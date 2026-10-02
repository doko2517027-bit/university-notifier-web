const DEFAULT_PROVIDERS = Object.freeze([
  {
    id: "google-cloud",
    name: "Firebase・Google Cloud",
    detail: "Firestore、Functions、Realtime Database、Cloud Buildなど",
    billingUrl: "https://console.cloud.google.com/billing",
    automatic: true,
  },
  {
    id: "render",
    name: "Render",
    detail: "定期確認サーバー・AIサーバー",
    billingUrl: "https://dashboard.render.com/billing",
  },
  {
    id: "github",
    name: "GitHub",
    detail: "Web版Pages、サーバー更新用Actions、リポジトリ",
    billingUrl: "https://github.com/settings/billing/summary",
  },
  {
    id: "cloudinary",
    name: "Cloudinary",
    detail: "画像・PDFの保存と配信",
    billingUrl: "https://console.cloudinary.com/settings/billing",
  },
  {
    id: "open-meteo",
    name: "Open-Meteo",
    detail: "天気・地域検索API",
    billingUrl: "https://open-meteo.com/en/pricing",
    knownFreeReason: "APIキー・請求連携を使用していない構成として検出",
  },
  {
    id: "other",
    name: "その他",
    detail: "ドメイン、追加サービス、手数料など",
    billingUrl: "",
  },
]);

const PROVIDER_IDS = new Set(DEFAULT_PROVIDERS.map((provider) => provider.id));

function monthKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

function recentMonthKeys(count = 12, now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(now)
      .filter((part) => part.type === "year" || part.type === "month")
      .map((part) => [part.type, Number(part.value)]),
  );
  const result = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(Date.UTC(parts.year, parts.month - 1 - index, 15));
    result.push(formatter.format(date));
  }
  return result;
}

function finiteAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) return null;
  return Math.round(amount * 100) / 100;
}

function normalizeManualCosts(value) {
  if (!value || typeof value !== "object") return {};
  const result = {};
  for (const [month, providers] of Object.entries(value)) {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || !providers || typeof providers !== "object") continue;
    result[month] = {};
    for (const [providerId, rawAmount] of Object.entries(providers)) {
      if (!PROVIDER_IDS.has(providerId)) continue;
      const amount = finiteAmount(rawAmount);
      if (amount !== null) result[month][providerId] = amount;
    }
  }
  return result;
}

function buildDashboard({
  automaticGoogleCosts = {},
  automaticGoogleServices = {},
  automaticCurrency = "JPY",
  config = {},
  now = new Date(),
  automaticStatus = "not-connected",
  automaticMessage = "Google Cloudの請求データ連携が未設定です。",
  freeUsage = null,
  providerDetections = {},
}) {
  const months = recentMonthKeys(12, now);
  const manualCosts = normalizeManualCosts(config.monthlyCosts);
  const googleConnected = automaticStatus === "connected";
  const providers = DEFAULT_PROVIDERS.map((provider) => ({
    ...provider,
    ...(providerDetections[provider.id] || {}),
  }));
  const series = months.map((month) => {
    const values = {};
    let incompleteCount = 0;
    for (const provider of providers) {
      let amount = null;
      let source = "unset";
      if (provider.id === "google-cloud" && googleConnected) {
        amount = finiteAmount(automaticGoogleCosts[month]);
        if (amount === null) amount = 0;
        source = "automatic";
      } else if (Object.hasOwn(manualCosts[month] || {}, provider.id)) {
        amount = manualCosts[month][provider.id];
        source = "manual";
      } else if (provider.knownFreeReason || provider.detectedFreeReason) {
        amount = 0;
        source = "detected-free";
      } else {
        incompleteCount += 1;
      }
      values[provider.id] = { amount, source };
    }
    const total = Object.values(values).reduce(
      (sum, item) => sum + (item.amount ?? 0),
      0,
    );
    return { month, total, incompleteCount, values };
  });
  const current = series.find((item) => item.month === monthKey(now)) || series.at(-1);
  const budgetAmount = finiteAmount(config.budgetAmount);
  const alertAmount = finiteAmount(config.alertAmount);
  const alertTriggered = alertAmount !== null && current.total >= alertAmount;
  const budgetRatio = budgetAmount && budgetAmount > 0 ? current.total / budgetAmount : null;
  return {
    currency: googleConnected ? automaticCurrency || "JPY" : "JPY",
    providers,
    series,
    currentMonth: current.month,
    currentTotal: current.total,
    currentIncompleteCount: current.incompleteCount,
    budgetAmount,
    alertAmount,
    alertTriggered,
    budgetRatio,
    notificationsEnabled: config.notificationsEnabled === true,
    automaticSource: {
      status: automaticStatus,
      message: automaticMessage,
    },
    automaticServiceBreakdown: automaticGoogleServices,
    freeUsage,
  };
}

