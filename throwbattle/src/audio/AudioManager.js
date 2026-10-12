import { ASSETS } from '../data/config.js';

export class AudioManager {
  constructor() {
    this.bgm = null;
    this.effects = new Set();
    this.volume = { bgm: 0.45, effect: 0.7 };
  }

  playBgm() {
    if (!ASSETS.audio.bgm || this.bgm) return;
    this.bgm = new Audio(ASSETS.audio.bgm);
    this.bgm.loop = true;
    this.bgm.volume = this.volume.bgm;
    this.bgm.play().catch(() => {});
  }

  play(name) {
    const path = ASSETS.audio[name];
    if (!path) return;
    const effect = new Audio(path);
    effect.volume = this.volume.effect;
    this.effects.add(effect);
    effect.addEventListener('ended', () => this.effects.delete(effect), { once: true });
    effect.play().catch(() => this.effects.delete(effect));
  }

  stop() {
    this.bgm?.pause();
    this.bgm = null;
    for (const effect of this.effects) effect.pause();
    this.effects.clear();
  }
}
