const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildDashboard,
  sanitizeSettingsInput,
  validBillingTable,
} = require("./cost_dashboard.js");

const NOW = new Date("2026-10-01T00:00:00+09:00");

test("自動取得したGoogle Cloud料金と手入力した外部サービスを合計する", () => {
  const dashboard = buildDashboard({
    now: NOW,
    automaticStatus: "connected",
    automaticGoogleCosts: { "2026-10": 120 },
    automaticGoogleServices: { "2026-10": { "Cloud Run": 80, "Cloud Firestore": 40 } },
    config: {
      monthlyCosts: {
        "2026-10": { render: 850, github: 0, cloudinary: 0, other: 30 },
      },
      alertAmount: 1000,
    },
  });
  assert.equal(dashboard.currentTotal, 1000);
  assert.equal(dashboard.currentIncompleteCount, 0);
  assert.equal(dashboard.alertTriggered, true);
  assert.equal(dashboard.series.at(-1).values["google-cloud"].source, "automatic");
  assert.deepEqual(dashboard.automaticServiceBreakdown["2026-10"], {
    "Cloud Run": 80,
    "Cloud Firestore": 40,
  });
});

test("未連携サービスは0円扱いにせず集計未完了として残す", () => {
  const dashboard = buildDashboard({ now: NOW, config: {} });
  assert.equal(dashboard.currentTotal, 0);
  assert.equal(dashboard.currentIncompleteCount, 5);
});

test("保存値は許可した提供元と安全な金額だけ受け付ける", () => {
  const result = sanitizeSettingsInput({
    month: "2026-10",
    costs: { render: "1200", unexpected: "500" },
    budgetAmount: "3000",
    alertAmount: "2500",
    notificationsEnabled: true,
  });
  assert.deepEqual(result.costs, { render: 1200 });
  assert.equal(result.notificationsEnabled, true);
  assert.throws(() => sanitizeSettingsInput({ month: "bad", costs: {} }));
});

test("請求エクスポート以外の任意テーブル名を受け付けない", () => {
  assert.equal(
    validBillingTable("universitynotifier-67517.billing.gcp_billing_export_v1_ABC-123"),
    "universitynotifier-67517.billing.gcp_billing_export_v1_ABC-123",
  );
  assert.equal(validBillingTable("project.dataset.users"), "");
});