function sanitizeSettingsInput(data) {
  const month = String(data?.month || "");
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("invalid-month");
  }
  const costs = {};
  for (const provider of DEFAULT_PROVIDERS) {
    const raw = data?.costs?.[provider.id];
    if (raw === "" || raw === null || raw === undefined) continue;
    const amount = finiteAmount(raw);
    if (amount === null) throw new Error("invalid-amount");
    costs[provider.id] = amount;
  }
  const budgetAmount = data?.budgetAmount === "" ? null : finiteAmount(data?.budgetAmount);
  const alertAmount = data?.alertAmount === "" ? null : finiteAmount(data?.alertAmount);
  if (data?.budgetAmount !== "" && budgetAmount === null) throw new Error("invalid-budget");
  if (data?.alertAmount !== "" && alertAmount === null) throw new Error("invalid-alert");
  return {
    month,
    costs,
    budgetAmount,
    alertAmount,
    notificationsEnabled: data?.notificationsEnabled === true,
  };
}

function validBillingTable(value) {
  const table = String(value || "");
  return /^[a-z0-9][a-z0-9-]{4,61}[a-z0-9]\.[A-Za-z0-9_]+\.gcp_billing_export_v1_[A-Fa-f0-9_-]+$/.test(table)
    ? table
    : "";
}

async function discoverBillingTable(bigquery, projectId) {
  const [datasets] = await bigquery.getDatasets({ maxResults: 100 });
  for (const dataset of datasets) {
    const [tables] = await dataset.getTables({ maxResults: 200 });
    const table = tables.find((item) =>
      String(item.id || "").startsWith("gcp_billing_export_v1_"),
    );
    if (table) return `${projectId}.${dataset.id}.${table.id}`;
  }
  return "";
}

async function queryGoogleCosts({ table, projectId }) {
  const { BigQuery } = require("@google-cloud/bigquery");
  const bigquery = new BigQuery({ projectId });
  let selectedTable = validBillingTable(table);
  if (!selectedTable) selectedTable = await discoverBillingTable(bigquery, projectId);
  if (!selectedTable) {
    return {
      status: "not-connected",
      message: "Cloud BillingのBigQueryエクスポートがまだ見つかりません。",
      table: "",
      costs: {},
      currency: "JPY",
    };
  }
  const query = `
    SELECT
      FORMAT_TIMESTAMP('%Y-%m', usage_start_time, 'Asia/Tokyo') AS month,
      service.description AS service,
      ANY_VALUE(currency) AS currency,
      ROUND(SUM(cost) + SUM(IFNULL((SELECT SUM(credit.amount) FROM UNNEST(credits) AS credit), 0)), 2) AS amount
    FROM \`${selectedTable}\`
    WHERE project.id = @projectId
      AND usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 13 MONTH)
    GROUP BY month, service
    ORDER BY month, amount DESC
  `;
  const [rows] = await bigquery.query({
    query,
    params: { projectId },
    maximumBytesBilled: 100 * 1024 * 1024,
    useLegacySql: false,
  });
  const costs = {};
  const services = {};
  for (const row of rows) {
    const month = String(row.month);
    const amount = finiteAmount(row.amount) || 0;
    costs[month] = Math.round(((costs[month] || 0) + amount) * 100) / 100;
    if (!services[month]) services[month] = {};
    services[month][String(row.service || "その他のGoogle Cloudサービス")] = amount;
  }
  return {
    status: "connected",
    message: "Google Cloudの請求エクスポートから自動集計しています。",
    table: selectedTable,
    costs,
    services,
    currency: String(rows.find((row) => row.currency)?.currency || "JPY"),
  };
}

module.exports = {
  DEFAULT_PROVIDERS,
  buildDashboard,
  monthKey,
  normalizeManualCosts,
  queryGoogleCosts,
  recentMonthKeys,
  sanitizeSettingsInput,
  validBillingTable,
};
