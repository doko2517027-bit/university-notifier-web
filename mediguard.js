import { auth, functions, studentNumber, initializePage, setupAdminTab, isMediguardTestStudent } from "./common.js?v=20261011-2";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

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
let stick = { x: 0, y: 0, pointer: null };
let characterImage = new Image();
let pathogenImage = new Image();
characterImage.src = "images/mediguard-characters.png";
pathogenImage.src = "images/mediguard-pathogens.png";

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
  $("selectedPassive").textContent = character.passive; $("selectedSkill").textContent = character.skill.split("：")[0];
  $("selectedCharacter").querySelector("span").className = spriteClass(character.sprite);
  renderCharacters(); renderRecords();
}
function showView(name) {
  const ids = { home: "homeView", characters: "charactersView", gacha: "gachaView", records: "recordsView", help: "helpView" };
  document.querySelectorAll(".game-view").forEach((view) => { view.hidden = true; });
  $(ids[name] || ids.home).hidden = false;
  $("screenTitle").textContent = { home: "メディガード！", characters: "キャラクター", gacha: "キャラガチャ", records: "防衛記録", help: "遊び方" }[name] || "メディガード！";
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
function openDialog(title, html) { $("dialogTitle").textContent = title; $("dialogBody").innerHTML = html; $("dialog").hidden = false; }
function showRates() {
  const labels = { N: "ノーマル", R: "レア", SR: "SR", SSR: "SSR", UR: "UR", LR: "LR" };
  openDialog("排出率・キャラクター", `<div class="rate-list">${Object.entries(dashboard.rates).map(([rarity, value]) => `<div class="rate-row"><b style="color:${RARITY_COLORS[rarity]}">${labels[rarity]}</b><span>${(value / 10).toFixed(1)}%</span><span>${dashboard.catalog.filter((item) => item.rarity === rarity).map((item) => escapeHtml(item.name)).join("、")}</span></div>`).join("")}</div><p class="medical-note">抽選結果はサーバー側で確定・保存します。ガチャポイントだけを消費し、累計学習ポイントは減りません。</p>`);
}
async function drawGacha(count) {
  if (busy) return; setBusy(true);
  try {
    const result = await api("draw", { count, requestId: requestId() }); await refresh();
    $("dialogTitle").textContent = "スキャン結果";
    $("dialogBody").innerHTML = `<div class="gacha-result">${result.results.map((item) => {
      const targets = dashboard.characters.filter((entry) => entry.characterId === item.characterId && entry.instanceId !== item.instanceId);
      return `<article style="--rarity:${RARITY_COLORS[item.rarity]}"><span class="${spriteClass(item.sprite)}"></span><b style="color:${RARITY_COLORS[item.rarity]}">${item.rarity}</b><strong>${escapeHtml(item.name)}</strong><small>Lv.1の新個体</small><div class="duplicate-actions"><button data-keep-dialog>そのまま所持</button>${targets.length ? `<button data-strengthen="${item.instanceId}" data-target="${targets[0].instanceId}">既存個体を強化</button><button data-exchange="${item.instanceId}">GPへ交換</button>` : ""}</div></article>`;
    }).join("")}</div>`;
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
function newBattle(run) {
  const maxHits = run.character.characterId === "guard_bear" ? 4 : 3;
  return {
    run, running: true, startedAt: performance.now(), elapsed: 0, lastTick: performance.now(), countdown: 3000,
    wave: 0, wavePending: true, waveDelay: 500, enemies: [], projectiles: [], holes: [], effects: [], enemyShots: [],
    player: { x: WORLD.width / 2, y: WORLD.height / 2, radius: 23, direction: { x: 1, y: 0 }, hits: 0, maxHits, lives: 3, invincible: 0, respawn: 0, hidden: false, rapid: 0, frozen: 0, savedDeath: false },
    kills: 0, shots: 0, infection: 0, skillCooldown: 0, chargeStart: 0, ended: false,
  };
}
function charStats() {
  const c = battle.run.character; const levelFactor = 1 + (c.level - 1) * .018 + c.dupeLevel * .035;
  const all = c.characterId === "celestial_guard" ? 1.12 : 1;
  return { attack: c.attack * levelFactor * all, speed: 205 * c.speed / 100 * all, range: 380 * c.range / 100 * all, charge: c.charge / 100 * all, cooldown: c.cooldown * (c.characterId === "star_sheep" ? .8 : 1) };
}
function mapIndex() { return Math.max(0, dashboard.maps.findIndex((item) => item.id === battle.run.map.id)); }
function spawnWave() {
  battle.wave += 1; battle.wavePending = false; battle.waveDelay = 0;
  $("waveText").textContent = `${battle.wave} / ${battle.run.waves}`; $("waveBanner").textContent = `WAVE ${battle.wave}`;
  $("waveBanner").style.animation = "none"; void $("waveBanner").offsetWidth; $("waveBanner").style.animation = "banner 1.5s both";
  const count = 3 + battle.wave * 2 + Math.min(4, Math.floor(battle.run.character.level / 12));
  for (let index = 0; index < count; index += 1) {
    let x; let y; do { x = 110 + Math.random() * (WORLD.width - 220); y = 110 + Math.random() * (WORLD.height - 220); } while (Math.hypot(x - battle.player.x, y - battle.player.y) < 330);
    battle.holes.push({ x, y, timer: 1 + index * .16, type: (mapIndex() * 2 + (battle.wave > 2 ? 1 : 0)) % 12, wave: battle.wave });
  }
}
function spawnEnemy(hole) {
  const strong = hole.type >= 6; const scale = 1 + (battle.run.character.level - 1) * .012 + (battle.wave - 1) * .18;
  battle.enemies.push({ x: hole.x, y: hole.y, radius: strong ? 29 : 23, hp: (strong ? 44 : 25) * scale, maxHp: (strong ? 44 : 25) * scale, speed: (strong ? 52 : 68) * (1 + battle.wave * .07), type: hole.type, flash: 0 });
}
function fire(power = 1, direction = battle.player.direction, spread = 0, piercing = false) {
  if (!battle?.running || battle.player.hidden || battle.countdown > 0) return;
  const stats = charStats(); const angle = Math.atan2(direction.y, direction.x) + spread;
  battle.projectiles.push({ x: battle.player.x + Math.cos(angle) * 28, y: battle.player.y + Math.sin(angle) * 28, vx: Math.cos(angle) * (520 + power * 90), vy: Math.sin(angle) * (520 + power * 90), radius: 6 + power * 2, damage: stats.attack * power, life: stats.range / (520 + power * 90), piercing, hit: new Set() });
  battle.shots += 1;
}
function useSkill() {
  if (!battle?.running || battle.skillCooldown > 0 || battle.player.hidden || battle.countdown > 0) return;
  const id = battle.run.character.characterId; const stats = charStats(); battle.skillCooldown = stats.cooldown;
  if (id === "cell_maru" || id === "mint_dragon" || id === "chemist_tanuki" || id === "celestial_guard") {
    const shots = id === "chemist_tanuki" ? 16 : id === "celestial_guard" ? 12 : 10;
    for (let i = 0; i < shots; i += 1) fire(id === "celestial_guard" ? 2.2 : 1.5, { x: 1, y: 0 }, Math.PI * 2 * i / shots, true);
    if (id === "mint_dragon") battle.player.hits = Math.max(0, battle.player.hits - 1);
    if (id === "celestial_guard") battle.player.frozen = 4;
  } else if (id === "medic_fox") battle.player.rapid = 8;
  else if (id === "spark_chick") fire(4, battle.player.direction, 0, true);
  else if (id === "aqua_cat" || id === "rapid_rabbit") [-.24, 0, .24].forEach((spread) => fire(2.1, battle.player.direction, spread, true));
  else if (id === "guard_bear") battle.player.invincible = 5;
  else if (id === "star_sheep") battle.enemies.forEach((enemy) => { if (Math.hypot(enemy.x - battle.player.x, enemy.y - battle.player.y) < 440) { enemy.hp -= stats.attack * 5; enemy.flash = .4; } });
  showBattleMessage(battle.run.character.skill.split("：")[0]);
}
function showBattleMessage(text) { $("battleMessage").textContent = text; $("battleMessage").style.opacity = "1"; clearTimeout(showBattleMessage.timer); showBattleMessage.timer = setTimeout(() => { $("battleMessage").style.opacity = ".45"; }, 1600); }
function takeHit() {
  const p = battle.player; if (p.invincible > 0 || p.hidden || battle.countdown > 0) return;
  p.hits += 1; p.invincible = 1.2; updateHud();
  if (p.hits < p.maxHits) return;
  if (battle.run.character.characterId === "chemist_tanuki" && !p.savedDeath) { p.savedDeath = true; p.hits = 0; p.invincible = 3; showBattleMessage("身代わり調合が発動！"); return; }
  p.lives -= 1; p.hits = 0;
  if (p.lives <= 0) { void finishBattle(false, "残機がなくなりました"); return; }
  p.hidden = true; p.respawn = 5; $("respawnPanel").hidden = false; showBattleMessage("再生処置を開始");
}
function movementVector() {
  let x = stick.x; let y = stick.y;
  if (keyState.has("KeyA") || keyState.has("ArrowLeft")) x -= 1;
  if (keyState.has("KeyD") || keyState.has("ArrowRight")) x += 1;
  if (keyState.has("KeyW") || keyState.has("ArrowUp")) y -= 1;
  if (keyState.has("KeyS") || keyState.has("ArrowDown")) y += 1;
  const length = Math.hypot(x, y); return length > 1 ? { x: x / length, y: y / length } : { x, y };
}
function updateBattle(dt) {
  if (!battle?.running) return;
  if (battle.countdown > 0) { battle.countdown -= dt * 1000; $("battleMessage").textContent = battle.countdown > 0 ? `${Math.ceil(battle.countdown / 1000)}` : "防衛開始！"; return; }
  battle.elapsed += dt * 1000; const remaining = Math.max(0, battle.run.timeLimitSeconds - battle.elapsed / 1000); if (remaining <= 0) { void finishBattle(false, "制限時間を超えました"); return; }
  const p = battle.player; p.invincible = Math.max(0, p.invincible - dt); p.rapid = Math.max(0, p.rapid - dt); p.frozen = Math.max(0, p.frozen - dt); battle.skillCooldown = Math.max(0, battle.skillCooldown - dt);
  if (p.hidden) { p.respawn -= dt; $("respawnText").textContent = Math.max(1, Math.ceil(p.respawn)); if (p.respawn <= 0) { p.hidden = false; p.invincible = 2.5; p.x = WORLD.width / 2; p.y = WORLD.height / 2; $("respawnPanel").hidden = true; } }
  else {
    const move = movementVector(); if (Math.hypot(move.x, move.y) > .08) p.direction = move;
    const chargeSlow = battle.chargeStart ? .72 : 1; const speed = charStats().speed * chargeSlow;
    p.x = Math.max(45, Math.min(WORLD.width - 45, p.x + move.x * speed * dt)); p.y = Math.max(45, Math.min(WORLD.height - 45, p.y + move.y * speed * dt));
  }
  if (battle.wavePending) { battle.waveDelay -= dt * 1000; if (battle.waveDelay <= 0) spawnWave(); }
  battle.holes.forEach((hole) => { hole.timer -= dt; if (hole.timer <= 0 && !hole.spawned) { hole.spawned = true; spawnEnemy(hole); } }); battle.holes = battle.holes.filter((hole) => hole.timer > -.5);
  const freeze = p.frozen > 0 ? 0 : 1;
  battle.enemies.forEach((enemy) => {
    enemy.flash = Math.max(0, enemy.flash - dt); const dx = p.x - enemy.x; const dy = p.y - enemy.y; const dist = Math.max(1, Math.hypot(dx, dy)); enemy.x += dx / dist * enemy.speed * dt * freeze; enemy.y += dy / dist * enemy.speed * dt * freeze;
    if (!p.hidden && dist < enemy.radius + p.radius) takeHit();
  });
  battle.projectiles.forEach((shot) => { shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt; battle.enemies.forEach((enemy) => { if (enemy.hp <= 0 || shot.hit.has(enemy)) return; if (Math.hypot(shot.x - enemy.x, shot.y - enemy.y) < shot.radius + enemy.radius) { enemy.hp -= shot.damage; enemy.flash = .15; shot.hit.add(enemy); if (!shot.piercing) shot.life = 0; } }); });
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
function drawAtlas(ctx, image, columns, rows, index, x, y, width, height) {
  if (!image.complete || !image.naturalWidth) return; const cellW = image.naturalWidth / columns; const cellH = image.naturalHeight / rows; const col = index % columns; const row = Math.floor(index / columns);
  ctx.drawImage(image, col * cellW, row * cellH, cellW, cellH, x - width / 2, y - height / 2, width, height);
}
function drawBattle() {
  if (!battle) return; const canvas = $("battleCanvas"); const rect = canvas.getBoundingClientRect(); const ratio = Math.min(2, devicePixelRatio || 1); if (canvas.width !== Math.round(rect.width * ratio) || canvas.height !== Math.round(rect.height * ratio)) { canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio); }
  const ctx = canvas.getContext("2d"); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.imageSmoothingEnabled = false; const width = rect.width; const height = rect.height;
  const cameraX = Math.max(width / 2, Math.min(WORLD.width - width / 2, battle.player.x)); const cameraY = Math.max(height / 2, Math.min(WORLD.height - height / 2, battle.player.y)); const offsetX = width / 2 - cameraX; const offsetY = height / 2 - cameraY;
  const colors = MAP_STYLE[battle.run.map.id] || MAP_STYLE.lung; ctx.fillStyle = colors[0]; ctx.fillRect(0, 0, width, height); ctx.save(); ctx.translate(offsetX, offsetY);
  ctx.fillStyle = colors[1]; for (let x = 70; x < WORLD.width; x += 160) for (let y = 60; y < WORLD.height; y += 150) { const wobble = ((x + y) % 3) * 7; ctx.beginPath(); ctx.arc(x + wobble, y, 34 + ((x * y) % 17), 0, Math.PI * 2); ctx.globalAlpha = .18; ctx.fill(); }
  ctx.globalAlpha = .32; ctx.strokeStyle = colors[2]; ctx.lineWidth = 4; for (let x = 0; x <= WORLD.width; x += 260) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 120, 300, x - 100, 700, x + 80, WORLD.height); ctx.stroke(); } ctx.globalAlpha = 1;
  battle.holes.forEach((hole) => { const pulse = .7 + Math.sin(performance.now() / 90) * .15; ctx.fillStyle = hole.spawned ? "#351f2e" : `rgba(100,28,57,${pulse})`; ctx.beginPath(); ctx.arc(hole.x, hole.y, hole.spawned ? 28 : 34 + pulse * 8, 0, Math.PI * 2); ctx.fill(); if (!hole.spawned) { ctx.strokeStyle = "#ffd38a"; ctx.lineWidth = 3; ctx.stroke(); } });
  battle.projectiles.forEach((shot) => { ctx.fillStyle = shot.piercing ? "#ffe27a" : "#92f4df"; ctx.beginPath(); ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke(); });
  battle.enemies.forEach((enemy) => { ctx.save(); if (enemy.flash > 0) ctx.globalAlpha = .45; drawAtlas(ctx, pathogenImage, 6, 2, enemy.type, enemy.x, enemy.y, enemy.radius * 3.5, enemy.radius * 3.5); ctx.restore(); const hp = Math.max(0, enemy.hp / enemy.maxHp); ctx.fillStyle = "#2b1d28aa"; ctx.fillRect(enemy.x - 22, enemy.y - enemy.radius - 18, 44, 4); ctx.fillStyle = "#e96a6a"; ctx.fillRect(enemy.x - 22, enemy.y - enemy.radius - 18, 44 * hp, 4); });
  if (!battle.player.hidden) { ctx.save(); if (battle.player.invincible > 0 && Math.floor(performance.now() / 100) % 2) ctx.globalAlpha = .3; drawAtlas(ctx, characterImage, 5, 2, battle.run.character.sprite, battle.player.x, battle.player.y, 86, 86); ctx.restore(); const d = battle.player.direction; ctx.strokeStyle = "#d6fff6a8"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(battle.player.x, battle.player.y); ctx.lineTo(battle.player.x + d.x * 48, battle.player.y + d.y * 48); ctx.stroke(); }
  ctx.strokeStyle = "#123940"; ctx.lineWidth = 18; ctx.strokeRect(0, 0, WORLD.width, WORLD.height); ctx.restore();
}
function gameLoop(now) { if (!battle?.running) return; const dt = Math.min(.05, (now - (lastFrame || now)) / 1000); lastFrame = now; updateBattle(dt); drawBattle(); frameId = requestAnimationFrame(gameLoop); }
async function startBattle() {
  if (busy) return; setBusy(true);
  try {
    const run = await api("startRun", { requestId: requestId() }); $("loadingMap").textContent = run.map.name; $("loadingPathogen").textContent = `${run.map.pathogen} / ${run.map.weapon}`; $("loadingScreen").hidden = false;
    await new Promise((resolve) => setTimeout(resolve, 1450)); battle = newBattle(run); $("battleMapName").textContent = run.map.name; $("waveText").textContent = `0 / ${run.waves}`; $("loadingScreen").hidden = true; $("battleScreen").hidden = false; $("respawnPanel").hidden = true; updateHud(); lastFrame = performance.now(); cancelAnimationFrame(frameId); frameId = requestAnimationFrame(gameLoop);
  } catch (error) { showToast(errorText(error)); $("loadingScreen").hidden = true; }
  finally { setBusy(false); }
}
async function finishBattle(won, reason) {
  if (!battle || battle.ended) return; battle.ended = true; battle.running = false; cancelAnimationFrame(frameId);
  const summary = { won, wave: battle.wave, kills: battle.kills, shots: battle.shots, damageTaken: 3 * (3 - battle.player.lives) + battle.player.hits, durationMs: Math.round(Math.max(3000, battle.elapsed)) };
  let result = null; try { result = await api("finishRun", { runId: battle.run.runId, summary, requestId: requestId() }); await refresh(); } catch (error) { showToast(errorText(error, "戦闘記録を保存できませんでした。")); }
  $("battleScreen").hidden = true; $("resultLabel").textContent = won ? "MISSION COMPLETE" : "MISSION FAILED"; $("resultTitle").textContent = won ? "防衛成功" : "防衛失敗";
  $("resultBody").innerHTML = `<p>${escapeHtml(reason)}</p><div class="result-stats"><article><span>到達</span><b>W${summary.wave}</b></article><article><span>撃退</span><b>${summary.kills}</b></article><article><span>EXP</span><b>+${result?.reward?.xp || 0}</b></article></div>${result?.firstClear ? `<p><b>初回クリア報酬 +${result.reward.gachaPoints}GP</b></p>` : ""}${result?.character ? `<p>${escapeHtml(result.character.name)} Lv.${result.character.level}</p>` : ""}`;
  $("resultScreen").hidden = false;
}
function beginCharge() { if (!battle?.running || battle.player.rapid > 0) { fire(1); return; } battle.chargeStart = performance.now(); }
function releaseCharge() { if (!battle?.running) return; const held = battle.chargeStart ? performance.now() - battle.chargeStart : 0; battle.chargeStart = 0; fire(1 + Math.min(2, held / (900 / charStats().charge))); }
function setupJoystick() {
  const area = $("joystick"); const knob = $("joystickKnob");
  const move = (event) => { if (stick.pointer !== event.pointerId) return; const rect = area.getBoundingClientRect(); let x = event.clientX - (rect.left + rect.width / 2); let y = event.clientY - (rect.top + rect.height / 2); const max = rect.width * .34; const length = Math.hypot(x, y); if (length > max) { x = x / length * max; y = y / length * max; } stick.x = x / max; stick.y = y / max; knob.style.transform = `translate(${x}px,${y}px)`; };
  area.addEventListener("pointerdown", (event) => { stick.pointer = event.pointerId; area.setPointerCapture(event.pointerId); move(event); }); area.addEventListener("pointermove", move);
  const end = (event) => { if (stick.pointer !== event.pointerId) return; stick = { x: 0, y: 0, pointer: null }; knob.style.transform = ""; }; area.addEventListener("pointerup", end); area.addEventListener("pointercancel", end);
}
function bindEvents() {
  $("startButton").addEventListener("click", () => { $("titleScreen").hidden = true; $("gameApp").hidden = false; showView("home"); });
  $("homeButton").addEventListener("click", () => showView("home")); $("selectedCharacter").addEventListener("click", () => showView("characters")); $("sortieButton").addEventListener("click", startBattle);
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
  document.querySelectorAll("[data-draw]").forEach((button) => button.addEventListener("click", () => drawGacha(Number(button.dataset.draw))));
  $("ratesButton").addEventListener("click", showRates); $("dialogClose").addEventListener("click", () => { $("dialog").hidden = true; });
  $("dialog").addEventListener("click", (event) => { if (event.target === $("dialog")) $("dialog").hidden = true; });
  document.addEventListener("click", async (event) => {
    const select = event.target.closest("[data-select]"); if (select) await mutate("select", { instanceId: select.dataset.select }, "出撃キャラクターを変更しました。");
    const favorite = event.target.closest("[data-favorite]"); if (favorite) await mutate("favorite", { instanceId: favorite.dataset.favorite, favorite: favorite.dataset.value === "true" });
    const strengthen = event.target.closest("[data-strengthen]"); if (strengthen) await resolveDuplicate(strengthen.dataset.strengthen, "strengthen", strengthen.dataset.target);
    const exchange = event.target.closest("[data-exchange]"); if (exchange) await resolveDuplicate(exchange.dataset.exchange, "exchange");
    if (event.target.closest("[data-keep-dialog]")) $("dialog").hidden = true;
  });
  setupJoystick();
  $("attackButton").addEventListener("pointerdown", (event) => { event.preventDefault(); $("attackButton").setPointerCapture(event.pointerId); beginCharge(); }); $("attackButton").addEventListener("pointerup", (event) => { event.preventDefault(); releaseCharge(); }); $("attackButton").addEventListener("pointercancel", releaseCharge);
  $("skillButton").addEventListener("click", useSkill); $("exitBattle").addEventListener("click", () => { if (confirm("この出撃を終了しますか？")) void finishBattle(false, "途中退出しました"); });
  $("retryButton").addEventListener("click", () => { $("resultScreen").hidden = true; void startBattle(); }); $("resultHome").addEventListener("click", () => { $("resultScreen").hidden = true; showView("home"); });
  addEventListener("keydown", (event) => { keyState.add(event.code); if (event.code === "Space" && !event.repeat) { event.preventDefault(); beginCharge(); } if (event.code === "KeyE" && !event.repeat) useSkill(); });
  addEventListener("keyup", (event) => { keyState.delete(event.code); if (event.code === "Space") { event.preventDefault(); releaseCharge(); } });
  $("battleCanvas").addEventListener("pointerdown", (event) => { if (!battle?.running) return; const rect = $("battleCanvas").getBoundingClientRect(); const x = event.clientX - rect.left - rect.width / 2; const y = event.clientY - rect.top - rect.height / 2; const length = Math.hypot(x, y); if (length > 5) battle.player.direction = { x: x / length, y: y / length }; fire(1); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && battle?.running) lastFrame = performance.now(); });
}
async function init() {
  try {
    await initializePage(); setupAdminTab();
    if (!auth.currentUser || !isMediguardTestStudent(studentNumber)) { location.replace("requests.html"); return; }
    bindEvents(); await refresh(); $("gameShell").hidden = false; document.body.classList.remove("page-loading"); $("gameGate").hidden = true;
  } catch (error) { console.error(error); $("gameGate").querySelector("strong").textContent = "読み込みに失敗しました"; $("gameGate").querySelector("small").textContent = errorText(error, "再読み込みしてください。"); }
}
void init();
