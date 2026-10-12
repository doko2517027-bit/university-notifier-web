import * as THREE from 'three';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.78, ...extra });

export function makePlaceholderCharacter(color = 0x3c6fd5) {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.78, 4, 10), mat(color));
  body.position.y = 1.26;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 12), mat(0xffd4a7));
  head.position.y = 2.13;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.46), mat(0x3b3041));
  hair.position.y = 2.19;
  root.add(body, head, hair);
  const arms = [];
  const legs = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.47, 1.7, 0);
    const armMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.46, 3, 7), mat(color));
    armMesh.position.y = -0.34;
    arm.add(armMesh);
    root.add(arm);
    arms.push(arm);
    const leg = new THREE.Group();
    leg.position.set(side * 0.2, 0.8, 0);
    const legMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.42, 3, 7), mat(0x243358));
    legMesh.position.y = -0.33;
    leg.add(legMesh);
    root.add(leg);
    legs.push(leg);
  }
  root.userData.placeholderLimbs = { arms, legs };
  return root;
}

export function animatePlaceholder(model, seconds, moving, throwing = false) {
  const limbs = model.userData.placeholderLimbs;
  if (!limbs) return;
  const swing = moving ? Math.sin(seconds * 11) * 0.55 : Math.sin(seconds * 2) * 0.04;
  limbs.arms[0].rotation.x = swing;
  limbs.arms[1].rotation.x = throwing ? -1.25 : -swing;
  limbs.legs[0].rotation.x = -swing;
  limbs.legs[1].rotation.x = swing;
  model.position.y = moving ? Math.abs(Math.sin(seconds * 11)) * 0.055 : Math.sin(seconds * 2) * 0.025;
}

export async function loadCharacter(assetPath, fallbackColor) {
  if (!assetPath) return { model: makePlaceholderCharacter(fallbackColor), mixer: null, clips: {} };
  try {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(assetPath);
    const model = gltf.scene;
    model.traverse((child) => { if (child.isMesh) child.castShadow = true; });
    const mixer = new THREE.AnimationMixer(model);
    const clips = Object.fromEntries(gltf.animations.map((clip) => [clip.name.toLowerCase(), clip]));
    return { model, mixer, clips };
  } catch (error) {
    console.warn('Throb model fallback:', error);
    return { model: makePlaceholderCharacter(fallbackColor), mixer: null, clips: {} };
  }
}

export async function loadVisualModel(assetPath) {
  if (!assetPath) return null;
  try {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(assetPath);
    return gltf.scene;
  } catch (error) {
    console.warn('Throb visual fallback:', error);
    return null;
  }
}

export function playCharacterAction(asset, actionName) {
  if (!asset.mixer) return;
  const clip = asset.clips[actionName.toLowerCase()];
  if (!clip || asset.activeAction === actionName) return;
  asset.mixer.stopAllAction();
  asset.mixer.clipAction(clip).reset().fadeIn(0.12).play();
  asset.activeAction = actionName;
}

export function makePlaceholderWeapon(weapon) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...weapon.size),
    mat(weapon.color, { metalness: weapon.id === 'knife' ? 0.55 : 0.05 }),
  );
  mesh.castShadow = true;
  return mesh;
}

export function disposeObject(root) {
  root.traverse((child) => {
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material) return;
      Object.values(material).forEach((value) => { if (value?.isTexture) value.dispose(); });
      material.dispose();
    });
  });
}
