import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.min.js";

const WORLD_WIDTH = 1800;
const WORLD_HEIGHT = 1200;
const WORLD_SCALE = 0.58;
const MAP_COLORS = {
  lung: [0xf2cbd0, 0xd78f9c, 0x824f61], airway: [0xdce7e4, 0x91b7b4, 0x496f72],
  intestine: [0xe7c4a3, 0xc28a68, 0x74503f], urinary: [0xd9d0e8, 0xa69bc4, 0x625a83],
  vessel: [0xbc7784, 0x7c4757, 0x3b2933], skin: [0xf0d2b8, 0xd29c79, 0x825d49],
};

function position3(x, y, height = 0) {
  return new THREE.Vector3((x - WORLD_WIDTH / 2) * WORLD_SCALE, height, (y - WORLD_HEIGHT / 2) * WORLD_SCALE);
}

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: .72, metalness: .04, ...options });
}

function mesh(geometry, mat, cast = true, receive = true) {
  const result = new THREE.Mesh(geometry, mat);
  result.castShadow = cast; result.receiveShadow = receive;
  return result;
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((entry) => entry.dispose?.());
    else child.material?.dispose?.();
  });
  object.removeFromParent();
}

function characterPalette(sprite = 0) {
  const palettes = [
    [0xf8ead1, 0x2a9ca0, 0x66d6d4], [0xf18b58, 0xf4eee2, 0xd85246], [0xf0c33d, 0x238c9e, 0x65dbe2],
    [0x50b9e5, 0xeaf7f4, 0x3378bc], [0x8d5d3f, 0xf3ead8, 0x2d9ba0], [0x72c9aa, 0xf3efe2, 0x42b878],
    [0xe8874a, 0xf3e4ce, 0xbe463c], [0xeee5de, 0x6750a6, 0xe0bc45], [0x5d9d98, 0xf2e8d8, 0x39c990], [0xfff0c7, 0xdba838, 0x3aa7aa],
  ];
  return palettes[Math.max(0, Math.min(palettes.length - 1, Number(sprite || 0)))];
}

