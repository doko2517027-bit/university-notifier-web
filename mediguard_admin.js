import { auth, functions, isAdmin, setupTheme, initializePage, setupAdminTab, loadUserName, loadProfileImage } from "./common.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

const $ = (id) => document.getElementById(id);
const adminCall = httpsCallable(functions, "mediguardAdmin", { timeout: 60000 });
const RARITY_COLORS = { N: "#708c84", R: "#408fc5", SR: "#8258c9", SSR: "#d65788", UR: "#e18c2f", LR: "#d9ac2a" };
const PASSIVE_LABELS = { rangeBoost: "射程アップ（%）", speedBoost: "移動速度アップ（%）", chargeBoost: "チャージ速度アップ（%）", attackBoost: "攻撃力アップ（%）", extraHit: "被弾上限を追加（回）", cooldownBoost: "再使用時間短縮（%）", revive: "死亡無効化（回）", allBoost: "全能力アップ（%）" };
const SKILL_LABELS = { radial: "全方向攻撃（弾数）", rapid: "連射強化（秒）", pierce: "貫通弾（威力）", triple: "3方向弾（威力）", shield: "無敵シールド（秒）", area: "周囲攻撃（威力）", healBurst: "回復＋全方向攻撃（回復量）", freezeBurst: "時間停止＋全方向攻撃（弾数）" };
let state = null;
let editingBannerId = "";
let editingCharacterId = "";

