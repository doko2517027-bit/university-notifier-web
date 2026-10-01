import { auth, functions, studentNumber, setupTheme, initializePage, setupAdminTab, showToast } from "./common.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";
import { CAREMATE_PET_ACTIONS, CAREMATE_PET_EXPRESSIONS, applyPetSprite } from "./pet_character_config.mjs";

const $ = (id) => document.getElementById(id);
let dashboard = null;
let previewTimer = 0;

setupTheme($("themeButton"));
$("backButton").onclick = () => location.assign("referral.html");
$("petVisibilityToggle").addEventListener("change", saveVisibility);
$("petCareActions").addEventListener("click", savePetCare);

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

  renderPetCare();
}

function renderPetPreview(action, expression) {
  const pet = dashboard.personalization.pet;
  $("petRoomCharacter").dataset.action = action;
  $("petRoomCharacter").dataset.expression = expression;
  $("petRoomCharacter").querySelector("b").textContent = pet.name;
  applyPetSprite($("petRoomCharacter").querySelector(".pet-room-sprite"), pet.kind, action, expression, Math.floor(Date.now() / 280) % 2);
}

function renderPetCare() {
  const unlocked = dashboard.entitlements?.petCare === true;
  $("petCareLock").textContent = unlocked ? "解放済み" : "8人達成で解放";
  $("petCareHelp").textContent = unlocked
    ? "4つのお世話は1日1回ずつ。全部できると連続お世話日数が増えます。"
    : "8人招待達成で、毎日ペットとふれあえるようになります。";
  $("petCareArea").hidden = !unlocked;
  if (!unlocked) return;
  const care = dashboard.petCare || {};
  const completed = new Set(Array.isArray(care.completedActions) ? care.completedActions : []);
  $("petCareProgress").textContent = `${completed.size} / 4`;
  $("petCareStreak").textContent = `連続${Number(care.streak || 0)}日`;
  $("petCareProgressBar").style.width = `${completed.size * 25}%`;
  document.querySelectorAll("[data-pet-care]").forEach((button) => {
    const done = completed.has(button.dataset.petCare);
    button.classList.toggle("is-completed", done);
    button.disabled = done;
    button.setAttribute("aria-pressed", String(done));
  });
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

async function savePetCare(event) {
  const button = event.target.closest("[data-pet-care]");
  if (!button || button.disabled) return;
  document.querySelectorAll("[data-pet-care]").forEach((item) => (item.disabled = true));
  try {
    const response = await httpsCallable(functions, "saveReferralPersonalization")({ action: "pet_interaction", interaction: button.dataset.petCare });
    dashboard.petCare = response.data?.petCare || dashboard.petCare;
    cacheDashboard();
    render();
    showToast("ペットのお世話を記録しました");
  } catch (error) {
    console.error("ペットお世話エラー:", error);
    alert(error?.message || "お世話を記録できませんでした。");
  } finally {
    renderPetCare();
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
