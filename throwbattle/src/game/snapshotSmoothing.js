const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

function blendItems(older, newer, t) {
  const byId = new Map(older.map((item) => [item.id, item]));
  return newer.map((item) => {
    const before = byId.get(item.id);
    if (!before) return item;
    const position = { ...item, x: lerp(before.x, item.x, t), y: lerp(before.y, item.y, t), z: lerp(before.z, item.z, t) };
    if (Number.isFinite(item.yaw) && Number.isFinite(before.yaw)) position.yaw = lerpAngle(before.yaw, item.yaw, t);
    return position;
  });
}

export function interpolateBattleState(older, newer, ratio) {
  const t = Math.max(0, Math.min(1, ratio));
  return {
    ...newer,
    players: blendItems(older.players, newer.players, t),
    projectiles: blendItems(older.projectiles, newer.projectiles, t),
  };
}

// Interpolate only visual positions. Never use sampled HP or damage for game rules.
export class SnapshotSmoother {
  constructor({ delayMs = 100, limit = 8 } = {}) {
    this.delayMs = delayMs;
    this.limit = limit;
    this.frames = [];
  }

  push(state, receivedAt) {
    if (this.frames.length && state.matchId !== this.frames.at(-1).state.matchId) this.frames = [];
    this.frames.push({ state, receivedAt });
    if (this.frames.length > this.limit) this.frames.shift();
  }

  sample(now) {
    if (!this.frames.length) return null;
    const target = now - this.delayMs;
    if (this.frames.length === 1 || target <= this.frames[0].receivedAt) return this.frames[0].state;
    for (let index = 1; index < this.frames.length; index++) {
      const newer = this.frames[index];
      if (target > newer.receivedAt) continue;
      const older = this.frames[index - 1];
      const gap = Math.max(1, newer.receivedAt - older.receivedAt);
      return interpolateBattleState(older.state, newer.state, (target - older.receivedAt) / gap);
    }
    return this.frames.at(-1).state;
  }
}