function createCharacterModel(sprite = 0) {
  const [skin, suit, accent] = characterPalette(sprite);
  const root = new THREE.Group(); root.userData.sprite = Number(sprite || 0);
  const shadow = mesh(new THREE.CircleGeometry(25, 32), new THREE.MeshBasicMaterial({ color: 0x261621, transparent: true, opacity: .27, depthWrite: false }), false, false);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .7; root.add(shadow);
  const rig = new THREE.Group(); rig.position.y = 4; root.add(rig);
  const body = mesh(new THREE.SphereGeometry(22, 24, 18), material(suit)); body.scale.set(1, 1.16, .82); body.position.y = 38; rig.add(body);
  const belly = mesh(new THREE.SphereGeometry(15, 22, 16), material(skin)); belly.scale.set(1, .92, .42); belly.position.set(0, 36, 17); rig.add(belly);
  const head = mesh(new THREE.SphereGeometry(28, 28, 20), material(skin)); head.scale.set(1.06, .95, .92); head.position.y = 73; rig.add(head);
  const face = new THREE.Group(); face.position.set(0, 72, 25); rig.add(face);
  [-9, 9].forEach((x) => { const eye = mesh(new THREE.SphereGeometry(3.4, 16, 12), material(0x242028), false, false); eye.position.x = x; face.add(eye); });
  const smile = mesh(new THREE.TorusGeometry(5.5, 1.15, 7, 18, Math.PI), material(0x643b43), false, false); smile.position.y = -8; smile.rotation.z = Math.PI; face.add(smile);
  const makeLimb = (side, arm = false) => {
    const pivot = new THREE.Group(); pivot.position.set(side * (arm ? 22 : 10), arm ? 47 : 22, 0); rig.add(pivot);
    const limb = mesh(new THREE.CapsuleGeometry(arm ? 5.2 : 6.4, arm ? 18 : 20, 7, 12), material(arm ? skin : suit)); limb.position.y = arm ? -10 : -13; pivot.add(limb); return pivot;
  };
  root.userData.leftArm = makeLimb(-1, true); root.userData.rightArm = makeLimb(1, true);
  root.userData.leftLeg = makeLimb(-1, false); root.userData.rightLeg = makeLimb(1, false);
  const addConeEar = (side, color = skin, height = 27) => { const ear = mesh(new THREE.ConeGeometry(9, height, 4), material(color)); ear.position.set(side * 18, 101, 0); ear.rotation.z = side * -.18; rig.add(ear); };
  const addRoundEar = (side, color = skin) => { const ear = mesh(new THREE.SphereGeometry(10, 16, 12), material(color)); ear.position.set(side * 21, 96, 0); rig.add(ear); };
  const addLongEar = (side, color = skin) => { const ear = mesh(new THREE.CapsuleGeometry(7, 33, 7, 12), material(color)); ear.position.set(side * 13, 119, -2); ear.rotation.z = side * -.12; rig.add(ear); };
  const addTail = (color = skin, curl = .15) => { const tail = mesh(new THREE.TorusGeometry(28, 9, 10, 26, Math.PI * 1.15), material(color)); tail.position.set(-3, 44, -22); tail.rotation.set(Math.PI / 2, curl, -.45); rig.add(tail); };
  const addWing = (side, color = 0xf4ead8) => { const wing = mesh(new THREE.ConeGeometry(17, 48, 5), material(color)); wing.scale.set(1, 1, .35); wing.position.set(side * 27, 53, -13); wing.rotation.z = side * .72; wing.rotation.x = -.18; rig.add(wing); };
  const addGoggles = (color = 0x2b3c45) => { [-1, 1].forEach((side) => { const lens = mesh(new THREE.TorusGeometry(7, 2.2, 7, 20), material(color, { metalness: .45 })); lens.position.set(side * 9, 86, 24); rig.add(lens); }); const bridge = mesh(new THREE.BoxGeometry(7, 2.2, 2.2), material(color)); bridge.position.set(0, 86, 24); rig.add(bridge); };
  if (sprite === 0 || sprite === 9) { const halo = mesh(new THREE.TorusGeometry(sprite === 9 ? 18 : 16, 2.4, 9, 30), material(accent, { emissive: accent, emissiveIntensity: .25 }), false, false); halo.rotation.x = Math.PI / 2; halo.position.y = 105; rig.add(halo); }
  if ([1, 3, 8, 9].includes(sprite)) { addConeEar(-1); addConeEar(1); addTail(skin, sprite === 8 ? .55 : .15); }
  if (sprite === 2) { addGoggles(); for (let i = -1; i <= 1; i += 1) { const plume = mesh(new THREE.ConeGeometry(5.5, 23, 5), material(skin)); plume.position.set(i * 8, 107 + Math.abs(i) * -3, -1); plume.rotation.z = i * -.25; rig.add(plume); } }
  if (sprite === 3) { const crown = mesh(new THREE.ConeGeometry(9, 22, 5), material(0x326db4, { emissive: 0x194b83, emissiveIntensity: .22 })); crown.position.y = 111; rig.add(crown); }
  if (sprite === 4) { addRoundEar(-1); addRoundEar(1); const shield = mesh(new THREE.CylinderGeometry(22, 25, 7, 6), material(0x248f98, { metalness: .3 })); shield.rotation.z = Math.PI / 2; shield.position.set(-31, 42, 9); rig.add(shield); }
  if (sprite === 5) { addConeEar(-1, 0xf0ddb4, 23); addConeEar(1, 0xf0ddb4, 23); addWing(-1, 0xbce9d0); addWing(1, 0xbce9d0); addTail(skin, .5); }
  if (sprite === 6) { addLongEar(-1); addLongEar(1); addGoggles(0x493a34); }
  if (sprite === 7) { for (let i = 0; i < 8; i += 1) { const puff = mesh(new THREE.SphereGeometry(9, 13, 10), material(skin)); const angle = i / 8 * Math.PI * 2; puff.position.set(Math.cos(angle) * 24, 83 + Math.sin(angle) * 19, -6); rig.add(puff); } addRoundEar(-1, suit); addRoundEar(1, suit); }
  if (sprite === 8) { addGoggles(0x303b3c); const pack = mesh(new THREE.BoxGeometry(35, 39, 17), material(0x2b514f)); pack.position.set(0, 47, -21); rig.add(pack); }
  if (sprite === 9) { addWing(-1, 0xfff2ca); addWing(1, 0xfff2ca); const crown = mesh(new THREE.ConeGeometry(12, 25, 5), material(0xe2ad35, { metalness: .35 })); crown.position.y = 114; rig.add(crown); }
  const staff = new THREE.Group(); staff.position.set(30, 49, 2); staff.rotation.z = -.22; rig.add(staff);
  const pole = mesh(new THREE.CylinderGeometry(2.1, 2.1, 60, 10), material(0x6b4a36)); pole.position.y = -12; staff.add(pole);
  const core = mesh(new THREE.SphereGeometry(9, 18, 14), material(accent, { emissive: accent, emissiveIntensity: .35 })); core.position.y = 22; staff.add(core);
  const crossV = mesh(new THREE.BoxGeometry(4, 14, 4), material(0xf8f2da)); crossV.position.set(0, 22, 9); staff.add(crossV);
  const crossH = mesh(new THREE.BoxGeometry(14, 4, 4), material(0xf8f2da)); crossH.position.set(0, 22, 9); staff.add(crossH);
  root.userData.rig = rig; root.userData.shadow = shadow;
  return root;
}

