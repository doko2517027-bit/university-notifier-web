import {
  auth,
  functions,
  studentNumber,
  initializePage,
  setupAdminTab,
  isBoneAdventureTestStudent,
} from "./common.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

const $ = (id) => document.getElementById(id);
const call = (name, timeout = 30000) => httpsCallable(functions, name, { timeout });
const api = {
  dashboard: call("getBoneAdventureState"),
  draw: call("drawBoneAdventureGacha"),
  duplicate: call("resolveBoneAdventureDuplicate"),
  loadout: call("saveBoneAdventureLoadout"),
  stats: call("allocateBoneAdventureStats"),
  respec: call("respecBoneAdventureStats"),
  run: call("saveBoneAdventureRun"),
};

const RARITY_LABELS = { N: "ノーマル", R: "レア", SR: "SR", SSR: "SSR", UR: "UR", LR: "LR" };
const RARITY_COLORS = { N: "#92a3a0", R: "#4f9fdb", SR: "#9d63d5", SSR: "#e45d9d", UR: "#e89c22", LR: "#f3ce48" };
const STAT_META = {
  vitality: { name: "生命力", detail: "体力と接触への耐久力" },
  agility: { name: "敏捷性", detail: "ジャンプと移動の扱いやすさ" },
  power: { name: "能力出力", detail: "特殊能力の持続・再使用" },
};
const STAGES = [
  { id: 1, name: "芽吹きの森", world: "forest", detail: "基本操作", background: "linear-gradient(145deg,#2d8055,#173f2d)" },
  { id: 2, name: "ケアメイト・シティ", world: "city", detail: "動く菌が登場", background: "linear-gradient(145deg,#6189a5,#354655)" },
  { id: 3, name: "抗体の砂漠", world: "desert", detail: "障害物が増加", background: "linear-gradient(145deg,#d49a4f,#905022)" },
  { id: 4, name: "白銀の稜線", world: "snow", detail: "速度が上昇", background: "linear-gradient(145deg,#9bcad9,#587f92)" },
];
const ORGAN_INFO = {
  heart: { name: "心臓", description: "全身へ血液を送り出すポンプの役割を担う臓器です。", structure: "主に4つの部屋と弁から構成され、左右で肺循環と体循環を担います。", disease: "心不全、不整脈、虚血性心疾患など。", tests: "脈拍、血圧、心電図、心エコーなどを組み合わせて評価します。", nursing: "呼吸状態、循環動態、浮腫、胸部症状、活動耐容能などを継続して観察します。" },
  lungs: { name: "肺", description: "吸気から酸素を取り込み、二酸化炭素を排出する臓器です。", structure: "気管支の先に肺胞が広がり、肺胞と毛細血管の間でガス交換が行われます。", disease: "肺炎、COPD、気管支喘息など。", tests: "呼吸数、SpO₂、血液ガス、胸部画像、呼吸機能検査など。", nursing: "呼吸音、努力呼吸、痰、体位、酸素療法中の状態などを観察します。" },
  eyes: { name: "眼", description: "光を受け取り、視覚情報として脳へ伝える感覚器です。", structure: "角膜、水晶体、網膜、視神経などが視覚に関与します。", disease: "白内障、緑内障、網膜疾患など。", tests: "視力、眼圧、眼底検査など。", nursing: "視覚変化、疼痛、転倒リスク、点眼手技などを確認します。" },
  kidney: { name: "腎臓", description: "血液をろ過し、尿生成と体液・電解質調整に関与します。", structure: "腎実質には多数のネフロンがあり、糸球体と尿細管でろ過と再吸収が行われます。", disease: "急性腎障害、慢性腎臓病など。", tests: "尿量、尿検査、血清クレアチニン、eGFR、電解質など。", nursing: "尿量、体重、浮腫、血圧、食事・水分、薬剤の影響などを観察します。" },
  brain: { name: "脳", description: "感覚・運動・認知・生命維持に関わる情報処理の中枢です。", structure: "大脳、小脳、脳幹などが連携して多様な機能を担います。", disease: "脳血管障害、てんかん、認知症など。", tests: "意識レベル、神経学的所見、画像検査、脳波など。", nursing: "意識、瞳孔、運動・感覚、言語、嚥下、安全確保などを観察します。" },
  muscle: { name: "骨格筋", description: "関節を動かし、姿勢保持や熱産生にも関与します。", structure: "筋線維が束になり、腱を介して骨へ付着します。", disease: "廃用性筋萎縮、筋損傷など。", tests: "筋力、関節可動域、歩行・動作、必要に応じて血液検査など。", nursing: "疼痛、筋力、活動量、転倒リスク、リハビリ状況などを確認します。" },
  skin: { name: "皮膚", description: "外界から身体を守り、体温調節や感覚にも関与します。", structure: "表皮・真皮・皮下組織から構成されます。", disease: "褥瘡、皮膚炎、感染症など。", tests: "視診・触診を基本に、必要に応じて培養や皮膚検査を行います。", nursing: "発赤、湿潤、乾燥、損傷、圧迫、清潔と保湿の状態を観察します。" },
};

