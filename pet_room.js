import { auth, functions, studentNumber, setupTheme, initializePage, setupAdminTab, showToast } from "./common.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";
import { CAREMATE_PET_ACTIONS, CAREMATE_PET_EXPRESSIONS, petFallbackGlyph } from "./pet_character_config.mjs";

const $ = (id) => document.getElementById(id);
let dashboard = null;
let previewTimer = 0;

setupTheme($("themeButton"));
$("backButton").onclick = () => location.assign("referral.html");
$("petVisibilityToggle").addEventListener("change", saveVisibility);
$("petRoomAccessories").addEventListener("click", saveAccessory);

await auth.authStateReady();
if (!auth.currentUser || auth.currentUser.uid !== `caremate-${studentNumber}`) {
  location.replace("login.html");
  throw new Error("ログインが必要です。");
}

await initializePage([setupAdminTab(), loadPetRoom()]);

async function loadPetRoom() {
  try {
    const response = await httpsCallable(functions, "getReferralDashboard")();
    dashboard = response.data;
    if (!dashboard.entitlements?.pet || !dashboard.personalization?.pet?.kind) {
      location.replace("referral.html");
      return;
    }
    cacheDashboard();
    render();
  } catch (error) {
    console.error("ペット情報取得エラー:", error);
    $("petRoomState").textContent = "読み込めませんでした";
  }
}

function render() {
  const pet = dashboard.personalization.pet;
  const visible = dashboard.personalization.petVisible !== false;
  $("petRoomState").textContent = visible ? "アプリ内に表示中" : "部屋でお休み中";
  $("petVisibilityToggle").checked = visible;
  $("petVisibilityLabel").textContent = visible ? "表示中" : "非表示";
  $("petVisibilityLabel").classList.toggle("is-off", !visible);
  renderPetPreview("stop", "neutral");
  clearInterval(previewTimer);
  previewTimer = window.setInterval(() => {
    const action = CAREMATE_PET_ACTIONS[Math.floor(Math.random() * CAREMATE_PET_ACTIONS.length)];
    const expression = CAREMATE_PET_EXPRESSIONS[Math.floor(Math.random() * CAREMATE_PET_EXPRESSIONS.length)];
    renderPetPreview(action.id, expression.id);
    $("petRoomAction").textContent = `${action.label}・${expression.label}`;
  }, 3200);

  const unlocked = dashboard.entitlements?.petAccessory === true;
  $("petAccessoryLock").textContent = unlocked ? "解放済み" : "8人達成で解放";
  $("petAccessoryHelp").textContent = unlocked ? "好きなアクセサリーへ何度でも変更できます。" : "8人招待達成でアクセサリーを変更できます。";
  $("petRoomAccessories").hidden = !unlocked;
  if (unlocked) {
    document.querySelectorAll("[data-accessory]").forEach((button) => button.classList.toggle("is-selected", button.dataset.accessory === (dashboard.personalization.accessory || "none")));
  }
}

function renderPetPreview(action, expression) {
  const pet = dashboard.personalization.pet;
  const accessories = { none: "", hat: "🎩", ribbon: "🎀", crown: "👑" };
  $("petRoomCharacter").dataset.action = action;
  $("petRoomCharacter").dataset.expression = expression;
  $("petRoomCharacter").innerHTML = `<span>${accessories[dashboard.personalization.accessory] || ""}${petFallbackGlyph(pet.kind, expression)}</span><b>${escapeHtml(pet.name)}</b>`;
}

async function saveVisibility(event) {
  const input = event.currentTarget;
  input.disabled = true;
  try {
    await httpsCallable(functions, "saveReferralPersonalization")({ action: "pet_visibility", visible: input.checked });
    dashboard.personalization.petVisible = input.checked;
    cacheDashboard();
    render();
    showToast(input.checked ? "ペットを表示しました" : "ペットを非表示にしました");
  } catch (error) {
    console.error("ペット表示設定エラー:", error);
    input.checked = !input.checked;
    alert("表示設定を変更できませんでした。");
  } finally {
    input.disabled = false;
  }
}

async function saveAccessory(event) {
  const button = event.target.closest("[data-accessory]");
  if (!button || button.classList.contains("is-selected")) return;
  document.querySelectorAll("[data-accessory]").forEach((item) => (item.disabled = true));
  try {
    await httpsCallable(functions, "saveReferralPersonalization")({ action: "accessory", accessory: button.dataset.accessory });
    dashboard.personalization.accessory = button.dataset.accessory;
    cacheDashboard();
    render();
    showToast("着せ替えを変更しました");
  } catch (error) {
    console.error("着せ替えエラー:", error);
    alert("着せ替えを変更できませんでした。");
  } finally {
    document.querySelectorAll("[data-accessory]").forEach((item) => (item.disabled = false));
  }
}

function cacheDashboard() {
  localStorage.setItem(
    `careMateReferralPersonalization:${studentNumber}`,
    JSON.stringify({ entitlements: dashboard.entitlements, personalization: dashboard.personalization, fetchedAt: Date.now() }),
  );
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
