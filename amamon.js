import {
  auth,
  functions,
  studentNumber,
  initializePage,
  setupAdminTab,
  isAmamonTestStudent,
} from "./common.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

const $ = (id) => document.getElementById(id);
const call = (name, timeout = 30000) => httpsCallable(functions, name, { timeout });
const api = {
  dashboard: call("getAmamonState"), create: call("createAmamonCompanion"), draw: call("drawAmamonGacha", 60000),
  duplicate: call("resolveAmamonDuplicate"), equipment: call("saveAmamonEquipment"), skills: call("allocateAmamonSkills"),
  respec: call("respecAmamonSkills"), permanent: call("useAmamonPermanentItem"), startCpu: call("startAmamonCpuBattle"),
  cpuAction: call("submitAmamonCpuAction"), opponents: call("listAmamonOpponents"), invite: call("sendAmamonPvpInvite"),
  respondInvite: call("respondAmamonPvpInvite"), pvpBattle: call("getAmamonPvpBattle"), pvpAction: call("submitAmamonPvpAction"),
  forfeit: call("forfeitAmamonPvp"),
};
const RARITY_COLORS = { N: "#8ca19e", R: "#438fca", SR: "#8e58ce", SSR: "#e25290", UR: "#e89a2b", LR: "#f1c63d" };
const BRANCHES = {
  sword: ["剣術", "攻撃技を習得"], fist: ["格闘", "素早い技を習得"], magic: ["魔法", "攻撃呪文を習得"],
  healing: ["回復", "回復呪文を習得"], guard: ["守護", "防御技を習得"],
};
const SLOT_META = { weapon: ["⚔️", "武器"], head: ["⛑️", "頭"], body: ["🥋", "体"], shield: ["🛡️", "盾"], accessory: ["💎", "アクセサリー"] };
let data = null;
let skillDraft = {};
let equipmentDraft = {};
let busy = false;
let activeBattle = null;
let rawPvpBattle = null;
let pvpPollTimer = 0;
let commandEntries = [];
let commandPage = 0;
let toastTimer = 0;

function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
function requestId() { return crypto.randomUUID ? crypto.randomUUID().replaceAll("-", "") : `${Date.now()}_${crypto.getRandomValues(new Uint32Array(4)).join("_")}`; }
function message(error, fallback = "処理に失敗しました。") { return String(error?.details || error?.message || fallback).replace(/^FirebaseError:\s*/i, ""); }
function showToast(text) { clearTimeout(toastTimer); $("amamonToast").textContent = text; $("amamonToast").hidden = false; toastTimer = setTimeout(() => { $("amamonToast").hidden = true; }, 3200); }
function setBusy(value) { busy = value; document.body.classList.toggle("amamon-busy", value); }
function formatNumber(value) { return Math.max(0, Number(value || 0)).toLocaleString("ja-JP"); }
function applyGrowthSprite(element, state, perspective = "front") {
  const stage = Math.min(3, Math.max(0, Number(state?.growth?.stage || 0)));
  const allowedBranches = new Set(["sword", "fist", "magic", "healing", "guard"]);
  const branch = allowedBranches.has(state?.growth?.branch) ? state.growth.branch : "sword";
  element.className = stage > 0
    ? `sprite ${perspective === "back" ? "companion-evolved-back" : "companion-evolved"} evolution-${branch} evolution-stage-${stage}`
    : `sprite companion-${perspective === "back" ? "back" : "front"}`;
}
function renderCompanionAppearance() {
  applyGrowthSprite($("amamonHomeSprite"), data.state);
  applyGrowthSprite($("amamonEquipmentSprite"), data.state);
  const equipped = Object.entries(data.state.equipment || {}).filter(([, itemId]) => itemId);
  $("amamonVisualEquipment").innerHTML = equipped.map(([slot, itemId]) => {
    const item = data.inventory.find((candidate) => candidate.id === itemId);
    const [icon, slotName] = SLOT_META[slot] || ["✦", "装備"];
    return `<span title="${escapeHtml(`${slotName}：${item?.name || "装備中"}`)}" aria-label="${escapeHtml(`${slotName}：${item?.name || "装備中"}`)}">${icon}</span>`;
  }).join("");
}

