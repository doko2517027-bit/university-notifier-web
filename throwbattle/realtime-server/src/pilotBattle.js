import { randomUUID } from 'node:crypto';
import { CONFIG, STAGES, WEAPONS } from '../../src/data/config.js';

const stage = STAGES.classroom;
const ZERO_INPUT = Object.freeze({ forward: 0, right: 0, yaw: 0, pitch: 0, dash: false, jump: false, fire: false, weapon: 0 });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function blocked(x, z, y) {
  if (Math.abs(x) >= stage.width / 2 - .75 || Math.abs(z) >= stage.depth / 2 - .75) return true;
  return stage.cover.some((box) => y < box.h - .08 && Math.abs(x - box.x) < box.w / 2 + .42 && Math.abs(z - box.z) < box.d / 2 + .42);
}

function projectileBlocked(x, y, z) {
  if (y < 0 || Math.abs(x) >= stage.width / 2 - .75 || Math.abs(z) >= stage.depth / 2 - .75) return true;
  return stage.cover.some((box) => x > box.x - box.w / 2 && x < box.x + box.w / 2 && z > box.z - box.d / 2 && z < box.z + box.d / 2 && y < box.h);
}

export function sanitizeBattleInput(raw) {
  const forward = clamp(finite(raw?.forward), -1, 1);
  const right = clamp(finite(raw?.right), -1, 1);
  const length = Math.max(1, Math.hypot(forward, right));
  return {
    forward: forward / length, right: right / length,
    yaw: clamp(finite(raw?.yaw), -Math.PI * 100, Math.PI * 100),
    pitch: clamp(finite(raw?.pitch), -1.1, 1.1),
    dash: raw?.dash === true, jump: raw?.jump === true, fire: raw?.fire === true,
    weapon: Number.isInteger(raw?.weapon) ? clamp(raw.weapon, 0, WEAPONS.length - 1) : 0,
  };
}

export class PilotBattle {
  constructor(players, { now = () => Date.now(), id = randomUUID() } = {}) {
    if (players.length < 2 || players.length > 8) throw new Error('battle-needs-players');
    this.id = id;
    this.now = now;
    this.elapsed = 0;
    this.countdown = 3;
    this.remaining = CONFIG.matchSeconds;
    this.players = new Map(players.map((entry, index) => [entry.id, {
      id: entry.id, name: entry.name,
      x: stage.spawns[index % stage.spawns.length].x,
      z: stage.spawns[index % stage.spawns.length].z,
      y: 0, vy: 0, yaw: index % 2 ? Math.PI / 2 : -Math.PI / 2,
      hp: CONFIG.maxHealth, maxHp: CONFIG.maxHealth, lives: CONFIG.lives,
      kills: 0, damage: 0, respawnAt: 0, invincibleUntil: 0, lastShot: -10,
      input: ZERO_INPUT, lastInputAt: 0, jumpQueued: false,
    }]));
    this.projectiles = [];
    this.result = null;
  }

  setInput(id, raw) {
    const player = this.players.get(id);
    if (!player || this.result) return false;
    player.input = sanitizeBattleInput(raw);
    player.jumpQueued ||= player.input.jump;
    player.lastInputAt = this.now();
    return true;
  }

  stopInput(id) {
    const player = this.players.get(id);
    if (!player) return;
    player.input = ZERO_INPUT;
    player.jumpQueued = false;
    player.lastInputAt = 0;
  }

