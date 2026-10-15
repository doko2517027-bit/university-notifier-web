import { RULES, STAGE, CPU_PROFILES } from './config.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const length = (x, z) => Math.hypot(x, z);
const inRect = (x, z, r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function segmentIntersectsBox(a, b, box, pad = 0) {
  let near = 0;
  let far = 1;
  for (const [axis, low, high] of [
    ['x', box.x - box.w / 2 - pad, box.x + box.w / 2 + pad],
    ['z', box.z - box.d / 2 - pad, box.z + box.d / 2 + pad],
    ['y', 0, box.h],
  ]) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-7) {
      if (a[axis] < low || a[axis] > high) return false;
      continue;
    }
    const t1 = (low - a[axis]) / delta;
    const t2 = (high - a[axis]) / delta;
    near = Math.max(near, Math.min(t1, t2));
    far = Math.min(far, Math.max(t1, t2));
    if (near > far) return false;
  }
  return far > 0 && near < 1;
}

function collides(x, z, radius = RULES.actorRadius) {
  return STAGE.obstacles.some((o) =>
    x + radius > o.x - o.w / 2 && x - radius < o.x + o.w / 2 &&
    z + radius > o.z - o.d / 2 && z - radius < o.z + o.d / 2
  );
}

function newActor(id, name, color, cpu, profile, spawn) {
  return {
    id, name, color, cpu, profile, x: spawn.x, z: spawn.z,
    vx: 0, vz: 0, speed: 0, eliminated: false, moving: false,
    facing: 0, reactionLeft: 0, wander: 0, observation: null,
  };
}

export class DarumaMatch {
  constructor({ playerCount = 4, role = 'runner', random = Math.random } = {}) {
    this.random = random;
    this.playerCount = clamp(Math.floor(playerCount), RULES.minPlayers, RULES.maxPlayers);
    this.requestedRole = role;
    this.round = 0;
    this.events = [];
    this.startRound();
  }

  startRound(oniId = null) {
    this.round += 1;
    this.events = [];
    const chosenRole = this.requestedRole === 'random'
      ? (this.random() < 0.5 ? 'oni' : 'runner') : this.requestedRole;
    this.actors = [newActor('player', 'あなた', 0xe76b70, false, null, STAGE.runnerSpawns[0])];
    for (let i = 1; i < this.playerCount; i++) {
      const profile = CPU_PROFILES[(i - 1) % CPU_PROFILES.length];
      this.actors.push(newActor(`cpu-${i}`, profile.name, profile.color, true, profile, STAGE.runnerSpawns[i - 1]));
    }
    this.oniId = oniId || (chosenRole === 'oni' ? 'player' : this.actors[1].id);
    const oni = this.oni;
    oni.x = STAGE.oniSpawn.x;
    oni.z = STAGE.oniSpawn.z;
    oni.facing = 0;
    for (let i = 0; i < this.runners.length; i++) {
      const runner = this.runners[i];
      Object.assign(runner, STAGE.runnerSpawns[i]);
      runner.vx = runner.vz = runner.speed = 0;
      runner.eliminated = false;
      runner.reactionLeft = 0;
      runner.observation = null;
    }
    this.oniLives = RULES.oniLives;
    this.looking = false;
    this.lookTime = 0;
    this.turnCooldown = 1;
    this.status = 'playing';
    this.winner = null;
    this.endReason = null;
    this.elapsed = 0;
    this.cpuOniDecision = 1.5;
    this.events.push({ type: 'round', text: `第${this.round}ラウンド開始 — ${oni.name}が鬼です`, at: 0 });
  }

  get oni() { return this.actors.find((a) => a.id === this.oniId); }
  get player() { return this.actors[0]; }
  get runners() { return this.actors.filter((a) => a.id !== this.oniId); }
  get aliveRunners() { return this.runners.filter((a) => !a.eliminated); }

  turnOni() {
    if (this.status !== 'playing' || this.looking || this.turnCooldown > 0) return false;
    this.looking = true;
    this.lookTime = RULES.oniLookSeconds;
    this.oni.facing = Math.PI;
    for (const runner of this.runners) runner.reactionLeft = runner.profile?.reaction || 0;
    this.events.push({ type: 'turn', text: '鬼が振り向いた！', at: this.elapsed });
    return true;
  }