async function loadDashboard() {
  const response = await api.dashboard();
  data = response.data;
  skillDraft = { ...data.state.skillAllocation };
  equipmentDraft = { ...data.state.equipment };
  renderAll();
  return data;
}

function renderAll() {
  const state = data.state;
  $("amamonName").textContent = state.companion?.name || "アマル";
  $("amamonNameInput").value = state.companion?.name || "アマル";
  $("amamonLevel").textContent = state.level;
  $("amamonGold").textContent = formatNumber(state.gold);
  $("amamonPoints").textContent = formatNumber(state.gachaPoints);
  $("amamonHpText").textContent = state.stats.maxHp;
  $("amamonMpText").textContent = state.stats.maxMp;
  $("amamonXpText").textContent = state.level >= state.levelCap ? `上限 Lv.${state.levelCap}` : `${formatNumber(state.xp)} / ${formatNumber(state.xpNeeded)}`;
  $("amamonHpBar").style.width = "100%"; $("amamonMpBar").style.width = "100%";
  $("amamonXpBar").style.width = state.level >= state.levelCap ? "100%" : `${Math.min(100, state.xp / Math.max(1, state.xpNeeded) * 100)}%`;
  const branchNames = { baby: "幼体", sword: "剣士型", fist: "格闘型", magic: "魔導型", healing: "治癒型", guard: "守護型" };
  $("amamonGrowthLabel").textContent = state.growth.stage ? `成長${state.growth.stage} · ${branchNames[state.growth.branch]}` : "幼体";
  renderCompanionAppearance();
  renderEnemies(); renderSkills(); renderEquipment(); renderInventory(); renderRecords();
}

function showView(name) {
  const map = { home: "amamonHome", battle: "amamonBattleSelect", training: "amamonTraining", gacha: "amamonGacha", equipment: "amamonEquipment", items: "amamonItems", records: "amamonRecords" };
  document.querySelectorAll(".amamon-view").forEach((view) => { view.hidden = true; });
  $(map[name] || map.home).hidden = false;
  $("amamonScreenTitle").textContent = name === "home" ? "あまもん" : ({ battle: "バトル", training: "育成", gacha: "ガチャ", equipment: "装備", items: "どうぐ", records: "記録" }[name] || "あまもん");
  if (name === "battle") void refreshPvp();
}

function renderEnemies() {
  const state = data.state; const unlocked = new Set(state.unlockedEnemies || []);
  $("amamonCpuEnemies").innerHTML = data.enemies.map((enemy) => {
    const canLimit = enemy.limitBoss && state.level >= state.levelCap && enemy.stage === state.levelCap;
    const available = unlocked.has(enemy.id) || canLimit;
    const cleared = state.defeatedEnemies.includes(enemy.id) || state.limitBreaks.includes(enemy.id);
    return `<button class="amamon-enemy-card" data-enemy="${enemy.id}" ${available ? "" : "disabled"}><span class="sprite enemy-sprite enemy-${Math.min(5, enemy.sprite || 0)}"></span><span><small>${enemy.limitBoss ? "LIMIT BREAK" : `STAGE ${enemy.stage}`} ${cleared ? "· CLEAR" : ""}</small><b>${escapeHtml(enemy.name)}</b><small>Lv.${enemy.level} · ${available ? `報酬 ${enemy.reward.gold}G` : "🔒 未解放"}</small></span></button>`;
  }).join("");
}

function spentDraft() { return Object.keys(BRANCHES).reduce((sum, key) => sum + Math.max(0, Number(skillDraft[key] || 0) - Number(data.state.skillAllocation[key] || 0)), 0); }
function renderSkills() {
  const available = Math.max(0, Number(data.state.skillPoints || 0) - spentDraft());
  $("amamonSkillPoints").textContent = available;
  $("amamonSkillBoard").innerHTML = Object.entries(BRANCHES).map(([key, [name, detail]]) => {
    const nextSkill = data.skillCatalog.filter((skill) => skill.branch === key && skill.points > Number(skillDraft[key] || 0)).sort((a, b) => a.points - b.points)[0];
    return `<article class="amamon-skill-row"><span><b>${name}</b><small>${nextSkill ? `次：${escapeHtml(nextSkill.name)} ${nextSkill.points}pt` : detail}</small></span><button data-skill-minus="${key}" ${Number(skillDraft[key] || 0) <= Number(data.state.skillAllocation[key] || 0) ? "disabled" : ""}>−</button><output>${Number(skillDraft[key] || 0)}</output><button data-skill-plus="${key}" ${available <= 0 ? "disabled" : ""}>＋</button></article>`;
  }).join("");
}

