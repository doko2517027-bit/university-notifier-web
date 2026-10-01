import {
  auth,
  functions,
  studentNumber,
  setupTheme,
  initializePage,
  setupAdminTab,
  loadProfileImage,
  showToast,
  updateAssignmentNavBadge,
  updateNewsNavBadge,
} from "./common.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

const $ = (id) => document.getElementById(id);
let dashboard = null;
let selectedPetKind = "";

setupTheme($("themeButton"));
$("backButton").onclick = () => location.assign("index.html");
$("profileButton").onclick = () => location.assign("profile.html");
$("issueReferralCode").onclick = issueCode;
$("copyReferralCode").onclick = copyCode;
$("referralCodeValue").onclick = copyCode;
$("shareReferralCode").onclick = shareCode;
$("openReferralGift").onclick = openGift;
$("saveReferralPet").onclick = savePet;
$("referralPetChoices").onclick = selectPet;
$("referralAccessoryArea").onclick = selectAccessory;
$("openPetRoom").onclick = () => location.assign("pet_room.html");

await auth.authStateReady();
if (!auth.currentUser || auth.currentUser.uid !== `caremate-${studentNumber}`) {
  location.replace("login.html");
  throw new Error("ログインが必要です。");
}

await initializePage([
  setupAdminTab(),
  loadProfileImage($("topProfileImage")),
  updateAssignmentNavBadge(),
  updateNewsNavBadge(),
  loadDashboard(),
]);

async function loadDashboard() {
  try {
    const call = httpsCallable(functions, "getReferralDashboard");
    const response = await call();
    dashboard = response.data;
    localStorage.setItem(
      `careMateReferralPersonalization:${studentNumber}`,
      JSON.stringify({
        entitlements: dashboard.entitlements || {},
        personalization: dashboard.personalization || {},
        fetchedAt: Date.now(),
      }),
    );
    render();
  } catch (error) {
    console.error("紹介情報取得エラー:", error);
    $("referralNextReward").textContent = "紹介情報を取得できませんでした。";
    showToast("紹介情報を取得できませんでした");
  }
}

function render() {
  const count = Math.max(0, Math.min(10, Number(dashboard.invitedCount || 0)));
  $("referralCount").textContent = count;
  $("referralProgressBar").style.width = `${count * 10}%`;
  $("referralNextReward").textContent = dashboard.nextMilestone
    ? `次の「${dashboard.nextMilestone.title}」まであと${dashboard.nextMilestone.remaining}人`
    : "すべての特典を達成しました！";

  const active = dashboard.activeCode;
  $("referralCodeEmpty").hidden = Boolean(active) || count >= 10;
  $("referralCodePanel").hidden = !active;
  $("issueReferralCode").hidden = count >= 10;
  $("referralCodeState").textContent = count >= 10
    ? "10人達成"
    : active
      ? "発行中"
      : "未発行";
  if (active) {
    $("referralCodeValue").textContent = active.code;
    $("referralCodeExpiry").textContent = `有効期限：${formatDateTime(active.expiresAt)}`;
  }

  $("referralRoadmap").innerHTML = dashboard.milestones
    .map((item) => `
      <article class="referral-roadmap-item ${item.unlocked ? "is-unlocked" : ""} ${item.deleted ? "is-deleted" : ""}">
        <div class="referral-roadmap-marker">${item.unlocked ? "✓" : item.deleted ? "×" : item.count}</div>
        <div><b>${item.count}人 → ${escapeHtml(item.title)}</b><p>${escapeHtml(item.description || "")}</p><small>${item.deleted ? "管理者により特典停止中" : item.unlocked ? `達成：${formatDateTime(item.unlockedAt)}` : `あと${Math.max(0, item.count - count)}人`}</small></div>
      </article>`)
    .join("");

  const reachedTen = count >= 10;
  $("referralGiftBanner").hidden = !reachedTen;
  if (reachedTen) {
    $("openReferralGift").hidden = !dashboard.gift?.available;
    $("referralGiftStatus").textContent = dashboard.gift?.available
      ? dashboard.gift.claimedAt
        ? `受取確認：${formatDateTime(dashboard.gift.claimedAt)}`
        : "ギフトの準備ができました。"
      : "運営者が付与を準備しています。";
  }

  renderPetReward();
}