let dashboard = null;
let viewer = null;
let runner = null;
let activeOrgan = null;
let tempStats = { vitality: 0, agility: 0, power: 0 };
let tempRemaining = 0;
let toastTimer = 0;
let revealGachaNow = null;
let mutationBusy = false;

function showToast(message) {
  clearTimeout(toastTimer);
  $("bonadToast").textContent = message;
  $("bonadToast").hidden = false;
  toastTimer = setTimeout(() => { $("bonadToast").hidden = true; }, 3200);
}

function errorMessage(error, fallback = "処理に失敗しました。") {
  return String(error?.message || error?.details || fallback).replace(/^FirebaseError:\s*/i, "");
}

function requestId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${crypto.getRandomValues(new Uint32Array(4)).join("_")}`;
}

async function loadDashboard() {
  const response = await api.dashboard();
  dashboard = response.data;
  tempStats = { ...dashboard.state.allocatedStats };
  tempRemaining = dashboard.state.unspentStatPoints;
  renderAll();
  return dashboard;
}

function renderAll() {
  const state = dashboard.state;
  $("bonadPoints").textContent = `${state.gachaPoints.toLocaleString("ja-JP")}pt`;
  $("bonadLevel").textContent = state.level;
  $("bonadXpText").textContent = state.level >= state.maxLevel ? "MAX LEVEL" : `${state.xp} / ${state.xpNeeded} XP`;
  $("bonadXpBar").style.width = state.level >= state.maxLevel ? "100%" : `${Math.min(100, (state.xp / Math.max(1, state.xpNeeded)) * 100)}%`;
  $("bonadStatPoint").textContent = `能力pt ${state.unspentStatPoints}`;
  $("bonadTrainingAvailable").textContent = `残り ${tempRemaining}pt`;
  $("bonadSlots").textContent = `${state.abilityEquipped.length} / ${state.equipmentSlots}枠`;
  $("bonadUnlockedStage").textContent = `Stage ${state.unlockedStage}`;
  $("bonadBestDistance").textContent = `${state.endlessBestDistance}m`;
  $("bonadBestScore").textContent = state.endlessBestScore.toLocaleString("ja-JP");
  renderRates();
  renderInventory();
  renderStats();
  renderEquipment();
  renderStages();
  viewer?.setEquipped(state.visualEquipped, dashboard.catalog);
}

function renderRates() {
  $("bonadRateList").innerHTML = Object.entries(dashboard.rates).map(([rarity, weight]) => {
    const names = dashboard.catalog.filter((item) => item.rarity === rarity).map((item) => item.name).join("、");
    return `<div class="bonad-rate-row"><b>${rarity}</b><span>${(weight / 10).toFixed(1)}%</span><span>${escapeHtml(names)}</span></div>`;
  }).join("");
}

function renderInventory() {
  if (!dashboard.inventory.length) {
    $("bonadInventory").innerHTML = '<p class="bonad-note">まだアイテムがありません。ガチャで最初のパーツを獲得しましょう。</p>';
    return;
  }
  const visualIds = new Set(Object.values(dashboard.state.visualEquipped || {}));
  $("bonadInventory").innerHTML = dashboard.inventory.map((item) => {
    const duplicate = Number(item.quantity || 0) > 1;
    const visual = ["organ", "decoration"].includes(item.kind);
    return `<article class="bonad-item-card" style="--rarity-color:${RARITY_COLORS[item.rarity]}"><header><b>${item.rarity}</b><span>×${item.quantity}</span></header><h4>${escapeHtml(item.name)}</h4><p>${escapeHtml(item.ability)}</p><small>強化 +${Number(item.enhancementLevel || 0)}</small><footer>${visual ? `<button data-visual-item="${item.id}">${visualIds.has(item.id) ? "見た目から外す" : "見た目に装着"}</button>` : ""}${duplicate && Number(item.enhancementLevel || 0) < dashboard.maxEnhancement ? `<button data-enhance-item="${item.id}">重複で強化</button>` : ""}${duplicate ? `<button data-exchange-item="${item.id}">${dashboard.exchangePoints[item.rarity]}ptへ交換</button>` : ""}</footer></article>`;
  }).join("");
}

function renderStats() {
  $("bonadTrainingAvailable").textContent = `残り ${tempRemaining}pt`;
  $("bonadStats").innerHTML = Object.entries(STAT_META).map(([key, meta]) => `<div class="bonad-stat-row"><span><b>${meta.name}</b><small>${meta.detail}</small></span><button data-stat-minus="${key}" type="button" ${tempStats[key] <= dashboard.state.allocatedStats[key] ? "disabled" : ""}>−</button><output>${tempStats[key]}</output><button data-stat-plus="${key}" type="button" ${tempRemaining <= 0 ? "disabled" : ""}>＋</button></div>`).join("");
}

function renderEquipment() {
  const equipped = new Set(dashboard.state.abilityEquipped || []);
  const eligible = dashboard.inventory.filter((item) => ["ability", "organ", "material"].includes(item.kind));
  $("bonadEquipmentList").innerHTML = eligible.length ? eligible.map((item) => `<label class="bonad-equip-row"><input type="checkbox" value="${item.id}" ${equipped.has(item.id) ? "checked" : ""}/><span><b>${escapeHtml(item.name)} +${Number(item.enhancementLevel || 0)}</b><small>${escapeHtml(item.ability)}</small></span></label>`).join("") : '<p class="bonad-note">装備できるアイテムをまだ所持していません。</p>';
}

function renderStages() {
  $("bonadStageList").innerHTML = STAGES.map((stage) => `<button class="bonad-stage-card" style="--stage-bg:${stage.background}" data-stage="${stage.id}" ${stage.id > dashboard.state.unlockedStage ? "disabled" : ""}><span>STAGE ${stage.id}${dashboard.state.completedStages.includes(stage.id) ? " · CLEAR" : ""}</span><h3>${stage.name}</h3><small>${stage.id > dashboard.state.unlockedStage ? "🔒 未解放" : stage.detail}</small></button>`).join("");
}

async function initializeViewer() {
  if (viewer) return;
  const status = $("bonad3dStatus");
  try {
    const { createBoneCharacterViewer } = await import("./bone_adventure_3d.js?v=20261009-1");
    viewer = createBoneCharacterViewer({ canvas: $("bonad3dCanvas"), onOrganSelect: showOrgan });
    viewer.setEquipped(dashboard.state.visualEquipped, dashboard.catalog);
    status.hidden = true;
  } catch (error) {
    console.error("ボンアド3D初期化エラー", error);
    status.textContent = "この端末では3D表示を開始できませんでした。ほかの機能は利用できます。";
  }
}

function showOrgan(organ, item) {
  activeOrgan = organ;
  const info = ORGAN_INFO[organ] || { name: item?.name || "人体パーツ", description: "詳細情報は今後追加予定です。" };
  $("bonadOrganName").textContent = info.name;
  $("bonadOrganDescription").textContent = info.description;
  $("bonadOrganAbility").textContent = item?.ability || "能力情報なし";
  $("bonadOrganDetail").disabled = !ORGAN_INFO[organ];
}

function openOrganDetail() {
  const info = ORGAN_INFO[activeOrgan];
  if (!info) return;
  $("bonadDetailTitle").textContent = info.name;
  $("bonadOrganDetailBody").innerHTML = [
    ["構造と働き", info.structure], ["関連疾患", info.disease], ["検査・評価", info.tests], ["看護で重要な観察", info.nursing], ["関連問題", "関連するテスト対策問題への連携はテスト版の次段階で追加します。"],
  ].map(([title, body]) => `<section class="bonad-detail-section"><h3>${title}</h3><p>${body}</p></section>`).join("");
  $("bonadOrganOverlay").hidden = false;
}

function setView(name) {
  document.querySelectorAll("[data-bonad-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.bonadView === name));
  document.querySelectorAll("[data-bonad-panel]").forEach((panel) => { panel.hidden = panel.dataset.bonadPanel !== name; panel.classList.toggle("is-active", panel.dataset.bonadPanel === name); });
  if (name === "room") void initializeViewer();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function runGacha(count) {
  if (mutationBusy) return;
  const cost = dashboard.costs[count];
  if (dashboard.state.gachaPoints < cost) { showToast("ガチャポイントが不足しています。"); return; }
  const overlay = $("bonadGachaOverlay");
  const animation = $("bonadGachaAnimation");
  const results = $("bonadGachaResults");
  const close = $("bonadCloseGacha");
  overlay.hidden = false;
  animation.hidden = false;
  animation.classList.remove("is-lr");
  results.hidden = true;
  $("bonadResultTitle").hidden = true;
  close.hidden = count === 1;
  close.textContent = "演出をスキップ";
  let skip = false;
  revealGachaNow = () => { skip = true; };
  mutationBusy = true;
  try {
    const response = await api.draw({ count, requestId: requestId() });
    const started = Date.now();
    while (!skip && Date.now() - started < (count === 1 ? 1400 : 2200)) await new Promise((resolve) => setTimeout(resolve, 80));
    const payload = response.data;
    const hasLr = payload.results.some((item) => item.rarity === "LR");
    animation.classList.toggle("is-lr", hasLr);
    animation.hidden = true;
    $("bonadResultTitle").hidden = false;
    results.hidden = false;
    results.innerHTML = payload.results.map((item) => `<article class="bonad-result-card" style="--rarity-color:${RARITY_COLORS[item.rarity]}"><strong>${item.rarity} ${escapeHtml(item.name)}</strong><small>${item.duplicate ? "重複獲得" : "NEW"}</small></article>`).join("");
    close.hidden = false;
    close.textContent = "確認";
    dashboard.state.gachaPoints = payload.remainingPoints;
    await loadDashboard();
  } catch (error) {
    overlay.hidden = true;
    showToast(errorMessage(error, "ガチャを実行できませんでした。"));
  } finally {
    revealGachaNow = null;
    mutationBusy = false;
  }
}

async function resolveDuplicate(itemId, mode) {
  if (mutationBusy) return;
  mutationBusy = true;
  try {
    await api.duplicate({ itemId, mode, requestId: requestId() });
    await loadDashboard();
    showToast(mode === "exchange" ? "ガチャポイントへ交換しました。" : "アイテムを強化しました。");
  } catch (error) { showToast(errorMessage(error)); }
  finally { mutationBusy = false; }
}

async function toggleVisual(itemId) {
  const item = dashboard.inventory.find((candidate) => candidate.id === itemId);
  if (!item) return;
  const visual = { ...(dashboard.state.visualEquipped || {}) };
  const key = item.organ || item.kind;
  if (visual[key] === itemId) delete visual[key]; else visual[key] = itemId;
  try {
    await api.loadout({ visualItemIds: Object.values(visual), abilityItemIds: dashboard.state.abilityEquipped });
    await loadDashboard();
    showToast(visual[key] ? `${item.name}を装着しました。` : `${item.name}を外しました。`);
  } catch (error) { showToast(errorMessage(error)); }
}

async function saveStats() {
  try {
    await api.stats({ stats: tempStats });
    await loadDashboard();
    showToast("能力ポイントを保存しました。");
  } catch (error) { showToast(errorMessage(error)); }
}

async function respecStats() {
  if (mutationBusy) return;
  if (!confirm("300ガチャポイントを使って、自由配分した能力をすべて戻しますか？")) return;
  mutationBusy = true;
  try { await api.respec({ requestId: requestId() }); await loadDashboard(); showToast("能力ポイントを振り直せる状態に戻しました。"); } catch (error) { showToast(errorMessage(error)); }
  finally { mutationBusy = false; }
}

async function saveEquipment() {
  const checked = [...document.querySelectorAll('#bonadEquipmentList input[type="checkbox"]:checked')].map((input) => input.value);
  if (checked.length > dashboard.state.equipmentSlots) { showToast(`装備は${dashboard.state.equipmentSlots}個までです。`); return; }
  try { await api.loadout({ visualItemIds: Object.values(dashboard.state.visualEquipped || {}), abilityItemIds: checked }); await loadDashboard(); showToast("ゲーム用装備を保存しました。"); } catch (error) { showToast(errorMessage(error)); }
}

async function startGame({ mode = "stage", stage = 1 } = {}) {
  const config = STAGES.find((item) => item.id === stage) || STAGES[0];
  if (!runner) {
    const { BoneAdventureRunner } = await import("./bone_adventure_game.js?v=20261009-1");
    runner = new BoneAdventureRunner({ canvas: $("bonadGameCanvas"), onFrame: updateGameHud, onFinish: finishGame });
  }
  $("bonadGameOverlay").hidden = false;
  $("bonadGameMessage").hidden = true;
  $("bonadGameTitle").textContent = mode === "endless" ? "ENDLESS" : `Stage ${stage} · ${config.name}`;
  const enhancementPower = dashboard.inventory.filter((item) => dashboard.state.abilityEquipped.includes(item.id)).reduce((sum, item) => sum + Number(item.enhancementLevel || 0), 0);
  runner.start({ mode, stage, world: config.world, abilityPower: dashboard.state.allocatedStats.power + enhancementPower });
}

function updateGameHud(frame) {
  $("bonadGameDistance").textContent = `${frame.distance}m`;
  $("bonadGameScore").textContent = frame.score.toLocaleString("ja-JP");
}

async function finishGame(result) {
  const message = $("bonadGameMessage");
  message.hidden = false;
  message.innerHTML = `<h2>${result.completed ? "STAGE CLEAR!" : result.reason === "quit" ? "RUN SAVED" : "GAME OVER"}</h2><p>${result.distance}m / ${result.score.toLocaleString("ja-JP")} score</p><p>結果を保存中…</p>`;
  try {
    const saved = await api.run({ ...result, requestId: requestId() });
    message.innerHTML = `<h2>${result.completed ? "STAGE CLEAR!" : result.reason === "quit" ? "RUN SAVED" : "GAME OVER"}</h2><p>${result.distance}m / ${result.score.toLocaleString("ja-JP")} score</p><p>＋${saved.data.experience} XP</p><button data-game-retry="1" type="button">もう一度</button><button data-game-close="1" type="button">メニューへ</button>`;
    await loadDashboard();
  } catch (error) {
    message.innerHTML = `<h2>保存できませんでした</h2><p>${escapeHtml(errorMessage(error))}</p><button data-game-close="1" type="button">メニューへ</button>`;
  }
}

function closeGame() {
  runner?.quit();
  $("bonadGameOverlay").hidden = true;
  $("bonadGameMessage").hidden = true;
}

function setupEvents() {
  $("bonadStart").onclick = () => { $("bonadTitle").hidden = true; $("bonadApp").hidden = false; setView("room"); };
  $("bonadBackTitle").onclick = () => { $("bonadApp").hidden = true; $("bonadTitle").hidden = false; };
  document.querySelectorAll("[data-bonad-view]").forEach((button) => { button.onclick = () => setView(button.dataset.bonadView); });
  document.querySelectorAll("[data-gacha-count]").forEach((button) => { button.onclick = () => runGacha(Number(button.dataset.gachaCount)); });
  $("bonadCloseGacha").onclick = () => { if (revealGachaNow && $("bonadCloseGacha").textContent.includes("スキップ")) { revealGachaNow(); return; } $("bonadGachaOverlay").hidden = true; };
  $("bonadInternalToggle").onclick = () => { const internal = viewer?.toggleInternal(); $("bonadInternalToggle").textContent = internal ? "内部を観察中" : "外観を表示中"; };
  $("bonadOrganDetail").onclick = openOrganDetail;
  $("bonadCloseOrgan").onclick = () => { $("bonadOrganOverlay").hidden = true; };
  $("bonadOrganOverlay").onclick = (event) => { if (event.target.id === "bonadOrganOverlay") $("bonadOrganOverlay").hidden = true; };
  $("bonadInventory").onclick = (event) => {
    const button = event.target.closest("button"); if (!button) return;
    if (button.dataset.visualItem) void toggleVisual(button.dataset.visualItem);
    if (button.dataset.enhanceItem) void resolveDuplicate(button.dataset.enhanceItem, "enhance");
    if (button.dataset.exchangeItem) void resolveDuplicate(button.dataset.exchangeItem, "exchange");
  };
  $("bonadStats").onclick = (event) => {
    const plus = event.target.dataset.statPlus; const minus = event.target.dataset.statMinus;
    if (plus && tempRemaining > 0) { tempStats[plus] += 1; tempRemaining -= 1; renderStats(); }
    if (minus && tempStats[minus] > dashboard.state.allocatedStats[minus]) { tempStats[minus] -= 1; tempRemaining += 1; renderStats(); }
  };
  $("bonadSaveStats").onclick = saveStats;
  $("bonadRespec").onclick = respecStats;
  $("bonadSaveEquipment").onclick = saveEquipment;
  $("bonadStageList").onclick = (event) => { const button = event.target.closest("[data-stage]"); if (button && !button.disabled) void startGame({ stage: Number(button.dataset.stage) }); };
  $("bonadStartEndless").onclick = () => startGame({ mode: "endless", stage: Math.min(dashboard.state.unlockedStage, STAGES.length) });
  $("bonadJumpButton").onclick = () => runner?.jump();
  $("bonadSlideButton").onclick = () => runner?.slide();
  $("bonadAbilityButton").onclick = () => runner?.ability();
  $("bonadGameCanvas").addEventListener("pointerdown", () => runner?.jump());
  $("bonadQuitGame").onclick = closeGame;
  $("bonadGameMessage").onclick = (event) => { if (event.target.closest("[data-game-close]")) closeGame(); if (event.target.closest("[data-game-retry]")) { const mode = runner.mode; const stage = runner.stage; void startGame({ mode, stage }); } };
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { $("bonadOrganOverlay").hidden = true; if (!$("bonadGameOverlay").hidden) closeGame(); } });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

async function boot() {
  if (!isBoneAdventureTestStudent(studentNumber)) { location.replace("requests.html"); return; }
  await auth.authStateReady();
  if (auth.currentUser?.uid !== `caremate-${studentNumber}`) { location.replace("login.html"); return; }
  try {
    await loadDashboard();
    setupEvents();
    $("bonadAccessGate").hidden = true;
    $("bonadTitle").hidden = false;
  } catch (error) {
    console.error("ボンアド認証・初期化エラー", error);
    if (["functions/permission-denied", "functions/unauthenticated"].includes(error?.code)) { location.replace("requests.html"); return; }
    $("bonadAccessGate").innerHTML = `<img src="images/bonad-skull.svg" alt=""><strong>ボンアドを開始できませんでした</strong><span>${escapeHtml(errorMessage(error))}</span><button class="bonad-secondary-button" type="button" onclick="location.reload()">もう一度試す</button>`;
  }
}

initializePage([boot(), setupAdminTab()]);
window.addEventListener("beforeunload", () => { viewer?.dispose(); runner?.dispose(); });
