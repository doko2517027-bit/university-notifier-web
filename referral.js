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
let selectedBackgroundFile = null;
let selectedBackgroundPreviewUrl = "";

setupTheme($("themeButton"));
$("backButton").onclick = () => location.assign("index.html");
$("profileButton").onclick = () => location.assign("profile.html");
$("issueReferralCode").onclick = issueCode;
$("copyReferralCode").onclick = copyCode;
$("referralCodeValue").onclick = copyCode;
$("shareReferralCode").onclick = shareCode;
$("openReferralGift").onclick = openGift;
$("chooseReferralBackground").onclick = () => $("referralBackgroundFile").click();
$("referralBackgroundFile").onchange = selectBackgroundFile;
$("saveReferralBackground").onclick = saveBackground;
$("removeReferralBackground").onclick = removeBackground;
$("saveReferralBackgroundEffects").onclick = saveBackgroundEffects;
$("referralBackgroundBlur").oninput = previewBackgroundEffects;
$("referralBackgroundBrightness").oninput = previewBackgroundEffects;
$("referralBackgroundPosition").onchange = previewBackgroundEffects;

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

  renderBackgroundReward();
}

function renderBackgroundReward() {
  const allowed = dashboard.entitlements?.photoBackground === true;
  const effectsAllowed = dashboard.entitlements?.backgroundEffects === true;
  const background = dashboard.personalization?.background;
  $("referralBackgroundCard").hidden = !allowed;
  if (!allowed) return;
  $("referralBackgroundState").textContent = background?.url ? "設定済み" : "未設定";
  $("removeReferralBackground").hidden = !background?.url;
  $("referralBackgroundEffects").hidden = !effectsAllowed || !background?.url;
  if (background?.url && !selectedBackgroundPreviewUrl) {
    renderBackgroundPreview(background.url);
  }
  $("referralBackgroundBlur").value = String(background?.blur ?? 0);
  $("referralBackgroundBrightness").value = String(background?.brightness ?? 82);
  $("referralBackgroundPosition").value = background?.position || "center";
  previewBackgroundEffects();
}

function selectBackgroundFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
    alert("10MB以下のJPEG・PNG・WebP・HEIC画像を選んでください。");
    event.target.value = "";
    return;
  }
  if (selectedBackgroundPreviewUrl) URL.revokeObjectURL(selectedBackgroundPreviewUrl);
  selectedBackgroundFile = file;
  selectedBackgroundPreviewUrl = URL.createObjectURL(file);
  renderBackgroundPreview(selectedBackgroundPreviewUrl);
  $("saveReferralBackground").disabled = false;
}

function renderBackgroundPreview(url) {
  const preview = $("referralBackgroundPreview");
  preview.innerHTML = `<img src="${escapeHtml(url)}" alt="選択した背景のプレビュー" />`;
}

function previewBackgroundEffects() {
  const blur = Number($("referralBackgroundBlur").value || 0);
  const brightness = Number($("referralBackgroundBrightness").value || 82);
  const position = $("referralBackgroundPosition").value || "center";
  $("referralBackgroundBlurValue").textContent = `${blur}px`;
  $("referralBackgroundBrightnessValue").textContent = `${brightness}%`;
  const image = $("referralBackgroundPreview").querySelector("img");
  if (image) {
    image.style.filter = `blur(${blur}px) brightness(${brightness}%)`;
    image.style.objectPosition = position;
  }
}

async function saveBackground() {
  if (!selectedBackgroundFile || dashboard.entitlements?.photoBackground !== true) return;
  const button = $("saveReferralBackground");
  button.disabled = true;
  button.textContent = "アップロード中...";
  try {
    const formData = new FormData();
    formData.append("file", selectedBackgroundFile);
    formData.append("upload_preset", "caremate_upload");
    formData.append("folder", `caremate/referral-backgrounds/${studentNumber}`);
    const upload = await fetch("https://api.cloudinary.com/v1_1/vpctonjf/image/upload", { method: "POST", body: formData });
    const data = await upload.json();
    if (!upload.ok || !data.secure_url) throw new Error(data.error?.message || "画像を保存できませんでした。");
    const optimizedUrl = String(data.secure_url).replace(
      "/image/upload/",
      "/image/upload/f_auto,q_auto,w_1920,c_limit/",
    );
    await httpsCallable(functions, "saveReferralPersonalization")({
      action: "background",
      url: optimizedUrl,
      publicId: data.public_id || "",
    });
    showToast("写真背景を設定しました");
    selectedBackgroundFile = null;
    selectedBackgroundPreviewUrl = "";
    await loadDashboard();
    location.reload();
  } catch (error) {
    console.error("写真背景設定エラー:", error);
    alert(error?.message || "写真背景を設定できませんでした。");
  } finally {
    button.disabled = false;
    button.textContent = "背景に設定";
  }
}

async function removeBackground() {
  if (!confirm("現在の写真背景を外しますか？")) return;
  try {
    await httpsCallable(functions, "saveReferralPersonalization")({ action: "background_remove" });
    showToast("写真背景を外しました");
    selectedBackgroundFile = null;
    selectedBackgroundPreviewUrl = "";
    $("referralBackgroundPreview").innerHTML = "<span>背景写真を選んでください</span>";
    await loadDashboard();
    location.reload();
  } catch (error) {
    console.error("写真背景解除エラー:", error);
    alert(error?.message || "写真背景を外せませんでした。");
  }
}

async function saveBackgroundEffects() {
  const button = $("saveReferralBackgroundEffects");
  button.disabled = true;
  try {
    await httpsCallable(functions, "saveReferralPersonalization")({
      action: "background_effects",
      blur: Number($("referralBackgroundBlur").value),
      brightness: Number($("referralBackgroundBrightness").value),
      position: $("referralBackgroundPosition").value,
    });
    showToast("背景の見え方を保存しました");
    await loadDashboard();
    location.reload();
  } catch (error) {
    console.error("背景調整エラー:", error);
    alert(error?.message || "背景の見え方を保存できませんでした。");
  } finally {
    button.disabled = false;
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
