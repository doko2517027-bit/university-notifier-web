import { auth, functions, studentNumber, initializePage, setupAdminTab, isMediguardTestStudent } from "./common.js?v=20261011-2";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";
import { mediguardAudio } from "./mediguard_audio.js?v=20261012-1";

const $ = (id) => document.getElementById(id);
const gameCall = httpsCallable(functions, "mediguardGame", { timeout: 60000 });
const RARITY_COLORS = { N: "#708c84", R: "#408fc5", SR: "#8258c9", SSR: "#d65788", UR: "#e18c2f", LR: "#d9ac2a" };
const MAP_STYLE = {
  lung: ["#dca6af", "#f2cad0", "#a96675"], airway: ["#b4c5c8", "#dce7e4", "#668b8e"],
  intestine: ["#c69a76", "#e5c3a1", "#8f674c"], urinary: ["#a9a2c4", "#d8d0e7", "#716991"],
  vessel: ["#774956", "#bc7784", "#4f303b"], skin: ["#d8b293", "#f0d2b8", "#9f765a"],
};
let dashboard = null;
let busy = false;
let toastTimer = 0;
let battle = null;
let frameId = 0;
let lastFrame = 0;
let keyState = new Set();
let selectedBannerId = "";
let finishGachaCinematic = null;
let stick = { x: 0, y: 0, pointer: null, baseX: 0, baseY: 0 };
let dpad = { up: false, down: false, left: false, right: false };
let attackAim = { pointer: null, x: 0, y: 0 };
let battle3d = null;
let home3d = null;
let portraits3d = null;
let loading3d = null;
const CONTROL_STORAGE_KEY = "caremate_mediguard_control_v1";
let controlMode = localStorage.getItem(CONTROL_STORAGE_KEY) === "joystick" ? "joystick" : "dpad";
const loadSpriteSet = (prefix, count) => Array.from({ length: count }, (_, index) => {
  const image = new Image();
  image.src = `images/mediguard-sprites/${prefix}-${index}.png`;
  return image;
});
const characterImages = loadSpriteSet("character", 10);
const pathogenImages = loadSpriteSet("pathogen", 12);
const starterWalkImage = new Image();
starterWalkImage.src = "images/mediguard-sprites/character-0-walk-v2.png";

