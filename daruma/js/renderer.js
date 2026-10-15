import * as THREE from '../vendor/three.module.js';
import { RULES, STAGE } from './config.js';

const mat = (color, roughness = 0.84) => new THREE.MeshStandardMaterial({ color, roughness });
const box = (w, h, d, material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);

function label(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 320; canvas.height = 70;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(17,46,55,.86)';
  ctx.roundRect(8, 8, 304, 54, 17); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 160, 35, 290);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set(2.35, .52, 1);
  sprite.position.y = 2.85;
  return sprite;
}

function makeActor(actor, isOni) {
  const root = new THREE.Group();
  root.userData.actorId = actor.id;
  const body = box(.76, 1.05, .48, mat(isOni ? 0xd46d65 : actor.color));
  body.position.y = 1.15; root.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.42, 14, 10), mat(0xf0d2ae));
  head.position.y = 2.05; root.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.43, 14, 8, 0, Math.PI * 2, 0, Math.PI * .36), mat(isOni ? 0x513a37 : 0x39444c));
  hair.position.y = 2.09; root.add(hair);
  const eyeMat = mat(0x243947);
  for (const x of [-.17, .17]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), eyeMat);
    eye.position.set(x, 2.07, -.385); root.add(eye);
  }
  const limbMaterial = mat(isOni ? 0x944a4a : 0x476371);
  const legs = [];
  const arms = [];
  for (const x of [-.24, .24]) {
    const leg = new THREE.Group(); leg.position.set(x, .7, 0);
    const mesh = box(.25, .68, .29, limbMaterial); mesh.position.y = -.34; leg.add(mesh);
    root.add(leg); legs.push(leg);
    const arm = new THREE.Group(); arm.position.set(x < 0 ? -.52 : .52, 1.63, 0);
    const armMesh = box(.23, .72, .23, limbMaterial); armMesh.position.y = -.35; arm.add(armMesh);
    root.add(arm); arms.push(arm);
  }
  root.add(label(actor.name));
  return { root, legs, arms };
}

export class GameRenderer {
  constructor(canvas, quality = 'auto') {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' });
    const ratio = quality === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1.5);
    this.renderer.setPixelRatio(ratio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xb9d9da);
    this.scene.fog = new THREE.Fog(0xb9d9da, 30, 94);
    this.camera = new THREE.PerspectiveCamera(67, 1, .1, 140);
    this.camera.position.set(0, 4, 25);
    this.scene.add(new THREE.HemisphereLight(0xf7f5e5, 0x6b8b8e, 2));
    const sun = new THREE.DirectionalLight(0xffe8bc, 2.1);
    sun.position.set(-18, 32, 11); this.scene.add(sun);
    this.actorViews = new Map();
    this.actorRoots = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.cameraAt = new THREE.Vector3(0, 2, 25);
    this.makeStage();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  makeStage() {
    const world = new THREE.Group();
    const floor = box(36, .35, 67, mat(0x9cc9a6)); floor.position.set(0, -.22, 1.5); world.add(floor);
    const center = box(8, .018, 60, mat(0xc1d7b4)); center.position.set(0, .018, 1); world.add(center);
    const ice = box(11, .03, 28, new THREE.MeshStandardMaterial({ color: 0xa9d9e9, roughness: .22, transparent: true, opacity: .9 }));
    ice.position.set(11.5, .035, -1); world.add(ice);
    const belt = box(6, .045, 11, mat(0x698e8a)); belt.position.set(12, .06, 2.5); world.add(belt);
    for (let z = -2; z < 8; z += 2) {
      const stripe = box(5.8, .01, .21, mat(0xe4d47e)); stripe.position.set(12, .09, z); world.add(stripe);
    }
    const start = box(36, .015, .28, mat(0xf8f0d4)); start.position.set(0, .02, 28); world.add(start);
    const goal = box(36, .015, .28, mat(0xe5a373)); goal.position.set(0, .02, -25); world.add(goal);
    for (const o of STAGE.obstacles) {
      const material = mat(o.type === 'wall' ? 0x47717b : o.type === 'pillar' ? 0x698c8c : 0xb68c6a);
      const mesh = box(o.w, o.h, o.d, material); mesh.position.set(o.x, o.h / 2, o.z); world.add(mesh);
      const top = box(o.w + .06, .08, o.d + .06, mat(0xe3d0a6)); top.position.set(o.x, o.h + .04, o.z); world.add(top);
    }
    for (const x of [-18.3, 18.3]) {
      const fence = box(.2, 1, 67, mat(0x3d666d)); fence.position.set(x, .5, 1.5); world.add(fence);
    }
    for (const z of [-32.4, 35.4]) {
      const fence = box(36.6, 1, .2, mat(0x3d666d)); fence.position.set(0, .5, z); world.add(fence);
    }
    this.scene.add(world);
  }

