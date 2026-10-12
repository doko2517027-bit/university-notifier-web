import * as THREE from 'three';
import { STAGES } from '../data/config.js';

const material = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.88 });

export function createClassroom({ includePlaceholderVisuals = true } = {}) {
  const data = STAGES.classroom;
  const group = new THREE.Group();
  if (includePlaceholderVisuals) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(data.width, data.depth), material(0xd3b993));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const wallMat = material(0xd4ddeb);
  const wall = (x, z, w, d) => {
    const item = new THREE.Mesh(new THREE.BoxGeometry(w, 4.2, d), wallMat);
    item.position.set(x, 2.1, z);
    item.castShadow = true;
    item.receiveShadow = true;
    group.add(item);
  };
  wall(0, -data.depth / 2, data.width, 0.4);
  wall(0, data.depth / 2, data.width, 0.4);
  wall(-data.width / 2, 0, 0.4, data.depth);
  wall(data.width / 2, 0, 0.4, data.depth);
  const board = new THREE.Mesh(new THREE.BoxGeometry(8, 2.2, 0.12), material(0x315d63));
  board.position.set(0, 2.3, -data.depth / 2 + 0.29);
  group.add(board);
  for (let i = -2; i <= 2; i++) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.2), material(0x9ed0e4));
    pane.position.set(-data.width / 2 + 0.23, 2.6, i * 4.8);
    pane.rotation.y = Math.PI / 2;
    group.add(pane);
  }

  const coverMat = { desk: material(0x9b7052), cabinet: material(0x786a5f), platform: material(0x6d92ad) };
  for (const cover of data.cover) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(cover.w, cover.h, cover.d), coverMat[cover.kind]);
    mesh.position.set(cover.x, cover.h / 2, cover.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (cover.kind === 'desk') {
      const top = new THREE.Mesh(new THREE.BoxGeometry(cover.w + 0.2, 0.12, cover.d + 0.2), material(0xc39a72));
      top.position.set(cover.x, cover.h + 0.05, cover.z);
      group.add(top);
    }
  }
  for (const pad of data.jumpPads) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.14, 20), material(0xf2b752));
    mesh.position.set(pad.x, 0.08, pad.z);
    group.add(mesh);
  }
  }
  const healMeshes = data.healSpawns.map((spot) => {
    const groupHeal = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.5, 0.55), material(0xf9fbfc));
    box.position.y = 0.37;
    const crossA = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.02), material(0xdf5c68));
    const crossB = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.02), material(0xdf5c68));
    crossA.position.set(0, 0.38, 0.29); crossB.position.copy(crossA.position);
    groupHeal.add(box, crossA, crossB);
    groupHeal.position.set(spot.x, 0, spot.z);
    group.add(groupHeal);
    return { mesh: groupHeal, x: spot.x, z: spot.z, active: true, cooldown: 0 };
  });

  return { group, data, healMeshes };
}

export function collidesWithCover(x, z, feetY, radius = 0.42) {
  return STAGES.classroom.cover.some((box) =>
    feetY < box.h - 0.08 && Math.abs(x - box.x) < box.w / 2 + radius && Math.abs(z - box.z) < box.d / 2 + radius,
  );
}

export function floorHeightAt(x, z) {
  const platform = STAGES.classroom.cover.find((box) => box.kind === 'platform');
  if (Math.abs(x - platform.x) < platform.w / 2 - 0.15 && Math.abs(z - platform.z) < platform.d / 2 - 0.15) return platform.h;
  return 0;
}

export function withinStage(x, z) {
  return Math.abs(x) < STAGES.classroom.width / 2 - 0.75 && Math.abs(z) < STAGES.classroom.depth / 2 - 0.75;
}

export function obstacleAt(x, y, z) {
  if (y < 0 || !withinStage(x, z)) return true;
  return STAGES.classroom.cover.some((box) =>
    x > box.x - box.w / 2 && x < box.x + box.w / 2 && z > box.z - box.d / 2 && z < box.z + box.d / 2 && y < box.h,
  );
}
