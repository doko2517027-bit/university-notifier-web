import { CONFIG } from '../data/config.js';

export class BattleSession {
  constructor({ rule = 'elimination', difficulty = 'normal', playerStats = {} } = {}) {
    this.rule = rule;
    this.difficulty = difficulty;
    this.elapsed = 0;
    this.remaining = CONFIG.matchSeconds;
    this.suddenDeath = false;
    this.finished = false;
    this.result = null;
    this.player = this.makeFighter('player', playerStats);
    this.cpu = this.makeFighter('cpu');
  }

  makeFighter(id, stats = {}) {
    const maxHp = Number.isFinite(stats.maxHp) ? Math.max(CONFIG.maxHealth, Math.min(500, stats.maxHp)) : CONFIG.maxHealth;
    const defense = Number.isFinite(stats.defense) ? Math.max(0, Math.min(100, stats.defense)) : 0;
    return { id, hp: maxHp, maxHp, defense, lives: CONFIG.lives, kills: 0, damage: 0, respawnAt: 0, invincibleUntil: 0 };
  }

  hit(targetId, amount, now = this.elapsed) {
    const target = this[targetId];
    const source = this[targetId === 'player' ? 'cpu' : 'player'];
    if (this.finished || target.lives <= 0 || target.respawnAt > now || target.invincibleUntil > now) return null;
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const actual = Math.min(target.hp, Math.max(1, Math.round(amount - target.defense)));
    if (!actual) return null;
    target.hp -= actual;
    source.damage += actual;
    if (target.hp > 0) return { kind: 'hit', targetId, amount: actual };
    target.lives--;
    source.kills++;
    if (target.lives > 0 && !this.suddenDeath) {
      target.respawnAt = now + CONFIG.respawnSeconds;
      return { kind: 'down', targetId, amount: actual };
    }
    this.finish(source.id, 'eliminated');
    return { kind: 'eliminated', targetId, amount: actual };
  }

  heal(targetId, amount) {
    const target = this[targetId];
    if (this.finished || target.lives <= 0 || target.respawnAt > this.elapsed) return 0;
    const applied = Math.min(target.maxHp - target.hp, amount);
    target.hp += applied;
    return applied;
  }

  tick(delta) {
    if (this.finished) return [];
    const events = [];
    this.elapsed += Math.max(0, Math.min(delta, 0.1));
    this.remaining = Math.max(0, this.remaining - Math.max(0, Math.min(delta, 0.1)));
    for (const fighter of [this.player, this.cpu]) {
      if (fighter.respawnAt > 0 && this.elapsed >= fighter.respawnAt) {
        fighter.respawnAt = 0;
        fighter.hp = fighter.maxHp;
        fighter.invincibleUntil = this.elapsed + CONFIG.invincibleSeconds;
        events.push({ kind: 'respawn', targetId: fighter.id });
      }
    }
    if (this.remaining > 0) return events;
    if (this.suddenDeath) {
      this.finish(null, 'sudden-death-timeout');
      return events;
    }
    const value = (fighter) => this.rule === 'kills' ? fighter.kills : fighter.lives;
    const difference = value(this.player) - value(this.cpu);
    if (difference !== 0) this.finish(difference > 0 ? 'player' : 'cpu', 'timeup');
    else {
      this.suddenDeath = true;
      this.remaining = CONFIG.suddenDeathSeconds;
      events.push({ kind: 'sudden-death' });
    }
    return events;
  }

  finish(winner, reason) {
    if (this.finished) return;
    this.finished = true;
    this.result = { winner, reason, player: { ...this.player }, cpu: { ...this.cpu } };
  }
}
