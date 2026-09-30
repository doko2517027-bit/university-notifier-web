import {
  auth,
  functions,
  studentNumber,
  setupTheme,
  initializePage,
  setupAdminTab,
  loadUserName,
  loadProfileImage,
  isAdmin,
  showToast,
  updateAssignmentNavBadge,
  updateNewsNavBadge,
} from "./common.js";
import { getIdTokenResult } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

const $ = (id) => document.getElementById(id);
const PROVIDER_COLORS = ["#0f9d8a", "#5a7bea", "#f4a340", "#a66ee7", "#e86478", "#718096"];
let dashboard = null;
let selectedMonth = "";

setupTheme($("themeButton"));
$("profileButton").onclick = () => { location.href = "profile.html"; };

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
  throw new Error("料金情報を確認できるアカウントではありません。");
}

await initializePage([
  setupAdminTab(),
  loadUserName($("userName")),
  loadProfileImage($("topProfileImage")),
  updateAssignmentNavBadge(),
  updateNewsNavBadge(),
  loadDashboard(false),
]);

$("refreshCostDashboard").onclick = () => loadDashboard(true);
$("saveCostSettings").onclick = saveSettings;
$("costMonthSelect").onchange = () => {
  selectedMonth = $("costMonthSelect").value;
  renderSelectedMonth();
};

async function loadDashboard(force) {
  const refreshButton = $("refreshCostDashboard");
  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.textContent = force ? "確認中..." : "読み込み中...";
  }
  try {
    const call = httpsCallable(functions, "getCareMateCostDashboard", { timeout: 60_000 });
    const response = await call({ force });
    dashboard = response.data;
    selectedMonth = selectedMonth && dashboard.series.some((item) => item.month === selectedMonth)
      ? selectedMonth
      : dashboard.currentMonth;
    renderDashboard();
  } catch (error) {
    console.error("料金ダッシュボード取得エラー:", error);
    $("costSourceNotice").className = "cost-source-notice is-error";
    $("costSourceNotice").textContent = "料金情報を取得できませんでした。時間をおいて再確認してください。";
    showToast("料金情報を取得できませんでした");
  } finally {
    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.textContent = "↻ 最新情報を確認";
    }
  }
}

function renderDashboard() {
  renderSourceState();
  renderMonthOptions();
  renderSummary();
  renderMonthlyChart();
  renderBudget();
  renderSelectedMonth();
}

function renderSourceState() {
  const source = dashboard.automaticSource || {};
  const connected = source.status === "connected";
  $("costSourceNotice").className = `cost-source-notice ${connected ? "is-connected" : "is-warning"}`;
  $("costSourceNotice").textContent = connected
    ? `✓ Firebase・Google Cloudは実際の請求データから自動集計しています。最終確認：${formatDateTime(dashboard.refreshedAt)}`
    : `⚠ ${source.message || "Google Cloud請求データは未連携です。"} 自動取得できないサービスは手入力できます。`;
  $("billingSetupCard").hidden = connected;
  $("billingSetupMessage").textContent = source.message || "請求データ連携が見つかりません。";
}

function renderMonthOptions() {
  $("costMonthSelect").innerHTML = dashboard.series
    .slice()
    .reverse()
    .map((item) => `<option value="${item.month}" ${item.month === selectedMonth ? "selected" : ""}>${formatMonth(item.month)}</option>`)
    .join("");
}