function animateCharacter(root, state, time) {
  const speed = Math.hypot(state.velocity?.x || 0, state.velocity?.y || 0);
  const walking = speed > 12;
  const phase = Number(state.walkTime || time * 2.3) * Math.PI * .82;
  const stride = walking ? Math.sin(phase) : 0;
  root.userData.leftLeg.rotation.x = stride * .68;
  root.userData.rightLeg.rotation.x = -stride * .68;
  root.userData.leftArm.rotation.x = -stride * .52;
  root.userData.rightArm.rotation.x = stride * .52;
  root.userData.rig.position.y = 4 + (walking ? Math.abs(Math.sin(phase * 2)) * 3.2 : Math.sin(time * 2.2) * 1.25);
  root.userData.rig.rotation.z = walking ? Math.sin(phase) * .035 : 0;
  root.rotation.y = Number.isFinite(state.visualAngle) ? Math.PI / 2 - state.visualAngle : Math.atan2(state.direction?.x || 0, state.direction?.y || 1);
  root.userData.shadow.scale.setScalar(walking ? 1.06 : 1);
}

function createMicrobe(type = 0, radius = 24) {
  const hues = [0xb25173, 0x6b8fc8, 0xa15cac, 0xc67845, 0x6ea867, 0xb2a243];
  const color = hues[type % hues.length]; const root = new THREE.Group();
  const body = mesh(new THREE.IcosahedronGeometry(radius * .72, 2), material(color, { roughness: .58 })); body.position.y = radius * .8; root.add(body);
  const spikeMat = material(new THREE.Color(color).offsetHSL(.03, .12, .12));
  for (let index = 0; index < 9; index += 1) {
    const angle = index / 9 * Math.PI * 2; const spike = mesh(new THREE.ConeGeometry(radius * .12, radius * .48, 8), spikeMat);
    spike.position.set(Math.cos(angle) * radius * .62, radius * .8, Math.sin(angle) * radius * .62); spike.rotation.z = Math.PI / 2; spike.rotation.y = -angle; root.add(spike);
  }
  [-1, 1].forEach((side) => { const eye = mesh(new THREE.SphereGeometry(radius * .105, 12, 10), material(0x17151c), false, false); eye.position.set(side * radius * .22, radius * .91, radius * .63); root.add(eye); });
  root.userData.body = body; return root;
}