function renderEquipment() {
  const equipment = data.inventory.filter((item) => item.kind === "equipment" && Number(item.quantity || 0) > 0);
  $("amamonEquipmentSlots").innerHTML = Object.entries(SLOT_META).map(([slot, [icon, name]]) => {
    const options = equipment.filter((item) => item.slot === slot).map((item) => `<option value="${item.id}" ${equipmentDraft[slot] === item.id ? "selected" : ""}>${escapeHtml(item.name)} +${Number(item.enhancementLevel || 0)}</option>`).join("");
    return `<label class="amamon-slot"><span>${icon}</span><b>${name}</b><select data-equipment-slot="${slot}"><option value="">装備なし</option>${options}</select></label>`;
  }).join("");
  $("amamonEquipmentStats").textContent = `HP ${data.state.stats.maxHp} / 攻 ${data.state.stats.attack} / 防 ${data.state.stats.defense}`;
  $("amamonEquipmentCandidates").innerHTML = equipment.length ? equipment.map((item) => `<article class="amamon-list-row"><span><b>${escapeHtml(item.name)} +${Number(item.enhancementLevel || 0)}</b><small>${item.rarity} · ${SLOT_META[item.slot]?.[1] || "装備"} · ×${item.quantity}</small></span>${Number(item.quantity || 0) > 1 ? `<button data-enhance="${item.id}">強化</button><button data-exchange="${item.id}">交換</button>` : ""}</article>`).join("") : '<div class="amamon-empty"><p>初期装備以外はまだありません。</p></div>';
}

function itemDetail(item) {
  if (item.kind === "equipment") return `${SLOT_META[item.slot]?.[1] || "装備"} / 強化 +${Number(item.enhancementLevel || 0)}`;
  if (item.kind === "permanent") return `${item.stat} 永久 +${item.amount}`;
  if (item.effect?.healHp) return `HPを${item.effect.healHp}回復`;
  if (item.effect?.healMp) return `MPを${item.effect.healMp}回復`;
  if (item.effect?.attackUp) return "戦闘中の攻撃力を上昇";
  if (item.effect?.cureStatus) return "状態異常を治療";
  return item.kind;
}
function renderInventory() {
  $("amamonInventory").innerHTML = data.inventory.length ? data.inventory.map((item) => `<article class="amamon-item-card" style="--rarity:${RARITY_COLORS[item.rarity] || "#8ca"}"><header><b>${item.rarity}</b><span>×${Number(item.quantity || 0)}</span></header><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(itemDetail(item))}</p><footer>${item.kind === "permanent" && Number(item.quantity || 0) ? `<button data-use-permanent="${item.id}">使う</button>` : ""}${item.kind === "equipment" && Number(item.quantity || 0) > 1 ? `<button data-enhance="${item.id}">強化</button><button data-exchange="${item.id}">交換</button>` : ""}</footer></article>`).join("") : '<div class="amamon-empty"><span>📦</span><p>所持品はまだありません。</p></div>';
}

function renderRecords() {
  const records = data.state.records || {};
  const cards = [["レベル", `Lv.${data.state.level}`], ["総EXP", formatNumber(data.state.totalXp)], ["CPU勝利", formatNumber(records.cpuWins)], ["CPU敗北", formatNumber(records.cpuLosses)], ["対戦勝利", formatNumber(records.pvpWins)], ["対戦敗北", formatNumber(records.pvpLosses)], ["最高連勝", formatNumber(records.bestStreak)], ["ガチャ", `${formatNumber(records.gachaDraws)}回`]];
  $("amamonRecordCards").innerHTML = cards.map(([label, value]) => `<article><span>${label}</span><b>${value}</b></article>`).join("");
  $("amamonBattleHistory").innerHTML = data.battleHistory.length ? data.battleHistory.map((row) => `<p>${row.mode === "pvp" ? "学生対戦" : escapeHtml(row.enemyName || "CPU戦")} · <b>${row.won ? "勝利" : "敗北"}</b> · ${row.turns}ターン</p>`).join("") : "<p>まだ記録がありません。</p>";
  $("amamonGachaHistory").innerHTML = data.gachaHistory.length ? data.gachaHistory.map((row) => `<p>${row.count}回 · ${row.results.map((item) => escapeHtml(item.name)).join("、")}</p>`).join("") : "<p>まだ記録がありません。</p>";
}

