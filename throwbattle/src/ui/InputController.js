export class InputController {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.joystick = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.firing = false;
    this.jumpQueued = false;
    this.toggleViewQueued = false;
    this.pauseQueued = false;
    this.selectedWeapon = 0;
    this.listeners = [];
    this.joystickPointer = null;
    this.lookPointer = null;
    this.firePointer = null;
    this.lastLook = null;
    this.bind();
  }

  on(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.listeners.push(() => target.removeEventListener(type, handler, options));
  }

  bind() {
    this.on(window, 'keydown', (event) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if (event.repeat) return;
      if (event.code === 'Space') this.jumpQueued = true;
      if (event.code === 'KeyV') this.toggleViewQueued = true;
      if (event.code === 'Escape') this.pauseQueued = true;
      if (/^Digit[123]$/.test(event.code)) this.selectedWeapon = Number(event.code.slice(-1)) - 1;
    });
    this.on(window, 'keyup', (event) => this.keys.delete(event.code));
    this.on(window, 'blur', () => this.reset());
    this.on(document, 'visibilitychange', () => { if (document.hidden) this.reset(); });
    this.on(this.canvas, 'pointerdown', (event) => {
      if (event.pointerType !== 'mouse') return;
      if (event.button === 0) {
        this.firing = true;
        this.canvas.requestPointerLock?.().catch(() => {});
      }
      if (event.button === 2) this.lastLook = [event.clientX, event.clientY];
    });
    this.on(window, 'pointerup', (event) => { if (event.pointerType === 'mouse' && event.button === 0) this.firing = false; });
    this.on(this.canvas, 'contextmenu', (event) => event.preventDefault());
    this.on(window, 'mousemove', (event) => {
      if (document.pointerLockElement === this.canvas) {
        this.look.x += event.movementX;
        this.look.y += event.movementY;
      } else if (event.buttons & 2 && this.lastLook) {
        this.look.x += event.clientX - this.lastLook[0];
        this.look.y += event.clientY - this.lastLook[1];
        this.lastLook = [event.clientX, event.clientY];
      } else this.lastLook = null;
    });

    const stick = document.getElementById('joystick');
    const knob = document.getElementById('joystickKnob');
    const updateStick = (event) => {
      const rect = stick.getBoundingClientRect();
      const radius = rect.width * 0.36;
      let x = event.clientX - (rect.left + rect.width / 2);
      let y = event.clientY - (rect.top + rect.height / 2);
      const length = Math.hypot(x, y);
      if (length > radius) { x *= radius / length; y *= radius / length; }
      this.joystick = { x: x / radius, y: -y / radius };
      knob.style.left = `calc(50% + ${x}px)`;
      knob.style.top = `calc(50% + ${y}px)`;
    };
    this.on(stick, 'pointerdown', (event) => {
      if (this.joystickPointer !== null) return;
      event.preventDefault();
      this.joystickPointer = event.pointerId;
      stick.setPointerCapture(event.pointerId);
      updateStick(event);
    });
    this.on(stick, 'pointermove', (event) => { if (event.pointerId === this.joystickPointer) updateStick(event); });
    const clearStick = (event) => {
      if (event.pointerId !== this.joystickPointer) return;
      this.joystickPointer = null;
      this.joystick = { x: 0, y: 0 };
      knob.style.left = '50%'; knob.style.top = '50%';
    };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.on(stick, type, clearStick);

    const lookArea = document.getElementById('lookArea');
    this.on(lookArea, 'pointerdown', (event) => {
      if (this.lookPointer !== null) return;
      this.lookPointer = event.pointerId;
      this.lastLook = [event.clientX, event.clientY];
      lookArea.setPointerCapture(event.pointerId);
    });
    this.on(lookArea, 'pointermove', (event) => {
      if (event.pointerId !== this.lookPointer || !this.lastLook) return;
      this.look.x += event.clientX - this.lastLook[0];
      this.look.y += event.clientY - this.lastLook[1];
      this.lastLook = [event.clientX, event.clientY];
    });
    const clearLook = (event) => { if (event.pointerId === this.lookPointer) { this.lookPointer = null; this.lastLook = null; } };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.on(lookArea, type, clearLook);

    const fireButton = document.getElementById('throwButton');
    this.on(fireButton, 'pointerdown', (event) => {
      if (this.firePointer !== null) return;
      event.preventDefault();
      this.firePointer = event.pointerId;
      fireButton.setPointerCapture(event.pointerId);
      this.firing = true;
    });
    const stopFire = (event) => { if (event.pointerId === this.firePointer) { this.firePointer = null; this.firing = false; } };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.on(fireButton, type, stopFire);
    this.on(document.getElementById('mobileJump'), 'pointerdown', (event) => { event.preventDefault(); this.jumpQueued = true; });
    const dash = document.getElementById('mobileDash');
    this.on(dash, 'pointerdown', (event) => { event.preventDefault(); dash.setPointerCapture(event.pointerId); this.keys.add('ShiftLeft'); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.on(dash, type, () => this.keys.delete('ShiftLeft'));
    this.on(document.getElementById('mobileView'), 'pointerdown', (event) => { event.preventDefault(); this.toggleViewQueued = true; });
  }

  get movement() {
    const forward = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) + this.joystick.y;
    const right = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) + this.joystick.x;
    const length = Math.max(1, Math.hypot(forward, right));
    return { forward: forward / length, right: right / length };
  }

  consumeLook() { const value = this.look; this.look = { x: 0, y: 0 }; return value; }
  consumeJump() { const value = this.jumpQueued; this.jumpQueued = false; return value; }
  consumeView() { const value = this.toggleViewQueued; this.toggleViewQueued = false; return value; }
  consumePause() { const value = this.pauseQueued; this.pauseQueued = false; return value; }
  reset() { this.keys.clear(); this.firing = false; this.joystick = { x: 0, y: 0 }; this.look = { x: 0, y: 0 }; }
  destroy() { this.reset(); this.listeners.forEach((off) => off()); document.exitPointerLock?.(); }
}