function createCellTexture(colors) {
  const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 768; const ctx = canvas.getContext("2d");
  const top = `#${colors[0].toString(16).padStart(6, "0")}`; const lower = `#${colors[1].toString(16).padStart(6, "0")}`;
  const gradient = ctx.createRadialGradient(460, 330, 50, 460, 330, 690); gradient.addColorStop(0, top); gradient.addColorStop(1, lower); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1024, 768);
  for (let index = 0; index < 38; index += 1) { const x = (index * 211 + 73) % 1024; const y = (index * 137 + 41) % 768; const radius = 25 + index % 6 * 7; ctx.globalAlpha = .09 + index % 3 * .025; ctx.fillStyle = index % 2 ? "#ffffff" : "#5b3143"; ctx.beginPath(); ctx.ellipse(x, y, radius * 1.4, radius, index * .37, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1; const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2.1, 1.6); return texture;
}

function createObstacle(item, colors) {
  const root = new THREE.Group(); const width = item.w * WORLD_SCALE; const depth = item.h * WORLD_SCALE;
  const organelleColors = { mitochondrion: 0x6eb8d4, lysosome: 0xf0ce55, nucleus: 0xc79bce, golgi: 0x7bb46f, er: 0xe3808f, microtubule: 0x79a967 };
  const color = organelleColors[item.type] || colors[1];
  if (item.type === "golgi" || item.type === "er") {
    for (let layer = 0; layer < 4; layer += 1) { const band = mesh(new THREE.TorusGeometry(Math.max(18, width * (.24 + layer * .035)), 5.5, 10, 34, Math.PI * 1.35), material(color)); band.rotation.x = Math.PI / 2; band.rotation.z = .7; band.scale.z = Math.max(.55, depth / Math.max(80, width)); band.position.y = 10 + layer * 7; root.add(band); }
  } else {
    const body = mesh(new THREE.SphereGeometry(34, 28, 18), material(color)); body.scale.set(Math.max(.7, width / 70), item.type === "nucleus" ? 1.2 : .72, Math.max(.7, depth / 70)); body.position.y = item.type === "nucleus" ? 32 : 23; root.add(body);
    if (item.type === "mitochondrion") { const ring = mesh(new THREE.TorusGeometry(20, 3.4, 8, 28), material(0xf8e9cd)); ring.scale.set(Math.max(.9, width / 100), 1, Math.max(.6, depth / 85)); ring.rotation.x = Math.PI / 2; ring.position.y = 42; root.add(ring); }
  }
  const p = position3(item.x + item.w / 2, item.y + item.h / 2); root.position.copy(p); return root;
}

function addLights(scene) {
  const hemi = new THREE.HemisphereLight(0xfff0df, 0x472d43, 2.4); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff2d5, 4.2); key.position.set(-300, 620, 260); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -650; key.shadow.camera.right = 650; key.shadow.camera.top = 500; key.shadow.camera.bottom = -500; scene.add(key);
  const fill = new THREE.PointLight(0x73e2dd, 28, 800, 1.7); fill.position.set(320, 180, -260); scene.add(fill);
}

class BaseRenderer {
  constructor(canvas, { alpha = false } = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(1.65, window.devicePixelRatio || 1)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.08;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(43, 1, 1, 3000); this.clock = new THREE.Clock();
  }
  resize() { const width = Math.max(1, this.canvas.clientWidth); const height = Math.max(1, this.canvas.clientHeight); this.renderer.setSize(width, height, false); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); }
}

