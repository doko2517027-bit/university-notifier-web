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
let students = [];
let totals = {};
let referralSettings = { homeVisible: true };

setupTheme($("themeButton"));
$("backButton").onclick = () => location.assign("admin.html");
$("refreshRewards").onclick = loadReferralAdmin;
$("referralSearch").addEventListener("input", render);
$("referralFilter").addEventListener("change", render);
$("referralHomeVisible").addEventListener("change", saveHomeVisibility);

await auth.authStateReady();
const admin = await isAdmin();
const token = auth.currentUser ? await getIdTokenResult(auth.currentUser) : null;
if (
  !admin || studentNumber !== "2510044" ||
  auth.currentUser?.uid !== "caremate-2510044" ||
  token?.claims?.studentNumber !== "2510044" || token?.claims?.admin !== true
) {
  location.replace("admin.html");
  throw new Error("紹介制度を管理できるアカウントではありません。");
}

$("rewardList").addEventListener("click", async (event) => {
  const grantButton = event.target.closest("[data-grant-reward]");
  if (grantButton) {
    await grantReward(grantButton);
    return;
  }
  const adjustButton = event.target.closest("[data-adjust-referral]");
  if (adjustButton) {
    await adjustReferralCount(adjustButton);
    return;
  }
  const rewardStateButton = event.target.closest("[data-referral-reward-state]");
  if (rewardStateButton) await changeRewardState(rewardStateButton);
});

await initializePage([setupAdminTab(), loadReferralAdmin()]);

async function loadReferralAdmin() {
  $("refreshRewards").disabled = true;
  try {
    const response = await httpsCallable(functions, "getReferralRewardAdmin")();
    students = Array.isArray(response.data?.students) ? response.data.students : [];
    totals = response.data?.totals || {};
    referralSettings = response.data?.settings || { homeVisible: true };
    render();
  } catch (error) {
    console.error("紹介制度一覧取得エラー:", error);
    $("rewardList").textContent = "紹介制度の情報を取得できませんでした。";
  } finally {
    $("refreshRewards").disabled = false;
  }
}

async function saveHomeVisibility(event) {
  const input = event.currentTarget;
  const previous = referralSettings.homeVisible !== false;
  const next = input.checked;
  input.disabled = true;
  $("referralHomeVisibilityLabel").textContent = "保存中...";
  try {
    const response = await httpsCallable(functions, "updateReferralHomeVisibilityAdmin")({ homeVisible: next });
    referralSettings = { ...referralSettings, homeVisible: response.data?.homeVisible !== false };
    renderHomeVisibility();
    showToast(next ? "ホームに友達招待を表示しました" : "ホームの友達招待を非表示にしました");
  } catch (error) {
    console.error("紹介表示設定エラー:", error);
    referralSettings.homeVisible = previous;
    input.checked = previous;
    renderHomeVisibility();
    alert("表示設定を保存できませんでした。");
  } finally {
    input.disabled = false;
  }
}

async function grantReward(button) {
  const target = button.dataset.grantReward;
  const giftUrl = document.querySelector(`[data-gift-url="${target}"]`)?.value.trim() || "";
  if (!giftUrl.startsWith("https://")) {
    alert("HTTPSで始まるギフトURLを入力してください。");
    return;
  }
  if (!confirm(`${target}へこのギフトURLを付与しますか？`)) return;
  button.disabled = true;
  try {
    await httpsCallable(functions, "grantReferralReward")({ studentNumber: target, giftUrl });
    showToast("ギフトを付与しました");
    await loadReferralAdmin();
  } catch (error) {
    console.error("ギフト付与エラー:", error);
    alert("ギフトを付与できませんでした。");
    button.disabled = false;
  }
}

async function adjustReferralCount(button) {
  const target = button.dataset.adjustReferral;
  const countInput = document.querySelector(`[data-referral-count="${target}"]`);
  const reasonInput = document.querySelector(`[data-referral-reason="${target}"]`);
  const targetCount = Number(countInput?.value);
  const reason = reasonInput?.value.trim() || "";
  if (!Number.isInteger(targetCount) || targetCount < 0 || targetCount > 10) {
    alert("達成人数は0〜10の整数で入力してください。");
    return;
  }
  if (reason.length < 4) {
    alert("修正理由を4文字以上で入力してください。");
    reasonInput?.focus();
    return;
  }
  if (!confirm(`${target}の達成人数を${targetCount}人へ修正しますか？\n修正履歴は保存されます。`)) return;
  button.disabled = true;
  try {
    await httpsCallable(functions, "adjustReferralCountAdmin")({
      studentNumber: target,
      targetCount,
      reason,
    });
    showToast("紹介進捗を修正しました");
    await loadReferralAdmin();
  } catch (error) {
    console.error("紹介進捗修正エラー:", error);
    alert("紹介進捗を修正できませんでした。");
    button.disabled = false;
  }
}