  lowerOni() {
    if (this.status !== 'playing' || !this.looking) return false;
    this.looking = false;
    this.lookTime = 0;
    this.turnCooldown = RULES.oniTurnCooldown;
    this.oni.facing = 0;
    this.events.push({ type: 'lower', text: '鬼は背を向けた', at: this.elapsed });
    return true;
  }

  visiblePoint(target, point = { x: target.x, y: 1.45, z: target.z }) {
    if (!this.looking || target.eliminated || target.id === this.oniId) return false;
    const eye = { x: this.oni.x, y: RULES.eyeHeight, z: this.oni.z + 0.35 };
    if (distance(this.oni, target) > RULES.accuseRange) return false;
    // The oni's actual body view is authoritative, never the local camera.
    const angle = Math.atan2(point.x - eye.x, point.z - eye.z);
    if (Math.abs(angle) > Math.PI * 0.44) return false;
    return !STAGE.obstacles.some((o) => segmentIntersectsBox(eye, point, o));
  }

  visible(target) {
    return [0.65, 1.25, 1.85].some((y) =>
      this.visiblePoint(target, { x: target.x, y, z: target.z }));
  }

  accuse(targetId, point) {
    if (this.status !== 'playing' || !this.looking) return { accepted: false, reason: 'not-looking' };
    const target = this.runners.find((a) => a.id === targetId && !a.eliminated);
    if (!target || !this.visiblePoint(target, point || { x: target.x, y: 1.45, z: target.z })) {
      return { accepted: false, reason: 'not-visible' };
    }
    const correct = target.speed > RULES.movementThreshold;
    if (correct) target.eliminated = true;
    else this.oniLives -= 1;
    const result = { accepted: true, correct, targetId, oniLives: this.oniLives };
    this.events.push({ type: 'accuse', text: correct
      ? `正解！ ${target.name}は動いていました` : `不正解！ ${target.name}は止まっていました`, at: this.elapsed, ...result });
    if (this.oniLives <= 0) this.finish('runners', '鬼の残機がなくなりました');
    else if (!this.aliveRunners.length) this.finish('oni', '逃走者が全員脱落しました');
    return result;
  }

  touch(actorId) {
    if (this.status !== 'playing') return false;
    const actor = this.runners.find((a) => a.id === actorId && !a.eliminated);
    if (!actor || distance(actor, this.oni) > RULES.touchRange) return false;
    this.finish('runners', `${actor.name}が鬼にタッチしました`);
    return true;
  }

  finish(winner, reason) {
    if (this.status !== 'playing') return;
    this.status = 'ended';
    this.winner = winner;
    this.endReason = reason;
    this.events.push({ type: 'end', text: reason, winner, at: this.elapsed });
  }

  nextRound(continueOni = true) {
    if (this.status !== 'ended') return false;
    let next = this.oniId;
    if (!continueOni || this.oniLives <= 0) {
      const choices = this.actors.filter((a) => a.id !== this.oniId);
      next = choices[Math.floor(this.random() * choices.length)].id;
    }
    this.startRound(next);
    return true;
  }

  move(actor, input, dt) {
    if (actor.eliminated || actor.id === this.oniId) return;
    const oldX = actor.x, oldZ = actor.z;
    const onIce = inRect(actor.x, actor.z, STAGE.ice);
    const friction = onIce ? RULES.iceFriction : RULES.normalFriction;
    const x = clamp(Number(input.x) || 0, -1, 1);
    const z = clamp(Number(input.z) || 0, -1, 1);
    const magnitude = Math.max(1, length(x, z));
    const speed = (input.dash ? RULES.dashSpeed : RULES.walkSpeed) * (actor.profile?.speed || 1);
    const targetX = x / magnitude * speed, targetZ = z / magnitude * speed;
    const rate = (x || z) ? RULES.acceleration : friction;
    actor.vx += clamp(targetX - actor.vx, -rate * dt, rate * dt);
    actor.vz += clamp(targetZ - actor.vz, -rate * dt, rate * dt);
    const belt = inRect(actor.x, actor.z, STAGE.belt) ? STAGE.belt : null;
    const stepX = (actor.vx + (belt?.vx || 0)) * dt;
    const stepZ = (actor.vz + (belt?.vz || 0)) * dt;
    const nextX = clamp(actor.x + stepX, STAGE.bounds.minX + 0.5, STAGE.bounds.maxX - 0.5);
    if (!collides(nextX, actor.z)) actor.x = nextX;
    else actor.vx = 0;
    const nextZ = clamp(actor.z + stepZ, STAGE.bounds.minZ + 0.5, STAGE.bounds.maxZ - 0.5);
    if (!collides(actor.x, nextZ)) actor.z = nextZ;
    else actor.vz = 0;
    actor.speed = length(actor.x - oldX, actor.z - oldZ) / dt;
    actor.moving = actor.speed > RULES.movementThreshold;
    if (actor.moving) actor.facing = Math.atan2(actor.x - oldX, -(actor.z - oldZ));
  }

