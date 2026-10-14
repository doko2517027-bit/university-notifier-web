import * as THREE from 'three';
import { CHARACTERS, STAGES, WEAPONS, CONFIG } from '../data/config.js';
import { loadCharacter, loadVisualModel, animatePlaceholder, playCharacterAction, disposeObject } from '../core/assets.js';
import { createClassroom } from '../stages/classroom.js';
import { InputController } from '../ui/InputController.js';

// A visual client only. Position, HP, projectiles and results come from the server.
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
    this.yaw = 0;
    this.pitch = 0;
    this.firstPerson = false;
    this.lastInputSent = 0;
    this.running = false;
  }

  async start() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x7793ac, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(8, 17, 10); sun.castShadow = true;
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
    const own = state.players.find((player) => player.id === this.participantId);
    const enemy = state.players.find((player) => player.id !== this.participantId);
    const look = this.input.consumeLook();
    this.yaw -= look.x * CONFIG.cameraSensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - look.y * CONFIG.cameraSensitivity, -1.1, 1.1);
    if (this.input.consumeView()) this.firstPerson = !this.firstPerson;
    if (this.input.consumePause()) this.onNotice('オンライン対戦は一時停止できません。退出は右上のボタンから行えます。');
    const now = performance.now();
    if (now - this.lastInputSent >= 100 && state.countdown === 0) {
      this.lastInputSent = now;
      const { forward, right } = this.input.movement;
      this.sendInput({ forward, right, yaw: this.yaw, pitch: this.pitch,
        dash: this.input.keys.has('ShiftLeft'), jump: this.input.consumeJump(),
        fire: this.input.firing, weapon: this.input.selectedWeapon });
    }
    for (const player of state.players) {
      const actor = this.actors.get(player.id);
      if (!actor) continue;
      actor.root.position.lerp(new THREE.Vector3(player.x, player.y, player.z), .38);
      actor.root.rotation.y = player.yaw;
      actor.asset.model.visible = player.lives > 0 && !player.respawnSeconds && !(this.firstPerson && player.id === this.participantId);
      playCharacterAction(actor.asset, player.lives <= 0 ? 'defeat' : 'idle');
      actor.asset.mixer?.update(.016);
      animatePlaceholder(actor.asset.model, now / 1000, false, false);
    }
    const activeShots = new Set();
    for (const shot of state.projectiles) {
      activeShots.add(shot.id);
      let mesh = this.shots.get(shot.id);
      if (!mesh) {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(.16, 8, 6), new THREE.MeshStandardMaterial({ color: WEAPONS[shot.weapon]?.color || 0xffffff }));
        this.scene.add(mesh); this.shots.set(shot.id, mesh);
      }
      mesh.position.lerp(new THREE.Vector3(shot.x, shot.y, shot.z), .65);
    }
    for (const [id, mesh] of this.shots) if (!activeShots.has(id)) {
      this.scene.remove(mesh); disposeObject(mesh); this.shots.delete(id);
    }
    if (own) {
      const target = new THREE.Vector3(own.x, own.y + 1.65, own.z);
      const direction = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
      if (this.firstPerson) this.camera.position.copy(target);
      else this.camera.position.copy(target).addScaledVector(direction, -5)
        .addScaledVector(new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)), 1.35).add(new THREE.Vector3(0, 1.1, 0));
      this.camera.lookAt(target.clone().addScaledVector(direction, 8));
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