async function mutate(task, success) {
  if (busy) return null; setBusy(true);
  try { const result = await task(); if (success) showToast(success); await loadDashboard(); return result; }
  catch (error) { console.error(error); showToast(message(error)); return null; }
  finally { setBusy(false); }
}

async function createCompanion() {
  const name = $("amamonNameInput").value.trim();
  const result = await mutate(() => api.create({ name }), "相棒が誕生しました！");
  if (result) { $("amamonCreate").hidden = true; showView("home"); }
}

function openDialog(title, html) { $("amamonDialogTitle").textContent = title; $("amamonDialogBody").innerHTML = html; $("amamonDialog").hidden = false; }
function showRates() {
  const labels = { N: "ノーマル", R: "レア", SR: "SR", SSR: "SSR", UR: "UR", LR: "LR" };
  openDialog("排出率・アイテム一覧", Object.entries(data.rates).map(([rarity, weight]) => `<div class="amamon-rate-row"><b style="color:${RARITY_COLORS[rarity]}">${rarity}</b><span>${(weight / 10).toFixed(1)}%</span><span>${escapeHtml(data.catalog.filter((item) => item.rarity === rarity).map((item) => item.name).join("、"))}</span></div>`).join("") + '<p style="font-size:10px">抽選結果はサーバー側で確定後に保存されます。</p>');
}
async function drawGacha(count) {
  const response = await mutate(() => api.draw({ count, requestId: requestId() })); if (!response) return;
  const results = response.data.results;
  openDialog("ガチャ結果", `<div class="amamon-gacha-result">${results.map((item) => `<article style="--rarity:${RARITY_COLORS[item.rarity]}"><b style="color:${RARITY_COLORS[item.rarity]}">${item.rarity}</b><strong>${escapeHtml(item.name)}</strong><span>${item.duplicate ? "重複入手" : "NEW!"}</span></article>`).join("")}</div>`);
}

async function resolveDuplicate(itemId, mode) {
  const item = data.inventory.find((entry) => entry.id === itemId); const verb = mode === "enhance" ? "強化素材に使う" : `${data.exchangePoints[item?.rarity] || 0}ptへ交換する`;
  if (!confirm(`${item?.name || "装備"}を${verb}でよいですか？\n最後の1個は残ります。`)) return;
  await mutate(() => api.duplicate({ itemId, mode, requestId: requestId() }), mode === "enhance" ? "装備を強化しました。" : "ガチャポイントへ交換しました。");
}
async function usePermanent(itemId) { const item = data.inventory.find((entry) => entry.id === itemId); if (!confirm(`${item?.name}を使って永久強化しますか？`)) return; await mutate(() => api.permanent({ itemId, requestId: requestId() }), "能力が永久に上がりました。"); }
async function saveEquipment() { await mutate(() => api.equipment({ equipment: equipmentDraft }), "装備を変更しました。"); }
async function saveSkills() { await mutate(() => api.skills({ allocation: skillDraft }), "スキル配分を保存しました。"); }
async function respecSkills() { if (!confirm("300ガチャポイントを使ってスキルポイントを振り直しますか？")) return; await mutate(() => api.respec({ requestId: requestId() }), "スキルポイントを戻しました。"); }

