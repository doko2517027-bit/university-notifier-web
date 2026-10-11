const STORAGE_KEY = "caremate_mediguard_audio_v1";

const DEFAULTS = Object.freeze({ bgm: true, sfx: true, volume: 0.7 });

function readSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      bgm: stored.bgm !== false,
      sfx: stored.sfx !== false,
      volume: Math.max(0, Math.min(1, Number.isFinite(Number(stored.volume)) ? Number(stored.volume) : DEFAULTS.volume)),
    };
  } catch (_) {
    return { ...DEFAULTS };
  }
}

class MediguardAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.music = null;
    this.settings = readSettings();
    this.theme = "";
    this.timer = 0;
    this.step = 0;
    this.nextNoteAt = 0;
  }

  async unlock() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    if (!this.context) {
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.music = this.context.createGain();
      this.music.connect(this.master);
      this.master.connect(this.context.destination);
      this.applyVolume();
    }
    if (this.context.state === "suspended") await this.context.resume();
    return true;
  }

  applyVolume() {
    if (!this.master || !this.context) return;
    this.master.gain.setTargetAtTime(this.settings.volume, this.context.currentTime, 0.02);
    this.music.gain.setTargetAtTime(this.settings.bgm ? 0.2 : 0, this.context.currentTime, 0.04);
  }

  update(next) {
    this.settings = { ...this.settings, ...next };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    this.applyVolume();
    if (!this.settings.bgm) this.stopMusic();
    else if (this.theme) this.playMusic(this.theme);
    return { ...this.settings };
  }

  tone(frequency, duration = 0.08, options = {}) {
    if (!this.context || !this.settings.sfx) return;
    const now = this.context.currentTime + Number(options.delay || 0);
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = options.type || "sine";
    oscillator.frequency.setValueAtTime(Math.max(35, frequency), now);
    if (options.to) oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, options.to), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, Number(options.gain || 0.12)), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  sfx(name, rarity = "N") {
    if (!this.context || !this.settings.sfx) return;
    const sounds = {
      button: () => this.tone(420, 0.055, { to: 560, gain: 0.07, type: "triangle" }),
      open: () => [330, 440, 660].forEach((note, index) => this.tone(note, 0.11, { delay: index * 0.055, gain: 0.075, type: "triangle" })),
      shoot: () => this.tone(620, 0.07, { to: 240, gain: 0.055, type: "square" }),
      charge: () => [280, 420, 700].forEach((note, index) => this.tone(note, 0.13, { delay: index * 0.035, to: note * 1.4, gain: 0.065 })),
      skill: () => [220, 330, 495, 740].forEach((note, index) => this.tone(note, 0.18, { delay: index * 0.04, gain: 0.09, type: "sawtooth" })),
      danger: () => [150, 110].forEach((note, index) => this.tone(note, 0.25, { delay: index * 0.18, gain: 0.13, type: "square" })),
      hit: () => this.tone(150, 0.16, { to: 62, gain: 0.13, type: "sawtooth" }),
      win: () => [392, 523, 659, 784].forEach((note, index) => this.tone(note, 0.24, { delay: index * 0.11, gain: 0.1, type: "triangle" })),
      lose: () => [330, 247, 165].forEach((note, index) => this.tone(note, 0.28, { delay: index * 0.13, gain: 0.09, type: "triangle" })),
      gacha: () => [110, 165, 247, 370].forEach((note, index) => this.tone(note, 0.34, { delay: index * 0.12, to: note * 1.45, gain: 0.1, type: "sawtooth" })),
      reveal: () => {
        const rank = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4, LR: 5 }[rarity] || 0;
        const notes = [392, 523, 659, 784, 988, 1175].slice(0, Math.max(2, rank + 1));
        notes.forEach((note, index) => this.tone(note, 0.32, { delay: index * 0.07, gain: 0.08 + rank * 0.008, type: rank >= 3 ? "sawtooth" : "triangle" }));
      },
    };
    sounds[name]?.();
  }

  playMusic(theme = "home") {
    this.theme = theme;
    if (!this.context || !this.settings.bgm) return;
    clearInterval(this.timer);
    this.step = 0;
    this.nextNoteAt = this.context.currentTime + 0.05;
    const patterns = {
      title: { tempo: 420, bass: [131, 165, 196, 165], lead: [523, 659, 784, 659, 587, 659, 523, 440] },
      home: { tempo: 360, bass: [147, 196, 220, 196], lead: [587, 659, 784, 659, 523, 587, 659, 494] },
      battle: { tempo: 230, bass: [110, 110, 147, 165], lead: [440, 494, 523, 659, 523, 494, 440, 392] },
      gacha: { tempo: 290, bass: [123, 185, 165, 247], lead: [494, 740, 659, 988, 740, 659, 587, 740] },
    };
    const pattern = patterns[theme] || patterns.home;
    const schedule = () => {
      if (!this.context || !this.settings.bgm) return;
      while (this.nextNoteAt < this.context.currentTime + 0.2) {
        const lead = pattern.lead[this.step % pattern.lead.length];
        const bass = pattern.bass[Math.floor(this.step / 2) % pattern.bass.length];
        this.musicNote(lead, this.nextNoteAt, pattern.tempo / 1000 * 0.72, 0.055, "triangle");
        if (this.step % 2 === 0) this.musicNote(bass, this.nextNoteAt, pattern.tempo / 1000 * 1.6, 0.045, "sine");
        this.nextNoteAt += pattern.tempo / 1000;
        this.step += 1;
      }
    };
    schedule();
    this.timer = window.setInterval(schedule, 100);
  }

  musicNote(frequency, when, duration, volume, type) {
    if (!this.context || !this.music) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain);
    gain.connect(this.music);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.04);
  }

  stopMusic() {
    clearInterval(this.timer);
    this.timer = 0;
  }
}

export const mediguardAudio = new MediguardAudio();
