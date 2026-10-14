import * as THREE from 'three';
import { CHARACTERS, STAGES, WEAPONS, CONFIG } from '../data/config.js';
import { loadCharacter, loadVisualModel, animatePlaceholder, playCharacterAction, disposeObject } from '../core/assets.js';
import { collidesWithCover, createClassroom, withinStage } from '../stages/classroom.js';
import { InputController } from '../ui/InputController.js';
import { SnapshotSmoother } from './snapshotSmoothing.js';

// Server snapshots own the rules; local position prediction only makes input feel immediate.
export class OnlineBattleApp {
  constructor({ container, participantId, sendInput, onNotice }) {
    this.container = container;
    this.participantId = participantId;
    this.sendInput = sendInput;
    this.onNotice = onNotice;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9ec5df);
    this.camera = new THREE.PerspectiveCamera(69, 1, .1, 120);
    this.actors = new Map();
    this.shots = new Map();
    this.state = null;
    this.smoother = new SnapshotSmoother();
    this.predictedPosition = null;
    this.selfVy = 0;
    this.lastOwnLives = null;
    this.lastFrame = 0;
    this.pendingJump = false;
    this.lastHud = 0;
    this.lastWeaponIndex = -1;
    this.yaw = 0;
    this.pitch = 0;
    this.firstPerson = false;
    this.lastInputSent = 0;
    this.running = false;
  }

  async start() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(pointer:coarse)').matches ? 1.25 : 1.75));
    this.renderer.shadowMap.enabled = false;
    this.container.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x7793ac, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(8, 17, 10);
    this.scene.add(sun);
    const stageModel = await loadVisualModel(STAGES.classroom.model);
    this.stage = createClassroom({ includePlaceholderVisuals: !stageModel });
    this.scene.add(this.stage.group);
    if (stageModel) this.scene.add(stageModel);
    this.input = new InputController(this.renderer.domElement);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
    this.buildWeaponHud();
    this.running = true;
    this.frame = requestAnimationFrame(() => this.update());
  }

  buildWeaponHud() {
    const hud = document.getElementById('weaponHud');
    hud.replaceChildren();
    WEAPONS.forEach((weapon, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${index + 1} ${weapon.name}`;
      button.addEventListener('pointerdown', (event) => { event.preventDefault(); this.input.selectedWeapon = index; });
      hud.appendChild(button);
    });
  }

  resize() {
    if (!this.renderer) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  async addActor(player, index) {
    const asset = await loadCharacter(CHARACTERS.student.model, index % 2 ? 0xdf7d6f : 0x3c6fd5);
    if (!this.running) { disposeObject(asset.model); return; }
    const root = new THREE.Group();
    root.add(asset.model);
    root.position.set(player.x, player.y, player.z);
    this.scene.add(root);
    this.actors.set(player.id, { root, asset });
  }

  receive(state) {
    this.state = state;
    this.smoother.push(state, performance.now());
    const own = state.players.find((player) => player.id === this.participantId);
    if (own && !this.predictedPosition) {
      this.predictedPosition = new THREE.Vector3(own.x, own.y, own.z);
      const enemy = state.players.find((player) => player.id !== this.participantId);
      if (enemy) this.yaw = Math.atan2(-(enemy.x - own.x), -(enemy.z - own.z));
    }
    state.players.forEach((player, index) => {
      if (!this.actors.has(player.id)) {
        this.actors.set(player.id, null); // Prevent repeated async loads.
        this.addActor(player, index).catch((error) => { this.actors.delete(player.id); console.warn('Throb online actor load failed:', error); });
      }
    });
  }

  update() {
    if (!this.running) return;
    this.frame = requestAnimationFrame(() => this.update());
    const state = this.state;
    if (!state) return;
    const now = performance.now();
    const delta = this.lastFrame ? Math.min(.05, Math.max(0, (now - this.lastFrame) / 1000)) : 0;
    this.lastFrame = now;
    const own = state.players.find((player) => player.id === this.participantId);
    const enemy = state.players.find((player) => player.id !== this.participantId);
    const look = this.input.consumeLook();
    this.yaw -= look.x * CONFIG.cameraSensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - look.y * CONFIG.cameraSensitivity, -1.1, 1.1);
    if (this.input.consumeView()) this.firstPerson = !this.firstPerson;
    if (this.input.consumePause()) this.onNotice('オンライン対戦は一時停止できません。退出は右上のボタンから行えます。');
    const jumpPressed = this.input.consumeJump();
    this.pendingJump ||= jumpPressed;
    const movement = this.input.movement;
    const dashing = this.input.keys.has('ShiftLeft') || this.input.keys.has('ShiftRight');
    if (now - this.lastInputSent >= 50 && state.countdown === 0) {
      this.lastInputSent = now;
      this.sendInput({ ...movement, yaw: this.yaw, pitch: this.pitch,
        dash: dashing, jump: this.pendingJump,
        fire: this.input.firing, weapon: this.input.selectedWeapon });
      this.pendingJump = false;
    }
    if (own && this.predictedPosition) {
      const predicted = this.predictedPosition;
      if ((this.lastOwnLives !== null && this.lastOwnLives !== own.lives) || own.respawnSeconds > 0) {
        predicted.set(own.x, own.y, own.z);
        this.selfVy = 0;
      } else if (state.countdown === 0 && own.lives > 0) {
        const speed = CONFIG.walkSpeed * (dashing ? CONFIG.dashMultiplier : 1);
        const dx = (-Math.sin(this.yaw) * movement.forward + Math.cos(this.yaw) * movement.right) * speed * delta;
        const dz = (-Math.cos(this.yaw) * movement.forward - Math.sin(this.yaw) * movement.right) * speed * delta;
        if (withinStage(predicted.x + dx, predicted.z) && !collidesWithCover(predicted.x + dx, predicted.z, predicted.y)) predicted.x += dx;
        if (withinStage(predicted.x, predicted.z + dz) && !collidesWithCover(predicted.x, predicted.z + dz, predicted.y)) predicted.z += dz;
        if (jumpPressed && predicted.y <= 0) this.selfVy = CONFIG.jumpVelocity;
        this.selfVy -= CONFIG.gravity * delta;
        predicted.y = Math.max(0, predicted.y + this.selfVy * delta);
        if (predicted.y === 0) this.selfVy = 0;
        const drift = Math.hypot(predicted.x - own.x, predicted.z - own.z);
        if (drift > 4) predicted.set(own.x, own.y, own.z);
        else if (Math.hypot(movement.forward, movement.right) < .05)
          predicted.lerp(new THREE.Vector3(own.x, predicted.y, own.z), .08);
        if (Math.abs(predicted.y - own.y) > 1.8) { predicted.y = own.y; this.selfVy = 0; }
      }
      this.lastOwnLives = own.lives;
    }
    const visual = this.smoother.sample(now) || state;
    for (const player of visual.players) {
      const actor = this.actors.get(player.id);
      if (!actor) continue;
      const oldX = actor.root.position.x, oldZ = actor.root.position.z;
      actor.root.position.set(player.id === this.participantId && this.predictedPosition ? this.predictedPosition.x : player.x,
        player.id === this.participantId && this.predictedPosition ? this.predictedPosition.y : player.y,
        player.id === this.participantId && this.predictedPosition ? this.predictedPosition.z : player.z);
      actor.root.rotation.y = player.id === this.participantId ? this.yaw : player.yaw;
      actor.asset.model.visible = player.lives > 0 && !player.respawnSeconds && !(this.firstPerson && player.id === this.participantId);
      const moving = Math.hypot(actor.root.position.x - oldX, actor.root.position.z - oldZ) > .002;
      playCharacterAction(actor.asset, player.lives <= 0 ? 'defeat' : moving ? player.id === this.participantId && dashing ? 'dash' : 'walk' : 'idle');
      actor.asset.mixer?.update(delta);
      animatePlaceholder(actor.asset.model, now / 1000, moving, false);
    }
    const activeShots = new Set();
    for (const shot of visual.projectiles) {
      activeShots.add(shot.id);
      let mesh = this.shots.get(shot.id);
      if (!mesh) {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(.16, 8, 6), new THREE.MeshStandardMaterial({ color: WEAPONS[shot.weapon]?.color || 0xffffff }));
        this.scene.add(mesh); this.shots.set(shot.id, mesh);
      }
      mesh.position.set(shot.x, shot.y, shot.z);
    }
    for (const [id, mesh] of this.shots) if (!activeShots.has(id)) {
      this.scene.remove(mesh); disposeObject(mesh); this.shots.delete(id);
    }
    if (own) {
      const position = this.predictedPosition || own;
      const target = new THREE.Vector3(position.x, position.y + 1.65, position.z);
      const direction = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
      if (this.firstPerson) this.camera.position.copy(target);
      else this.camera.position.copy(target).addScaledVector(direction, -5)
        .addScaledVector(new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)), 1.35).add(new THREE.Vector3(0, 1.1, 0));
      this.camera.lookAt(target.clone().addScaledVector(direction, 8));
    }
    if (this.lastWeaponIndex !== this.input.selectedWeapon) {
      this.lastWeaponIndex = this.input.selectedWeapon;
      [...document.getElementById('weaponHud').children].forEach((button, index) => button.classList.toggle('active', index === this.lastWeaponIndex));
    }
    if (now - this.lastHud >= 100) {
      this.lastHud = now;
      if (own) {
        document.getElementById('playerHpBar').style.width = `${Math.max(0, own.hp / own.maxHp * 100)}%`;
        document.getElementById('playerHudText').textContent = `${own.hp} HP・残機${own.lives}${own.respawnSeconds ? `・復活まで${own.respawnSeconds}秒` : ''}`;
      }
      if (enemy) {
        document.getElementById('enemyHpBar').style.width = `${Math.max(0, enemy.hp / enemy.maxHp * 100)}%`;
        document.getElementById('enemyHudText').textContent = `${enemy.hp} HP・残機${enemy.lives}`;
      }
      document.querySelector('#battleHud .enemy strong').textContent = enemy?.name || '対戦相手';
      const remaining = state.remaining;
      document.getElementById('battleTime').textContent = state.countdown ? `開始まで ${state.countdown}`
        : `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
      document.getElementById('battleScore').textContent = `${own?.kills || 0} - ${enemy?.kills || 0}`;
    }
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.input?.destroy();
    disposeObject(this.scene);
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    document.getElementById('weaponHud').replaceChildren();
    this.actors.clear(); this.shots.clear();
  }
}