function renderPetReward() {
  const canUsePet = dashboard.entitlements?.pet === true;
  const pet = dashboard.personalization?.pet;
  $("referralPetCard").hidden = !canUsePet;
  if (!canUsePet) return;

  $("referralPetSetup").hidden = Boolean(pet?.kind);
  $("referralPetCurrent").hidden = !pet?.kind;
  $("referralPetState").textContent = pet?.kind ? "設定済み" : "未設定";
  if (pet?.kind) {
    const icons = { cat: "🐱", dog: "🐶", bird: "🐥" };
    const accessories = { none: "", hat: "🎩", ribbon: "🎀", crown: "👑" };
    $("referralPetPreview").innerHTML = `<span>${accessories[dashboard.personalization?.accessory] || ""}${icons[pet.kind] || "🐾"}</span><b>${escapeHtml(pet.name)}</b>`;
  }

  const canUseAccessory = dashboard.entitlements?.petAccessory === true && Boolean(pet?.kind);
  $("referralAccessoryArea").hidden = !canUseAccessory;
  if (canUseAccessory) {
    const current = dashboard.personalization?.accessory || "none";
    document.querySelectorAll("[data-accessory]").forEach((button) => {
      const selected = button.dataset.accessory === current;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }
}

function selectPet(event) {
  const button = event.target.closest("[data-pet-kind]");
  if (!button) return;
  selectedPetKind = button.dataset.petKind;
  document.querySelectorAll("[data-pet-kind]").forEach((item) => {
    const selected = item === button;
    item.classList.toggle("is-selected", selected);
    item.setAttribute("aria-pressed", String(selected));
  });
}

async function savePet() {
  const name = $("referralPetName").value.trim();
  if (!selectedPetKind) {
    alert("ペットを1匹選んでください。");
    return;
  }
  if (!name || name.length > 12) {
    alert("ペットの名前を1〜12文字で入力してください。");
    return;
  }
  if (!confirm(`「${name}」で確定します。種類と名前は後から変更できません。`)) return;
  const button = $("saveReferralPet");
  button.disabled = true;
  button.textContent = "設定中...";
  try {
    await httpsCallable(functions, "saveReferralPersonalization")({ action: "pet", kind: selectedPetKind, name });
    showToast("ペットを設定しました");
    location.reload();
  } catch (error) {
    console.error("ペット設定エラー:", error);
    alert(error?.message || "ペットを設定できませんでした。");
    button.disabled = false;
    button.textContent = "このペットで確定";
  }
}

async function selectAccessory(event) {
  const button = event.target.closest("[data-accessory]");
  if (!button || button.classList.contains("is-selected")) return;
  document.querySelectorAll("[data-accessory]").forEach((item) => (item.disabled = true));
  try {
    await httpsCallable(functions, "saveReferralPersonalization")({ action: "accessory", accessory: button.dataset.accessory });
    localStorage.removeItem(`careMateReferralPersonalization:${studentNumber}`);
    showToast("アクセサリーを変更しました");
    location.reload();
  } catch (error) {
    console.error("アクセサリー設定エラー:", error);
    alert("アクセサリーを変更できませんでした。");
  } finally {
    document.querySelectorAll("[data-accessory]").forEach((item) => (item.disabled = false));
  }
}

async function issueCode() {
  const button = $("issueReferralCode");
  button.disabled = true;
  button.textContent = "発行中...";
  try {
    const call = httpsCallable(functions, "issueReferralCode");
    await call();
    await loadDashboard();
    showToast("招待コードを発行しました");
  } catch (error) {
    console.error("招待コード発行エラー:", error);
    alert("招待コードを発行できませんでした。時間をおいてお試しください。");
  } finally {
    button.disabled = false;
    button.textContent = "招待コードを発行";
  }
}

async function copyCode() {
  const code = dashboard?.activeCode?.code;
  if (!code) return;
  await navigator.clipboard.writeText(code);
  showToast("招待コードをコピーしました");
}

async function shareCode() {
  const code = dashboard?.activeCode?.code;
  if (!code) return;
  const text = `CareMateの招待コードです：${code}\n新規登録画面の「招待コード（任意）」へ入力してください。`;
  if (navigator.share) {
    await navigator.share({ title: "CareMate 友達招待", text });
  } else {
    await navigator.clipboard.writeText(text);
    showToast("共有文をコピーしました");
  }
}

async function openGift() {
  try {
    const call = httpsCallable(functions, "claimReferralGift");
    const response = await call();
    const url = String(response.data?.url || "");
    if (!url.startsWith("https://")) throw new Error("gift-url-invalid");
    window.open(url, "_blank", "noopener,noreferrer");
    await loadDashboard();
  } catch (error) {
    console.error("ギフト受取エラー:", error);
    alert("ギフトを開けませんでした。運営者へ確認してください。");
  }
}

function formatDateTime(value) {
  const date = new Date(Number(value || 0));
  if (Number.isNaN(date.getTime()) || date.getTime() <= 0) return "--";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