function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
function message(value, error = false) { $("adminMessage").textContent = value; $("adminMessage").classList.toggle("error", error); }
function errorText(error) { return String(error?.details || error?.message || "処理に失敗しました。").replace(/^FirebaseError:\s*/i, ""); }
function localDateTime(value) {
  if (!value) return "";
  const date = new Date(value); if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function call(action, payload = {}) { return adminCall({ action, ...payload }).then((result) => result.data); }
function switchTab(name) {
  document.querySelectorAll("[data-admin-tab]").forEach((button) => button.classList.toggle("active", button.dataset.adminTab === name));
  document.querySelectorAll("[data-admin-panel]").forEach((panel) => { panel.hidden = panel.dataset.adminPanel !== name; });
}
function currentBannerStatus(item) {
  if (!item.enabled) return "非公開";
  const now = Date.now();
  if (item.startsAt && now < new Date(item.startsAt).getTime()) return "公開待ち";
  if (item.endsAt && now >= new Date(item.endsAt).getTime()) return "終了";
  return item.limited ? "期間限定・公開中" : "公開中";
}
function renderSummary() {
  const active = state.banners.find((item) => item.id === state.settings.activeBannerId);
  $("adminSummary").innerHTML = [
    ["現在の公開状態", state.settings.gameEnabled ? "公開中" : "停止中"],
    ["メインガチャ", active?.name || "未設定"],
    ["登録内容", `${state.summary.bannerCount}ガチャ・${state.summary.characterCount}キャラ`],
  ].map(([label, value]) => `<article><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></article>`).join("");
}
function renderMetrics() {
  const metrics = state.metrics || {};
  const cards = [
    ["総プレイヤー", `${Number(metrics.totalPlayers || 0).toLocaleString("ja-JP")}人`, "登録済み", "#4b9b7b"],
    ["今日のプレイヤー", `${Number(metrics.todayPlayers || 0).toLocaleString("ja-JP")}人`, "本日操作あり", "#4a92bd"],
    ["現在オンライン", `${Number(metrics.onlinePlayers || 0).toLocaleString("ja-JP")}人`, "メディガを表示中", "#67ad58"],
    ["戦闘勝率", `${Number(metrics.winRate || 0).toFixed(1)}%`, `${Number(metrics.wins || 0)}勝 / ${Number(metrics.battleCount || 0)}戦`, "#d89b3c"],
    ["ガチャ実行", `${Number(metrics.gachaExecutions || 0).toLocaleString("ja-JP")}回`, `${Number(metrics.gachaResults || 0)}体排出`, "#9a72c4"],
    ["戦闘回数", `${Number(metrics.battleCount || 0).toLocaleString("ja-JP")}回`, "完了した出撃", "#4f879f"],
    ["24時間エラー", `${Number(metrics.errorCount24h || 0).toLocaleString("ja-JP")}件`, "記録済みエラー", Number(metrics.errorCount24h || 0) ? "#bd4c44" : "#4b9b7b"],
    ["公開キャラ", `${Number(state.summary?.characterCount || 0)}体`, `${Number(state.summary?.bannerCount || 0)}ガチャ公開`, "#aa7b45"],
  ];
  $("metricsCards").innerHTML = cards.map(([label, value, note, color]) => `<article class="metrics-card" style="--metric-color:${color}"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b><small>${escapeHtml(note)}</small></article>`).join("");

  const activity = Array.isArray(metrics.activity) ? metrics.activity : [];
  const maxActivity = Math.max(1, ...activity.flatMap((item) => [Number(item.battles || 0), Number(item.gacha || 0)]));
  $("activityChart").innerHTML = activity.map((item) => `<div class="activity-day"><div class="activity-bars" title="${escapeHtml(item.label)} 出撃${Number(item.battles || 0)}回・ガチャ${Number(item.gacha || 0)}回"><i class="activity-bar" style="height:${Math.max(3, (Number(item.battles || 0) / maxActivity) * 100)}%"></i><i class="activity-bar gacha" style="height:${Math.max(3, (Number(item.gacha || 0) / maxActivity) * 100)}%"></i></div><div><b>${escapeHtml(item.label)}</b><span>${Number(item.battles || 0)} / ${Number(item.gacha || 0)}</span></div></div>`).join("") || "<p>まだ集計データがありません。</p>";

  const rarityCounts = metrics.rarityCounts || {};
  const maxRarity = Math.max(1, ...Object.values(rarityCounts).map(Number));
  $("rarityChart").innerHTML = Object.keys(RARITY_COLORS).map((rarity) => `<div class="metric-row"><b style="color:${RARITY_COLORS[rarity]}">${rarity}</b><span class="metric-track"><i class="metric-fill" style="--metric-color:${RARITY_COLORS[rarity]};width:${(Number(rarityCounts[rarity] || 0) / maxRarity) * 100}%"></i></span><span>${Number(rarityCounts[rarity] || 0)}体</span></div>`).join("");

  const popular = Array.isArray(metrics.popularCharacters) ? metrics.popularCharacters : [];
  const maxPopular = Math.max(1, ...popular.map((item) => Number(item.count || 0)));
  $("popularCharacters").innerHTML = popular.length ? popular.map((item) => `<div class="metric-row"><b>${escapeHtml(item.name)}</b><span class="metric-track"><i class="metric-fill" style="width:${(Number(item.count || 0) / maxPopular) * 100}%"></i></span><span>${Number(item.count || 0)}体</span></div>`).join("") : "<p>キャラクター所持データはまだありません。</p>";

  const errors = Number(metrics.errorCount24h || 0);
  $("systemHealth").innerHTML = `<div class="system-health-value" style="--health-color:${errors ? "#bd4c44" : "#4b9b7b"}"><i></i><div><b>${errors ? "確認が必要です" : "正常に稼働中"}</b><span>${errors ? `直近24時間に${errors}件の記録があります。` : "直近24時間のエラー記録はありません。"}</span></div></div>`;
  $("metricsUpdatedAt").textContent = metrics.generatedAt ? `最終更新 ${new Date(metrics.generatedAt).toLocaleString("ja-JP")}` : "";
}
function renderSettings() {
  const form = $("settingsForm");
  form.elements.gameEnabled.checked = state.settings.gameEnabled !== false;
  form.elements.notice.value = state.settings.notice || "";
  form.elements.activeBannerId.innerHTML = state.banners.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
  form.elements.activeBannerId.value = state.settings.activeBannerId || state.banners[0]?.id || "";
}
function renderBannerList() {
  $("bannerList").innerHTML = state.banners.map((item) => `<button type="button" data-edit-banner="${escapeHtml(item.id)}" class="${editingBannerId === item.id ? "active" : ""}" style="--item-accent:${item.accent}"><span>${escapeHtml(currentBannerStatus(item))}</span><b>${escapeHtml(item.name)}</b><small>${item.singleCost}GP / 10連 ${item.tenCost}GP</small></button>`).join("");
}
function renderCharacterChoices(selected = []) {
  const checked = new Set(selected);
  $("bannerCharacterChoices").innerHTML = state.characters.map((item) => `<label><input type="checkbox" value="${escapeHtml(item.id)}" ${checked.has(item.id) ? "checked" : ""} ${item.enabled ? "" : "disabled"}/><span>${escapeHtml(item.name)}</span><small style="color:${RARITY_COLORS[item.rarity]}">${item.rarity}${item.enabled ? "" : "・停止中"}</small></label>`).join("");
}
function updateRateTotal() {
  const total = [...$("rateInputs").querySelectorAll("input")].reduce((sum, input) => sum + Number(input.value || 0), 0);
  $("rateTotal").textContent = `合計 ${total.toFixed(1)}%`;
  $("rateTotal").classList.toggle("invalid", Math.abs(total - 100) > .001);
}
function editBanner(id) {
  const item = state.banners.find((entry) => entry.id === id); if (!item) return;
  editingBannerId = item.id; const form = $("bannerForm");
  form.elements.id.value = item.id; form.elements.id.readOnly = true;
  form.elements.name.value = item.name; form.elements.subtitle.value = item.subtitle || ""; form.elements.accent.value = item.accent;
  form.elements.sortOrder.value = item.sortOrder; form.elements.startsAt.value = localDateTime(item.startsAt); form.elements.endsAt.value = localDateTime(item.endsAt);
  form.elements.singleCost.value = item.singleCost; form.elements.tenCost.value = item.tenCost;
  form.elements.enabled.checked = item.enabled; form.elements.limited.checked = item.limited;
  [...$("rateInputs").querySelectorAll("input")].forEach((input) => { input.value = (Number(item.rates[input.name] || 0) / 10).toFixed(1); });
  renderCharacterChoices(item.characterIds); updateRateTotal(); renderBannerList();
  $("bannerEditorTitle").textContent = item.name; $("bannerStatusBadge").textContent = currentBannerStatus(item); $("deleteBannerButton").hidden = false;
}
function newBanner() {
  editingBannerId = ""; const form = $("bannerForm"); form.reset(); form.elements.id.readOnly = false; form.elements.id.value = `event_${Date.now().toString(36)}`;
  form.elements.singleCost.value = 30; form.elements.tenCost.value = 300; form.elements.accent.value = "#efb34d"; form.elements.enabled.checked = true;
  const defaults = { N: 55, R: 25, SR: 12, SSR: 6, UR: 1.8, LR: .2 };
  [...$("rateInputs").querySelectorAll("input")].forEach((input) => { input.value = defaults[input.name]; });
  renderCharacterChoices(state.characters.filter((item) => item.enabled).map((item) => item.id)); updateRateTotal(); renderBannerList();
  $("bannerEditorTitle").textContent = "新しいガチャ"; $("bannerStatusBadge").textContent = "作成中"; $("deleteBannerButton").hidden = true;
}
function renderCharacterList() {
  $("characterAdminList").innerHTML = state.characters.map((item) => `<button type="button" data-edit-character="${escapeHtml(item.id)}" class="${editingCharacterId === item.id ? "active" : ""}" style="--item-accent:${RARITY_COLORS[item.rarity]}"><span class="character-sprite sprite-${item.sprite}"></span><b>${escapeHtml(item.name)}</b><span style="color:${RARITY_COLORS[item.rarity]}">${item.rarity}${item.enabled ? "" : "・停止中"}</span><small>${escapeHtml(item.passive)}</small></button>`).join("");
}
function editCharacter(id) {
  const item = state.characters.find((entry) => entry.id === id); if (!item) return;
  editingCharacterId = item.id; const form = $("characterForm");
  for (const key of ["id", "name", "rarity", "sprite", "attack", "speed", "range", "charge", "passiveType", "passiveValue", "passive", "skillType", "skillValue", "skill", "cooldown"]) form.elements[key].value = item[key] ?? "";
  form.elements.id.readOnly = true; form.elements.enabled.checked = item.enabled !== false;
  $("characterEditorTitle").textContent = item.name; $("characterPreview").className = `character-sprite sprite-${item.sprite}`; renderCharacterList();
}
function newCharacter() {
  editingCharacterId = ""; const form = $("characterForm"); form.reset(); form.elements.id.readOnly = false; form.elements.rarity.value = "N"; form.elements.sprite.value = "0";
  form.elements.attack.value = 10; form.elements.speed.value = 100; form.elements.range.value = 100; form.elements.charge.value = 100; form.elements.passiveValue.value = 10; form.elements.skillValue.value = 8; form.elements.cooldown.value = 18; form.elements.enabled.checked = true;
  $("characterEditorTitle").textContent = "新しいキャラクター設定"; $("characterPreview").className = "character-sprite sprite-0"; renderCharacterList();
}
function renderAll() {
  renderSummary(); renderMetrics(); renderSettings(); renderBannerList(); renderCharacterList();
  if (!editingBannerId && state.banners[0]) editBanner(state.banners[0].id);
  if (!editingCharacterId && state.characters[0]) editCharacter(state.characters[0].id);
}
async function refreshMetrics(showMessage = true) {
  const button = $("refreshMetricsButton");
  button.disabled = true; button.textContent = "更新中…";
  try {
    const result = await call("metrics"); state.metrics = result.metrics; renderMetrics();
    if (showMessage) message("運営状況を更新しました。");
  } catch (error) { if (showMessage) message(errorText(error), true); }
  finally { button.disabled = false; button.textContent = "↻ 更新"; }
}
async function load() {
  state = await call("dashboard");
  const rarities = state.options.rarities;
  $("rateInputs").innerHTML = rarities.map((rarity) => `<label style="color:${RARITY_COLORS[rarity]}">${rarity}<input name="${rarity}" type="number" min="0" max="100" step="0.1" /></label>`).join("");
  $("characterForm").elements.rarity.innerHTML = rarities.map((item) => `<option>${item}</option>`).join("");
  $("characterForm").elements.sprite.innerHTML = Array.from({ length: 10 }, (_, index) => `<option value="${index}">画像 ${index + 1}</option>`).join("");
  $("characterForm").elements.passiveType.innerHTML = state.options.passiveTypes.map((item) => `<option value="${item}">${PASSIVE_LABELS[item]}</option>`).join("");
  $("characterForm").elements.skillType.innerHTML = state.options.skillTypes.map((item) => `<option value="${item}">${SKILL_LABELS[item]}</option>`).join("");
  renderAll();
  $("rateInputs").addEventListener("input", updateRateTotal);
}

setupTheme($("themeButton"));
$("profileButton").onclick = () => { location.href = "profile.html"; };
await auth.authStateReady();
if (!(await isAdmin())) { location.replace("admin.html"); throw new Error("管理者権限がありません。"); }
document.querySelectorAll("[data-admin-tab]").forEach((button) => { button.onclick = () => switchTab(button.dataset.adminTab); });
$("refreshMetricsButton").onclick = () => refreshMetrics(true);
$("settingsForm").onsubmit = async (event) => { event.preventDefault(); try { await call("saveSettings", { activeBannerId: event.currentTarget.elements.activeBannerId.value, gameEnabled: event.currentTarget.elements.gameEnabled.checked, notice: event.currentTarget.elements.notice.value }); message("運用設定を保存しました。"); state = await call("dashboard"); renderAll(); } catch (error) { message(errorText(error), true); } };
$("newBannerButton").onclick = newBanner;
$("bannerList").onclick = (event) => { const button = event.target.closest("[data-edit-banner]"); if (button) editBanner(button.dataset.editBanner); };
$("bannerForm").onsubmit = async (event) => {
  event.preventDefault(); const form = event.currentTarget;
  const rates = Object.fromEntries([...$("rateInputs").querySelectorAll("input")].map((input) => [input.name, Math.round(Number(input.value || 0) * 10)]));
  const banner = { id: form.elements.id.value, name: form.elements.name.value, subtitle: form.elements.subtitle.value, accent: form.elements.accent.value, sortOrder: form.elements.sortOrder.value, startsAt: form.elements.startsAt.value || null, endsAt: form.elements.endsAt.value || null, singleCost: form.elements.singleCost.value, tenCost: form.elements.tenCost.value, enabled: form.elements.enabled.checked, limited: form.elements.limited.checked, rates, characterIds: [...$("bannerCharacterChoices").querySelectorAll("input:checked")].map((input) => input.value) };
  try { await call("saveBanner", { banner }); message("ガチャ設定を保存しました。"); editingBannerId = banner.id; state = await call("dashboard"); renderAll(); } catch (error) { message(errorText(error), true); }
};
$("deleteBannerButton").onclick = async () => { const item = state.banners.find((entry) => entry.id === editingBannerId); if (!item || !confirm(`「${item.name}」を削除しますか？`)) return; try { await call("deleteBanner", { bannerId: item.id }); message("ガチャを削除しました。"); editingBannerId = ""; state = await call("dashboard"); renderAll(); } catch (error) { message(errorText(error), true); } };
$("newCharacterButton").onclick = newCharacter;
$("characterAdminList").onclick = (event) => { const button = event.target.closest("[data-edit-character]"); if (button) editCharacter(button.dataset.editCharacter); };
$("characterForm").elements.sprite.onchange = (event) => { $("characterPreview").className = `character-sprite sprite-${event.target.value}`; };
$("characterForm").onsubmit = async (event) => { event.preventDefault(); const form = event.currentTarget; const character = Object.fromEntries(["id", "name", "rarity", "sprite", "attack", "speed", "range", "charge", "passiveType", "passiveValue", "passive", "skillType", "skillValue", "skill", "cooldown"].map((key) => [key, form.elements[key].value])); character.enabled = form.elements.enabled.checked; try { await call("saveCharacter", { character }); message("キャラクター設定を保存しました。"); editingCharacterId = character.id; state = await call("dashboard"); renderAll(); } catch (error) { message(errorText(error), true); } };

await initializePage([setupAdminTab(), loadUserName($("userName")), loadProfileImage($("topProfileImage")), load()]);
setInterval(() => { if (!document.hidden && document.querySelector('[data-admin-panel="dashboard"]:not([hidden])')) refreshMetrics(false); }, 30000);
