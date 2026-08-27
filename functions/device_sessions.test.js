const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeDeviceId,
  isPrimaryDeviceAuditAdminIdentity,
  extractClientIp,
  getIpPrivacyValues,
  parseDeviceInfo,
  evaluateAccountSharingRisk,
  shouldRefreshApproximateRegion,
  shouldForceLogoutSession,
  fetchApproximateRegion,
} = require("./device_sessions");

test("端末監査は2510044本人のUID・権限・サーバープロフィールがすべて一致した時だけ許可する", () => {
  const authorized = {
    uid: "caremate-2510044",
    tokenStudentNumber: "2510044",
    adminClaim: true,
    adminEnabled: true,
    profileExists: true,
    profileStudentNumber: "2510044",
  };

  assert.equal(isPrimaryDeviceAuditAdminIdentity(authorized), true);
  assert.equal(
    isPrimaryDeviceAuditAdminIdentity({
      ...authorized,
      uid: "caremate-2510001",
    }),
    false,
  );
  assert.equal(
    isPrimaryDeviceAuditAdminIdentity({
      ...authorized,
      tokenStudentNumber: "2510001",
    }),
    false,
  );
  assert.equal(
    isPrimaryDeviceAuditAdminIdentity({
      ...authorized,
      adminEnabled: false,
    }),
    false,
  );
  assert.equal(
    isPrimaryDeviceAuditAdminIdentity({
      ...authorized,
      profileExists: false,
    }),
    false,
  );
});

test("端末IDは十分な長さのランダムID形式だけを受け付ける", () => {
  assert.equal(
    normalizeDeviceId("5a7cb928-82c2-4f67-86e1-a449e118f091"),
    "5a7cb928-82c2-4f67-86e1-a449e118f091",
  );
  assert.equal(normalizeDeviceId("short"), "");
  assert.equal(normalizeDeviceId("invalid device identifier"), "");
});

test("サーバーリクエストの先頭転送元IPをマスクする", () => {
  const ip = extractClientIp({
    headers: { "x-forwarded-for": "203.0.113.42, 10.0.0.1" },
  });
  const privacy = getIpPrivacyValues(ip);

  assert.equal(ip, "203.0.113.42");
  assert.equal(privacy.maskedIp, "203.0.113.*");
  assert.equal(privacy.networkKey.length, 24);
  assert.equal(privacy.networkKey.includes("203.0.113"), false);
});

test("Androidの機種名、iPhone/iPadの詳細不明表示、PC情報を安全に分類する", () => {
  const android = parseDeviceInfo(
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A.240505.004) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36",
  );
  assert.equal(android.deviceType, "Android");
  assert.equal(android.model, "Pixel 8");
  assert.equal(android.os, "Android 14");
  assert.match(android.browser, /Google Chrome/);

  const reducedAndroid = parseDeviceInfo(
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36",
  );
  assert.equal(reducedAndroid.model, "Android端末（詳細不明）");

  const iphone = parseDeviceInfo(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1",
  );
  assert.equal(iphone.deviceType, "iPhone");
  assert.equal(iphone.model, "iPhone（詳細不明）");

  const ipad = parseDeviceInfo(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1",
  );
  assert.equal(ipad.deviceType, "iPad");
  assert.equal(ipad.model, "iPad（詳細不明）");

  const pc = parseDeviceInfo(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  );
  assert.equal(pc.deviceType, "PC");
  assert.equal(pc.os, "Windows 10/11");
});

test("同じ場所・同じネットワークの通常の2端末利用だけでは警告しない", () => {
  const now = Date.now();
  const risk = evaluateAccountSharingRisk(
    [
      { lastSeenAt: now - 2 * 60000, regionCity: "福岡市", networkKey: "a" },
      { lastSeenAt: now - 3 * 60000, regionCity: "福岡市", networkKey: "a" },
    ],
    now,
  );

  assert.equal(risk.level, "normal");
  assert.deepEqual(risk.reasons, []);
});

test("近接時間の3端末・異なる市・異なるネットワークを説明付きで警告する", () => {
  const now = Date.now();
  const risk = evaluateAccountSharingRisk(
    [
      { lastSeenAt: now - 2 * 60000, regionCity: "福岡市", networkKey: "a" },
      { lastSeenAt: now - 3 * 60000, regionCity: "北九州市", networkKey: "b" },
      { lastSeenAt: now - 4 * 60000, regionCity: "福岡市", networkKey: "a" },
    ],
    now,
  );

  assert.equal(risk.level, "review");
  assert.equal(risk.reasons.length, 3);
  assert.match(risk.reasons.join(" "), /3台/);
  assert.match(risk.reasons.join(" "), /異なる推定市区町村/);
  assert.match(risk.reasons.join(" "), /異なるネットワーク/);
});

test("推定地域は24時間経過時またはネットワーク変更時だけ再取得する", () => {
  const now = Date.now();
  const existing = {
    networkKey: "network-a",
    regionLastAttemptAt: new Date(now - 23 * 60 * 60 * 1000),
  };

  assert.equal(
    shouldRefreshApproximateRegion({
      existing,
      networkKey: "network-a",
      hasClientIp: true,
      nowMillis: now,
    }),
    false,
  );
  assert.equal(
    shouldRefreshApproximateRegion({
      existing,
      networkKey: "network-b",
      hasClientIp: true,
      nowMillis: now,
    }),
    true,
  );
  assert.equal(
    shouldRefreshApproximateRegion({
      existing: {
        ...existing,
        regionLastAttemptAt: new Date(now - 24 * 60 * 60 * 1000),
      },
      networkKey: "network-a",
      hasClientIp: true,
      nowMillis: now,
    }),
    true,
  );
});

test("個別・全端末の要求より前に認証したセッションだけを強制ログアウトする", () => {
  const oldAuthentication = new Date("2026-08-27T01:00:00Z");
  const request = new Date("2026-08-27T02:00:00Z");
  const newAuthentication = new Date("2026-08-27T03:00:00Z");

  assert.equal(
    shouldForceLogoutSession({
      authTimeMillis: oldAuthentication,
      deviceRequestedAt: request,
    }),
    true,
  );
  assert.equal(
    shouldForceLogoutSession({
      authTimeMillis: oldAuthentication,
      allDevicesRequestedAt: request,
    }),
    true,
  );
  assert.equal(
    shouldForceLogoutSession({
      authTimeMillis: newAuthentication,
      deviceRequestedAt: request,
      allDevicesRequestedAt: request,
    }),
    false,
  );
});

test("位置APIには緯度経度を要求せず、国・都道府県・市区町村だけを扱う", async () => {
  const originalFetch = global.fetch;
  let requestedUrl = "";
  global.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      async json() {
        return {
          success: true,
          country: "日本",
          country_code: "JP",
          region: "福岡県",
          city: "福岡市",
          latitude: 33.59,
          longitude: 130.4,
        };
      },
    };
  };

  try {
    const region = await fetchApproximateRegion("203.0.113.42");
    assert.match(requestedUrl, /fields=success,country,country_code,region,city/);
    assert.doesNotMatch(requestedUrl, /latitude|longitude/);
    assert.deepEqual(Object.keys(region).sort(), [
      "city",
      "country",
      "countryCode",
      "provider",
      "region",
      "status",
    ]);
    assert.equal(region.city, "福岡市");
  } finally {
    global.fetch = originalFetch;
  }
});