async function startCpu(enemyId) {
  if (busy) return; setBusy(true);
  try { const response = await api.startCpu({ enemyId, requestId: requestId() }); activeBattle = response.data.battle; renderBattle(); $("amamonCombat").hidden = false; }
  catch (error) { showToast(message(error)); }
  finally { setBusy(false); }
}
function healthWidth(current, maximum) { return `${Math.max(0, Math.min(100, Number(current || 0) / Math.max(1, Number(maximum || 1)) * 100))}%`; }
function renderBattle() {
  if (!activeBattle) return; const player = activeBattle.player; const enemy = activeBattle.enemy;
  $("enemyName").textContent = enemy.name; $("enemyLevel").textContent = activeBattle.enemyStage; $("enemyHpBar").style.width = healthWidth(enemy.hp, enemy.stats.maxHp); $("enemyHpText").textContent = `${enemy.hp} / ${enemy.stats.maxHp}`;
  $("playerName").textContent = player.name; $("playerLevel").textContent = data.state.level; $("playerHpBar").style.width = healthWidth(player.hp, player.stats.maxHp); $("playerHpText").textContent = `${player.hp} / ${player.stats.maxHp}`; $("playerMpBar").style.width = healthWidth(player.mp, player.stats.maxMp); $("playerMpText").textContent = `${player.mp} / ${player.stats.maxMp}`;
  applyGrowthSprite($("amamonPlayerSprite"), { growth: player.growth || data.state.growth }, "back");
  if (activeBattle.mode === "pvp") applyGrowthSprite($("amamonEnemySprite"), { growth: enemy.growth });
  else $("amamonEnemySprite").className = `sprite enemy-sprite enemy-${Math.min(5, activeBattle.enemySprite || 0)}`;
  $("amamonBattleLog").textContent = (activeBattle.log || []).at(-1) || "行動を選んでください。";
  $("amamonCommandRoot").hidden = false; $("amamonCommandSub").hidden = true;
}
function animateAction(action) {
  const playerSprite = $("amamonPlayerSprite");
  const enemySprite = $("amamonEnemySprite");
  const playerClass = action.type === "guard" ? "amamon-guard-pulse" : "amamon-strike";
  playerSprite.classList.remove("amamon-strike", "amamon-guard-pulse");
  enemySprite.classList.remove("amamon-hit-shake");
  $("amamonEffect").classList.remove("flash");
  void playerSprite.offsetWidth;
  playerSprite.classList.add(playerClass);
  if (!["guard", "item", "equipment"].includes(action.type)) enemySprite.classList.add("amamon-hit-shake");
  $("amamonEffect").classList.add("flash");
  setTimeout(() => { playerSprite.classList.remove(playerClass); enemySprite.classList.remove("amamon-hit-shake"); }, 700);
}
async function submitCpuAction(action) {
  if (busy || !activeBattle) return; setBusy(true);
  try {
    animateAction(action);
    if (activeBattle.mode === "pvp") {
      const response = await api.pvpAction({ battleId: activeBattle.battleId, action, requestId: requestId() });
      rawPvpBattle = response.data.battle;
      adaptPvpBattle(rawPvpBattle);
      renderBattle();
      if (!response.data.resolved) { $("amamonBattleLog").textContent = "行動を確定しました。相手の選択を待っています…"; schedulePvpPoll(); }
      if (rawPvpBattle.status === "finished") await finishPvpBattle();
      return;
    }
    const response = await api.cpuAction({ battleId: activeBattle.battleId, action, requestId: requestId() }); activeBattle = response.data.battle; renderBattle();
    if (response.data.reward) { await loadDashboard(); const reward = response.data.reward; $("amamonPlayerSprite").classList.add(reward.won ? "amamon-victory-pulse" : "amamon-defeat-fade"); $("amamonBattleResult").innerHTML = `<h2>${reward.won ? "WIN!" : "DEFEAT"}</h2><p>${reward.won ? `EXP +${reward.xp}<br>G ${reward.goldDelta >= 0 ? "+" : ""}${reward.goldDelta}` : `EXP +${reward.xp}<br>G ${reward.goldDelta}`}</p>${reward.levelsGained ? `<b>LEVEL UP! Lv.${reward.level}</b>` : ""}${reward.drop ? `<p>🎁 ${escapeHtml(reward.drop.name)}</p>` : ""}<button id="amamonResultClose">ホームへ</button>`; $("amamonBattleResult").hidden = false; $("amamonResultClose").onclick = closeCombat;
    }
  } catch (error) { showToast(message(error)); }
  finally { setBusy(false); }
}
function closeCombat() { clearTimeout(pvpPollTimer); rawPvpBattle = null; activeBattle = null; $("amamonCombat").hidden = true; $("amamonBattleResult").hidden = true; showView("home"); }

