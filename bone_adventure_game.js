const WORLDS = Object.freeze({
  forest: { sky: "#9ee3ed", ground: "#3f8b56", accent: "#1e5e3a" },
  city: { sky: "#b8d9ec", ground: "#65727e", accent: "#34424d" },
  desert: { sky: "#f5d899", ground: "#d18b48", accent: "#9a5727" },
  snow: { sky: "#cdeafa", ground: "#e8f3f6", accent: "#6c9baa" },
});

export class BoneAdventureRunner {
  constructor({ canvas, onFrame = () => {}, onFinish = () => {} }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onFrame = onFrame;
    this.onFinish = onFinish;
    this.running = false;
    this.animationId = 0;
    this.lastTime = 0;
    this.keyHandler = (event) => {
      if (!this.running) return;
      if (["Space", "ArrowUp", "KeyW"].includes(event.code)) { event.preventDefault(); this.jump(); }
      if (["ArrowDown", "KeyS"].includes(event.code)) { event.preventDefault(); this.slide(); }
      if (["KeyX", "ShiftLeft", "ShiftRight"].includes(event.code)) { event.preventDefault(); this.ability(); }
    };
    window.addEventListener("keydown", this.keyHandler);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
  }

  start({ mode = "stage", stage = 1, world = "forest", abilityPower = 0 } = {}) {
    this.mode = mode;
    this.stage = Math.max(1, Number(stage || 1));
    this.world = WORLDS[world] || WORLDS.forest;
    this.abilityPower = Math.max(0, Number(abilityPower || 0));
    this.durationMs = 0;
    this.distance = 0;
    this.score = 0;
    this.health = 3;
    this.speed = 250 + this.stage * 10;
    this.targetDistance = 820 + this.stage * 180;
    this.player = { x: 115, y: 0, vy: 0, width: 42, height: 88, grounded: true, slidingUntil: 0, invulnerableUntil: 0 };
    this.obstacles = [];
    this.particles = [];
    this.spawnDistance = 210;
    this.shieldUntil = 0;
    this.abilityReadyAt = 0;
    this.running = true;
    this.finished = false;
    this.lastTime = performance.now();
    this.resize();
    cancelAnimationFrame(this.animationId);
    this.animationId = requestAnimationFrame((time) => this.loop(time));
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(320, rect.width || 320);
    this.height = Math.max(220, rect.height || 220);
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.groundY = this.height - Math.max(46, this.height * .16);
  }

  jump() {
    if (!this.running || !this.player.grounded) return;
    this.player.vy = -610;
    this.player.grounded = false;
  }

  slide() {
    if (!this.running || !this.player.grounded) return;
    this.player.slidingUntil = this.durationMs + 620;
  }

  ability() {
    if (!this.running || this.durationMs < this.abilityReadyAt) return;
    this.shieldUntil = this.durationMs + 1800 + this.abilityPower * 60;
    this.abilityReadyAt = this.durationMs + Math.max(5200, 8000 - this.abilityPower * 80);
    for (let index = 0; index < 18; index += 1) this.particles.push({ x: this.player.x + 20, y: this.groundY - 45, vx: Math.cos(index) * 90, vy: Math.sin(index) * 90, life: 1 });
  }

  quit() {
    if (!this.running) return;
    this.finish(false, "quit");
  }