export class Mediguard3DBattle extends BaseRenderer {
  constructor(canvas) { super(canvas); this.mapId = ""; this.playerModel = null; this.enemyObjects = new Map(); this.holeObjects = new Map(); this.projectileObjects = new Map(); }
  buildWorld(mapId, obstacles) {
    [...this.scene.children].forEach(disposeObject); this.enemyObjects.clear(); this.holeObjects.clear(); this.projectileObjects.clear(); this.playerModel = null; this.mapId = mapId;
    const colors = MAP_COLORS[mapId] || MAP_COLORS.lung; this.scene.background = new THREE.Color(colors[2]); this.scene.fog = new THREE.Fog(colors[2], 640, 1200); addLights(this.scene);
    const texture = createCellTexture(colors); const floor = mesh(new THREE.PlaneGeometry(WORLD_WIDTH * WORLD_SCALE, WORLD_HEIGHT * WORLD_SCALE), material(0xffffff, { map: texture, roughness: .88 }), false, true); floor.rotation.x = -Math.PI / 2; this.scene.add(floor);
    const membraneMat = material(colors[1], { emissive: colors[2], emissiveIntensity: .08 });
    [[0, -WORLD_HEIGHT * WORLD_SCALE / 2, WORLD_WIDTH * WORLD_SCALE, 24], [0, WORLD_HEIGHT * WORLD_SCALE / 2, WORLD_WIDTH * WORLD_SCALE, 24], [-WORLD_WIDTH * WORLD_SCALE / 2, 0, 24, WORLD_HEIGHT * WORLD_SCALE], [WORLD_WIDTH * WORLD_SCALE / 2, 0, 24, WORLD_HEIGHT * WORLD_SCALE]].forEach(([x, z, w, d]) => { const wall = mesh(new THREE.BoxGeometry(w, 30, d), membraneMat); wall.position.set(x, 12, z); this.scene.add(wall); });
    obstacles.forEach((item) => this.scene.add(createObstacle(item, colors)));
  }
  syncMap(map, factory, store, update) {
    const active = new Set();
    map.forEach((entity) => { active.add(entity); let object = store.get(entity); if (!object) { object = factory(entity); store.set(entity, object); this.scene.add(object); } update(object, entity); });
    for (const [entity, object] of store) if (!active.has(entity)) { disposeObject(object); store.delete(entity); }
  }
  render(battle, obstacles) {
    this.resize(); if (this.mapId !== battle.run.map.id) this.buildWorld(battle.run.map.id, obstacles);
    const time = performance.now() / 1000;
    if (!this.playerModel || this.playerModel.userData.sprite !== Number(battle.run.character.sprite || 0)) { if (this.playerModel) disposeObject(this.playerModel); this.playerModel = createCharacterModel(battle.run.character.sprite); this.scene.add(this.playerModel); }
    const playerPosition = position3(battle.player.x, battle.player.y); this.playerModel.position.copy(playerPosition); this.playerModel.visible = !battle.player.hidden; animateCharacter(this.playerModel, battle.player, time);
    this.playerModel.traverse((child) => { if (child.material && "opacity" in child.material) { child.material.transparent = battle.player.invincible > 0; child.material.opacity = battle.player.invincible > 0 && Math.floor(time * 10) % 2 ? .42 : 1; } });
    this.syncMap(battle.enemies, (enemy) => createMicrobe(enemy.type, enemy.radius), this.enemyObjects, (object, enemy) => { object.position.copy(position3(enemy.x, enemy.y)); object.rotation.y = Math.atan2(battle.player.x - enemy.x, battle.player.y - enemy.y); object.position.y = 2 + Math.sin(time * 5 + enemy.x * .01) * 3; object.userData.body.scale.setScalar(enemy.flash > 0 ? 1.15 : 1); });
    this.syncMap(battle.holes, () => { const ring = mesh(new THREE.TorusGeometry(24, 6, 10, 32), material(0x4a1737, { emissive: 0x7c2349, emissiveIntensity: .4 })); ring.rotation.x = Math.PI / 2; return ring; }, this.holeObjects, (object, hole) => { object.position.copy(position3(hole.x, hole.y, 2)); const pulse = hole.spawned ? 1 : 1 + Math.sin(time * 9) * .16; object.scale.setScalar(pulse); });
    this.syncMap(battle.projectiles, (shot) => mesh(new THREE.SphereGeometry(Math.max(5, shot.radius * .75), 14, 10), material(shot.piercing ? 0xffdc58 : 0x62f6dc, { emissive: shot.piercing ? 0xffb429 : 0x2cbba8, emissiveIntensity: 1.4 })), this.projectileObjects, (object, shot) => object.position.copy(position3(shot.x, shot.y, 24)));
    const follow = new THREE.Vector3(playerPosition.x, 0, playerPosition.z); const landscape = this.canvas.clientWidth > this.canvas.clientHeight; const cameraOffset = landscape ? new THREE.Vector3(0, 430, 475) : new THREE.Vector3(0, 520, 610); const targetCamera = follow.clone().add(cameraOffset); this.camera.position.lerp(targetCamera, .11); this.camera.lookAt(follow.x, 18, follow.z - 28);
    this.renderer.render(this.scene, this.camera);
  }
}