function commandList(type) {
  if (type === "skill" || type === "spell") return data.state.skills.filter((skill) => skill.type === type).map((skill) => ({ id: skill.id, name: skill.name, detail: `${skill.mp || 0}MP / 威力 ${skill.power || "補助"}`, disabled: activeBattle.player.mp < Number(skill.mp || 0), action: { type, id: skill.id } }));
  if (type === "item") return data.inventory.filter((item) => item.kind === "consumable" && Number(item.quantity || 0) > 0).map((item) => ({ id: item.id, name: item.name, detail: `${itemDetail(item)} / ×${item.quantity}`, action: { type, id: item.id } }));
  if (type === "equipment") return data.inventory.filter((item) => item.kind === "equipment" && Number(item.quantity || 0) > 0).map((item) => ({ id: item.id, name: item.name, detail: `${SLOT_META[item.slot]?.[1]} / +${Number(item.enhancementLevel || 0)}`, action: { type, id: item.id } }));
  return [];
}
function openCommand(type) { commandEntries = commandList(type); commandPage = 0; $("amamonCommandRoot").hidden = true; $("amamonCommandSub").hidden = false; renderCommandPage(); }
function renderCommandPage() {
  const pages = Math.max(1, Math.ceil(commandEntries.length / 4)); commandPage = Math.max(0, Math.min(pages - 1, commandPage)); const page = commandEntries.slice(commandPage * 4, commandPage * 4 + 4);
  $("amamonCommandItems").innerHTML = page.length ? page.map((entry) => `<button data-command-entry="${entry.id}" ${entry.disabled ? "disabled" : ""}><b>${escapeHtml(entry.name)}</b><small>${escapeHtml(entry.detail)}</small></button>`).join("") : '<p style="grid-column:1/-1;text-align:center;font-size:10px">使えるものがありません。</p>';
  $("amamonCommandPage").textContent = `${commandPage + 1} / ${pages}`; $("amamonCommandPrev").disabled = commandPage <= 0; $("amamonCommandNext").disabled = commandPage >= pages - 1;
}

async function refreshPvp() {
  try {
    const [response, freshDashboard] = await Promise.all([api.opponents(), api.dashboard()]); data = freshDashboard.data; const opponents = response.data.opponents || [];
    $("amamonOpponentList").innerHTML = opponents.length ? opponents.map((entry) => `<article class="amamon-list-row"><span><b>${escapeHtml(entry.companionName)}</b><small>${entry.studentNumber} · Lv.${entry.level}</small></span><button data-invite="${entry.studentNumber}">招待</button></article>`).join("") : '<div class="amamon-empty"><p>現在、対戦できるテスト参加者はいません。許可ユーザーを追加するとここへ表示されます。</p></div>';
    renderInvites();
  } catch (error) { $("amamonOpponentList").innerHTML = `<div class="amamon-empty"><p>${escapeHtml(message(error))}</p></div>`; }
}
function renderInvites() {
  const invites = data.pvpInvites || [];
  $("amamonInviteList").innerHTML = invites.map((invite) => {
    if (invite.status === "accepted" && invite.battleId) return `<article class="amamon-list-row"><span><b>${escapeHtml(invite.from === studentNumber ? invite.to : invite.from)}との対戦</b><small>対戦を再開できます</small></span><button data-open-pvp="${invite.battleId}">対戦へ</button></article>`;
    if (invite.status === "pending" && invite.to === studentNumber) return `<article class="amamon-list-row"><span><b>${escapeHtml(invite.from)}から対戦招待</b><small>承認すると対戦を開始します</small></span><button data-invite-accept="${invite.id}">承認</button><button data-invite-reject="${invite.id}">拒否</button></article>`;
    if (invite.status === "pending" && invite.from === studentNumber) return `<article class="amamon-list-row"><span><b>${escapeHtml(invite.to)}へ招待中</b><small>相手の承認を待っています</small></span></article>`;
    return "";
  }).join("");
}