function requestId() { return crypto.randomUUID ? crypto.randomUUID().replaceAll("-", "") : `${Date.now()}_${crypto.getRandomValues(new Uint32Array(4)).join("_")}`; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]); }
function errorText(error, fallback = "処理に失敗しました。") { return String(error?.details || error?.message || fallback).replace(/^FirebaseError:\s*/i, ""); }
function format(value) { return Math.max(0, Number(value || 0)).toLocaleString("ja-JP"); }
function showToast(text) { clearTimeout(toastTimer); $("toast").textContent = text; $("toast").hidden = false; toastTimer = setTimeout(() => { $("toast").hidden = true; }, 3300); }
function setBusy(value) { busy = value; document.body.classList.toggle("game-busy", value); }
function spriteClass(index) { return `character-sprite sprite-${Math.max(0, Math.min(9, Number(index || 0)))}`; }
function selectedCharacter() { return dashboard?.characters?.find((item) => item.instanceId === dashboard.player.selectedCharacterId) || dashboard?.characters?.[0]; }
async function api(action, payload = {}) { const response = await gameCall({ action, ...payload }); return response.data; }
async function refresh() { dashboard = await api("dashboard"); render(); return dashboard; }
async function mutate(action, payload, success) {
  if (busy) return null; setBusy(true);
  try { const result = await api(action, payload); await refresh(); if (success) showToast(success); return result; }
  catch (error) { console.error(error); showToast(errorText(error)); return null; }
  finally { setBusy(false); }
}
function render() {
  const character = selectedCharacter(); if (!character) return;
  $("gachaPoints").textContent = format(dashboard.player.gachaPoints);
  $("selectedName").textContent = character.name; $("selectedLevel").textContent = character.level;
  $("selectedCharacter").querySelector("span").className = spriteClass(character.sprite);
  home3d?.setCharacter(character.sprite);
  renderCharacters(); renderRecords(); renderGachaBanners(); renderLimitBreak();
  apply3DPortraits();
}
function apply3DPortraits(root = document) {
  if (!portraits3d) return;
  root.querySelectorAll(".character-sprite").forEach((element) => {
    const spriteClassName = [...element.classList].find((name) => /^sprite-\d+$/.test(name));
    if (!spriteClassName) return; const sprite = Number(spriteClassName.slice(7));
    element.style.backgroundImage = `url("${portraits3d.render(sprite)}")`; element.classList.add("rendered-3d");
  });
}
async function initialize3D() {
  if (battle3d || loading3d) return loading3d;
  loading3d = import("./mediguard_3d.js?v=20261012-1").then((module) => {
    if (!module.supportsMediguard3D()) return false;
    battle3d = new module.Mediguard3DBattle($("battleCanvas"));
    home3d = new module.Mediguard3DShowcase($("home3dCanvas"));
    portraits3d = new module.Mediguard3DPortraits();
    const character = selectedCharacter(); if (character) home3d.setCharacter(character.sprite);
    document.body.classList.add("mediguard-3d");
    apply3DPortraits();
    return true;
  }).catch((error) => { console.warn("3D表示を開始できないため2D表示を使用します。", error); return false; });
  return loading3d;
}
function selectedBanner() {
  return dashboard?.banners?.find((item) => item.id === selectedBannerId)
    || dashboard?.banners?.find((item) => item.id === dashboard.activeBannerId)
    || dashboard?.banners?.[0];
}
function renderGachaBanners() {
  const banners = dashboard?.banners || [];
  if (!banners.some((item) => item.id === selectedBannerId)) selectedBannerId = dashboard?.activeBannerId || banners[0]?.id || "";
  const current = selectedBanner();
  $("gachaBannerList").innerHTML = banners.length ? banners.map((item) => `<button type="button" data-banner="${escapeHtml(item.id)}" class="${item.id === current?.id ? "active" : ""}" style="--banner-accent:${item.accent}"><span>${item.limited ? "期間限定" : "常設"}</span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.subtitle || "キャラクタースキャン")}</small></button>`).join("") : '<p class="medical-note">現在引けるガチャはありません。</p>';
  $("singleGachaCost").textContent = `${format(current?.singleCost || 30)} GP`;
  $("tenGachaCost").textContent = `${format(current?.tenCost || 300)} GP`;
  document.querySelectorAll("[data-draw]").forEach((button) => { button.disabled = !current; });
}
function showView(name) {
  const ids = { home: "homeView", characters: "charactersView", gacha: "gachaView", records: "recordsView", help: "helpView", limitBreak: "limitBreakView", settings: "settingsView" };
  document.querySelectorAll(".game-view").forEach((view) => { view.hidden = true; });
  $(ids[name] || ids.home).hidden = false;
  $("screenTitle").textContent = { home: "メディガード！", characters: "キャラクター", gacha: "キャラガチャ", records: "防衛記録", help: "遊び方", limitBreak: "限界突破", settings: "ゲーム設定" }[name] || "メディガード！";
  mediguardAudio.playMusic(name === "gacha" ? "gacha" : "home");
}
function renderCharacters() {
  $("characterList").innerHTML = dashboard.characters.map((item) => {
    const chosen = item.instanceId === dashboard.player.selectedCharacterId;
    const same = dashboard.characters.filter((other) => other.characterId === item.characterId && other.instanceId !== item.instanceId);
    return `<article class="character-card ${chosen ? "selected" : ""}" style="--rarity:${RARITY_COLORS[item.rarity]}">
      <button class="favorite-button" data-favorite="${item.instanceId}" data-value="${!item.favorite}" aria-label="お気に入り">${item.favorite ? "★" : "☆"}</button>
      <span class="${spriteClass(item.sprite)}"></span><div><span class="rarity">${item.rarity}</span><h3>${escapeHtml(item.name)} <small>Lv.${item.level}</small></h3><p>${escapeHtml(item.passive)}</p><p>${escapeHtml(item.skill)}</p><small>能力強化 +${item.dupeLevel} / 5</small></div>
      <footer>${chosen ? '<button disabled>出撃中</button>' : `<button class="primary" data-select="${item.instanceId}">出撃設定</button>`}${same.length && !chosen && !item.favorite ? `<button data-strengthen="${item.instanceId}" data-target="${same[0].instanceId}">合成</button><button data-exchange="${item.instanceId}">交換</button>` : ""}</footer></article>`;
  }).join("");
}
function renderRecords() {
  const records = dashboard.player.records || {};
  $("recordGrid").innerHTML = [["出撃", `${format(records.plays)}回`], ["防衛成功", `${format(records.wins)}回`], ["総撃退", `${format(records.totalKills)}体`], ["最高到達", `WAVE ${format(records.bestWave)}`]].map(([a, b]) => `<article><span>${a}</span><b>${b}</b></article>`).join("");
  const cleared = new Set(dashboard.player.firstClears || []);
  $("mapRecords").innerHTML = dashboard.maps.map((map) => `<article><b>${escapeHtml(map.name)}</b><small>${cleared.has(map.id) ? "✓ 初回報酬獲得済み" : `未クリア · 初回${map.firstClearPoints}GP`}</small></article>`).join("");
  $("runHistory").innerHTML = dashboard.history.length ? dashboard.history.map((run) => `<p>${run.result?.reward?.won ? "✓ 防衛成功" : "× 防衛失敗"} · ${escapeHtml(run.result?.map?.name || run.mapId)} · ${format(run.summary?.kills)}体撃退</p>`).join("") : "<p>まだ出撃記録がありません。</p>";
}
function renderLimitBreak() {
  const character = selectedCharacter(); if (!character) return;
  const capped = character.level >= character.levelCap; const complete = character.levelCap >= 100; const next = Math.min(100, character.levelCap + 10);
  $("currentLevelCap").textContent = `Lv.${character.levelCap}`; $("nextLevelCap").textContent = complete ? "解放完了" : `Lv.${next}`;
  $("limitBossName").textContent = complete ? "すべての限界を突破済み" : `免疫暴走体・第${next / 10 - 4}形態`;
  $("limitBreakStatus").textContent = complete ? `${character.name}は現在の最大上限Lv.100まで解放済みです。` : capped ? `${character.name} Lv.${character.level}：挑戦できます。` : `${character.name}はあと${character.levelCap - character.level}レベルで挑戦できます。`;
  $("limitBreakChallenge").disabled = complete || !capped; $("limitBreakChallenge").textContent = complete ? "限界突破完了" : capped ? "限界突破戦へ出撃" : `Lv.${character.levelCap}で解放`;
}
function openDialog(title, html) { $("dialogTitle").textContent = title; $("dialogBody").innerHTML = html; $("dialog").hidden = false; }
function playGachaCinematic(results, banner) {
  const order = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4, LR: 5 };
  const strongest = results.reduce((best, item) => order[item.rarity] > order[best] ? item.rarity : best, "N");
  const rare = order[strongest] >= order.SSR;
  const random = crypto.getRandomValues(new Uint32Array(1))[0] % 100;
  const guaranteed = rare && random < 65;
  const cinematic = $("gachaCinematic");
  const timers = [];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  cinematic.className = `gacha-cinematic rarity-${guaranteed ? strongest : "N"} ${guaranteed ? "effect-guaranteed" : "effect-standard"}`;
  cinematic.hidden = false;
  mediguardAudio.sfx("gacha");
  $("gachaCinematicCode").textContent = banner?.name || "MEDICAL UNIT SCAN";
  $("gachaCinematicText").textContent = guaranteed ? "高密度反応を確認" : "解析を開始";
  $("gachaCinematicRarity").textContent = guaranteed ? `${strongest} 確定反応` : "";
  return new Promise((resolve) => {
    let done = false;
    const later = (callback, delay) => timers.push(setTimeout(callback, reduced ? Math.min(delay, 80) : delay));
    const finish = () => {
      if (done) return; done = true; timers.forEach(clearTimeout); cinematic.hidden = true; cinematic.className = "gacha-cinematic"; finishGachaCinematic = null; resolve();
    };
    finishGachaCinematic = finish;
    later(() => cinematic.classList.add("phase-charge"), 120);
    later(() => { cinematic.classList.add("phase-lock"); $("gachaCinematicText").textContent = guaranteed ? "確定シグナル接続" : "生命反応を照合中"; }, 1050);
    later(() => {
      cinematic.classList.add("phase-reveal");
      if (rare && !guaranteed) { cinematic.classList.add(`rarity-${strongest}`, "effect-surprise"); $("gachaCinematicText").textContent = "反応上昇"; $("gachaCinematicRarity").textContent = `${strongest} UNIT`; }
      else { $("gachaCinematicText").textContent = "ユニットを確認"; }
      mediguardAudio.sfx("reveal", strongest);
    }, 2350);
    later(finish, 3850);
  });
}
function showRates() {
  const labels = { N: "ノーマル", R: "レア", SR: "SR", SSR: "SSR", UR: "UR", LR: "LR" };
  const banner = selectedBanner();
  if (!banner) return showToast("現在引けるガチャはありません。");
  openDialog(`${banner.name}の排出率`, `<div class="rate-list">${Object.entries(banner.rates).map(([rarity, value]) => `<div class="rate-row"><b style="color:${RARITY_COLORS[rarity]}">${labels[rarity]}</b><span>${(value / 10).toFixed(1)}%</span><span>${dashboard.catalog.filter((item) => banner.characterIds.includes(item.id) && item.rarity === rarity).map((item) => escapeHtml(item.name)).join("、")}</span></div>`).join("")}</div><p class="medical-note">抽選結果はサーバー側で確定・保存します。ガチャポイントだけを消費し、累計学習ポイントは減りません。</p>`);
}
async function drawGacha(count) {
  if (busy) return; setBusy(true);
  try {
    const banner = selectedBanner();
    if (!banner) throw new Error("現在引けるガチャはありません。");
    const result = await api("draw", { count, bannerId: banner.id, requestId: requestId() });
    await playGachaCinematic(result.results, banner); await refresh();
    $("dialogTitle").textContent = "スキャン結果";
    $("dialogBody").innerHTML = `<div class="gacha-result">${result.results.map((item) => {
      const targets = dashboard.characters.filter((entry) => entry.characterId === item.characterId && entry.instanceId !== item.instanceId);
      return `<article style="--rarity:${RARITY_COLORS[item.rarity]}"><span class="${spriteClass(item.sprite)}"></span><b style="color:${RARITY_COLORS[item.rarity]}">${item.rarity}</b><strong>${escapeHtml(item.name)}</strong><small>Lv.1の新個体</small><div class="duplicate-actions"><button data-keep-dialog>そのまま所持</button>${targets.length ? `<button data-strengthen="${item.instanceId}" data-target="${targets[0].instanceId}">既存個体を強化</button><button data-exchange="${item.instanceId}">GPへ交換</button>` : ""}</div></article>`;
    }).join("")}</div>`;
    apply3DPortraits($("dialogBody"));
    $("dialog").hidden = false;
  } catch (error) { showToast(errorText(error)); }
  finally { setBusy(false); }
}
async function resolveDuplicate(sourceInstanceId, mode, targetInstanceId = "") {
  const wording = mode === "strengthen" ? "この個体を合成素材にしますか？" : "この個体をガチャポイントへ交換しますか？";
  if (!confirm(wording)) return;
  const result = await mutate("duplicate", { sourceInstanceId, targetInstanceId, mode, requestId: requestId() }, mode === "strengthen" ? "固有能力を強化しました。" : "ガチャポイントへ交換しました。");
  if (result) $("dialog").hidden = true;
}