export class Mediguard3DShowcase extends BaseRenderer {
  constructor(canvas) {
    super(canvas, { alpha: true }); this.renderer.setClearColor(0x000000, 0); this.sprite = -1; this.actor = null; this.running = true; this.scene.background = null; addLights(this.scene);
    const platform = mesh(new THREE.CylinderGeometry(92, 118, 18, 48), material(0x754654, { metalness: .2 })); platform.position.y = -4; this.scene.add(platform);
    for (let i = 0; i < 5; i += 1) { const orb = mesh(new THREE.SphereGeometry(8 + i % 2 * 4, 16, 12), material(i % 2 ? 0x77c6d6 : 0xe7cc59, { emissive: i % 2 ? 0x1c8193 : 0x9a7620, emissiveIntensity: .2 })); orb.position.set(Math.cos(i * 1.7) * 115, 15 + i * 5, Math.sin(i * 1.7) * 70); this.scene.add(orb); }
    this.camera.position.set(0, 105, 235); this.camera.lookAt(0, 48, 0); this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  setCharacter(sprite) { if (this.sprite === Number(sprite || 0)) return; this.sprite = Number(sprite || 0); if (this.actor) disposeObject(this.actor); this.actor = createCharacterModel(this.sprite); this.actor.scale.setScalar(1.2); this.scene.add(this.actor); }
  loop() { if (!this.running) return; this.resize(); const time = performance.now() / 1000; if (this.actor) { animateCharacter(this.actor, { direction: { x: Math.sin(time * .38), y: Math.cos(time * .38) }, velocity: { x: 0, y: 0 }, walkTime: 0 }, time); this.actor.rotation.y = Math.sin(time * .45) * .32; } this.renderer.render(this.scene, this.camera); requestAnimationFrame(this.loop); }
}

export class Mediguard3DPortraits {
  constructor() {
    this.canvas = document.createElement("canvas"); this.canvas.width = 320; this.canvas.height = 320; this.cache = new Map();
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    this.renderer.setSize(320, 320, false); this.renderer.setPixelRatio(1); this.renderer.setClearColor(0x000000, 0); this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.12;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(37, 1, 1, 1000); this.camera.position.set(0, 88, 245); this.camera.lookAt(0, 52, 0); addLights(this.scene);
  }
  render(sprite = 0) {
    const key = Number(sprite || 0); if (this.cache.has(key)) return this.cache.get(key);
    const actor = createCharacterModel(key); actor.scale.setScalar(1.2); actor.rotation.y = -.26; animateCharacter(actor, { direction: { x: .22, y: 1 }, velocity: { x: 0, y: 0 }, walkTime: 0 }, key * .37); this.scene.add(actor);
    this.renderer.render(this.scene, this.camera); const portrait = this.canvas.toDataURL("image/png"); disposeObject(actor); this.cache.set(key, portrait); return portrait;
  }
}

export function supportsMediguard3D() {
  try { const canvas = document.createElement("canvas"); return Boolean(canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true })); } catch { return false; }
}