async function changeRewardState(button) {
  const target = button.dataset.studentNumber;
  const milestoneCount = Number(button.dataset.milestoneCount);
  const deleted = button.dataset.referralRewardState === "delete";
  const actionLabel = deleted ? "削除" : "復元";
  const reason = prompt(`${target}の${milestoneCount}人特典を${actionLabel}する理由を入力してください。\n履歴に保存されます。`);
  if (reason === null) return;
  if (reason.trim().length < 4) {
    alert("理由を4文字以上で入力してください。");
    return;
  }
  const detail = milestoneCount === 2 && deleted
    ? "学習ポイント100ptも差し引かれます。"
    : milestoneCount === 6 && deleted
      ? "設定済みのペット・名前・お世話記録も削除されます。"
      : milestoneCount === 10 && deleted
        ? "登録済みのギフトURLも削除されます。"
        : "";
  if (!confirm(`${target}の${milestoneCount}人特典を${actionLabel}しますか？${detail ? `\n${detail}` : ""}`)) return;
  button.disabled = true;
  try {
    await httpsCallable(functions, "setReferralRewardDeletedAdmin")({
      studentNumber: target,
      milestoneCount,
      deleted,
      reason: reason.trim(),
    });
    showToast(`特典を${actionLabel}しました`);
    await loadReferralAdmin();
  } catch (error) {
    console.error("紹介特典状態変更エラー:", error);
    alert(error?.message || `特典を${actionLabel}できませんでした。`);
    button.disabled = false;
  }
}

function render() {
  renderHomeVisibility();
  $("referralStudentTotal").textContent = `${Number(totals.students || students.length)}人`;
  $("referralTotal").textContent = `${Number(totals.referrals || 0)}件`;
  $("activeCodeTotal").textContent = `${Number(totals.activeCodes || 0)}件`;
  $("rewardTotal").textContent = `${Number(totals.reachedTen || 0)}人`;
  $("rewardPending").textContent = `${Number(totals.pendingRewards || 0)}人`;
  const search = $("referralSearch").value.trim().toLowerCase();
  const filter = $("referralFilter").value;
  const visible = students.filter((item) => {
    if (search && !`${item.studentNumber} ${item.name} ${item.department}`.toLowerCase().includes(search)) return false;
    if (filter === "progress") return Number(item.invitedCount || 0) > 0;
    if (filter === "active-code") return Boolean(item.activeCode);
    if (filter === "reached") return Number(item.invitedCount || 0) >= 10;
    if (filter === "pending") return Number(item.invitedCount || 0) >= 10 && !["granted", "deleted"].includes(item.reward?.status);
    return true;
  });
  $("rewardList").innerHTML = visible.length
    ? visible.map(renderStudent).join("")
    : '<div class="referral-empty">条件に一致する学生はいません。</div>';
}

function renderHomeVisibility() {
  const visible = referralSettings.homeVisible !== false;
  $("referralHomeVisible").checked = visible;
  $("referralHomeVisibilityLabel").textContent = visible ? "表示中" : "非表示";
  $("referralHomeVisibilityLabel").classList.toggle("is-off", !visible);
}

