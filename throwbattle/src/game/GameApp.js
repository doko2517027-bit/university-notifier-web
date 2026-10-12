import * as THREE from 'three';
import { CONFIG, CHARACTERS, STAGES, WEAPONS } from '../data/config.js';
import { loadCharacter, loadVisualModel, makePlaceholderWeapon, animatePlaceholder, playCharacterAction, disposeObject } from '../core/assets.js';
import { createClassroom, collidesWithCover, floorHeightAt, withinStage, obstacleAt } from '../stages/classroom.js';
import { BattleSession } from '../battle/BattleSession.js';
import { InputController } from '../ui/InputController.js';

const near = (a, b, distance) => Math.hypot(a.x - b.x, a.z - b.z) < distance;
const facing = (dx, dz) => Math.atan2(-dx, -dz);

export class GameApp {
  constructor({ container, settings, onResult, onPause, onNotice, onSound = () => {} }) {
    this.container = container;
    this.settings = settings;
    this.onResult = onResult;
    this.onPause = onPause;
    this.onNotice = onNotice;
    this.onSound = onSound;
    this.session = new BattleSession(settings);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9ec5df);
    this.camera = new THREE.PerspectiveCamera(69, 1, 0.1, 120);
    this.projectiles = [];
    this.clock = new THREE.Clock();
    this.running = false;
    this.paused = false;
    this.firstPerson = false;
    this.yaw = 0;
    this.pitch = 0;
    this.frame = null;
    this.finishTimer = null;
    this.input = null;
    this.weaponIndex = 0;
    this.weaponHud = document.getElementById('weaponHud');
  }

  async start() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x7793ac, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(8, 17, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -24; sun.shadow.camera.right = 24;
    sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
    this.scene.add(sun);
    this.stageVisual = await loadVisualModel(STAGES.classroom.model);
    this.stage = createClassroom({ includePlaceholderVisuals: !this.stageVisual });
    this.scene.add(this.stage.group);
    if (this.stageVisual) this.scene.add(this.stageVisual);
    this.weaponVisuals = await Promise.all(WEAPONS.map((weapon) => loadVisualModel(weapon.model)));
    this.player = await this.createActor('player', 0x3c6fd5, STAGES.classroom.spawns[0]);
    this.cpu = await this.createActor('cpu', 0xdf7d6f, STAGES.classroom.spawns[1]);
    this.yaw = facing(this.cpu.root.position.x - this.player.root.position.x, this.cpu.root.position.z - this.player.root.position.z);
    this.cpuConfig = CONFIG.cpu[this.settings.difficulty] || CONFIG.cpu.normal;
    this.input = new InputController(this.renderer.domElement);
    this.onVisibilityChange = () => { if (document.hidden && !this.paused && !this.session.finished) this.setPaused(true); };
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
    this.buildWeaponHud();
    this.running = true;
    this.clock.start();
    this.onNotice('対戦開始！');
    this.frame = requestAnimationFrame(() => this.update());
  }

  async createActor(id, color, spawn) {
    const asset = await loadCharacter(CHARACTERS.student.model, color);
    const root = new THREE.Group();
    root.position.set(spawn.x, 0, spawn.z);
    root.add(asset.model);
    asset.model.traverse((child) => { if (child.isMesh) child.castShadow = true; });
    this.scene.add(root);
    return { id, root, asset, vy: 0, grounded: true, lastShot: -10, hitUntil: 0, landUntil: 0, moving: false, shotFlashUntil: 0 };
  }

  resize() {
    if (!this.renderer) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  buildWeaponHud() {
    this.weaponHud.replaceChildren();
    WEAPONS.forEach((weapon, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${index + 1} ${weapon.name}`;
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        this.input.selectedWeapon = index;
        this.selectWeapon(index);
      });
      this.weaponHud.appendChild(button);
    });
    this.selectWeapon(0);
  }

  selectWeapon(index) {
    if (index < 0 || index >= WEAPONS.length || this.weaponIndex === index && this.weaponHud.querySelector('.active')) return;
    this.weaponIndex = index;
    [...this.weaponHud.children].forEach((button, i) => button.classList.toggle('active', i === index));
  }

  get direction() {
    return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  update() {
    if (!this.running) return;
    this.frame = requestAnimationFrame(() => this.update());
    const delta = Math.min(this.clock.getDelta(), 0.05);
    if (this.input.consumePause()) this.setPaused(!this.paused);
    if (!this.paused && !this.session.finished) {
      this.updatePlayer(delta);
      this.updateCpu(delta);
      this.updateProjectiles(delta);
      this.updateHeals(delta);
      const events = this.session.tick(delta);
      for (const event of events) {
        if (event.kind === 'respawn') this.respawn(event.targetId);
        if (event.kind === 'sudden-death') this.onNotice('サドンデス！ 次に倒れた方が負け');
      }
      if (this.session.finished) this.finish();
    }
    this.updateCamera();
    this.updateAnimations(delta);
    this.updateHud();
    this.renderer.render(this.scene, this.camera);
  }

  updatePlayer(delta) {
    const look = this.input.consumeLook();
    this.yaw -= look.x * CONFIG.cameraSensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - look.y * CONFIG.cameraSensitivity, -1.1, 1.1);
    if (this.input.consumeView()) {
      this.firstPerson = !this.firstPerson;
      this.player.asset.model.visible = !this.firstPerson;
    }
    this.selectWeapon(this.input.selectedWeapon);
    const fighter = this.session.player;
    if (fighter.respawnAt > this.session.elapsed || fighter.lives <= 0) return;
    const { forward, right } = this.input.movement;
    const multiplier = this.input.keys.has('ShiftLeft') || this.input.keys.has('ShiftRight') ? CONFIG.dashMultiplier : 1;
    const dx = (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * right) * CONFIG.walkSpeed * multiplier * delta;
    const dz = (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * right) * CONFIG.walkSpeed * multiplier * delta;
    this.moveActor(this.player, dx, dz, delta, this.input.consumeJump());
    this.player.root.rotation.y = this.yaw;
    this.player.moving = Math.abs(forward) + Math.abs(right) > 0.1;
    if (this.input.firing) this.fire(this.player, this.direction, WEAPONS[this.weaponIndex]);
  }

  moveActor(actor, dx, dz, delta, jump = false) {
    const position = actor.root.position;
    if (jump && actor.grounded) { actor.vy = CONFIG.jumpVelocity; actor.grounded = false; }
    for (const pad of STAGES.classroom.jumpPads) {
      if (actor.grounded && Math.hypot(position.x - pad.x, position.z - pad.z) < 0.8) {
        actor.vy = CONFIG.jumpVelocity * 1.42;
        actor.grounded = false;
        break;
      }
    }
    if (!collidesWithCover(position.x + dx, position.z, position.y) && withinStage(position.x + dx, position.z)) position.x += dx;
    if (!collidesWithCover(position.x, position.z + dz, position.y) && withinStage(position.x, position.z + dz)) position.z += dz;
    actor.vy -= CONFIG.gravity * delta;
    position.y += actor.vy * delta;
    const floor = floorHeightAt(position.x, position.z);
    if (position.y <= floor) {
      if (!actor.grounded) actor.landUntil = this.session.elapsed + 0.18;
      position.y = floor; actor.vy = 0; actor.grounded = true;
    }
  }

  updateCpu(delta) {
    const fighter = this.session.cpu;
    if (fighter.respawnAt > this.session.elapsed || fighter.lives <= 0) return;
    const from = this.cpu.root.position;
    const to = this.player.root.position;
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const distance = Math.hypot(dx, dz);
    const aim = facing(dx, dz);
    this.cpu.root.rotation.y = aim;
    const phase = Math.sin(this.session.elapsed * 0.8);
    let vx = 0, vz = 0;
    if (distance > 8 && this.session.player.respawnAt <= this.session.elapsed) { vx = dx / distance; vz = dz / distance; }
    else if (distance < 5) { vx = -dx / Math.max(distance, 1); vz = -dz / Math.max(distance, 1); }
    else { vx = -dz / Math.max(distance, 1) * phase; vz = dx / Math.max(distance, 1) * phase; }
    const step = this.cpuConfig.speed * delta;
    if (collidesWithCover(from.x + vx * step, from.z + vz * step, from.y)) {
      const oldX = vx;
      vx = -vz;
      vz = oldX;
      if (collidesWithCover(from.x + vx * step, from.z + vz * step, from.y)) {
        vx = -vx; vz = -vz;
      }
    }
    this.moveActor(this.cpu, vx * step, vz * step, delta, false);
    this.cpu.moving = Math.abs(vx) + Math.abs(vz) > 0.05;
    if (distance < 26 && this.session.player.respawnAt <= this.session.elapsed) {
      const target = new THREE.Vector3(dx, to.y - from.y + 0.05, dz).normalize();
      const miss = (1 - this.cpuConfig.accuracy) * 0.28;
      target.x += Math.sin(this.session.elapsed * 2.7) * miss;
      target.z += Math.cos(this.session.elapsed * 1.9) * miss;
      this.fire(this.cpu, target.normalize(), WEAPONS[0], this.cpuConfig.fireDelay);
    }
  }

  fire(actor, direction, weapon, overrideCooldown = null) {
    const cooldown = overrideCooldown ?? weapon.cooldown;
    if (this.session.elapsed - actor.lastShot < cooldown) return;
    actor.lastShot = this.session.elapsed;
    actor.shotFlashUntil = this.session.elapsed + 0.22;
    if (actor.id === 'player') this.onSound('throw');
    const weaponIndex = WEAPONS.findIndex((candidate) => candidate.id === weapon.id);
    const mesh = this.weaponVisuals[weaponIndex]?.clone(true) || makePlaceholderWeapon(weapon);
    const start = actor.root.position.clone().add(new THREE.Vector3(0, 1.52, 0));
    start.addScaledVector(direction, 0.88);
    mesh.position.copy(start);
    this.scene.add(mesh);
    this.projectiles.push({ mesh, ownerId: actor.id, weapon, sharedVisual: Boolean(this.weaponVisuals[weaponIndex]), velocity: direction.clone().multiplyScalar(weapon.projectileSpeed), age: 0, distance: 0 });
  }

  updateProjectiles(delta) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const shot = this.projectiles[i];
      const travel = shot.velocity.length() * delta;
      const slices = Math.max(1, Math.ceil(travel / 0.32));
      let hit = false;
      const target = shot.ownerId === 'player' ? this.cpu : this.player;
      for (let slice = 0; slice < slices; slice++) {
        shot.mesh.position.addScaledVector(shot.velocity, delta / slices);
        const p = shot.mesh.position;
        if (obstacleAt(p.x, p.y, p.z)) { hit = true; if (shot.ownerId === 'player') this.onSound('impact'); break; }
        const targetState = this.session[target.id];
        if (targetState.respawnAt > this.session.elapsed || targetState.lives <= 0) continue;
        if (Math.hypot(p.x - target.root.position.x, p.z - target.root.position.z) < 0.56 && p.y > target.root.position.y + 0.08 && p.y < target.root.position.y + 2.55) {
          const headshot = p.y > target.root.position.y + 1.78;
          const event = this.session.hit(target.id, shot.weapon.damage * (headshot ? CONFIG.headshotMultiplier : 1));
          if (event) {
            target.hitUntil = this.session.elapsed + 0.28;
            if (shot.ownerId === 'player') this.onSound('hit');
            if (headshot && shot.ownerId === 'player') this.onNotice('ヘッドショット！');
            if (event.kind === 'down') this.down(target);
          }
          hit = true;
          break;
        }
      }
      shot.age += delta;
      shot.distance += travel;
      shot.mesh.rotation.x += delta * 7;
      if (hit || shot.age > 4 || shot.distance > shot.weapon.range) {
        this.scene.remove(shot.mesh);
        if (!shot.sharedVisual) disposeObject(shot.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  down(actor) {
    actor.asset.model.visible = false;
    if (actor.id === 'player') this.onNotice('倒れました。復活まで10秒');
    else this.onNotice('CPUを倒した！');
  }

  respawn(targetId) {
    const actor = this[targetId];
    const spot = STAGES.classroom.spawns[targetId === 'player' ? 0 : 1];
    actor.root.position.set(spot.x, 0, spot.z);
    actor.vy = 0;
    actor.asset.model.visible = targetId !== 'player' || !this.firstPerson;
    if (targetId === 'player') this.onNotice('復活！ 3秒間無敵');
  }

  updateHeals(delta) {
    for (const heal of this.stage.healMeshes) {
      if (!heal.active) {
        heal.cooldown -= delta;
        if (heal.cooldown <= 0) { heal.active = true; heal.mesh.visible = true; }
        continue;
      }
      for (const actor of [this.player, this.cpu]) {
        if (near(actor.root.position, heal, 0.95) && this.session.heal(actor.id, 25) > 0) {
          heal.active = false; heal.cooldown = 30; heal.mesh.visible = false;
          if (actor.id === 'player') this.onNotice('絆創膏でHP回復');
          break;
        }
      }
    }
  }

  updateCamera() {
    const position = this.player.root.position;
    const target = new THREE.Vector3(position.x, position.y + 1.65, position.z);
    const direction = this.direction;
    if (this.firstPerson) this.camera.position.copy(target);
    else {
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      this.camera.position.copy(target).addScaledVector(direction, -5).addScaledVector(right, 1.35).add(new THREE.Vector3(0, 1.1, 0));
    }
    this.camera.lookAt(target.clone().addScaledVector(direction, 8));
  }

  updateAnimations(delta) {
    for (const actor of [this.player, this.cpu]) {
      const fighter = this.session[actor.id];
      const dashing = actor.id === 'player' && (this.input.keys.has('ShiftLeft') || this.input.keys.has('ShiftRight'));
      const name = fighter.lives <= 0 ? 'defeat'
        : actor.hitUntil > this.session.elapsed ? 'hit'
          : actor.shotFlashUntil > this.session.elapsed ? 'throw'
            : !actor.grounded ? 'jump'
              : actor.landUntil > this.session.elapsed ? 'land'
                : actor.moving ? dashing ? 'dash' : 'walk' : 'idle';
      playCharacterAction(actor.asset, name);
      actor.asset.mixer?.update(delta);
      animatePlaceholder(actor.asset.model, this.session.elapsed, actor.moving, name === 'throw');
    }
  }

  updateHud() {
    const { player, cpu } = this.session;
    document.getElementById('playerHpBar').style.width = `${Math.max(0, player.hp)}%`;
    document.getElementById('enemyHpBar').style.width = `${Math.max(0, cpu.hp)}%`;
    const downTime = player.respawnAt > this.session.elapsed ? `・復活まで${Math.ceil(player.respawnAt - this.session.elapsed)}秒` : '';
    document.getElementById('playerHudText').textContent = `${player.hp} HP・残機${player.lives}${downTime}`;
    document.getElementById('enemyHudText').textContent = `${cpu.hp} HP・残機${cpu.lives}`;
    const remaining = Math.ceil(this.session.remaining);
    document.getElementById('battleTime').textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    document.getElementById('battleScore').textContent = `${player.kills} - ${cpu.kills}`;
  }

  setPaused(paused) {
    if (this.session.finished) return;
    this.paused = paused;
    this.input.reset();
    if (paused) document.exitPointerLock?.();
    this.onPause(paused);
  }

  finish() {
    this.input.reset();
    this.onNotice(this.session.result.winner === 'player' ? 'WIN!' : this.session.result.winner === 'cpu' ? 'LOSE' : 'DRAW');
    this.finishTimer = setTimeout(() => this.onResult(this.session.result), 1700);
  }

  leave() {
    this.session.finish('cpu', 'left');
    this.onResult(this.session.result);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.finishTimer);
    this.resizeObserver?.disconnect();
    if (this.onVisibilityChange) document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.input?.destroy();
    disposeObject(this.scene);
    this.weaponVisuals?.forEach((model) => { if (model) disposeObject(model); });
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.weaponHud.replaceChildren();
  }
}