  tick(delta) {
    if (this.result) return;
    const dt = clamp(finite(delta), 0, .1);
    if (this.countdown > 0) { this.countdown = Math.max(0, this.countdown - dt); return; }
    this.elapsed += dt;
    this.remaining = Math.max(0, this.remaining - dt);
    for (const player of this.players.values()) {
      if (player.respawnAt && this.elapsed >= player.respawnAt) {
        const index = [...this.players.keys()].indexOf(player.id);
        const spawn = stage.spawns[index % stage.spawns.length];
        Object.assign(player, { x: spawn.x, z: spawn.z, y: 0, vy: 0, hp: player.maxHp,
          respawnAt: 0, invincibleUntil: this.elapsed + CONFIG.invincibleSeconds });
      }
      if (player.lives <= 0 || player.respawnAt) continue;
      const input = this.now() - player.lastInputAt <= 500 ? player.input : ZERO_INPUT;
      player.yaw = input.yaw;
      const speed = CONFIG.walkSpeed * (input.dash ? CONFIG.dashMultiplier : 1);
      const dx = (-Math.sin(input.yaw) * input.forward + Math.cos(input.yaw) * input.right) * speed * dt;
      const dz = (-Math.cos(input.yaw) * input.forward - Math.sin(input.yaw) * input.right) * speed * dt;
      if (!blocked(player.x + dx, player.z, player.y)) player.x += dx;
      if (!blocked(player.x, player.z + dz, player.y)) player.z += dz;
      if (player.jumpQueued && player.y <= 0) player.vy = CONFIG.jumpVelocity;
      player.jumpQueued = false;
      player.vy -= CONFIG.gravity * dt;
      player.y = Math.max(0, player.y + player.vy * dt);
      if (player.y === 0) player.vy = 0;
      if (input.fire) this.fire(player, input);
    }
    this.moveProjectiles(dt);
    const alive = [...this.players.values()].filter((player) => player.lives > 0);
    if (alive.length <= 1) this.finish(alive[0]?.id || null, 'eliminated');
    else if (this.remaining === 0) {
      const sorted = [...this.players.values()].sort((a, b) => b.kills - a.kills || b.lives - a.lives || b.damage - a.damage);
      this.finish(sorted[0].kills === sorted[1].kills && sorted[0].lives === sorted[1].lives && sorted[0].damage === sorted[1].damage ? null : sorted[0].id, 'timeup');
    }
  }

  fire(player, input) {
    const weapon = WEAPONS[input.weapon];
    if (this.elapsed - player.lastShot < weapon.cooldown || this.projectiles.length > 100) return;
    player.lastShot = this.elapsed;
    const cp = Math.cos(input.pitch);
    const direction = { x: -Math.sin(input.yaw) * cp, y: Math.sin(input.pitch), z: -Math.cos(input.yaw) * cp };
    this.projectiles.push({ id: randomUUID(), owner: player.id, weapon: input.weapon,
      x: player.x + direction.x * .9, y: player.y + 1.52 + direction.y * .9,
      z: player.z + direction.z * .9, dx: direction.x, dy: direction.y, dz: direction.z, distance: 0 });
  }

  moveProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const shot = this.projectiles[i];
      const weapon = WEAPONS[shot.weapon];
      const travel = weapon.projectileSpeed * dt;
      const steps = Math.max(1, Math.ceil(travel / .32));
      let remove = false;
      for (let step = 0; step < steps && !remove; step++) {
        const part = travel / steps;
        shot.x += shot.dx * part; shot.y += shot.dy * part; shot.z += shot.dz * part;
        shot.distance += part;
        if (projectileBlocked(shot.x, shot.y, shot.z) || shot.distance > weapon.range) { remove = true; break; }
        for (const target of this.players.values()) {
          if (target.id === shot.owner || target.lives <= 0 || target.respawnAt || target.invincibleUntil > this.elapsed) continue;
          if (distance(shot, target) >= .56 || shot.y < target.y + .08 || shot.y > target.y + 2.55) continue;
          const owner = this.players.get(shot.owner);
          const headshot = shot.y > target.y + 1.78;
          const amount = Math.min(target.hp, Math.round(weapon.damage * (headshot ? CONFIG.headshotMultiplier : 1)));
          target.hp -= amount; owner.damage += amount;
          if (target.hp <= 0) {
            target.lives--; owner.kills++;
            if (target.lives > 0) target.respawnAt = this.elapsed + CONFIG.respawnSeconds;
          }
          remove = true;
          break;
        }
      }
      if (remove) this.projectiles.splice(i, 1);
    }
  }

  forfeit(id) {
    if (this.result || !this.players.has(id)) return;
    const remaining = [...this.players.keys()].filter((key) => key !== id);
    this.finish(remaining.length === 1 ? remaining[0] : null, 'disconnected');
  }

  finish(winner, reason) {
    if (this.result) return;
    this.result = { winner, reason, matchId: this.id,
      players: [...this.players.values()].map(({ id, name, kills, damage, lives }) => ({ id, name, kills, damage, lives })) };
  }

  snapshot() {
    return { matchId: this.id, countdown: Math.ceil(this.countdown), remaining: Math.ceil(this.remaining),
      players: [...this.players.values()].map(({ id, name, x, y, z, yaw, hp, maxHp, lives, kills, damage, respawnAt, invincibleUntil }) =>
        ({ id, name, x, y, z, yaw, hp, maxHp, lives, kills, damage,
          respawnSeconds: respawnAt ? Math.max(0, Math.ceil(respawnAt - this.elapsed)) : 0,
          invincible: invincibleUntil > this.elapsed })),
      projectiles: this.projectiles.map(({ id, x, y, z, weapon }) => ({ id, x, y, z, weapon })) };
  }
}
