export class InputManager {
  constructor(root) {
    this.root = root;
    this.keys = new Set();
    this.touchMove = 0;
    this.stickPointer = null;
    this.heldAttack = new Set();
    this.queued = new Set();
    this.cleanups = [];
    this.bind();
  }

  listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.cleanups.push(() => target.removeEventListener(type, handler, options));
  }

  bind() {
    const accepted = new Set(['KeyA', 'KeyD', 'Space', 'KeyJ', 'KeyK', 'KeyL', 'Escape']);
    this.listen(window, 'keydown', (event) => {
      if (!accepted.has(event.code)) return;
      if (this.root.hidden) return;
      event.preventDefault();
      this.keys.add(event.code);
      if (!event.repeat) {
        const action = { Space: 'jump', KeyJ: 'attack', KeyK: 'skill', KeyL: 'dodge', Escape: 'pause' }[event.code];
        if (action) this.queued.add(action);
      }
    });
    this.listen(window, 'keyup', (event) => this.keys.delete(event.code));
    this.listen(window, 'blur', () => this.reset());
    this.listen(document, 'visibilitychange', () => { if (document.hidden) this.reset(); });
    const stick = document.getElementById('moveStick');
    const knob = document.getElementById('stickKnob');
    const update = (event) => {
      const rect = stick.getBoundingClientRect();
      const radius = rect.width * 0.32;
      const dx = Math.max(-radius, Math.min(radius, event.clientX - rect.left - rect.width / 2));
      this.touchMove = dx / radius;
      knob.style.transform = `translate(calc(-50% + ${dx}px), -50%)`;
    };
    this.listen(stick, 'pointerdown', (event) => {
      if (this.stickPointer !== null) return;
      event.preventDefault(); this.stickPointer = event.pointerId;
      stick.setPointerCapture(event.pointerId); update(event);
    });
    this.listen(stick, 'pointermove', (event) => { if (event.pointerId === this.stickPointer) update(event); });
    const resetStick = (event) => {
      if (event.pointerId !== this.stickPointer) return;
      this.stickPointer = null; this.touchMove = 0;
      knob.style.transform = 'translate(-50%, -50%)';
    };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.listen(stick, type, resetStick);
    for (const button of document.querySelectorAll('[data-game-action]')) {
      const action = button.dataset.gameAction;
      this.listen(button, 'pointerdown', (event) => {
        event.preventDefault(); button.setPointerCapture(event.pointerId);
        if (action === 'attack') { this.heldAttack.add(event.pointerId); this.queued.add('attack'); }
        else this.queued.add(action);
        button.classList.add('pressed');
      });
      const release = (event) => {
        if (action === 'attack') this.heldAttack.delete(event.pointerId);
        button.classList.remove('pressed');
      };
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.listen(button, type, release);
    }
  }

  snapshot() {
    const move = Math.max(-1, Math.min(1, Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')) + this.touchMove));
    const result = {
      move, attack: this.queued.has('attack') || this.keys.has('KeyJ') || this.heldAttack.size > 0,
      jump: this.queued.has('jump'), skill: this.queued.has('skill'),
      dodge: this.queued.has('dodge'), pause: this.queued.has('pause'),
    };
    this.queued.clear();
    return result;
  }

  reset() {
    this.keys.clear(); this.heldAttack.clear(); this.queued.clear();
    this.touchMove = 0; this.stickPointer = null;
    const knob = document.getElementById('stickKnob');
    if (knob) knob.style.transform = 'translate(-50%, -50%)';
  }

  destroy() { this.reset(); this.cleanups.forEach((cleanup) => cleanup()); this.cleanups = []; }
}
