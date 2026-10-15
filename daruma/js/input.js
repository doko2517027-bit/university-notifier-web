export class GameInput {
  constructor(canvas, controls, settings, onSelect, onPause, onTurn, onLower, onTouch, onView) {
    this.canvas = canvas;
    this.controls = controls;
    this.settings = settings;
    this.keys = new Set();
    this.joystick = { x: 0, z: 0 };
    this.yaw = 0;
    this.offsetYaw = 0;
    this.pitch = 0;
    this.mode = settings.camera;
    this.dash = false;
    this.onSelect = onSelect;
    window.addEventListener('keydown', (event) => {
      if (['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if (event.repeat) return;
      if (event.code === 'Escape') onPause();
      if (event.code === 'KeyV') onView();
      if (event.code === 'KeyE') onTurn();
      if (event.code === 'KeyF') onLower();
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.dash = false; this.joystick = { x: 0, z: 0 }; });
    const zone = controls.joystick;
    const knob = controls.knob;
    const moveStick = (e) => {
      const r = zone.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const ratio = Math.min(1, Math.hypot(dx, dy) / 46);
      const angle = Math.atan2(dy, dx);
      this.joystick.x = Math.cos(angle) * ratio;
      this.joystick.z = Math.sin(angle) * ratio;
      knob.style.transform = `translate(${this.joystick.x * 31}px,${this.joystick.z * 31}px)`;
    };
    zone.addEventListener('pointerdown', (e) => { zone.setPointerCapture(e.pointerId); this.stickPointer = e.pointerId; moveStick(e); });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId === this.stickPointer) moveStick(e); });
    const releaseStick = (e) => { if (e.pointerId !== this.stickPointer) return; this.stickPointer = null; this.joystick = { x: 0, z: 0 }; knob.style.transform = ''; };
    zone.addEventListener('pointerup', releaseStick); zone.addEventListener('pointercancel', releaseStick);
    const dash = controls.dash;
    dash.addEventListener('pointerdown', (e) => { dash.setPointerCapture(e.pointerId); this.dash = true; });
    dash.addEventListener('pointerup', () => this.dash = false);
    dash.addEventListener('pointercancel', () => this.dash = false);
    controls.touch.addEventListener('click', onTouch);
    controls.turn.addEventListener('click', onTurn);
    controls.lower.addEventListener('click', onLower);
    controls.view.addEventListener('click', onView);
    let lookPointer = null;
    let start = null;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && e.clientX < window.innerWidth * .35) return;
      if (e.pointerType === 'mouse' && e.button === 2) { lookPointer = e.pointerId; start = { x: e.clientX, y: e.clientY, moved: 100 }; canvas.setPointerCapture(e.pointerId); return; }
      if (e.pointerType === 'touch') { lookPointer = e.pointerId; start = { x: e.clientX, y: e.clientY, moved: 0 }; canvas.setPointerCapture(e.pointerId); }
      else if (e.button === 0) onSelect(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookPointer || !start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      start.moved += Math.hypot(dx, dy);
      start.x = e.clientX; start.y = e.clientY;
      const factor = .005 * Number(settings.sensitivity || 1);
      this.yaw += dx * factor;
      this.offsetYaw = Math.max(-.55, Math.min(.55, this.offsetYaw + dx * factor));
      this.pitch = Math.max(-.55, Math.min(.55, this.pitch - dy * factor));
    });
    canvas.addEventListener('pointerup', (e) => {
      if (e.pointerId !== lookPointer) return;
      if (e.pointerType === 'touch' && start?.moved < 10) onSelect(e.clientX, e.clientY);
      lookPointer = null; start = null;
    });
    canvas.addEventListener('pointercancel', () => { lookPointer = null; start = null; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  movement() {
    const x = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) + this.joystick.x;
    const forward = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) - this.joystick.z;
    return {
      x: Math.cos(this.yaw) * x + Math.sin(this.yaw) * forward,
      z: Math.sin(this.yaw) * x - Math.cos(this.yaw) * forward,
      dash: this.dash || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
    };
  }

  toggleView() { this.mode = this.mode === 'tps' ? 'fps' : 'tps'; return this.mode; }
  resetCamera() { this.yaw = 0; this.offsetYaw = 0; this.pitch = 0; }
}
