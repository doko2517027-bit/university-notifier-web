import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const ORGAN_COLORS = Object.freeze({
  heart: 0xd83b4b,
  lungs: 0xe78898,
  eyes: 0x77cfe0,
  muscle: 0xb93737,
  skin: 0xf1b894,
  kidney: 0x8e3f56,
  brain: 0xe9a6bd,
});

export function createBoneCharacterViewer({ canvas, onOrganSelect = () => {} }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const saved = readSavedView();
  camera.position.set(0, 1.35, saved.zoom);
  camera.lookAt(0, 1.35, 0);
  scene.add(new THREE.HemisphereLight(0xe9fffb, 0x37545a, 2.6));
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
  keyLight.position.set(4, 7, 5);
  keyLight.castShadow = true;
  scene.add(keyLight);
  const rimLight = new THREE.PointLight(0x47d9bd, 16, 9);
  rimLight.position.set(-3, 3, -3);
  scene.add(rimLight);

  const character = new THREE.Group();
  character.rotation.y = saved.rotation;
  scene.add(character);
  const boneMaterial = new THREE.MeshStandardMaterial({ color: 0xf2ebd7, roughness: 0.56, metalness: 0.03 });
  const jointMaterial = new THREE.MeshStandardMaterial({ color: 0xd9ceb5, roughness: 0.68 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x26383b, roughness: 0.72 });
  const organs = new Map();
  let internalMode = true;
  let disposed = false;
  let frameId = 0;

  const sphere = (name, position, scale, material = boneMaterial) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    character.add(mesh);
    return mesh;
  };
  const cylinderBetween = (name, start, end, radius = .055, material = boneMaterial) => {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const direction = new THREE.Vector3().subVectors(b, a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * .92, direction.length(), 14), material);
    mesh.name = name;
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    mesh.castShadow = true;
    character.add(mesh);
    return mesh;
  };

  // 人体に近い比率のコード生成モデル。外部3Dモデルは利用しない。
  sphere("skull", [0, 2.65, 0], [.39, .48, .36]);
  sphere("jaw", [0, 2.29, .03], [.27, .16, .26], jointMaterial);
  sphere("eyeSocketL", [-.14, 2.68, .31], [.095, .12, .045], darkMaterial);
  sphere("eyeSocketR", [.14, 2.68, .31], [.095, .12, .045], darkMaterial);
  cylinderBetween("neck", [0, 2.19, 0], [0, 2.03, 0], .07);
  cylinderBetween("spine", [0, 2.02, 0], [0, .95, 0], .065);
  cylinderBetween("clavicleL", [0, 2.02, 0], [-.4, 1.98, 0], .045);
  cylinderBetween("clavicleR", [0, 2.02, 0], [.4, 1.98, 0], .045);
  for (let index = 0; index < 7; index += 1) {
    const y = 1.92 - index * .12;
    const width = .43 - Math.abs(index - 3) * .027;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(width, .025, 8, 36, Math.PI * 1.72), boneMaterial);
    rib.position.set(0, y, .02);
    rib.rotation.set(Math.PI / 2, 0, Math.PI * .14);
    rib.scale.z = .58;
    rib.castShadow = true;
    character.add(rib);
  }
  cylinderBetween("sternum", [0, 1.98, .28], [0, 1.27, .22], .04);
  sphere("pelvis", [0, .93, 0], [.38, .24, .23], jointMaterial);
  const limbs = [
    [[-.4, 1.98, 0], [-.62, 1.38, .01], [-.66, .84, .05]],
    [[.4, 1.98, 0], [.62, 1.38, .01], [.66, .84, .05]],
    [[-.2, .86, 0], [-.26, .12, .02], [-.29, -.65, .1]],
    [[.2, .86, 0], [.26, .12, .02], [.29, -.65, .1]],
  ];
  limbs.forEach(([top, middle, end], index) => {
    const radius = index < 2 ? .055 : .072;
    cylinderBetween(`limb${index}a`, top, middle, radius);
    sphere(`joint${index}`, middle, [radius * 1.55, radius * 1.55, radius * 1.55], jointMaterial);
    cylinderBetween(`limb${index}b`, middle, end, radius * .86);
    sphere(`end${index}`, end, index < 2 ? [.09, .13, .07] : [.12, .08, .24], jointMaterial);
  });

  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.35, 48), new THREE.MeshStandardMaterial({ color: 0x4a6865, transparent: true, opacity: .26, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.75;
  floor.receiveShadow = true;
  scene.add(floor);

  function organMaterial(organ, opacity = 1) {
    return new THREE.MeshStandardMaterial({ color: ORGAN_COLORS[organ], roughness: .42, metalness: .02, transparent: opacity < 1, opacity, emissive: ORGAN_COLORS[organ], emissiveIntensity: .04 });
  }

  function markOrgan(mesh, organ, item) {
    mesh.userData.organ = organ;
    mesh.userData.item = item;
    mesh.castShadow = true;
    const existing = organs.get(organ) || [];
    existing.push(mesh);
    organs.set(organ, existing);
    character.add(mesh);
    return mesh;
  }

  function clearOrgans() {
    for (const meshes of organs.values()) {
      for (const mesh of meshes) {
        character.remove(mesh);
        mesh.geometry?.dispose();
        mesh.material?.dispose();
      }
    }
    organs.clear();
  }

  function addOrgan(item) {
    const organ = item.organ;
    if (organ === "heart") {
      const heart = markOrgan(new THREE.Mesh(new THREE.SphereGeometry(.15, 24, 18), organMaterial(organ)), organ, item);
      heart.position.set(-.08, 1.59, .25); heart.scale.set(.86, 1.16, .75);
    } else if (organ === "lungs") {
      [-1, 1].forEach((side) => {
        const lung = markOrgan(new THREE.Mesh(new THREE.SphereGeometry(.2, 24, 18), organMaterial(organ, .94)), organ, item);
        lung.position.set(side * .17, 1.68, .19); lung.scale.set(.72, 1.48, .7);
      });
    } else if (organ === "eyes") {
      [-1, 1].forEach((side) => {
        const eye = markOrgan(new THREE.Mesh(new THREE.SphereGeometry(.075, 20, 16), organMaterial(organ)), organ, item);
        eye.position.set(side * .14, 2.68, .34);
      });
    } else if (organ === "kidney") {
      [-1, 1].forEach((side) => {
        const kidney = markOrgan(new THREE.Mesh(new THREE.SphereGeometry(.11, 20, 16), organMaterial(organ)), organ, item);
        kidney.position.set(side * .17, 1.12, -.03); kidney.scale.set(.75, 1.15, .55);
      });
    } else if (organ === "brain") {
      const brain = markOrgan(new THREE.Mesh(new THREE.SphereGeometry(.27, 28, 20), organMaterial(organ, .9)), organ, item);
      brain.position.set(0, 2.72, 0); brain.scale.set(1, .72, .78);
    } else if (organ === "muscle" || organ === "skin") {
      const shell = markOrgan(new THREE.Mesh(new THREE.CapsuleGeometry(.38, 1.55, 12, 22), organMaterial(organ, organ === "skin" ? .42 : .28)), organ, item);
      shell.position.set(0, .9, 0); shell.scale.set(1, 1.25, .66);
    }
  }

  function setEquipped(visualEquipped = {}, catalog = []) {
    clearOrgans();
    for (const itemId of Object.values(visualEquipped || {})) {
      const item = catalog.find((candidate) => candidate.id === itemId);
      if (item?.organ) addOrgan(item);
    }
    applyInternalMode();
  }

  function applyInternalMode() {
    for (const [organ, meshes] of organs.entries()) {
      for (const mesh of meshes) {
        if (organ === "skin" || organ === "muscle") {
          mesh.material.opacity = internalMode ? .16 : organ === "skin" ? .7 : .42;
          mesh.material.transparent = true;
        }
      }
    }
  }

  function toggleInternal() {
    internalMode = !internalMode;
    applyInternalMode();
    return internalMode;
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const activePointers = new Map();
  let lastX = 0;
  let dragging = false;
  let pinchDistance = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  canvas.addEventListener("pointerdown", (event) => {
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    dragging = true;
    lastX = event.clientX;
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.size === 2) {
      const [a, b] = [...activePointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance) setZoom(camera.position.z + (pinchDistance - distance) * .012);
      pinchDistance = distance;
      return;
    }
    character.rotation.y += (event.clientX - lastX) * .012;
    lastX = event.clientX;
  });
  const pointerUp = (event) => {
    const started = activePointers.get(event.pointerId);
    activePointers.delete(event.pointerId);
    pinchDistance = 0;
    dragging = activePointers.size > 0;
    if (started && Math.hypot(event.clientX - started.x, event.clientY - started.y) < 7) selectAt(event);
    saveView();
  };
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  canvas.addEventListener("wheel", (event) => { event.preventDefault(); setZoom(camera.position.z + event.deltaY * .003); saveView(); }, { passive: false });

  function setZoom(value) {
    camera.position.z = THREE.MathUtils.clamp(value, 4.2, 8.4);
  }

  function selectAt(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const targets = [...organs.values()].flat();
    const hit = raycaster.intersectObjects(targets, false)[0];
    if (!hit?.object?.userData?.organ) return;
    for (const meshes of organs.values()) for (const mesh of meshes) mesh.material.emissiveIntensity = .04;
    hit.object.material.emissiveIntensity = .45;
    onOrganSelect(hit.object.userData.organ, hit.object.userData.item);
  }

  function saveView() {
    try { sessionStorage.setItem("bonadCharacterView", JSON.stringify({ rotation: character.rotation.y, zoom: camera.position.z })); } catch {}
  }

  function animate(time) {
    if (disposed) return;
    character.position.y = Math.sin(time * .0017) * .018;
    if (!dragging) character.rotation.y += Math.sin(time * .00065) * .00035;
    const heartMeshes = organs.get("heart") || [];
    const pulse = 1 + Math.max(0, Math.sin(time * .007)) * .06;
    heartMeshes.forEach((mesh) => mesh.scale.set(.86 * pulse, 1.16 * pulse, .75 * pulse));
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(animate);
  }
  frameId = requestAnimationFrame(animate);

  function dispose() {
    disposed = true;
    cancelAnimationFrame(frameId);
    observer.disconnect();
    renderer.dispose();
  }

  return { setEquipped, toggleInternal, dispose, getView: () => ({ rotation: character.rotation.y, zoom: camera.position.z }) };
}

function readSavedView() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem("bonadCharacterView") || "{}");
    return { rotation: Number.isFinite(parsed.rotation) ? parsed.rotation : -.24, zoom: Number.isFinite(parsed.zoom) ? parsed.zoom : 6.25 };
  } catch {
    return { rotation: -.24, zoom: 6.25 };
  }
}