function adaptPvpBattle(battle) {
  const opponent = battle.participants.find((number) => number !== studentNumber);
  activeBattle = {
    mode: "pvp", battleId: battle.battleId, player: battle.players[studentNumber], enemy: battle.players[opponent],
    enemyStage: battle.players[opponent]?.level || 1, enemySprite: 0, log: battle.log || [], status: battle.status, opponent, winner: battle.winner,
  };
}
async function openPvpBattle(battleId) {
  if (busy) return; setBusy(true);
  try { const response = await api.pvpBattle({ battleId }); rawPvpBattle = response.data.battle; adaptPvpBattle(rawPvpBattle); renderBattle(); $("amamonCombat").hidden = false; if (rawPvpBattle.pendingActions?.[studentNumber]) { $("amamonBattleLog").textContent = "相手の行動を待っています…"; schedulePvpPoll(); } if (rawPvpBattle.status === "finished") await finishPvpBattle(); }
  catch (error) { showToast(message(error)); }
  finally { setBusy(false); }
}
function schedulePvpPoll() { clearTimeout(pvpPollTimer); pvpPollTimer = setTimeout(() => { void pollPvp(); }, 2500); }
async function pollPvp() {
  if (!activeBattle?.battleId || activeBattle.mode !== "pvp") return;
  try { const response = await api.pvpBattle({ battleId: activeBattle.battleId }); const previousTurn = rawPvpBattle?.turn; rawPvpBattle = response.data.battle; adaptPvpBattle(rawPvpBattle); renderBattle(); if (rawPvpBattle.status === "finished") { await finishPvpBattle(); return; } if (rawPvpBattle.pendingActions?.[studentNumber] || rawPvpBattle.turn === previousTurn) { $("amamonBattleLog").textContent = "相手の行動を待っています…"; schedulePvpPoll(); } }
  catch (error) { showToast(message(error)); schedulePvpPoll(); }
}
async function finishPvpBattle() {
  clearTimeout(pvpPollTimer); await loadDashboard(); const won = rawPvpBattle?.winner === studentNumber;
  $("amamonPlayerSprite").classList.add(won ? "amamon-victory-pulse" : "amamon-defeat-fade");
  $("amamonBattleResult").innerHTML = `<h2>${won ? "WIN!" : "DEFEAT"}</h2><p>学生対戦の結果を保存しました。</p><button id="amamonResultClose">ホームへ</button>`; $("amamonBattleResult").hidden = false; $("amamonResultClose").onclick = closeCombat;
}

