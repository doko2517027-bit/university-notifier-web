import {
  auth,
  functions,
  studentNumber,
  setupTheme,
  initializePage,
  setupAdminTab,
  isAdmin,
  showToast,
} from "./common.js";
import { getIdTokenResult } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

const $ = (id) => document.getElementById(id);
let rewards = [];

setupTheme($("themeButton"));
$("backButton").onclick = () => location.assign("admin.html");
$("refreshRewards").onclick = loadRewards;

await auth.authStateReady();
const admin = await isAdmin();
const token = auth.currentUser ? await getIdTokenResult(auth.currentUser) : null;
if (
  !admin ||
  studentNumber !== "2510044" ||
  auth.currentUser?.uid !== "caremate-2510044" ||
  token?.claims?.studentNumber !== "2510044" ||
  token?.claims?.admin !== true
) {
  location.replace("admin.html");
  throw new Error("紹介特典を管理できるアカウントではありません。");
}

$("rewardList").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-grant-reward]");
  if (!button) return;
  const target = button.dataset.grantReward;
  const input = document.querySelector(`[data-gift-url="${target}"]`);
  const giftUrl = input?.value.trim() || "";
  if (!giftUrl.startsWith("https://")) {
    alert("HTTPSで始まるギフトURLを入力してください。");
    return;
  }
  if (!confirm(`${target}へこのギフトURLを付与しますか？`)) return;
  button.disabled = true;
  button.textContent = "付与中...";
  try {
    const grant = httpsCallable(functions, "grantReferralReward");
    await grant({ studentNumber: target, giftUrl });
    showToast("ギフトを付与しました");
    await loadRewards();
  } catch (error) {
    console.error("ギフト付与エラー:", error);
    alert("ギフトを付与できませんでした。");
    button.disabled = false;
    button.textContent = "付与する";
  }
});

await initializePage([setupAdminTab(), loadRewards()]);

async function loadRewards() {
  $("refreshRewards").disabled = true;
  try {
    const call = httpsCallable(functions, "getReferralRewardAdmin");
    const response = await call();
    rewards = response.data?.rewards || [];
    render();
  } catch (error) {
    console.error("紹介特典一覧取得エラー:", error);
    $("rewardList").textContent = "紹介特典を取得できませんでした。";
  } finally {
    $("refreshRewards").disabled = false;
  }
}

function render() {
  $("rewardTotal").textContent = `${rewards.length}人`;
  $("rewardPending").textContent = `${rewards.filter((item) => item.status !== "granted").length}人`;
  $("rewardGranted").textContent = `${rewards.filter((item) => item.status === "granted").length}人`;
  if (!rewards.length) {
    $("rewardList").innerHTML = '<div class="referral-empty">まだ10人達成者はいません。</div>';
    return;
  }
  $("rewardList").innerHTML = rewards.map((item) => `
    <article class="referral-reward-item ${item.status === "granted" ? "is-granted" : ""}">
      <div class="referral-reward-head"><div><strong>${escapeHtml(item.studentNumber)}</strong><small>達成：${formatDateTime(item.reachedAt)}</small></div><span>${item.status === "granted" ? "付与済み" : "未付与"}</span></div>
      <label>ギフトURL<input data-gift-url="${escapeHtml(item.studentNumber)}" type="url" value="${escapeHtml(item.giftUrl)}" placeholder="https://..." /></label>
      <div class="referral-reward-actions"><small>${item.grantedAt ? `付与：${formatDateTime(item.grantedAt)}` : "URLは対象学生だけに表示されます"}${item.claimedAt ? ` / 受取確認：${formatDateTime(item.claimedAt)}` : ""}</small><button class="btn btn-primary" data-grant-reward="${escapeHtml(item.studentNumber)}" type="button">${item.status === "granted" ? "URLを更新" : "付与する"}</button></div>
    </article>`).join("");
}

function formatDateTime(value) {
  const date = new Date(Number(value || 0));
  if (Number.isNaN(date.getTime()) || date.getTime() <= 0) return "--";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
