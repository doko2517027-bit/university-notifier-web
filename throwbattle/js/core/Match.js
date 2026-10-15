import { RULES, STAGE, WEAPONS, SKILLS, ARMORS, CPU_LEVELS } from '../data.js';

const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const overlap = (a1, a2, b1, b2) => a1 < b2 && a2 > b1;

function fighter(id, character, spawn) {
  return {
    id, character, x: spawn.x, y: spawn.y, vx: 0, vy: 0, facing: id === 'player' ? 1 : -1,
    hp: character.maxHp, maxHp: character.maxHp, stocks: RULES.stocks, grounded: false, standingPlatform: null,
    alive: true, respawnLeft: 0, invulnerable: 0, hitFlash: 0, attackLeft: 0,
    skillLeft: 0, boostLeft: 0, dodgeLeft: 0, dodgeCooldown: 0, pose: 'idle', poseTime: 0, actionPoseLeft: 0,
    deathPoseLeft: 0, pendingThrow: null,
    kills: 0, damageDone: 0, heldWeapon: character.weaponId, lastInput: { move: 0 },
  };
}

export class Match {
  constructor({ character, cpuCharacter = character, difficulty = 'normal', stage = STAGE, random = Math.random }) {
    this.rules = RULES;
    this.stage = structuredClone(stage);
    this.player = fighter('player', character, stage.spawn.player);
    this.cpu = fighter('cpu', cpuCharacter, stage.spawn.cpu);
    this.difficulty = CPU_LEVELS[difficulty] || CPU_LEVELS.normal;
    this.random = random;
    this.projectiles = [];
    this.effects = [];
    this.events = [];
    this.elapsed = 0;
    this.remaining = RULES.matchSeconds;
    this.finished = false;
    this.winner = null;
    this.finishReason = null;
    this.paused = false;
    this.hitStop = 0;
    this.cpuThink = 0;
    this.cpuInput = { move: 0 };
    this.cpuAttackAt = 0;
  }

  get fighters() { return [this.player, this.cpu]; }

  emit(type, data = {}) { this.events.push({ type, ...data }); }

  consumeEvents() { return this.events.splice(0); }

  tick(rawDt, playerInput = {}) {
    if (this.paused) return;
    const dt = clamp(rawDt, 0, 0.05);
    if (this.finished) {
      for (const f of this.fighters) {
        if (f.pose === 'victory' || f.pose === 'death') f.poseTime += dt;
        f.deathPoseLeft = Math.max(0, f.deathPoseLeft - dt);
      }
      return;
    }
    if (this.hitStop > 0) { this.hitStop -= dt; return; }
    this.elapsed += dt;
    this.remaining = Math.max(0, this.remaining - dt);
    this.updatePlatforms();
    this.cpuThink -= dt;
    if (this.cpuThink <= 0) {
      this.cpuInput = this.chooseCpuInput();
      this.cpuThink = this.difficulty.reaction;
    }
    this.updateFighter(this.player, playerInput, dt);
    this.updateFighter(this.cpu, this.cpuInput, dt);
    this.cpuInput.attack = false;
    this.cpuInput.skill = false;
    this.cpuInput.jump = false;
    this.cpuInput.dodge = false;
    this.updateProjectiles(dt);
    this.effects = this.effects.filter((effect) => (effect.time -= dt) > 0);
    if (!this.finished && this.remaining <= 0) {
      const p = this.player; const c = this.cpu;
      const playerScore = p.stocks * 1000 + p.hp;
      const cpuScore = c.stocks * 1000 + c.hp;
      this.finish(playerScore === cpuScore ? null : playerScore > cpuScore ? 'player' : 'cpu', 'time');
    }
  }

  updatePlatforms() {
    for (const platform of this.stage.platforms) {
      if (platform.type === 'moving') {
        platform.previousX = platform.currentX ?? platform.x;
        platform.currentX = platform.x + Math.sin(this.elapsed * platform.speed) * platform.range;
      }
    }
  }