function setupEvents() {
  $("amamonStart").onclick = () => { $("amamonTitle").hidden = true; $("amamonApp").hidden = false; if (!data.state.companion?.id) $("amamonCreate").hidden = false; else showView("home"); };
  $("amamonHomeButton").onclick = () => showView("home");
  document.querySelectorAll("[data-view]").forEach((button) => { button.onclick = () => showView(button.dataset.view); });
  $("amamonCreateButton").onclick = createCompanion; $("amamonDialogClose").onclick = () => { $("amamonDialog").hidden = true; };
  $("amamonDialog").onclick = (event) => { if (event.target === $("amamonDialog")) $("amamonDialog").hidden = true; };
  $("amamonRates").onclick = showRates; document.querySelectorAll("[data-draw]").forEach((button) => { button.onclick = () => drawGacha(Number(button.dataset.draw)); });
  $("amamonRefreshPvp").onclick = refreshPvp;
  $("amamonCpuEnemies").onclick = (event) => { const button = event.target.closest("[data-enemy]"); if (button && !button.disabled) void startCpu(button.dataset.enemy); };
  document.querySelectorAll("[data-battle-tab]").forEach((button) => { button.onclick = () => { document.querySelectorAll("[data-battle-tab]").forEach((entry) => entry.classList.toggle("active", entry === button)); const pvp = button.dataset.battleTab === "pvp"; $("amamonCpuEnemies").hidden = pvp; $("amamonPvpArea").hidden = !pvp; }; });
  $("amamonSkillBoard").onclick = (event) => { const plus = event.target.dataset.skillPlus; const minus = event.target.dataset.skillMinus; if (plus && Number(data.state.skillPoints || 0) - spentDraft() > 0) skillDraft[plus] = Number(skillDraft[plus] || 0) + 1; if (minus && Number(skillDraft[minus] || 0) > Number(data.state.skillAllocation[minus] || 0)) skillDraft[minus] -= 1; renderSkills(); };
  $("amamonSaveSkills").onclick = saveSkills; $("amamonRespecSkills").onclick = respecSkills;
  $("amamonEquipmentSlots").onchange = (event) => { const select = event.target.closest("[data-equipment-slot]"); if (!select) return; if (select.value) equipmentDraft[select.dataset.equipmentSlot] = select.value; else delete equipmentDraft[select.dataset.equipmentSlot]; };
  $("amamonSaveEquipment").onclick = saveEquipment;
  const inventoryClick = (event) => { const enhance = event.target.closest("[data-enhance]"); const exchange = event.target.closest("[data-exchange]"); const permanent = event.target.closest("[data-use-permanent]"); if (enhance) void resolveDuplicate(enhance.dataset.enhance, "enhance"); if (exchange) void resolveDuplicate(exchange.dataset.exchange, "exchange"); if (permanent) void usePermanent(permanent.dataset.usePermanent); };
  $("amamonEquipmentCandidates").onclick = inventoryClick; $("amamonInventory").onclick = inventoryClick;
  $("amamonCommandRoot").onclick = (event) => { const button = event.target.closest("[data-command]"); if (!button) return; const type = button.dataset.command; if (type === "attack" || type === "guard") void submitCpuAction({ type, id: "" }); else openCommand(type); };
  $("amamonCommandItems").onclick = (event) => { const button = event.target.closest("[data-command-entry]"); const entry = commandEntries.find((item) => item.id === button?.dataset.commandEntry); if (entry && !button.disabled) void submitCpuAction(entry.action); };
  $("amamonCommandPrev").onclick = () => { commandPage -= 1; renderCommandPage(); }; $("amamonCommandNext").onclick = () => { commandPage += 1; renderCommandPage(); }; $("amamonCommandBack").onclick = () => { $("amamonCommandRoot").hidden = false; $("amamonCommandSub").hidden = true; };
  $("amamonQuitBattle").onclick = async () => { if (!confirm(activeBattle?.mode === "pvp" ? "対戦を棄権しますか？" : "この戦闘画面を閉じますか？進行中のCPU戦は報酬なしで終了します。")) return; if (activeBattle?.mode === "pvp") await mutate(() => api.forfeit({ battleId: activeBattle.battleId })); closeCombat(); };
  $("amamonOpponentList").onclick = async (event) => { const button = event.target.closest("[data-invite]"); if (!button) return; await mutate(() => api.invite({ targetStudentNumber: button.dataset.invite, requestId: requestId() }), "対戦招待を送りました。"); };
  $("amamonInviteList").onclick = async (event) => { const open = event.target.closest("[data-open-pvp]"); if (open) { await openPvpBattle(open.dataset.openPvp); return; } const accept = event.target.closest("[data-invite-accept]"); const reject = event.target.closest("[data-invite-reject]"); const button = accept || reject; if (!button) return; const response = await mutate(() => api.respondInvite({ inviteId: button.dataset.inviteAccept || button.dataset.inviteReject, accept: Boolean(accept) })); if (response?.data?.battleId) await openPvpBattle(response.data.battleId); };
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { if (!$("amamonCombat").hidden) closeCombat(); else if (!$("amamonDialog").hidden) $("amamonDialog").hidden = true; else showView("home"); } });
}

async function boot() {
  if (!isAmamonTestStudent(studentNumber)) { location.replace("requests.html"); return; }
  await auth.authStateReady();
  if (auth.currentUser?.uid !== `caremate-${studentNumber}`) { location.replace("login.html"); return; }
  try {
    await loadDashboard(); setupEvents(); $("amamonGate").hidden = true; $("amamonShell").hidden = false;
  } catch (error) {
    console.error("あまもん初期化エラー", error);
    if (["functions/permission-denied", "functions/unauthenticated"].includes(error?.code)) { location.replace("requests.html"); return; }
    $("amamonGate").innerHTML = `<img src="images/amamon-tab.svg" alt="" width="70"><strong>あまもんを開始できませんでした</strong><span>${escapeHtml(message(error))}</span><button onclick="location.reload()">もう一度試す</button>`;
  }
}

initializePage([boot(), setupAdminTab()]);