function renderSummary() {
  const current = dashboard.series.find((item) => item.month === dashboard.currentMonth) || dashboard.series.at(-1);
  const currentIndex = dashboard.series.indexOf(current);
  const previous = currentIndex > 0 ? dashboard.series[currentIndex - 1] : null;
  $("currentCostTotal").textContent = formatMoney(current.total);
  $("currentCostCompleteness").textContent = current.incompleteCount
    ? `未入力が${current.incompleteCount}サービスあります`
    : "すべてのサービスを集計済み";
  $("monthlyBudgetSummary").textContent = dashboard.budgetAmount === null ? "未設定" : formatMoney(dashboard.budgetAmount);
  if (dashboard.budgetAmount !== null) {
    const remaining = dashboard.budgetAmount - current.total;
    $("budgetRemainingSummary").textContent = remaining >= 0
      ? `残り ${formatMoney(remaining)}`
      : `${formatMoney(Math.abs(remaining))} 超過`;
  } else {
    $("budgetRemainingSummary").textContent = "予算を設定できます";
  }
  if (previous) {
    const difference = current.total - previous.total;
    $("costMonthChange").textContent = difference === 0
      ? "±0"
      : `${difference > 0 ? "+" : "−"}${formatMoney(Math.abs(difference))}`;
    $("costMonthChange").classList.toggle("is-cost-up", difference > 0);
    $("previousMonthSummary").textContent = `前月 ${formatMoney(previous.total)}`;
  }
  $("alertAmountSummary").textContent = dashboard.alertAmount === null ? "未設定" : formatMoney(dashboard.alertAmount);
  $("alertStateSummary").textContent = dashboard.alertTriggered
    ? "設定金額を超えています"
    : dashboard.alertAmount === null
      ? "超過時にお知らせできます"
      : "設定金額以内です";

  const banner = $("costAlertBanner");
  if (dashboard.alertTriggered) {
    banner.hidden = false;
    banner.className = "cost-alert-banner is-danger";
    banner.innerHTML = `<b>⚠ 料金アラート</b><span>${escapeHtml(dashboard.currentMonth)}の確認済み料金が設定額を超えています。</span>`;
  } else if (current.incompleteCount) {
    banner.hidden = false;
    banner.className = "cost-alert-banner is-warning";
    banner.innerHTML = `<b>集計はまだ未完了です</b><span>${current.incompleteCount}サービスの金額が未入力です。請求画面を確認してください。</span>`;
  } else {
    banner.hidden = true;
  }
}

function renderMonthlyChart() {
  const budget = dashboard.budgetAmount || 0;
  const maximum = Math.max(1, budget, ...dashboard.series.map((item) => item.total));
  $("chartCurrency").textContent = dashboard.currency || "JPY";
  $("monthlyCostChart").innerHTML = dashboard.series.map((item) => {
    const height = item.total ? Math.max(5, (item.total / maximum) * 100) : 2;
    const budgetPosition = budget ? Math.min(100, (budget / maximum) * 100) : 0;
    return `
      <div class="cost-chart-column" title="${escapeHtml(formatMonth(item.month))} ${escapeHtml(formatMoney(item.total))}">
        <div class="cost-chart-value">${compactMoney(item.total)}</div>
        <div class="cost-chart-rail">
          ${budget ? `<i class="cost-budget-line" style="bottom:${budgetPosition}%"></i>` : ""}
          <b class="${item.incompleteCount ? "is-incomplete" : ""}" style="height:${height}%"></b>
        </div>
        <span>${escapeHtml(item.month.slice(5))}月</span>
      </div>`;
  }).join("");
}

function renderBudget() {
  $("monthlyBudgetInput").value = dashboard.budgetAmount ?? "";
  $("alertAmountInput").value = dashboard.alertAmount ?? "";
  $("costNotificationsEnabled").checked = dashboard.notificationsEnabled === true;
  const ratio = dashboard.budgetRatio;
  const percent = ratio === null ? 0 : Math.min(100, ratio * 100);
  $("costBudgetMeter").style.width = `${percent}%`;
  $("costBudgetMeter").className = ratio >= 1 ? "is-danger" : ratio >= 0.8 ? "is-warning" : "";
  $("costBudgetMeterText").textContent = ratio === null
    ? "予算を設定すると使用割合が表示されます。"
    : `今月は月額予算の${Math.round(ratio * 100)}%です。`;
}