  chooseCpuInput() {
    const cpu = this.cpu; const target = this.player;
    if (!cpu.alive || !target.alive) return { move: 0 };
    const dx = target.x - cpu.x;
    let move = Math.abs(dx) > 250 ? Math.sign(dx) : Math.abs(dx) < 160 ? -Math.sign(dx) : 0;
    // The center gap is dangerous. Jump across it rather than running off the ledge.
    const approachingGap = (move > 0 && cpu.x > 620 && cpu.x < 900) || (move < 0 && cpu.x < 980 && cpu.x > 710);
    const nearOuterEdge = (move < 0 && cpu.x < 170) || (move > 0 && cpu.x > 1430);
    if (nearOuterEdge) move = -move;
    // A ranged CPU can hold the opposite ledge and fight across the central
    // gap. Chasing into the pit made unattended matches end without combat.
    if (cpu.x >= 890 && target.x <= 710 && cpu.x <= 1005) move = 0;
    if (cpu.x <= 710 && target.x >= 890 && cpu.x >= 595) move = 0;
    const danger = this.projectiles.some((p) => p.owner !== cpu.id && Math.abs(p.x - cpu.x) < 180 && Math.abs(p.y - (cpu.y - 70)) < 90);
    const attack = Math.abs(dx) < 680 && Math.abs(target.y - cpu.y) < 210 &&
      this.elapsed >= this.cpuAttackAt && this.random() < this.difficulty.accuracy;
    if (attack) this.cpuAttackAt = this.elapsed + (this.difficulty === CPU_LEVELS.easy ? 2.1 : this.difficulty === CPU_LEVELS.hard ? 0.95 : 1.55);
    return {
      move,
      jump: cpu.grounded && (approachingGap || (target.y < cpu.y - 95 && this.random() < this.difficulty.aggression)),
      attack,
      skill: Math.abs(dx) < 660 && this.random() < this.difficulty.aggression * 0.32,
      dodge: danger && this.random() < this.difficulty.aggression,
    };
  }

  updateFighter(f, input, dt) {
    if (!f.alive) {
      f.deathPoseLeft = Math.max(0, f.deathPoseLeft - dt);
      if (f.deathPoseLeft > 0) f.poseTime += dt;
      if (f.stocks > 0) {
        f.respawnLeft -= dt;
        if (f.respawnLeft <= 0) this.respawn(f);
      }
      return;
    }
    f.invulnerable = Math.max(0, f.invulnerable - dt);
    f.hitFlash = Math.max(0, f.hitFlash - dt);
    f.attackLeft = Math.max(0, f.attackLeft - dt);
    f.skillLeft = Math.max(0, f.skillLeft - dt);
    f.boostLeft = Math.max(0, f.boostLeft - dt);
    f.actionPoseLeft = Math.max(0, f.actionPoseLeft - dt);
    f.dodgeCooldown = Math.max(0, f.dodgeCooldown - dt);
    f.dodgeLeft = Math.max(0, f.dodgeLeft - dt);
    if (f.pendingThrow) {
      f.pendingThrow.delay -= dt;
      if (f.pendingThrow.delay <= 0) {
        this.throwWeapon(f, false, true);
        f.pendingThrow = null;
      }
    }
    const move = clamp(Number(input.move) || 0, -1, 1);
    if (f.grounded && f.standingPlatform?.type === 'moving') {
      f.x += (f.standingPlatform.currentX ?? f.standingPlatform.x) - (f.standingPlatform.previousX ?? f.standingPlatform.x);
    }
    if (Math.abs(move) > 0.12) f.facing = Math.sign(move);
    if (input.dodge && f.dodgeCooldown <= 0) {
      f.dodgeLeft = RULES.dodgeSeconds;
      f.dodgeCooldown = RULES.dodgeCooldown;
      f.invulnerable = Math.max(f.invulnerable, RULES.dodgeSeconds);
      f.pose = 'dodge'; f.poseTime = 0;
      f.actionPoseLeft = Math.max(f.actionPoseLeft, 4 / 12);
      f.pendingThrow = null;
      this.emit('dodge', { id: f.id });
    }
    const speed = f.character.moveSpeed;
    const targetVx = f.dodgeLeft > 0 ? f.facing * speed * 2.4 : move * speed;
    f.vx += clamp(targetVx - f.vx, -2200 * dt, 2200 * dt);
    if (input.jump && f.grounded) {
      f.vy = -f.character.jumpPower;
      f.grounded = false;
      f.standingPlatform = null;
      this.emit('jump', { id: f.id });
    }
    if (input.skill && f.skillLeft <= 0 && !f.pendingThrow && f.actionPoseLeft <= 0) {
      const skill = SKILLS[f.character.skillId];
      f.skillLeft = skill?.cooldown || RULES.skillCooldown;
      f.boostLeft = skill?.duration || 0;
      f.pose = 'skill'; f.poseTime = 0;
      f.actionPoseLeft = (f.character.sprite?.animations?.skill?.frames?.length || 4) / (f.character.sprite?.animations?.skill?.fps || 12);
      this.effects.push({ x: f.x, y: f.y - 85, time: 0.42, maxTime: 0.42, kind: 'skill' });
      this.emit('skill', { id: f.id, duration: f.boostLeft });
    } else if (input.attack && f.attackLeft <= 0 && !f.pendingThrow && f.actionPoseLeft <= 0) {
      const animation = f.character.sprite?.animations?.attack;
      const releaseFrame = animation?.available && Number.isInteger(animation.releaseFrame) ? animation.releaseFrame : 0;
      if (releaseFrame > 0) {
        f.attackLeft = WEAPONS[f.heldWeapon]?.cooldown || 0.6;
        f.pendingThrow = { delay: releaseFrame / animation.fps };
        f.pose = 'attack'; f.poseTime = 0;
        f.actionPoseLeft = animation.frames.length / animation.fps;
      } else this.throwWeapon(f, false);
    }
    const previousY = f.y;
    f.x += f.vx * dt;
    f.vy = Math.min(f.vy + RULES.gravity * dt, 1450);
    f.y += f.vy * dt;
    f.grounded = false;
    f.standingPlatform = null;
    if (f.vy >= 0) {
      for (const p of this.stage.platforms) {
        const px = p.currentX ?? p.x;
        if (previousY <= p.y + 10 && f.y >= p.y && overlap(f.x - f.character.hitbox.width / 2, f.x + f.character.hitbox.width / 2, px, px + p.width)) {
          f.y = p.y; f.vy = 0; f.grounded = true; f.standingPlatform = p;
          break;
        }
      }
    }
    if (f.y > RULES.deathY || f.x < -100 || f.x > RULES.stageWidth + 100) {
      this.kill(f, 'pit');
      return;
    }
    const nextPose = f.hitFlash ? 'hit' : f.dodgeLeft ? 'dodge' : f.actionPoseLeft ? f.pose : !f.grounded ? f.vy < 0 ? 'jump' : 'fall' : Math.abs(f.vx) > 50 ? 'run' : 'idle';
    if (nextPose !== f.pose) { f.pose = nextPose; f.poseTime = 0; } else f.poseTime += dt;
  }