function renderStudent(item) {
  const count = Math.max(0, Math.min(10, Number(item.invitedCount || 0)));
  const reward = item.reward || {};
  const histories = Array.isArray(item.histories) ? item.histories : [];
  const adjustments = Array.isArray(item.adjustments) ? item.adjustments : [];
  const milestones = Array.isArray(item.milestones) ? item.milestones : [];
  const reached = count >= 10;
  const tenRewardDeleted = milestones.some((milestone) => milestone.count === 10 && milestone.deleted);
  return `
    <details class="referral-admin-student ${reached ? "is-reached" : ""}">
      <summary>
        <div class="referral-admin-student-title"><strong>${escapeHtml(item.studentNumber)}${item.name ? ` / ${escapeHtml(item.name)}` : ""}</strong><small>${escapeHtml([item.department, item.grade ? `${item.grade}年` : ""].filter(Boolean).join("・") || "所属未設定")}</small></div>
        <div class="referral-admin-student-progress"><b>${count} / 10人</b><span>${reached ? "🎉 10人達成" : item.activeCode ? "コード発行中" : count ? "進行中" : "未開始"}</span></div>
      </summary>
      <div class="referral-admin-student-body">
        <div class="referral-admin-progress-track"><i style="width:${count * 10}%"></i></div>
        <div class="referral-admin-info-grid">
          <div><small>現在の招待コード</small><b>${item.activeCode ? escapeHtml(item.activeCode.code) : "なし"}</b>${item.activeCode ? `<em>期限：${formatDateTime(item.activeCode.expiresAt)}</em>` : ""}</div>
          <div><small>自動成立履歴</small><b>${histories.length}件</b><em>${Number(item.manualAdjustment || 0) ? `手動補正 ${Number(item.manualAdjustment) > 0 ? "+" : ""}${Number(item.manualAdjustment)}人` : "補正なし"}</em></div>
          <div><small>ギフト状態</small><b>${rewardStatus(reward, reached)}</b>${reward.claimedAt ? `<em>受取確認：${formatDateTime(reward.claimedAt)}</em>` : ""}</div>
        </div>
        <section><h3>マイルストーン・特典管理</h3><div class="referral-admin-milestones">${milestones.map((m) => renderMilestoneControl(item.studentNumber, m)).join("")}</div></section>
        <section><h3>紹介成立履歴</h3><div class="referral-admin-history">${histories.length ? histories.map((h) => `<div><b>${escapeHtml(h.invitedStudentNumber)}</b><span>${formatDateTime(h.establishedAt)}${h.codePreview ? `・コード末尾 ${escapeHtml(h.codePreview)}` : ""}</span></div>`).join("") : '<p class="referral-empty">成立履歴はありません。</p>'}</div></section>
        <section class="referral-adjust-editor">
          <h3>進捗を手動補正</h3>
          <p>自動カウント漏れなどの修正専用です。変更者・変更前後・理由が保存されます。</p>
          <div class="referral-adjust-controls"><label>達成人数<input data-referral-count="${escapeHtml(item.studentNumber)}" type="number" min="0" max="10" step="1" value="${count}" /></label><label>修正理由<input data-referral-reason="${escapeHtml(item.studentNumber)}" type="text" maxlength="120" placeholder="例：登録時のFunctions障害で未加算" /></label><button class="btn" data-adjust-referral="${escapeHtml(item.studentNumber)}" type="button">進捗を修正</button></div>
          ${adjustments.length ? `<details class="referral-adjust-history"><summary>補正履歴 ${adjustments.length}件</summary>${adjustments.map((a) => `<div><b>${a.fromCount} → ${a.toCount}人</b><span>${escapeHtml(a.reason)}・${formatDateTime(a.adjustedAt)}・${escapeHtml(a.adjustedBy)}</span></div>`).join("")}</details>` : ""}
        </section>
        ${reached ? tenRewardDeleted ? '<section class="referral-reward-editor"><h3>500円分デジタルギフト</h3><p>この特典は削除中です。マイルストーン欄から復元すると再び付与できます。</p></section>' : `<section class="referral-reward-editor ${reward.status === "granted" ? "is-granted" : ""}"><h3>500円分デジタルギフト</h3><label>ギフトURL<input data-gift-url="${escapeHtml(item.studentNumber)}" type="url" value="${escapeHtml(reward.giftUrl || "")}" placeholder="https://..." /></label><div class="referral-reward-actions"><small>${reward.grantedAt ? `付与：${formatDateTime(reward.grantedAt)}` : "未付与"}${reward.claimedAt ? ` / 受取：${formatDateTime(reward.claimedAt)}` : ""}</small><button class="btn btn-primary" data-grant-reward="${escapeHtml(item.studentNumber)}" type="button">${reward.status === "granted" ? "URLを更新" : "付与する"}</button></div></section>` : ""}
      </div>
    </details>`;
}

function renderMilestoneControl(studentNumber, milestone) {
  const available = milestone.unlocked || milestone.deleted;
  return `<div class="referral-admin-milestone-control ${milestone.unlocked ? "is-unlocked" : ""} ${milestone.deleted ? "is-deleted" : ""}">
    <span>${milestone.count}人 ${milestone.unlocked ? "✓" : milestone.deleted ? "削除済み" : "未達成"}</span>
    ${available ? `<button type="button" class="btn ${milestone.deleted ? "" : "btn-danger"}" data-referral-reward-state="${milestone.deleted ? "restore" : "delete"}" data-student-number="${escapeHtml(studentNumber)}" data-milestone-count="${milestone.count}">${milestone.deleted ? "復元" : "削除"}</button>` : ""}
  </div>`;
}

function rewardStatus(reward, reached) {
  if (!reached) return "対象外";
  if (reward.status === "deleted") return "削除済み";
  if (reward.claimedAt) return "受取確認済み";
  return reward.status === "granted" ? "付与済み" : "未付与";
}
function formatDateTime(value) {
  const date = new Date(Number(value || 0));
  return Number.isNaN(date.getTime()) || date.getTime() <= 0 ? "--" : new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