  cpuRunnerInput(actor) {
    if (this.looking && actor.reactionLeft <= 0 && this.visible(actor)) return { x: 0, z: 0, dash: false };
    if (this.looking && actor.reactionLeft <= 0 && this.random() > actor.profile.risk) {
      return { x: 0, z: 0, dash: false };
    }
    const routeX = actor.z > 2 ? actor.profile.route : (actor.z > -17 ? actor.profile.route * 0.7 : 0);
    const dx = routeX - actor.x;
    let dz = -1;
    // Steer around solid geometry without reading the oni's movement verdict.
    const aheadZ = actor.z - 1.2;
    if (collides(actor.x, aheadZ, 0.55)) {
      const leftFree = !collides(actor.x - 1.3, aheadZ, 0.55);
      const rightFree = !collides(actor.x + 1.3, aheadZ, 0.55);
      return { x: leftFree ? -1 : (rightFree ? 1 : (actor.x < 0 ? -1 : 1)), z: -0.35, dash: false };
    }
    return { x: clamp(dx * 0.45, -1, 1), z: dz, dash: actor.profile.speed > 1 && actor.z > 4 };
  }

  cpuOniTick(dt) {
    if (this.oniId === 'player') return;
    this.cpuOniDecision -= dt;
    if (!this.looking && this.cpuOniDecision <= 0) {
      this.turnOni();
      this.cpuOniDecision = 2.2 + this.random() * 1.8;
    }
    if (!this.looking) return;
    for (const target of this.aliveRunners) {
      if (!this.visible(target)) { target.observation = null; continue; }
      const previous = target.observation;
      // The CPU observes positions through line of sight; it never reads speed for deciding.
      const observed = previous && this.elapsed - previous.at > 0.12
        ? distance(target, previous) / (this.elapsed - previous.at) : 0;
      if (!previous || this.elapsed - previous.at > 0.16) target.observation = { x: target.x, z: target.z, at: this.elapsed };
      if (observed > 0.42 && this.random() < 0.022) {
        this.accuse(target.id);
        break;
      }
    }
    if (this.cpuOniDecision <= 0.4 && this.random() < 0.007) {
      const visible = this.aliveRunners.filter((a) => this.visible(a));
      if (visible.length) this.accuse(visible[Math.floor(this.random() * visible.length)].id);
    }
    if (this.cpuOniDecision <= 0) this.lowerOni();
  }

  tick(dt, playerInput = { x: 0, z: 0, dash: false }) {
    if (this.status !== 'playing') return;
    dt = clamp(dt, 0.001, 0.05);
    this.elapsed += dt;
    this.turnCooldown = Math.max(0, this.turnCooldown - dt);
    if (this.looking) {
      this.lookTime -= dt;
      if (this.lookTime <= 0) this.lowerOni();
    }
    // All positions and velocities are updated before accusation decisions.
    for (const actor of this.runners) {
      actor.reactionLeft = Math.max(0, actor.reactionLeft - dt);
      this.move(actor, actor.cpu ? this.cpuRunnerInput(actor) : playerInput, dt);
      if (actor.cpu && distance(actor, this.oni) <= RULES.touchRange) this.touch(actor.id);
    }
    if (this.status === 'playing') this.cpuOniTick(dt);
  }
}