function renderSelectedMonth() {
  if (!dashboard) return;
  const monthData = dashboard.series.find((item) => item.month === selectedMonth) || dashboard.series.at(-1);
  const positiveValues = dashboard.providers
    .map((provider) => ({ provider, amount: monthData.values[provider.id]?.amount ?? 0 }))
    .filter((item) => item.amount > 0);
  let cursor = 0;
  const segments = positiveValues.map((item, index) => {
    const start = monthData.total ? (cursor / monthData.total) * 100 : 0;
    cursor += item.amount;
    const end = monthData.total ? (cursor / monthData.total) * 100 : 0;
    return `${PROVIDER_COLORS[index % PROVIDER_COLORS.length]} ${start}% ${end}%`;
  });
  $("costDonut").style.background = segments.length
    ? `conic-gradient(${segments.join(",")})`
    : "color-mix(in srgb, var(--primary) 12%, var(--card))";
  $("costDonutTotal").textContent = formatMoney(monthData.total);
  $("costBreakdownList").innerHTML = dashboard.providers.map((provider, index) => {
    const value = monthData.values[provider.id];
    return `<div><i style="background:${PROVIDER_COLORS[index % PROVIDER_COLORS.length]}"></i><span>${escapeHtml(provider.name)}</span><b>${value.amount === null ? "未入力" : escapeHtml(formatMoney(value.amount))}</b></div>`;
  }).join("");
  $("providerCountLabel").textContent = `${dashboard.providers.length}サービス`;
  $("costProviderList").innerHTML = dashboard.providers.map((provider, index) => {
    const value = monthData.values[provider.id];
    const sourceLabel = value.source === "automatic"
      ? "自動取得"
      : value.source === "detected-free"
        ? "無料構成を検出"
        : value.source === "manual"
          ? "手入力"
          : "未入力";
    return `
      <article class="cost-provider-item">
        <i class="cost-provider-color" style="background:${PROVIDER_COLORS[index % PROVIDER_COLORS.length]}"></i>
        <div class="cost-provider-copy">
          <div><h3>${escapeHtml(provider.name)}</h3><span class="cost-source-badge is-${escapeHtml(value.source)}">${sourceLabel}</span></div>
          <p>${escapeHtml(provider.detail)}</p>
          ${provider.knownFreeReason ? `<small>${escapeHtml(provider.knownFreeReason)}。有料契約がある場合は実額を入力してください。</small>` : ""}
          ${provider.id === "google-cloud" && value.source === "automatic" ? renderGoogleServiceDetails(selectedMonth) : ""}
        </div>
        <label class="cost-provider-amount"><span>${escapeHtml(formatMonth(selectedMonth))}</span><div><b>${currencySymbol()}</b><input data-provider-cost="${escapeHtml(provider.id)}" type="number" min="0" max="10000000" step="1" inputmode="numeric" value="${value.source === "manual" ? value.amount : ""}" placeholder="${value.source === "automatic" ? compactMoney(value.amount) : value.source === "detected-free" ? "0" : "未入力"}" ${value.source === "automatic" ? "disabled" : ""} /></div></label>
        ${provider.billingUrl ? `<a href="${escapeHtml(provider.billingUrl)}" target="_blank" rel="noopener" class="cost-billing-link">請求画面を開く ↗</a>` : ""}
      </article>`;
  }).join("");
  $("costSaveMessage").textContent = `${formatMonth(selectedMonth)}の金額を編集しています。`;
}

function renderGoogleServiceDetails(month) {
  const services = dashboard.automaticServiceBreakdown?.[month] || {};
  const rows = Object.entries(services).sort((a, b) => Number(b[1]) - Number(a[1]));
  if (!rows.length) return "";
  return `<details class="cost-cloud-details"><summary>Google Cloud内訳を見る</summary>${rows.map(([name, amount]) => `<div><span>${escapeHtml(name)}</span><b>${escapeHtml(formatMoney(amount))}</b></div>`).join("")}</details>`;
}

async function saveSettings() {
  const button = $("saveCostSettings");
  button.disabled = true;
  button.textContent = "保存中...";
  try {
    const costs = {};
    document.querySelectorAll("[data-provider-cost]").forEach((input) => {
      costs[input.dataset.providerCost] = input.value;
    });
    const save = httpsCallable(functions, "saveCareMateCostSettings");
    const response = await save({
      month: selectedMonth,
      costs,
      budgetAmount: $("monthlyBudgetInput").value,
      alertAmount: $("alertAmountInput").value,
      notificationsEnabled: $("costNotificationsEnabled").checked,
    });
    dashboard = response.data;
    renderDashboard();
    $("costSaveMessage").textContent = `${formatMonth(selectedMonth)}の料金とアラート設定を保存しました。`;
    showToast("料金設定を保存しました");
  } catch (error) {
    console.error("料金設定保存エラー:", error);
    $("costSaveMessage").textContent = "保存できませんでした。入力内容を確認してください。";
    showToast("料金設定を保存できませんでした");
  } finally {
    button.disabled = false;
    button.textContent = "この月の料金と設定を保存";
  }
}

function formatMoney(value) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: dashboard?.currency || "JPY",
    maximumFractionDigits: dashboard?.currency === "JPY" ? 0 : 2,
  }).format(Number(value || 0));
}

function compactMoney(value) {
  return new Intl.NumberFormat("ja-JP", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

function currencySymbol() {
  return dashboard?.currency === "JPY" ? "¥" : dashboard?.currency || "¥";
}

function formatMonth(value) {
  const [year, month] = String(value).split("-");
  return `${year}年${Number(month)}月`;
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "日時不明" : date.toLocaleString("ja-JP");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