  throwWeapon(f, skill, queued = false) {
    const weapon = WEAPONS[f.heldWeapon];
    if (!weapon) return;
    const boost = skill || f.boostLeft > 0 ? SKILLS[f.character.skillId] : null;
    const sprite = f.character.sprite;
    const attack = sprite?.animations?.attack;
    const releaseFile = attack?.frames?.[attack.releaseFrame ?? 0];
    const hand = (queued && sprite?.anchors?.attack?.[releaseFile]?.hand) || sprite?.anchors?.default?.hand || { x: 40, y: -90 };
    const cpuScale = f.id === 'cpu' ? (this.difficulty === CPU_LEVELS.easy ? 0.55 : this.difficulty === CPU_LEVELS.hard ? 1 : 0.72) : 1;
    this.projectiles.push({
      owner: f.id, x: f.x + hand.x * f.facing, y: f.y + hand.y,
      vx: f.facing * weapon.speed * (boost?.speedMultiplier || 1), vy: -145,
      age: 0, rotation: 0, weaponId: weapon.id,
      damage: Math.round(weapon.damage * (f.character.attackMultiplier || 1) * (boost?.damageMultiplier || 1) * cpuScale),
      knockbackX: weapon.knockbackX * (boost ? 1.2 : 1) * cpuScale, knockbackY: weapon.knockbackY * cpuScale,
    });
    if (!queued) {
      f.attackLeft = weapon.cooldown;
      f.pose = skill ? 'skill' : 'attack'; f.poseTime = 0;
      f.actionPoseLeft = 0.28;
    }
    this.emit('throw', { id: f.id, boosted: Boolean(boost) });
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      const weapon = WEAPONS[p.weaponId];
      p.age += dt; p.x += p.vx * dt; p.vy += weapon.gravity * dt; p.y += p.vy * dt; p.rotation += weapon.spin * dt;
      const target = p.owner === 'player' ? this.cpu : this.player;
      if (target.alive && target.invulnerable <= 0 &&
          overlap(p.x - weapon.hitbox.width / 2, p.x + weapon.hitbox.width / 2, target.x - target.character.hitbox.width / 2, target.x + target.character.hitbox.width / 2) &&
          overlap(p.y - weapon.hitbox.height / 2, p.y + weapon.hitbox.height / 2, target.y - target.character.hitbox.height, target.y)) {
        this.hit(target, p); p.age = 999;
      }
      if (this.stage.platforms.some((platform) => {
        if (platform.type !== 'solid') return false;
        const px = platform.currentX ?? platform.x;
        return p.x >= px && p.x <= px + platform.width && p.y >= platform.y && p.y <= platform.y + platform.height;
      })) p.age = 999;
    }
    this.projectiles = this.projectiles.filter((p) => p.age < 2.5 && p.x > -50 && p.x < RULES.stageWidth + 50 && p.y < RULES.deathY);
  }

  hit(target, projectile) {
    if (!target.alive || target.invulnerable > 0) return false;
    const source = projectile.owner === 'player' ? this.player : this.cpu;
    const armorDefense = (target.character.equippedArmorIds || []).reduce((total, id) => total + (ARMORS[id]?.defense || 0), 0);
    const dealt = Math.max(1, projectile.damage - (target.character.defense || 0) - armorDefense);
    target.hp = Math.max(0, target.hp - dealt);
    source.damageDone += dealt;
    const weight = Math.max(0.5, target.character.weight || 1);
    target.vx = Math.sign(projectile.vx) * projectile.knockbackX / weight;
    target.vy = -projectile.knockbackY / weight;
    target.grounded = false;
    target.hitFlash = 0.27;
    target.pose = 'hit'; target.poseTime = 0;
    target.actionPoseLeft = (target.character.sprite?.animations?.hit?.frames?.length || 3) / (target.character.sprite?.animations?.hit?.fps || 10);
    target.invulnerable = RULES.hitInvincibleSeconds;
    this.hitStop = 0.045;
    this.effects.push({ x: target.x, y: target.y - 75, time: 0.28, maxTime: 0.28, kind: 'hit' });
    this.emit('hit', { id: target.id, damage: dealt });
    if (target.hp <= 0) this.kill(target, 'hp');
    return true;
  }

  kill(f, reason) {
    if (!f.alive) return;
    f.alive = false; f.hp = 0; f.vx = 0; f.vy = 0; f.stocks--;
    f.pendingThrow = null; f.boostLeft = 0;
    f.pose = 'death'; f.poseTime = 0;
    f.deathPoseLeft = reason === 'pit' ? 0 : (f.character.sprite?.animations?.death?.frames?.length || 4) / (f.character.sprite?.animations?.death?.fps || 10);
    const other = f.id === 'player' ? this.cpu : this.player;
    other.kills++;
    this.emit('death', { id: f.id, reason });
    if (f.stocks <= 0) this.finish(other.id, reason);
    else f.respawnLeft = RULES.respawnSeconds;
  }

  respawn(f) {
    const spawn = this.stage.spawn[f.id];
    f.x = spawn.x; f.y = spawn.y; f.vx = 0; f.vy = 0;
    f.hp = f.maxHp; f.alive = true; f.grounded = false; f.respawnLeft = 0;
    f.standingPlatform = null;
    f.invulnerable = RULES.invincibleSeconds; f.pose = 'respawn'; f.poseTime = 0;
    f.deathPoseLeft = 0; f.pendingThrow = null;
    f.actionPoseLeft = (f.character.sprite?.animations?.respawn?.frames?.length || 4) / (f.character.sprite?.animations?.respawn?.fps || 10);
    this.emit('respawn', { id: f.id });
  }

  finish(winner, reason) {
    if (this.finished) return;
    this.finished = true; this.winner = winner; this.finishReason = reason;
    const victor = winner === 'player' ? this.player : winner === 'cpu' ? this.cpu : null;
    if (victor?.alive) { victor.pose = 'victory'; victor.poseTime = 0; }
    this.emit('finish', { winner, reason });
  }
}
