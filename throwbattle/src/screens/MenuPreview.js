import * as THREE from 'three';
import { CHARACTERS, WEAPONS } from '../data/config.js';
import { loadCharacter, loadVisualModel, makePlaceholderWeapon, animatePlaceholder, playCharacterAction, disposeObject } from '../core/assets.js';

export class MenuPreview {
  constructor(container) {
    this.container = container;
    this.running = false;
    this.angle = 0.5;
    this.dragPointer = null;
    this.lastX = 0;
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x3b4d7e);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
    this.camera.position.set(0, 2.3, 5.8);
    this.camera.lookAt(0, 1.2, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.container.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6479b4, 2.4));
    const light = new THREE.DirectionalLight(0xfff3db, 2);
    light.position.set(3, 6, 5);
    this.scene.add(light);
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.36, 40), new THREE.MeshStandardMaterial({ color: 0x243557, roughness: 0.9 }));
    platform.position.y = -0.25;
    this.scene.add(platform);
    this.asset = await loadCharacter(CHARACTERS.student.model, CHARACTERS.student.color);
    if (!this.running) { disposeObject(this.asset.model); return; }
    this.scene.add(this.asset.model);
    const weaponVisual = await loadVisualModel(WEAPONS[0].model);
    if (!this.running) { if (weaponVisual) disposeObject(weaponVisual); return; }
    const weapon = weaponVisual || makePlaceholderWeapon(WEAPONS[0]);
    weapon.position.set(0.68, 1.25, -0.22);
    weapon.rotation.y = 0.4;
    this.asset.model.add(weapon);
    this.onDown = (event) => { this.dragPointer = event.pointerId; this.lastX = event.clientX; this.renderer.domElement.setPointerCapture(event.pointerId); };
    this.onMove = (event) => { if (event.pointerId === this.dragPointer) { this.angle += (event.clientX - this.lastX) * 0.009; this.lastX = event.clientX; } };
    this.onUp = (event) => { if (event.pointerId === this.dragPointer) this.dragPointer = null; };
    this.renderer.domElement.addEventListener('pointerdown', this.onDown);
    this.renderer.domElement.addEventListener('pointermove', this.onMove);
    this.renderer.domElement.addEventListener('pointerup', this.onUp);
    this.renderer.domElement.addEventListener('pointercancel', this.onUp);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.container);
    this.resize();
    this.clock = new THREE.Clock();
    this.loop();
  }

  resize() {
    if (!this.renderer) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  loop() {
    if (!this.running) return;
    this.frame = requestAnimationFrame(() => this.loop());
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.asset.model.rotation.y = this.angle;
    playCharacterAction(this.asset, 'idle');
    this.asset.mixer?.update(delta);
    animatePlaceholder(this.asset.model, this.clock.elapsedTime, false);
    this.renderer.render(this.scene, this.camera);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.renderer?.domElement.removeEventListener('pointerdown', this.onDown);
    this.renderer?.domElement.removeEventListener('pointermove', this.onMove);
    this.renderer?.domElement.removeEventListener('pointerup', this.onUp);
    this.renderer?.domElement.removeEventListener('pointercancel', this.onUp);
    if (this.scene) disposeObject(this.scene);
    this.scene = null;
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.renderer = null;
  }
}