const WORLD = { width: 1800, height: 1200 };
const OBSTACLE_LAYOUTS = Object.freeze({
  lung: [
    { x: 230, y: 180, w: 300, h: 110, type: "mitochondrion" }, { x: 750, y: 115, w: 150, h: 300, type: "er" },
    { x: 1210, y: 165, w: 340, h: 115, type: "golgi" }, { x: 210, y: 720, w: 190, h: 310, type: "er" },
    { x: 620, y: 875, w: 390, h: 120, type: "mitochondrion" }, { x: 1320, y: 690, w: 180, h: 330, type: "golgi" },
  ],
  airway: [
    { x: 260, y: 185, w: 110, h: 380, type: "er" }, { x: 600, y: 125, w: 470, h: 95, type: "golgi" },
    { x: 1210, y: 250, w: 110, h: 350, type: "er" }, { x: 410, y: 765, w: 520, h: 100, type: "mitochondrion" },
    { x: 1120, y: 870, w: 390, h: 100, type: "golgi" },
  ],
  intestine: [
    { x: 170, y: 190, w: 440, h: 105, type: "golgi" }, { x: 810, y: 110, w: 120, h: 340, type: "er" },
    { x: 1190, y: 220, w: 390, h: 110, type: "mitochondrion" }, { x: 230, y: 755, w: 360, h: 120, type: "golgi" },
    { x: 730, y: 900, w: 470, h: 105, type: "mitochondrion" }, { x: 1390, y: 670, w: 120, h: 340, type: "er" },
  ],
  urinary: [
    { x: 210, y: 160, w: 260, h: 160, type: "lysosome" }, { x: 720, y: 140, w: 120, h: 310, type: "er" },
    { x: 1230, y: 180, w: 280, h: 150, type: "nucleus" }, { x: 290, y: 780, w: 310, h: 155, type: "lysosome" },
    { x: 890, y: 900, w: 420, h: 105, type: "mitochondrion" }, { x: 1430, y: 620, w: 120, h: 310, type: "er" },
  ],
  vessel: [
    { x: 180, y: 245, w: 390, h: 80, type: "microtubule" }, { x: 690, y: 110, w: 95, h: 350, type: "er" },
    { x: 1140, y: 260, w: 460, h: 85, type: "microtubule" }, { x: 260, y: 820, w: 430, h: 90, type: "mitochondrion" },
    { x: 970, y: 820, w: 100, h: 300, type: "er" }, { x: 1370, y: 750, w: 260, h: 95, type: "lysosome" },
  ],
  skin: [
    { x: 170, y: 170, w: 250, h: 190, type: "nucleus" }, { x: 650, y: 130, w: 150, h: 320, type: "er" },
    { x: 1190, y: 160, w: 350, h: 170, type: "golgi" }, { x: 230, y: 760, w: 350, h: 170, type: "lysosome" },
    { x: 800, y: 850, w: 400, h: 130, type: "mitochondrion" }, { x: 1430, y: 650, w: 150, h: 330, type: "er" },
  ],
});
function battleObstacles(mapId = battle?.run?.map?.id) { return OBSTACLE_LAYOUTS[mapId] || OBSTACLE_LAYOUTS.lung; }
function circleTouchesObstacle(x, y, radius, obstacle) {
  const nearestX = Math.max(obstacle.x, Math.min(x, obstacle.x + obstacle.w));
  const nearestY = Math.max(obstacle.y, Math.min(y, obstacle.y + obstacle.h));
  return Math.hypot(x - nearestX, y - nearestY) < radius;
}
function freePosition(x, y, radius = 30, mapId) { return !battleObstacles(mapId).some((obstacle) => circleTouchesObstacle(x, y, radius, obstacle)); }
function moveAroundObstacles(entity, dx, dy) {
  const radius = Math.max(8, Number(entity.radius || 20));
  const targetX = Math.max(radius + 14, Math.min(WORLD.width - radius - 14, entity.x + dx));
  const targetY = Math.max(radius + 14, Math.min(WORLD.height - radius - 14, entity.y + dy));
  if (freePosition(targetX, targetY, radius)) { entity.x = targetX; entity.y = targetY; return; }
  if (freePosition(targetX, entity.y, radius)) entity.x = targetX;
  else if (freePosition(entity.x, targetY, radius)) entity.y = targetY;
}
function segmentHitsObstacle(x1, y1, x2, y2) {
  const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 16));
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps; const x = x1 + (x2 - x1) * t; const y = y1 + (y2 - y1) * t;
    if (!freePosition(x, y, 3)) return true;
  }
  return false;
}
function newBattle(run) {
  const maxHits = 3 + (run.character.passiveType === "extraHit" ? Math.max(1, Math.round(run.character.passiveValue || 1)) : 0);
  return {
    run, running: true, startedAt: performance.now(), elapsed: 0, lastTick: performance.now(), countdown: 3000,
    wave: 0, wavePending: true, waveDelay: 500, enemies: [], projectiles: [], holes: [], effects: [], enemyShots: [],
    player: {
      x: WORLD.width / 2, y: WORLD.height / 2, radius: 23,
      direction: { x: 1, y: 0 }, visualAngle: 0, velocity: { x: 0, y: 0 }, walkTime: 0, moving: false,
      hits: 0, maxHits, lives: 3, invincible: 0, respawn: 0, hidden: false, rapid: 0, frozen: 0, savedDeath: false,
    },
    kills: 0, shots: 0, infection: 0, skillCooldown: 0, chargeStart: 0, alertLock: 0, ended: false,
  };
}
function charStats() {
  const c = battle.run.character; const levelFactor = 1 + (c.level - 1) * .018 + c.dupeLevel * .035;
  const bonus = Math.max(0, Number(c.passiveValue || 0)) / 100;
  const all = c.passiveType === "allBoost" ? 1 + bonus : 1;
  return {
    attack: c.attack * levelFactor * all * (c.passiveType === "attackBoost" ? 1 + bonus : 1),
    speed: 205 * c.speed / 100 * all * (c.passiveType === "speedBoost" ? 1 + bonus : 1),
    range: 380 * c.range / 100 * all * (c.passiveType === "rangeBoost" ? 1 + bonus : 1),
    charge: c.charge / 100 * all * (c.passiveType === "chargeBoost" ? 1 + bonus : 1),
    cooldown: c.cooldown * (c.passiveType === "cooldownBoost" ? Math.max(.25, 1 - bonus) : 1),
  };
}
function mapIndex() { return Math.max(0, dashboard.maps.findIndex((item) => item.id === battle.run.map.id)); }
function spawnWave() {
  battle.wave += 1; battle.wavePending = false; battle.waveDelay = 0;
  battle.alertLock = 1.25; $("threatFlash").hidden = false;
  mediguardAudio.sfx("danger");
  $("waveText").textContent = `${battle.wave} / ${battle.run.waves}`; $("waveBanner").textContent = `WAVE ${battle.wave}`;
  $("waveBanner").style.animation = "none"; void $("waveBanner").offsetWidth; $("waveBanner").style.animation = "banner 1.5s both";
  const count = 3 + battle.wave * 2 + Math.min(4, Math.floor(battle.run.character.level / 12));
  for (let index = 0; index < count; index += 1) {
    let x; let y; do { x = 110 + Math.random() * (WORLD.width - 220); y = 110 + Math.random() * (WORLD.height - 220); } while (Math.hypot(x - battle.player.x, y - battle.player.y) < 330 || !freePosition(x, y, 48));
    battle.holes.push({ x, y, timer: 1 + index * .16, type: (mapIndex() * 2 + (battle.wave > 2 ? 1 : 0)) % 12, wave: battle.wave });
  }
  if (battle.run.limitBreak && battle.wave === battle.run.waves) battle.holes.push({ x: WORLD.width / 2, y: 180, timer: 2.1, type: 11, wave: battle.wave, boss: true });
}
function spawnEnemy(hole) {
  const strong = hole.type >= 6; const scale = 1 + (battle.run.character.level - 1) * .012 + (battle.wave - 1) * .18; const boss = hole.boss === true;
  const hp = (boss ? 180 : strong ? 44 : 25) * scale;
  battle.enemies.push({ x: hole.x, y: hole.y, radius: boss ? 46 : strong ? 29 : 23, hp, maxHp: hp, speed: (boss ? 43 : strong ? 52 : 68) * (1 + battle.wave * .07), type: hole.type, boss, flash: 0 });
}
function fire(power = 1, direction = battle.player.direction, spread = 0, piercing = false) {
  if (!battle?.running || battle.player.hidden || battle.countdown > 0 || battle.alertLock > 0) return;
  const stats = charStats(); const angle = Math.atan2(direction.y, direction.x) + spread;
  battle.projectiles.push({ x: battle.player.x + Math.cos(angle) * 28, y: battle.player.y + Math.sin(angle) * 28, vx: Math.cos(angle) * (520 + power * 90), vy: Math.sin(angle) * (520 + power * 90), radius: 6 + power * 2, damage: stats.attack * power, life: stats.range / (520 + power * 90), piercing, hit: new Set() });
  battle.shots += 1;
  mediguardAudio.sfx(power > 1.35 ? "charge" : "shoot");
}
function useSkill() {
  if (!battle?.running || battle.player.hidden || battle.countdown > 0 || battle.alertLock > 0) return;
  if (battle.skillCooldown > 0) { showBattleMessage(`スキル再使用まで ${Math.ceil(battle.skillCooldown)}秒`); return; }
  const character = battle.run.character; const stats = charStats(); const type = character.skillType; const value = Math.max(1, Number(character.skillValue || 1)); battle.skillCooldown = stats.cooldown;
  if (["radial", "healBurst", "freezeBurst"].includes(type)) {
    const shots = Math.max(6, Math.round(value));
    for (let i = 0; i < shots; i += 1) fire(type === "freezeBurst" ? 2.2 : 1.5, { x: 1, y: 0 }, Math.PI * 2 * i / shots, true);
    if (type === "healBurst") battle.player.hits = Math.max(0, battle.player.hits - Math.round(value));
    if (type === "freezeBurst") battle.player.frozen = Math.max(2, value / 3);
  } else if (type === "rapid") battle.player.rapid = value;
  else if (type === "pierce") fire(value, battle.player.direction, 0, true);
  else if (type === "triple") [-.24, 0, .24].forEach((spread) => fire(value, battle.player.direction, spread, true));
  else if (type === "shield") battle.player.invincible = value;
  else if (type === "area") battle.enemies.forEach((enemy) => { if (Math.hypot(enemy.x - battle.player.x, enemy.y - battle.player.y) < 440) { enemy.hp -= stats.attack * value; enemy.flash = .4; } });
  mediguardAudio.sfx("skill");
  showBattleMessage(battle.run.character.skill.split("：")[0]);
}
function showBattleMessage(text) { $("battleMessage").textContent = text; $("battleMessage").style.opacity = "1"; clearTimeout(showBattleMessage.timer); showBattleMessage.timer = setTimeout(() => { $("battleMessage").style.opacity = ".45"; }, 1600); }
function takeHit() {
  const p = battle.player; if (p.invincible > 0 || p.hidden || battle.countdown > 0) return;
  mediguardAudio.sfx("hit");
  p.hits += 1; p.invincible = 1.2; updateHud();
  if (p.hits < p.maxHits) return;
  if (battle.run.character.passiveType === "revive" && !p.savedDeath) { p.savedDeath = true; p.hits = 0; p.invincible = 3; showBattleMessage("身代わり能力が発動！"); return; }
  p.lives -= 1; p.hits = 0;
  if (p.lives <= 0) { void finishBattle(false, "残機がなくなりました"); return; }
  p.hidden = true; p.respawn = 5; $("respawnPanel").hidden = false; showBattleMessage("再生処置を開始");
}
function movementVector() {
  let x = controlMode === "joystick" ? stick.x : Number(dpad.right) - Number(dpad.left);
  let y = controlMode === "joystick" ? stick.y : Number(dpad.down) - Number(dpad.up);
  if (keyState.has("KeyA") || keyState.has("ArrowLeft")) x -= 1;
  if (keyState.has("KeyD") || keyState.has("ArrowRight")) x += 1;
  if (keyState.has("KeyW") || keyState.has("ArrowUp")) y -= 1;
  if (keyState.has("KeyS") || keyState.has("ArrowDown")) y += 1;
  const length = Math.hypot(x, y); return length > 1 ? { x: x / length, y: y / length } : { x, y };
}
function shortestAngle(from, to) { return Math.atan2(Math.sin(to - from), Math.cos(to - from)); }
function updateBattle(dt) {
  if (!battle?.running) return;
  if (battle.countdown > 0) { battle.countdown -= dt * 1000; $("battleMessage").textContent = battle.countdown > 0 ? `${Math.ceil(battle.countdown / 1000)}` : "防衛開始！"; return; }
  if (battle.alertLock > 0) { battle.alertLock = Math.max(0, battle.alertLock - dt); if (battle.alertLock === 0) $("threatFlash").hidden = true; updateHud(); return; }
  battle.elapsed += dt * 1000; const remaining = Math.max(0, battle.run.timeLimitSeconds - battle.elapsed / 1000); if (remaining <= 0) { void finishBattle(false, "制限時間を超えました"); return; }
  const p = battle.player; p.invincible = Math.max(0, p.invincible - dt); p.rapid = Math.max(0, p.rapid - dt); p.frozen = Math.max(0, p.frozen - dt); battle.skillCooldown = Math.max(0, battle.skillCooldown - dt);
  if (p.hidden) { p.respawn -= dt; $("respawnText").textContent = Math.max(1, Math.ceil(p.respawn)); if (p.respawn <= 0) { p.hidden = false; p.invincible = 2.5; p.x = WORLD.width / 2; p.y = WORLD.height / 2; $("respawnPanel").hidden = true; } }
  else {
    const move = movementVector(); const inputStrength = Math.min(1, Math.hypot(move.x, move.y));
    if (inputStrength > .08) {
      p.direction = { x: move.x / inputStrength, y: move.y / inputStrength };
      const targetAngle = Math.atan2(p.direction.y, p.direction.x);
      p.visualAngle += shortestAngle(p.visualAngle, targetAngle) * Math.min(1, dt * 13);
    }
    const chargeSlow = battle.chargeStart ? .72 : 1; const speed = charStats().speed * chargeSlow;
    const response = inputStrength > .08 ? 12 : 17;
    const blend = 1 - Math.exp(-response * dt);
    p.velocity.x += (move.x * speed - p.velocity.x) * blend;
    p.velocity.y += (move.y * speed - p.velocity.y) * blend;
    const travelSpeed = Math.hypot(p.velocity.x, p.velocity.y);
    p.moving = travelSpeed > 12;
    if (p.moving) p.walkTime += dt * (5.8 + Math.min(5.4, travelSpeed / 42));
    moveAroundObstacles(p, p.velocity.x * dt, p.velocity.y * dt);
  }
  if (battle.wavePending) { battle.waveDelay -= dt * 1000; if (battle.waveDelay <= 0) spawnWave(); }
  battle.holes.forEach((hole) => { hole.timer -= dt; if (hole.timer <= 0 && !hole.spawned) { hole.spawned = true; spawnEnemy(hole); } }); battle.holes = battle.holes.filter((hole) => hole.timer > -.5);
  const freeze = p.frozen > 0 ? 0 : 1;
  battle.enemies.forEach((enemy) => {
    enemy.flash = Math.max(0, enemy.flash - dt); const dx = p.x - enemy.x; const dy = p.y - enemy.y; const dist = Math.max(1, Math.hypot(dx, dy));
    const blocked = segmentHitsObstacle(enemy.x, enemy.y, p.x, p.y); const turn = blocked ? (enemy.x + enemy.y) % 2 ? 1 : -1 : 0;
    const moveX = blocked ? (-dy / dist * .7 + dx / dist * .3) * turn : dx / dist; const moveY = blocked ? (dx / dist * .7 + dy / dist * .3) * turn : dy / dist;
    moveAroundObstacles(enemy, moveX * enemy.speed * dt * freeze, moveY * enemy.speed * dt * freeze);
    if (!p.hidden && dist < enemy.radius + p.radius) takeHit();
  });
  battle.projectiles.forEach((shot) => { const beforeX = shot.x; const beforeY = shot.y; shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt; if (segmentHitsObstacle(beforeX, beforeY, shot.x, shot.y)) shot.life = 0; battle.enemies.forEach((enemy) => { if (enemy.hp <= 0 || shot.hit.has(enemy)) return; if (Math.hypot(shot.x - enemy.x, shot.y - enemy.y) < shot.radius + enemy.radius) { enemy.hp -= shot.damage; enemy.flash = .15; shot.hit.add(enemy); if (!shot.piercing) shot.life = 0; } }); });
  battle.projectiles = battle.projectiles.filter((shot) => shot.life > 0 && shot.x > 0 && shot.y > 0 && shot.x < WORLD.width && shot.y < WORLD.height);
  const defeated = battle.enemies.filter((enemy) => enemy.hp <= 0).length; battle.kills += defeated; battle.enemies = battle.enemies.filter((enemy) => enemy.hp > 0);
  if (!battle.wavePending && battle.wave > 0 && battle.enemies.length === 0 && battle.holes.length === 0) { if (battle.wave >= battle.run.waves) { void finishBattle(true, "全ウェーブを撃退しました"); return; } battle.wavePending = true; battle.waveDelay = 1800; showBattleMessage("次のウェーブを準備中"); }
  if (["urinary", "intestine"].includes(battle.run.map.id)) { battle.infection = Math.min(100, battle.infection + battle.enemies.length * dt * .022); if (battle.infection >= 100) void finishBattle(false, "感染ゲージが100%になりました"); }
  updateHud();
}
function updateHud() {
  if (!battle) return; const p = battle.player; const remaining = Math.max(0, battle.run.timeLimitSeconds - battle.elapsed / 1000);
  $("timeText").textContent = Math.ceil(remaining); $("lifeText").textContent = "●".repeat(Math.max(0, p.lives)) + "○".repeat(Math.max(0, 3 - p.lives)); $("hitText").textContent = `HIT ${p.hits} / ${p.maxHits}`;
  const infection = ["urinary", "intestine"].includes(battle.run.map.id); $("infectionBox").hidden = !infection; $("infectionBar").style.width = `${battle.infection}%`; $("infectionText").textContent = `${Math.floor(battle.infection)}%`;
  const charge = battle.chargeStart ? Math.min(100, (performance.now() - battle.chargeStart) / (1200 / charStats().charge) * 100) : 0; $("attackButton").style.setProperty("--progress", charge);
  const cooldown = charStats().cooldown; const progress = battle.skillCooldown ? Math.max(0, 100 - battle.skillCooldown / cooldown * 100) : 100; $("skillButton").style.setProperty("--progress", progress); $("skillButton").classList.toggle("cooling", battle.skillCooldown > 0); $("skillCooldown").textContent = battle.skillCooldown > 0 ? Math.ceil(battle.skillCooldown) : "";
}
function drawCutout(ctx, images, index, x, y, maxWidth, maxHeight) {
  const image = images[Math.max(0, Math.min(images.length - 1, Number(index || 0)))];
  if (!image?.complete || !image.naturalWidth) return;
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  ctx.drawImage(image, x - width / 2, y - height / 2, width, height);
}
function walkDirectionRow(angle) {
  const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (normalized >= Math.PI * .25 && normalized < Math.PI * .75) return 0;
  if (normalized >= Math.PI * .75 && normalized < Math.PI * 1.25) return 3;
  if (normalized >= Math.PI * 1.25 && normalized < Math.PI * 1.75) return 2;
  return 1;
}
function drawPlayerSprite(ctx, player, character, x, y, maxWidth, maxHeight, shadow = false) {
  const useWalkSheet = Number(character.sprite || 0) === 0 && starterWalkImage.complete && starterWalkImage.naturalWidth;
  if (!useWalkSheet) {
    ctx.save();
    const lean = player.moving ? Math.sin(player.walkTime * Math.PI * .5) * .045 : 0;
    ctx.translate(x, y); ctx.rotate(lean); ctx.scale(player.direction.x < -.12 ? -1 : 1, 1);
    drawCutout(ctx, characterImages, character.sprite, 0, 0, maxWidth, maxHeight);
    ctx.restore();
    return;
  }
  const columns = 4; const rows = 4;
  const sourceWidth = starterWalkImage.naturalWidth / columns; const sourceHeight = starterWalkImage.naturalHeight / rows;
  const frame = player.moving ? Math.floor(player.walkTime) % columns : 0;
  const row = walkDirectionRow(player.visualAngle);
  const stride = player.moving ? Math.sin(player.walkTime * Math.PI * 2) : 0;
  const width = maxWidth * (1 + Math.abs(stride) * .018);
  const height = maxHeight * (1 - Math.abs(stride) * .012);
  const residual = shortestAngle(row === 0 ? Math.PI / 2 : row === 1 ? 0 : row === 2 ? -Math.PI / 2 : Math.PI, player.visualAngle);
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.max(-.16, Math.min(.16, residual * .18)));
  if (shadow) ctx.scale(1.03, .96);
  ctx.drawImage(starterWalkImage, frame * sourceWidth, row * sourceHeight, sourceWidth, sourceHeight, -width / 2, -height / 2, width, height);
  ctx.restore();
}
function drawBattleScenery(ctx, mapId) {
  const style = MAP_STYLE[mapId] || MAP_STYLE.lung; const time = performance.now() / 1000;
  ctx.save(); ctx.lineCap = "round";
  for (let index = 0; index < 22; index += 1) {
    const x = 80 + (index * 317) % (WORLD.width - 160); const y = 70 + (index * 223) % (WORLD.height - 140); const size = 24 + (index % 5) * 9;
    ctx.globalAlpha = .16; ctx.fillStyle = index % 2 ? style[2] : "#ffffff"; ctx.strokeStyle = index % 2 ? "#ffffff" : style[2]; ctx.lineWidth = 3;
    if (mapId === "lung" || mapId === "airway") { ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.arc(x + size * .72, y + 4, size * .66, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    else if (mapId === "vessel") { ctx.beginPath(); ctx.ellipse(x, y, size * 1.25, size * .48, (index % 4) * .38, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    else if (mapId === "skin") { ctx.beginPath(); ctx.roundRect(x - size, y - size * .65, size * 2, size * 1.3, 10); ctx.fill(); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(x - size, y); ctx.quadraticCurveTo(x, y - size * (1.2 + Math.sin(time + index) * .08), x + size, y); ctx.quadraticCurveTo(x, y + size, x - size, y); ctx.fill(); ctx.stroke(); }
  }
  ctx.globalAlpha = .22; ctx.strokeStyle = "#f4d27a"; ctx.lineWidth = 5; ctx.setLineDash([20, 16]);
  for (let row = 0; row < 3; row += 1) { const y = 230 + row * 390; ctx.beginPath(); ctx.moveTo(40, y); ctx.bezierCurveTo(430, y - 130, 870, y + 150, 1320, y - 30); ctx.bezierCurveTo(1500, y - 100, 1650, y + 40, 1760, y); ctx.stroke(); }
  ctx.restore();
}
function drawBattleObstacles(ctx, mapId) {
  const colors = MAP_STYLE[mapId] || MAP_STYLE.lung;
  battleObstacles(mapId).forEach((obstacle, index) => {
    const radius = Math.min(44, Math.max(18, Math.min(obstacle.w, obstacle.h) * .22));
    ctx.save();
    ctx.shadowColor = "#5a293c80"; ctx.shadowBlur = 20; ctx.shadowOffsetY = 20;
    const gradient = ctx.createLinearGradient(obstacle.x, obstacle.y, obstacle.x + obstacle.w, obstacle.y + obstacle.h);
    const organelleColor = { mitochondrion: "#7fc6df", lysosome: "#f4d85a", nucleus: "#cda9d5", golgi: "#87bf75", er: "#e98994", microtubule: "#82ad68" }[obstacle.type] || colors[0];
    gradient.addColorStop(0, "#fff7ee"); gradient.addColorStop(.2, organelleColor); gradient.addColorStop(1, colors[2]);
    ctx.fillStyle = gradient; ctx.strokeStyle = "#6d3f4b"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.roundRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h, radius); ctx.fill(); ctx.stroke();
    ctx.shadowColor = "transparent"; ctx.globalAlpha = .5; ctx.strokeStyle = "#fffdf5"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(obstacle.x + 12, obstacle.y + 10, obstacle.w - 24, Math.max(16, obstacle.h * .22), Math.max(8, radius - 8)); ctx.stroke();
    ctx.globalAlpha = .62; ctx.strokeStyle = "#71444e"; ctx.lineWidth = 5;
    if (obstacle.type === "mitochondrion") {
      const middle = obstacle.y + obstacle.h * .58; ctx.beginPath(); ctx.moveTo(obstacle.x + 20, middle);
      for (let step = 1; step <= 6; step += 1) ctx.lineTo(obstacle.x + 20 + (obstacle.w - 40) * step / 6, middle + (step % 2 ? -obstacle.h * .18 : obstacle.h * .16)); ctx.stroke();
    } else if (obstacle.type === "lysosome" || obstacle.type === "nucleus") {
      ctx.fillStyle = obstacle.type === "nucleus" ? "#f48e92" : "#fff075"; ctx.globalAlpha = .75; ctx.beginPath(); ctx.ellipse(obstacle.x + obstacle.w / 2, obstacle.y + obstacle.h * .58, obstacle.w * .22, obstacle.h * .24, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      const bands = Math.max(2, Math.min(6, Math.floor(obstacle.w / 80)));
      for (let band = 0; band < bands; band += 1) { const y = obstacle.y + obstacle.h * (.42 + band * .1); ctx.beginPath(); ctx.moveTo(obstacle.x + 18, y); ctx.bezierCurveTo(obstacle.x + obstacle.w * .34, y - 18, obstacle.x + obstacle.w * .63, y + 18, obstacle.x + obstacle.w - 18, y); ctx.stroke(); }
    }
    ctx.globalAlpha = .28; ctx.fillStyle = index % 2 ? "#fff2a0" : "#b7fff0";
    for (let dot = 0; dot < 3; dot += 1) { ctx.beginPath(); ctx.arc(obstacle.x + obstacle.w * (.23 + dot * .27), obstacle.y + obstacle.h * .76, 5 + dot, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  });
}
function drawBattle2D() {
  if (!battle) return; const canvas = $("battleCanvas"); const rect = canvas.getBoundingClientRect(); const ratio = Math.min(2, devicePixelRatio || 1); if (canvas.width !== Math.round(rect.width * ratio) || canvas.height !== Math.round(rect.height * ratio)) { canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio); }
  const ctx = canvas.getContext("2d"); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.imageSmoothingEnabled = false; const width = rect.width; const height = rect.height;
  const zoom = width < 700 ? 1.34 : 1.2; const verticalScale = .84; const viewWidth = width / zoom; const viewHeight = height / (zoom * verticalScale);
  const cameraX = Math.max(viewWidth / 2, Math.min(WORLD.width - viewWidth / 2, battle.player.x)); const cameraY = Math.max(viewHeight / 2, Math.min(WORLD.height - viewHeight / 2, battle.player.y));
  const colors = MAP_STYLE[battle.run.map.id] || MAP_STYLE.lung;
  const backdrop = ctx.createLinearGradient(0, 0, width, height); backdrop.addColorStop(0, colors[1]); backdrop.addColorStop(.48, colors[0]); backdrop.addColorStop(1, colors[2]); ctx.fillStyle = backdrop; ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.translate(width / 2, height / 2); ctx.scale(zoom, zoom * verticalScale); ctx.translate(-cameraX, -cameraY);
  ctx.fillStyle = colors[1];
  for (let x = 70; x < WORLD.width; x += 160) for (let y = 60; y < WORLD.height; y += 150) {
    const wobble = ((x + y) % 3) * 7; const radius = 34 + ((x * y) % 17); const pulse = 1 + Math.sin(performance.now() / 900 + x * .02 + y * .01) * .04;
    ctx.globalAlpha = .18; ctx.beginPath(); ctx.arc(x + wobble, y, radius * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = .12; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + wobble - radius * .16, y - radius * .18, radius * .68, Math.PI * 1.06, Math.PI * 1.7); ctx.stroke();
  }
  ctx.globalAlpha = .28; ctx.strokeStyle = colors[2]; ctx.lineCap = "round";
  for (let x = -80; x <= WORLD.width; x += 270) { ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(x, -20); ctx.bezierCurveTo(x + 170, 280, x - 120, 720, x + 110, WORLD.height + 30); ctx.stroke(); ctx.globalAlpha = .16; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 5; ctx.stroke(); ctx.globalAlpha = .28; ctx.strokeStyle = colors[2]; }
  ctx.globalAlpha = .2; ctx.fillStyle = "#ffffff";
  for (let index = 0; index < 34; index += 1) { const px = (index * 191 + 73) % WORLD.width; const py = (index * 137 + 41) % WORLD.height; ctx.beginPath(); ctx.arc(px, py, 2 + index % 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  drawBattleScenery(ctx, battle.run.map.id);
  drawBattleObstacles(ctx, battle.run.map.id);
  battle.holes.forEach((hole) => {
    const pulse = .7 + Math.sin(performance.now() / 90) * .15; const radius = hole.spawned ? 28 : 34 + pulse * 8;
    ctx.save(); ctx.shadowColor = hole.spawned ? "#1c0f20" : "#ffd36a"; ctx.shadowBlur = hole.spawned ? 12 : 24; ctx.fillStyle = hole.spawned ? "#251529" : `rgba(106,22,64,${pulse})`; ctx.beginPath(); ctx.arc(hole.x, hole.y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = hole.spawned ? "#8b4a70" : "#ffe7a3"; ctx.lineWidth = hole.spawned ? 3 : 4; ctx.stroke(); if (!hole.spawned) { ctx.globalAlpha = .5; ctx.beginPath(); ctx.arc(hole.x, hole.y, radius + 12, 0, Math.PI * 2); ctx.stroke(); } ctx.restore();
  });
  battle.projectiles.forEach((shot) => { ctx.save(); ctx.shadowColor = shot.piercing ? "#ffd853" : "#62ffe0"; ctx.shadowBlur = 18; ctx.fillStyle = shot.piercing ? "#ffe27a" : "#92f4df"; ctx.beginPath(); ctx.arc(shot.x, shot.y, shot.radius + 2, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); });
  battle.enemies.forEach((enemy) => { const bob = Math.sin(performance.now() / 210 + enemy.x * .01) * 2; ctx.save(); ctx.globalAlpha = .26; ctx.fillStyle = "#351d31"; ctx.beginPath(); ctx.ellipse(enemy.x + 4, enemy.y + enemy.radius * .92, enemy.radius * 1.08, enemy.radius * .38, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = enemy.flash > 0 ? .45 : 1; ctx.filter = "drop-shadow(0 7px 3px rgba(66,26,48,.5))"; drawCutout(ctx, pathogenImages, enemy.type, enemy.x, enemy.y - 4 + bob, enemy.radius * 4.15, enemy.radius * 4.15); ctx.restore(); const hp = Math.max(0, enemy.hp / enemy.maxHp); ctx.fillStyle = "#1d1523cc"; ctx.fillRect(enemy.x - 24, enemy.y - enemy.radius - 26, 48, 6); ctx.fillStyle = "#ff5e68"; ctx.fillRect(enemy.x - 23, enemy.y - enemy.radius - 25, 46 * hp, 4); });
  if (!battle.player.hidden) {
    const speed = Math.hypot(battle.player.velocity.x, battle.player.velocity.y);
    const bob = battle.player.moving ? Math.abs(Math.sin(battle.player.walkTime * Math.PI)) * -3.2 : Math.sin(performance.now() / 430) * .7;
    const bodySize = 118 + Math.min(8, speed / 40);
    ctx.save(); ctx.globalAlpha = .28; ctx.fillStyle = "#542f4266"; ctx.beginPath(); ctx.ellipse(battle.player.x + 5, battle.player.y + 38, battle.player.moving ? 39 : 35, battle.player.moving ? 11 : 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = .18; ctx.filter = "brightness(.35) saturate(.7)"; drawPlayerSprite(ctx, battle.player, battle.run.character, battle.player.x + 4, battle.player.y + 8, bodySize, bodySize, true);
    ctx.globalAlpha = battle.player.invincible > 0 && Math.floor(performance.now() / 100) % 2 ? .3 : 1; ctx.filter = "drop-shadow(0 7px 3px rgba(72,35,52,.45))"; ctx.shadowColor = "#8bffe9"; ctx.shadowBlur = battle.player.invincible > 0 ? 25 : 5; drawPlayerSprite(ctx, battle.player, battle.run.character, battle.player.x, battle.player.y - 6 + bob, bodySize, bodySize);
    ctx.restore();
  }
  ctx.strokeStyle = "#102f38"; ctx.lineWidth = 18; ctx.strokeRect(0, 0, WORLD.width, WORLD.height); ctx.restore();
  const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .2, width / 2, height / 2, Math.max(width, height) * .72); vignette.addColorStop(0, "rgba(5,18,25,0)"); vignette.addColorStop(1, "rgba(5,18,25,.36)"); ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
}
function drawBattle() {
  if (battle3d) { battle3d.render(battle, battleObstacles(battle?.run?.map?.id)); return; }
  drawBattle2D();
}
function gameLoop(now) { if (!battle?.running) return; const dt = Math.min(.05, (now - (lastFrame || now)) / 1000); lastFrame = now; updateBattle(dt); drawBattle(); frameId = requestAnimationFrame(gameLoop); }
async function startBattle(action = "startRun") {
  if (busy) return; setBusy(true);
  $("loadingMap").textContent = action === "startLimitBreak" ? "限界突破戦" : "出撃地点を選定中";
  $("loadingPathogen").textContent = "病原体と安全な経路を解析しています…";
  $("loadingScreen").hidden = false;
  try {
    await initialize3D();
    const run = await api(action, { requestId: requestId() }); $("loadingMap").textContent = run.map.name; $("loadingPathogen").textContent = run.limitBreak ? `${run.bossName} / 上限解放戦` : `${run.map.pathogen} / ${run.map.weapon}`;
    await new Promise((resolve) => setTimeout(resolve, 1450)); battle = newBattle(run); $("battleMapName").textContent = run.map.name; $("waveText").textContent = `0 / ${run.waves}`; $("loadingScreen").hidden = true; $("battleScreen").hidden = false; $("respawnPanel").hidden = true; updateHud(); lastFrame = performance.now(); cancelAnimationFrame(frameId); frameId = requestAnimationFrame(gameLoop);
    mediguardAudio.playMusic("battle");
  } catch (error) { showToast(errorText(error)); $("loadingScreen").hidden = true; }
  finally { setBusy(false); }
}
async function finishBattle(won, reason) {
  if (!battle || battle.ended) return; battle.ended = true; battle.running = false; cancelAnimationFrame(frameId);
  mediguardAudio.sfx(won ? "win" : "lose");
  const summary = { won, wave: battle.wave, kills: battle.kills, shots: battle.shots, damageTaken: 3 * (3 - battle.player.lives) + battle.player.hits, durationMs: Math.round(Math.max(3000, battle.elapsed)) };
  let result = null; try { result = await api("finishRun", { runId: battle.run.runId, summary, requestId: requestId() }); await refresh(); } catch (error) { showToast(errorText(error, "戦闘記録を保存できませんでした。")); }
  $("battleScreen").hidden = true; $("resultLabel").textContent = won ? "MISSION COMPLETE" : "MISSION FAILED"; $("resultTitle").textContent = result?.unlockedCap ? "限界突破成功" : won ? "防衛成功" : "防衛失敗";
  $("resultBody").innerHTML = `<p>${escapeHtml(reason)}</p><div class="result-stats"><article><span>到達</span><b>W${summary.wave}</b></article><article><span>撃退</span><b>${summary.kills}</b></article><article><span>EXP</span><b>+${result?.reward?.xp || 0}</b></article></div>${result?.unlockedCap ? `<p class="limit-unlocked"><b>レベル上限 Lv.${result.unlockedCap} 解放</b></p>` : ""}${result?.firstClear ? `<p><b>初回クリア報酬 +${result.reward.gachaPoints}GP</b></p>` : ""}${result?.character ? `<p>${escapeHtml(result.character.name)} Lv.${result.character.level}</p>` : ""}`;
  $("resultScreen").hidden = false;
  mediguardAudio.playMusic("home");
}
function beginCharge() { if (!battle?.running || battle.player.rapid > 0) { fire(1); return; } battle.chargeStart = performance.now(); }
function releaseCharge() { if (!battle?.running) return; const held = battle.chargeStart ? performance.now() - battle.chargeStart : 0; battle.chargeStart = 0; fire(1 + Math.min(2, held / (900 / charStats().charge))); }
function setupJoystick() {
  const screen = $("battleScreen"); const area = $("joystick"); const knob = $("joystickKnob");
  const placeBase = (x, y) => { const size = area.offsetWidth; area.style.left = `${x - size / 2}px`; area.style.top = `${y - size / 2}px`; area.style.bottom = "auto"; };
  const activate = (event) => {
    if (stick.pointer !== null || !battle?.running) return false;
    const rect = screen.getBoundingClientRect();
    if (event.clientX > rect.left + rect.width * .56 || event.target.closest("button")) return false;
    event.preventDefault(); stick.pointer = event.pointerId; stick.baseX = event.clientX; stick.baseY = event.clientY; area.classList.add("active"); placeBase(stick.baseX, stick.baseY); screen.setPointerCapture(event.pointerId); return true;
  };
  const move = (event) => {
    if (stick.pointer !== event.pointerId) return;
    const max = area.offsetWidth * .34; let x = event.clientX - stick.baseX; let y = event.clientY - stick.baseY; const length = Math.hypot(x, y);
    if (length > max) { const overflow = length - max; stick.baseX += x / length * overflow; stick.baseY += y / length * overflow; placeBase(stick.baseX, stick.baseY); x = event.clientX - stick.baseX; y = event.clientY - stick.baseY; }
    stick.x = x / max; stick.y = y / max; knob.style.transform = `translate(${x}px,${y}px)`;
  };
  screen.addEventListener("pointerdown", (event) => { if (activate(event)) move(event); });
  screen.addEventListener("pointermove", move);
  const end = (event) => { if (stick.pointer !== event.pointerId) return; stick = { x: 0, y: 0, pointer: null, baseX: 0, baseY: 0 }; knob.style.transform = ""; area.classList.remove("active"); area.style.left = ""; area.style.top = ""; area.style.bottom = ""; };
  screen.addEventListener("pointerup", end); screen.addEventListener("pointercancel", end);
}
function applyControlMode(mode, announce = false) {
  controlMode = mode === "joystick" ? "joystick" : "dpad";
  localStorage.setItem(CONTROL_STORAGE_KEY, controlMode);
  $("joystick").hidden = controlMode !== "joystick";
  $("directionPad").hidden = controlMode !== "dpad";
  document.querySelectorAll("[data-control-mode]").forEach((button) => {
    const selected = button.dataset.controlMode === controlMode;
    button.classList.toggle("selected", selected); button.setAttribute("aria-checked", String(selected));
  });
  stick.x = 0; stick.y = 0; dpad = { up: false, down: false, left: false, right: false };
  if (announce) showToast(controlMode === "dpad" ? "十字キー操作に変更しました。" : "スティック操作に変更しました。");
}
function setupDirectionPad() {
  document.querySelectorAll("[data-direction]").forEach((button) => {
    const direction = button.dataset.direction;
    const press = (event) => { event.preventDefault(); button.setPointerCapture?.(event.pointerId); dpad[direction] = true; button.classList.add("pressed"); };
    const release = (event) => { event?.preventDefault?.(); dpad[direction] = false; button.classList.remove("pressed"); };
    button.addEventListener("pointerdown", press);
    ["pointerup", "pointercancel", "pointerleave"].forEach((name) => button.addEventListener(name, release));
  });
}
function syncSettingsUi() {
  const settings = mediguardAudio.settings;
  $("bgmToggle").checked = settings.bgm; $("sfxToggle").checked = settings.sfx;
  $("volumeSlider").value = String(Math.round(settings.volume * 100)); $("volumeValue").textContent = `${Math.round(settings.volume * 100)}%`;
  applyControlMode(controlMode);
}
async function enterGame() {
  await mediguardAudio.unlock(); mediguardAudio.sfx("open");
  $("loadingMap").textContent = "防衛本部"; $("loadingPathogen").textContent = "キャラクターと作戦データを準備しています…"; $("loadingScreen").hidden = false;
  await new Promise((resolve) => setTimeout(resolve, 720));
  $("titleScreen").hidden = true; $("gameApp").hidden = false; $("loadingScreen").hidden = true; showView("home");
}
function bindEvents() {
  $("startButton").addEventListener("click", () => { void enterGame(); });
  $("gameExitButton").addEventListener("click", () => { window.location.href = "index.html"; }); $("selectedCharacter").addEventListener("click", () => showView("characters")); $("sortieButton").addEventListener("click", () => startBattle("startRun"));
  $("settingsButton").addEventListener("click", () => showView("settings"));
  $("limitBreakChallenge").addEventListener("click", () => startBattle("startLimitBreak"));
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
  document.querySelectorAll("[data-draw]").forEach((button) => button.addEventListener("click", () => drawGacha(Number(button.dataset.draw))));
  $("ratesButton").addEventListener("click", showRates); $("dialogClose").addEventListener("click", () => { $("dialog").hidden = true; });
  $("gachaSkipButton").addEventListener("click", () => finishGachaCinematic?.());
  $("dialog").addEventListener("click", (event) => { if (event.target === $("dialog")) $("dialog").hidden = true; });
  document.addEventListener("click", async (event) => {
    const select = event.target.closest("[data-select]"); if (select) await mutate("select", { instanceId: select.dataset.select }, "出撃キャラクターを変更しました。");
    const favorite = event.target.closest("[data-favorite]"); if (favorite) await mutate("favorite", { instanceId: favorite.dataset.favorite, favorite: favorite.dataset.value === "true" });
    const strengthen = event.target.closest("[data-strengthen]"); if (strengthen) await resolveDuplicate(strengthen.dataset.strengthen, "strengthen", strengthen.dataset.target);
    const exchange = event.target.closest("[data-exchange]"); if (exchange) await resolveDuplicate(exchange.dataset.exchange, "exchange");
    const banner = event.target.closest("[data-banner]"); if (banner) { selectedBannerId = banner.dataset.banner; renderGachaBanners(); }
    if (event.target.closest("[data-keep-dialog]")) $("dialog").hidden = true;
  });
  setupJoystick();
  setupDirectionPad(); syncSettingsUi();
  document.querySelectorAll("[data-control-mode]").forEach((button) => button.addEventListener("click", () => applyControlMode(button.dataset.controlMode, true)));
  $("bgmToggle").addEventListener("change", () => mediguardAudio.update({ bgm: $("bgmToggle").checked }));
  $("sfxToggle").addEventListener("change", () => mediguardAudio.update({ sfx: $("sfxToggle").checked }));
  $("volumeSlider").addEventListener("input", () => { const volume = Number($("volumeSlider").value) / 100; $("volumeValue").textContent = `${Math.round(volume * 100)}%`; mediguardAudio.update({ volume }); });
  document.querySelector("#gameShell").addEventListener("click", (event) => { if (event.target.closest("button") && event.target.id !== "attackButton" && event.target.id !== "skillButton") mediguardAudio.sfx("button"); });
  $("attackButton").addEventListener("pointerdown", (event) => { event.preventDefault(); attackAim = { pointer: event.pointerId, x: event.clientX, y: event.clientY }; $("attackButton").setPointerCapture(event.pointerId); beginCharge(); });
  $("attackButton").addEventListener("pointermove", (event) => { if (attackAim.pointer !== event.pointerId || !battle?.running) return; const dx = event.clientX - attackAim.x; const dy = event.clientY - attackAim.y; const length = Math.hypot(dx, dy); if (length > 10) battle.player.direction = { x: dx / length, y: dy / length }; });
  $("attackButton").addEventListener("pointerup", (event) => { event.preventDefault(); attackAim.pointer = null; releaseCharge(); }); $("attackButton").addEventListener("pointercancel", () => { attackAim.pointer = null; releaseCharge(); });
  $("skillButton").addEventListener("pointerdown", (event) => { event.preventDefault(); event.stopPropagation(); $("skillButton").classList.add("pressed"); useSkill(); });
  ["pointerup", "pointercancel", "pointerleave"].forEach((name) => $("skillButton").addEventListener(name, () => $("skillButton").classList.remove("pressed")));
  $("exitBattle").addEventListener("click", () => { if (confirm("この出撃を終了しますか？")) void finishBattle(false, "途中退出しました"); });
  $("retryButton").addEventListener("click", () => { $("resultScreen").hidden = true; void startBattle(); }); $("resultHome").addEventListener("click", () => { $("resultScreen").hidden = true; showView("home"); });
  addEventListener("keydown", (event) => { keyState.add(event.code); if (event.code === "Space" && !event.repeat) { event.preventDefault(); beginCharge(); } if (event.code === "KeyE" && !event.repeat) useSkill(); });
  addEventListener("keyup", (event) => { keyState.delete(event.code); if (event.code === "Space") { event.preventDefault(); releaseCharge(); } });
  $("battleCanvas").addEventListener("pointerdown", (event) => { if (!battle?.running) return; const rect = $("battleCanvas").getBoundingClientRect(); if (event.clientX <= rect.left + rect.width * .56) return; const x = event.clientX - rect.left - rect.width / 2; const y = event.clientY - rect.top - rect.height / 2; const length = Math.hypot(x, y); if (length > 5) battle.player.direction = { x: x / length, y: y / length }; fire(1); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && battle?.running) lastFrame = performance.now(); });
}
async function boot() {
  if (!isMediguardTestStudent(studentNumber)) { location.replace("requests.html"); return; }
  try {
    await auth.authStateReady();
    if (auth.currentUser?.uid !== `caremate-${studentNumber}`) { location.replace("login.html"); return; }
    bindEvents(); await refresh(); $("gameShell").hidden = false; document.body.classList.remove("page-loading"); $("gameGate").hidden = true; void initialize3D();
  } catch (error) {
    console.error(error);
    if (["functions/permission-denied", "functions/unauthenticated"].includes(error?.code)) { location.replace("login.html"); return; }
    $("gameGate").querySelector("strong").textContent = "読み込みに失敗しました";
    $("gameGate").querySelector("small").textContent = errorText(error, "再読み込みしてください。");
  }
}
void initializePage([boot(), setupAdminTab()]);