  loop(time) {
    if (!this.running) return;
    const dt = Math.min(.035, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    this.update(dt);
    this.draw();
    this.onFrame({ distance: Math.floor(this.distance), score: Math.floor(this.score), health: this.health });
    this.animationId = requestAnimationFrame((next) => this.loop(next));
  }

  update(dt) {
    this.durationMs += dt * 1000;
    const difficulty = 1 + Math.min(1.5, this.distance / 2200) + (this.mode === "endless" ? this.durationMs / 160000 : 0);
    this.speed = (250 + this.stage * 10) * difficulty;
    this.distance += this.speed * dt * .1;
    this.score += this.speed * dt * .13;
    this.player.vy += 1480 * dt;
    this.player.y += this.player.vy * dt;
    if (this.player.y >= 0) { this.player.y = 0; this.player.vy = 0; this.player.grounded = true; }
    this.spawnDistance -= this.speed * dt;
    if (this.spawnDistance <= 0) {
      this.spawnObstacle();
      this.spawnDistance = Math.max(170, 390 - difficulty * 65) + Math.random() * 210;
    }
    for (const obstacle of this.obstacles) obstacle.x -= this.speed * dt;
    this.obstacles = this.obstacles.filter((obstacle) => obstacle.x > -90 && !obstacle.removed);
    for (const particle of this.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.life -= dt * 1.8; }
    this.particles = this.particles.filter((particle) => particle.life > 0);
    this.checkCollisions();
    if (this.mode === "stage" && this.distance >= this.targetDistance) this.finish(true, "clear");
  }

  spawnObstacle() {
    const airborne = Math.random() < .3;
    const virus = Math.random() < .62;
    this.obstacles.push({ x: this.width + 50, y: airborne ? this.groundY - 118 : this.groundY, width: virus ? 47 : 34, height: virus ? 47 : 65, airborne, virus, phase: Math.random() * Math.PI * 2 });
  }

  checkCollisions() {
    const sliding = this.durationMs < this.player.slidingUntil;
    const playerHeight = sliding ? 40 : this.player.height;
    const playerTop = this.groundY - playerHeight + this.player.y;
    const playerBox = { left: this.player.x, right: this.player.x + this.player.width, top: playerTop, bottom: this.groundY + this.player.y };
    for (const obstacle of this.obstacles) {
      const bottom = obstacle.airborne ? obstacle.y : this.groundY;
      const box = { left: obstacle.x, right: obstacle.x + obstacle.width, top: bottom - obstacle.height, bottom };
      if (playerBox.right < box.left || playerBox.left > box.right || playerBox.bottom < box.top || playerBox.top > box.bottom) continue;
      obstacle.removed = true;
      if (this.durationMs < this.shieldUntil) { this.score += 120; continue; }
      if (this.durationMs < this.player.invulnerableUntil) continue;
      this.health -= 1;
      this.player.invulnerableUntil = this.durationMs + 1500;
      if (this.health <= 0) this.finish(false, "collision");
    }
  }

  finish(completed, reason) {
    if (this.finished) return;
    this.finished = true;
    this.running = false;
    cancelAnimationFrame(this.animationId);
    this.draw();
    this.onFinish({ mode: this.mode, stage: this.stage, completed, reason, durationMs: Math.round(this.durationMs), distance: Math.floor(this.distance), score: Math.floor(this.score) });
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, this.world.sky);
    gradient.addColorStop(1, "#eaf7f3");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawScenery(ctx);
    ctx.fillStyle = this.world.ground;
    ctx.fillRect(0, this.groundY, this.width, this.height - this.groundY);
    ctx.fillStyle = this.world.accent;
    for (let x = -((this.distance * 10) % 52); x < this.width; x += 52) ctx.fillRect(x, this.groundY + 13, 27, 4);
    for (const obstacle of this.obstacles) this.drawObstacle(ctx, obstacle);
    this.drawSkeleton(ctx);
    for (const particle of this.particles) { ctx.globalAlpha = Math.max(0, particle.life); ctx.fillStyle = "#65f1d6"; ctx.beginPath(); ctx.arc(particle.x, particle.y, 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(9,39,44,.75)";
    ctx.font = "700 13px system-ui";
    ctx.fillText(`❤ ${this.health}`, 14, 24);
    if (this.durationMs < this.shieldUntil) ctx.fillText("SHIELD", 14, 44);
  }

  drawScenery(ctx) {
    const offset = (this.distance * 2.2) % 240;
    ctx.globalAlpha = .32;
    ctx.fillStyle = this.world.accent;
    for (let x = -offset; x < this.width + 200; x += 240) {
      if (this.world === WORLDS.city) { ctx.fillRect(x, this.groundY - 160, 95, 160); ctx.fillRect(x + 108, this.groundY - 105, 70, 105); }
      else { ctx.beginPath(); ctx.arc(x + 50, this.groundY - 60, 48, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x + 44, this.groundY - 55, 13, 55); }
    }
    ctx.globalAlpha = 1;
  }

  drawObstacle(ctx, obstacle) {
    const y = obstacle.airborne ? obstacle.y : this.groundY;
    if (obstacle.virus) {
      ctx.save(); ctx.translate(obstacle.x + obstacle.width / 2, y - obstacle.height / 2); ctx.rotate(Math.sin(this.durationMs * .005 + obstacle.phase) * .15);
      ctx.fillStyle = "#8e3cb8"; ctx.beginPath(); ctx.arc(0, 0, obstacle.width / 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#6a248d"; ctx.lineWidth = 4;
      for (let i = 0; i < 8; i += 1) { const angle = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(angle) * 18, Math.sin(angle) * 18); ctx.lineTo(Math.cos(angle) * 29, Math.sin(angle) * 29); ctx.stroke(); }
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-8, -4, 4, 0, Math.PI * 2); ctx.arc(8, -4, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    } else {
      ctx.fillStyle = "#c1533e"; ctx.fillRect(obstacle.x, y - obstacle.height, obstacle.width, obstacle.height); ctx.fillStyle = "#f6c56a"; ctx.fillRect(obstacle.x - 5, y - obstacle.height, obstacle.width + 10, 10);
    }
  }

  drawSkeleton(ctx) {
    const sliding = this.durationMs < this.player.slidingUntil;
    const x = this.player.x + 20;
    const feet = this.groundY + this.player.y;
    const invulnerable = this.durationMs < this.player.invulnerableUntil;
    ctx.save();
    ctx.globalAlpha = invulnerable && Math.floor(this.durationMs / 90) % 2 ? .35 : 1;
    ctx.strokeStyle = "#f4ecd7"; ctx.fillStyle = "#f4ecd7"; ctx.lineWidth = 7; ctx.lineCap = "round";
    if (sliding) { ctx.translate(x, feet - 26); ctx.rotate(-.55); }
    else ctx.translate(x, feet - 67);
    const gait = Math.sin(this.durationMs * .018) * 13;
    ctx.beginPath(); ctx.arc(0, -17, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#23383b"; ctx.beginPath(); ctx.arc(-5, -19, 3.4, 0, Math.PI * 2); ctx.arc(5, -19, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#f4ecd7"; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, 27); ctx.moveTo(-14, 5); ctx.lineTo(14, 5); ctx.moveTo(-10, 11); ctx.quadraticCurveTo(0, 21, 10, 11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, 5); ctx.lineTo(-18, 17 + gait * .18); ctx.moveTo(10, 5); ctx.lineTo(18, 17 - gait * .18); ctx.moveTo(-5, 27); ctx.lineTo(-11 + gait * .5, 49); ctx.moveTo(5, 27); ctx.lineTo(11 - gait * .5, 49); ctx.stroke();
    if (this.durationMs < this.shieldUntil) { ctx.strokeStyle = "#55e7d0"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 10, 39, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.animationId);
    window.removeEventListener("keydown", this.keyHandler);
    this.resizeObserver.disconnect();
  }
}