  syncActors(match) {
    for (const view of this.actorViews.values()) this.scene.remove(view.root);
    this.actorViews.clear(); this.actorRoots.length = 0;
    for (const actor of match.actors) {
      const view = makeActor(actor, actor.id === match.oniId);
      this.actorViews.set(actor.id, view);
      this.actorRoots.push(view.root);
      this.scene.add(view.root);
    }
  }

  resize() {
    const width = window.innerWidth, height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = width < height ? 76 : 67;
    this.camera.updateProjectionMatrix();
  }

  render(match, view) {
    for (const actor of match.actors) {
      const visual = this.actorViews.get(actor.id);
      if (!visual) continue;
      visual.root.visible = !actor.eliminated;
      visual.root.position.set(actor.x, 0, actor.z);
      visual.root.rotation.y = actor.id === match.oniId ? (match.looking ? Math.PI : 0) : actor.facing;
      const swing = Math.sin(match.elapsed * 11 * (actor.speed / 4 + .25)) * Math.min(0.55, actor.speed / 8);
      visual.legs[0].rotation.x = swing; visual.legs[1].rotation.x = -swing;
      visual.arms[0].rotation.x = -swing * .7; visual.arms[1].rotation.x = swing * .7;
    }
    const player = match.player;
    const isOni = player.id === match.oniId;
    const baseYaw = isOni ? (match.looking ? Math.PI : 0) : view.yaw;
    const yaw = baseYaw + (isOni ? Math.max(-.55, Math.min(.55, view.offsetYaw)) : 0);
    const pitch = Math.max(-.6, Math.min(.6, view.pitch));
    const direction = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const target = new THREE.Vector3(player.x, 1.55, player.z);
    if (view.mode === 'fps') {
      this.camera.position.set(player.x, RULES.eyeHeight, player.z);
      this.camera.lookAt(this.camera.position.clone().add(direction));
    } else {
      const desired = target.clone().sub(direction.clone().multiplyScalar(5.6));
      desired.y = Math.max(2.3, desired.y + 2.2);
      // Keep the camera in front of solid geometry instead of clipping through it.
      let fraction = 1;
      for (const o of STAGE.obstacles) {
        const hit = new THREE.Box3(new THREE.Vector3(o.x-o.w/2-.2, 0, o.z-o.d/2-.2),
          new THREE.Vector3(o.x+o.w/2+.2, o.h+.2, o.z+o.d/2+.2));
        const ray = new THREE.Ray(target, desired.clone().sub(target).normalize());
        const hitPoint = ray.intersectBox(hit, new THREE.Vector3());
        if (hitPoint) fraction = Math.min(fraction, Math.max(.18, target.distanceTo(hitPoint) / target.distanceTo(desired) - .04));
      }
      this.cameraAt.lerp(target.clone().lerp(desired, fraction), .2);
      this.camera.position.copy(this.cameraAt);
      this.camera.lookAt(target.clone().add(direction.clone().multiplyScalar(2)));
    }
    const self = this.actorViews.get(player.id);
    if (self) self.root.visible = !player.eliminated && view.mode !== 'fps';
    this.renderer.render(this.scene, this.camera);
    if (self) self.root.visible = !player.eliminated;
  }

  pickActor(clientX, clientY, match) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.actorRoots, true);
    for (const hit of hits) {
      let node = hit.object;
      while (node && !node.userData.actorId) node = node.parent;
      if (node?.userData.actorId && node.userData.actorId !== match.player.id) {
        return { id: node.userData.actorId, point: { x: hit.point.x, y: hit.point.y, z: hit.point.z } };
      }
    }
    return null;
  }
}
