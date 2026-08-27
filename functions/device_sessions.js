const crypto = require("node:crypto");
const net = require("node:net");

const DEVICE_SESSION_RETENTION_DAYS = 30;
const FORCE_LOGOUT_RETENTION_MS =
  DEVICE_SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const GEOLOCATION_REFRESH_MS = 24 * 60 * 60 * 1000;
const ACTIVE_WINDOW_MS = 15 * 60 * 1000;
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const CITY_COMPARISON_WINDOW_MS = 60 * 60 * 1000;
const NETWORK_COMPARISON_WINDOW_MS = 10 * 60 * 1000;
const GEOLOCATION_TIMEOUT_MS = 1500;

function cleanText(value, maxLength = 120) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeDeviceId(value) {
  const deviceId = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{16,80}$/.test(deviceId) ? deviceId : "";
}

function isPrimaryDeviceAuditAdminIdentity({
  uid = "",
  tokenStudentNumber = "",
  adminClaim = false,
  adminEnabled = false,
  profileExists = false,
  profileStudentNumber = "",
}) {
  return (
    uid === "caremate-2510044" &&
    tokenStudentNumber === "2510044" &&
    adminClaim === true &&
    adminEnabled === true &&
    profileExists === true &&
    profileStudentNumber === "2510044"
  );
}

function normalizeIpCandidate(value) {
  let candidate = String(value || "").trim();

  if (!candidate) return "";

  candidate = candidate.replace(/^for=/i, "").replace(/^"|"$/g, "");

  if (candidate.startsWith("[")) {
    const closingBracket = candidate.indexOf("]");
    if (closingBracket > 0) candidate = candidate.slice(1, closingBracket);
  }

  if (candidate.toLowerCase().startsWith("::ffff:")) {
    const mappedIpv4 = candidate.slice(7);
    if (net.isIP(mappedIpv4) === 4) return mappedIpv4;
  }

  const ipv4WithPort = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort && net.isIP(ipv4WithPort[1]) === 4) {
    return ipv4WithPort[1];
  }

  return net.isIP(candidate) ? candidate : "";
}

function extractClientIp(rawRequest) {
  const forwardedFor = cleanText(
    rawRequest?.headers?.["x-forwarded-for"] ||
      rawRequest?.get?.("x-forwarded-for"),
    500,
  );
  const candidates = [
    forwardedFor.split(",")[0],
    rawRequest?.ip,
    rawRequest?.socket?.remoteAddress,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeIpCandidate(candidate);
    if (normalized) return normalized;
  }

  return "";
}

function expandIpv6Address(ip) {
  if (net.isIP(ip) !== 6) return [];

  const [head = "", tail = ""] = ip.toLowerCase().split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missingParts = Math.max(0, 8 - headParts.length - tailParts.length);

  return [
    ...headParts,
    ...Array(missingParts).fill("0"),
    ...tailParts,
  ].map((part) => part.padStart(4, "0"));
}

function getIpPrivacyValues(ip) {
  if (net.isIP(ip) === 4) {
    const parts = ip.split(".");
    const networkPrefix = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    return {
      maskedIp: `${parts[0]}.${parts[1]}.${parts[2]}.*`,
      networkKey: crypto
        .createHash("sha256")
        .update(networkPrefix)
        .digest("hex")
        .slice(0, 24),
    };
  }

  if (net.isIP(ip) === 6) {
    const expanded = expandIpv6Address(ip);
    const networkPrefix = `${expanded.slice(0, 4).join(":")}::/64`;
    return {
      maskedIp: `${expanded.slice(0, 4).join(":")}:…`,
      networkKey: crypto
        .createHash("sha256")
        .update(networkPrefix)
        .digest("hex")
        .slice(0, 24),
    };
  }

  return { maskedIp: "", networkKey: "" };
}

function isPrivateOrLocalIp(ip) {
  if (net.isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }

  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

function parseVersion(userAgent, expression) {
  const match = userAgent.match(expression);
  return match ? match[1].replace(/_/g, ".") : "";
}

function parseAndroidModel(userAgent) {
  const androidSection = userAgent.match(/\(([^)]*Android[^)]*)\)/i)?.[1] || "";
  const parts = androidSection
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const buildPart = parts.find((part) => /\bBuild\//i.test(part));
  const fallbackPart = parts
    .slice()
    .reverse()
    .find(
      (part) =>
        !/^(Linux|Android\b|wv$|[a-z]{2}(?:[-_][A-Z]{2})?)$/i.test(part),
    );
  const model = cleanText(
    String(buildPart || fallbackPart || "").replace(/\s+Build\/.*$/i, ""),
    80,
  );

  return model && !/^(?:Android|K)$/i.test(model)
    ? model
    : "Android端末（詳細不明）";
}

function parseDeviceInfo(userAgentValue) {
  const userAgent = cleanText(userAgentValue, 500);
  const isIpad = /iPad/i.test(userAgent) || /Macintosh.*Mobile\//i.test(userAgent);
  const isIphone = /iPhone/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  const isChromeOs = /CrOS/i.test(userAgent);
  const isWindows = /Windows NT/i.test(userAgent);
  const isMac = /Macintosh|Mac OS X/i.test(userAgent) && !isIpad;

  let deviceType = "PC";
  let model = "PC（詳細不明）";
  let os = "OS不明";

  if (isIpad) {
    deviceType = "iPad";
    model = "iPad（詳細不明）";
    const version = parseVersion(userAgent, /OS\s([\d_]+)/i);
    os = version ? `iPadOS ${version}` : "iPadOS（詳細不明）";
  } else if (isIphone) {
    deviceType = "iPhone";
    model = "iPhone（詳細不明）";
    const version = parseVersion(userAgent, /OS\s([\d_]+)/i);
    os = version ? `iOS ${version}` : "iOS（詳細不明）";
  } else if (isAndroid) {
    deviceType = "Android";
    model = parseAndroidModel(userAgent);
    const version = parseVersion(userAgent, /Android\s([\d.]+)/i);
    os = version ? `Android ${version}` : "Android（詳細不明）";
  } else if (isChromeOs) {
    const version = parseVersion(userAgent, /CrOS\s[^\s]+\s([\d.]+)/i);
    os = version ? `ChromeOS ${version}` : "ChromeOS";
  } else if (isWindows) {
    const version = parseVersion(userAgent, /Windows NT\s([\d.]+)/i);
    os = version === "10.0" ? "Windows 10/11" : `Windows ${version || ""}`.trim();
  } else if (isMac) {
    const version = parseVersion(userAgent, /Mac OS X\s([\d_]+)/i);
    os = version ? `macOS ${version}` : "macOS（詳細不明）";
  } else if (/Linux/i.test(userAgent)) {
    os = "Linux";
  }

  let browser = "ブラウザ不明";
  const browserCandidates = [
    [/SamsungBrowser\/([\d.]+)/i, "Samsung Internet"],
    [/EdgA?\/([\d.]+)/i, "Microsoft Edge"],
    [/(?:CriOS|Chrome)\/([\d.]+)/i, "Google Chrome"],
    [/(?:FxiOS|Firefox)\/([\d.]+)/i, "Firefox"],
    [/Version\/([\d.]+).*Safari/i, "Safari"],
  ];

  for (const [expression, name] of browserCandidates) {
    const version = parseVersion(userAgent, expression);
    if (version) {
      browser = `${name} ${version}`;
      break;
    }
  }

  return {
    deviceType,
    os: cleanText(os, 80),
    browser: cleanText(browser, 80),
    model: cleanText(model, 80),
    displayName: cleanText(`${model} / ${browser}`, 160),
  };
}

function timestampToMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function shouldForceLogoutSession({
  authTimeMillis,
  deviceRequestedAt = 0,
  allDevicesRequestedAt = 0,
}) {
  const requestedAt = Math.max(
    timestampToMillis(deviceRequestedAt),
    timestampToMillis(allDevicesRequestedAt),
  );
  const authenticatedAt = timestampToMillis(authTimeMillis);

  return requestedAt > 0 && (!authenticatedAt || authenticatedAt <= requestedAt);
}

function shouldRefreshApproximateRegion({
  existing = {},
  networkKey = "",
  hasClientIp = false,
  nowMillis = Date.now(),
}) {
  if (!hasClientIp) return false;

  const networkChanged = Boolean(
    networkKey && existing.networkKey && networkKey !== existing.networkKey,
  );
  const lastAttemptAt = timestampToMillis(
    existing.regionLastAttemptAt || existing.regionLookedUpAt,
  );

  return (
    networkChanged ||
    !lastAttemptAt ||
    nowMillis - lastAttemptAt >= GEOLOCATION_REFRESH_MS
  );
}

function evaluateAccountSharingRisk(devices, nowMillis = Date.now()) {
  const normalizedDevices = devices
    .map((device) => ({
      ...device,
      lastSeenMillis: timestampToMillis(device.lastSeenAt),
    }))
    .filter((device) => device.lastSeenMillis > 0);
  const activeDevices = normalizedDevices.filter(
    (device) => nowMillis - device.lastSeenMillis <= ACTIVE_WINDOW_MS,
  );
  const recentDevices = normalizedDevices.filter(
    (device) => nowMillis - device.lastSeenMillis <= RECENT_WINDOW_MS,
  );
  const comparisonDevices = normalizedDevices.filter(
    (device) => nowMillis - device.lastSeenMillis <= CITY_COMPARISON_WINDOW_MS,
  );
  const reasons = [];

  if (activeDevices.length >= 3) {
    reasons.push(`15分以内に${activeDevices.length}台の端末が利用されています`);
  }

  let cityReason = "";
  let networkReason = "";

  for (let index = 0; index < comparisonDevices.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < comparisonDevices.length; otherIndex += 1) {
      const first = comparisonDevices[index];
      const second = comparisonDevices[otherIndex];
      const timeDifference = Math.abs(first.lastSeenMillis - second.lastSeenMillis);
      const firstCity = cleanText(first.regionCity, 80);
      const secondCity = cleanText(second.regionCity, 80);

      if (
        !cityReason &&
        timeDifference <= CITY_COMPARISON_WINDOW_MS &&
        firstCity &&
        secondCity &&
        firstCity !== secondCity
      ) {
        cityReason = `60分以内に異なる推定市区町村（${firstCity} / ${secondCity}）から利用されています`;
      }

      if (
        !networkReason &&
        timeDifference <= NETWORK_COMPARISON_WINDOW_MS &&
        first.networkKey &&
        second.networkKey &&
        first.networkKey !== second.networkKey
      ) {
        networkReason = "10分以内に異なるネットワークから2台の端末が利用されています";
      }
    }
  }

  if (cityReason) reasons.push(cityReason);
  if (networkReason) reasons.push(networkReason);

  return {
    level: reasons.length ? "review" : "normal",
    reasons,
    deviceCount: devices.length,
    activeDeviceCount: activeDevices.length,
    recentDeviceCount: recentDevices.length,
  };
}

function createUnknownRegion(status = "unavailable") {
  return {
    country: "",
    countryCode: "",
    region: "",
    city: "",
    status,
    provider: "ipwhois.io",
  };
}

async function fetchApproximateRegion(ip) {
  if (!ip || isPrivateOrLocalIp(ip)) return createUnknownRegion("unavailable");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEOLOCATION_TIMEOUT_MS);

  try {
    const url =
      `https://ipwho.is/${encodeURIComponent(ip)}` +
      "?fields=success,country,country_code,region,city&lang=ja";
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });

    if (!response.ok) return createUnknownRegion("service-error");

    const data = await response.json();
    if (data?.success !== true) return createUnknownRegion("not-found");

    const region = {
      country: cleanText(data.country, 80),
      countryCode: cleanText(data.country_code, 8),
      region: cleanText(data.region, 80),
      city: cleanText(data.city, 80),
      status: "estimated",
      provider: "ipwhois.io",
    };

    return region.country || region.region || region.city
      ? region
      : createUnknownRegion("not-found");
  } catch {
    return createUnknownRegion("service-error");
  } finally {
    clearTimeout(timeout);
  }
}

function createDeviceSessionStore(db, FieldValue) {
  const rootCollection = db.collection("userDeviceSessions");
  const accessCollection = db.collection("userDeviceAccess");
  const geolocationCache = db.collection("ipGeolocationCache");

  function getDeviceAccessRef(studentNumber, deviceId) {
    return accessCollection
      .doc(studentNumber)
      .collection("logoutRequests")
      .doc(deviceId);
  }

  async function readForceLogoutState(studentNumber, deviceId, authTimeMillis) {
    const [allDevicesSnapshot, deviceSnapshot] = await Promise.all([
      accessCollection.doc(studentNumber).get(),
      getDeviceAccessRef(studentNumber, deviceId).get(),
    ]);
    const allDevicesRequestedAt = timestampToMillis(
      allDevicesSnapshot.data()?.forceLogoutRequestedAt,
    );
    const deviceRequestedAt = timestampToMillis(
      deviceSnapshot.data()?.forceLogoutRequestedAt,
    );

    return {
      forceLogout: shouldForceLogoutSession({
        authTimeMillis,
        deviceRequestedAt,
        allDevicesRequestedAt,
      }),
      requestedAt: Math.max(deviceRequestedAt, allDevicesRequestedAt),
    };
  }

  async function checkDeviceLogout(studentNumber, rawDeviceId, authTimeMillis) {
    const deviceId = normalizeDeviceId(rawDeviceId);
    if (!deviceId) return { forceLogout: false };

    const deviceSnapshot = await rootCollection
      .doc(studentNumber)
      .collection("loginDevices")
      .doc(deviceId)
      .get();
    if (!deviceSnapshot.exists) return { forceLogout: false };

    return readForceLogoutState(studentNumber, deviceId, authTimeMillis);
  }

  async function getApproximateRegion(ip) {
    if (!ip) return createUnknownRegion("unavailable");

    const cacheId = crypto.createHash("sha256").update(ip).digest("hex");
    const cacheRef = geolocationCache.doc(cacheId);

    try {
      const cacheSnapshot = await cacheRef.get();
      if (
        cacheSnapshot.exists &&
        timestampToMillis(cacheSnapshot.data()?.expiresAt) > Date.now()
      ) {
        return cacheSnapshot.data().region || createUnknownRegion("not-found");
      }
    } catch (error) {
      console.warn("IP推定地域キャッシュ取得失敗:", error?.message || "unknown");
    }

    const region = await fetchApproximateRegion(ip);

    try {
      await cacheRef.set({
        region,
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + GEOLOCATION_REFRESH_MS),
      });
    } catch (error) {
      console.warn("IP推定地域キャッシュ保存失敗:", error?.message || "unknown");
    }

    return region;
  }

  async function readDevices(studentNumber) {
    const snapshot = await rootCollection
      .doc(studentNumber)
      .collection("loginDevices")
      .get();
    return snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    }));
  }

  async function refreshRiskSummary(studentNumber) {
    const devices = await readDevices(studentNumber);
    const risk = evaluateAccountSharingRisk(devices);

    await rootCollection.doc(studentNumber).set(
      {
        studentNumber,
        ...risk,
        riskEvaluatedAt: new Date(),
        updatedAt: new Date(),
      },
      { merge: true },
    );

    return risk;
  }

  async function recordDeviceSession({
    studentNumber,
    deviceId: rawDeviceId,
    rawRequest,
    eventType = "activity",
    authTimeMillis = 0,
  }) {
    const deviceId = normalizeDeviceId(rawDeviceId);
    if (!deviceId) return { recorded: false, reason: "invalid-device-id" };

    const clientIp = extractClientIp(rawRequest);
    const { maskedIp, networkKey } = getIpPrivacyValues(clientIp);
    const userAgent =
      rawRequest?.headers?.["user-agent"] || rawRequest?.get?.("user-agent") || "";
    const deviceInfo = parseDeviceInfo(userAgent);
    const deviceRef = rootCollection
      .doc(studentNumber)
      .collection("loginDevices")
      .doc(deviceId);
    const [existingSnapshot, forceLogoutState] = await Promise.all([
      deviceRef.get(),
      readForceLogoutState(studentNumber, deviceId, authTimeMillis),
    ]);

    if (forceLogoutState.forceLogout) {
      return {
        recorded: false,
        forceLogout: true,
        forceLogoutRequestedAt: forceLogoutState.requestedAt,
      };
    }

    const existing = existingSnapshot.data() || {};
    const now = new Date();
    const shouldRefreshRegion = shouldRefreshApproximateRegion({
      existing,
      networkKey,
      hasClientIp: Boolean(clientIp),
      nowMillis: now.getTime(),
    });
    const region = shouldRefreshRegion
      ? await getApproximateRegion(clientIp)
      : null;
    const regionSucceeded = region?.status === "estimated";
    const data = {
      studentNumber,
      deviceId,
      ...deviceInfo,
      maskedIp: maskedIp || existing.maskedIp || "不明",
      networkKey: networkKey || existing.networkKey || "",
      lastSeenAt: now,
      expiresAt: new Date(
        now.getTime() + DEVICE_SESSION_RETENTION_DAYS * 86400000,
      ),
      updatedAt: now,
    };

    if (timestampToMillis(authTimeMillis) > 0) {
      data.lastAuthenticatedAt = new Date(timestampToMillis(authTimeMillis));
    }

    const previousIpUpdatedAt = timestampToMillis(existing.ipUpdatedAt);
    if (
      maskedIp &&
      (maskedIp !== existing.maskedIp ||
        !previousIpUpdatedAt ||
        now.getTime() - previousIpUpdatedAt >= GEOLOCATION_REFRESH_MS)
    ) {
      data.ipUpdatedAt = now;
    }

    if (shouldRefreshRegion) {
      data.regionLastAttemptAt = now;
      data.regionLastAttemptStatus = region?.status || "service-error";

      // 外部サービスの失敗時は、直前に取得できた推定地域を消さない。
      if (regionSucceeded) {
        data.regionCountry = region.country;
        data.regionCountryCode = region.countryCode;
        data.regionName = region.region;
        data.regionCity = region.city;
        data.regionStatus = region.status;
        data.regionProvider = region.provider;
        data.regionLookedUpAt = now;
      } else if (!existingSnapshot.exists) {
        data.regionCountry = "";
        data.regionCountryCode = "";
        data.regionName = "";
        data.regionCity = "";
        data.regionStatus = region?.status || "unavailable";
        data.regionProvider = region?.provider || "ipwhois.io";
      }
    }

    if (!existingSnapshot.exists) data.firstSeenAt = now;
    if (eventType === "login") {
      data.lastLoginAt = now;
      data.loginCount = FieldValue.increment(1);
    }

    await deviceRef.set(data, { merge: true });
    const risk = await refreshRiskSummary(studentNumber);
    return { recorded: true, risk };
  }

  function serializeDevice(
    device,
    nowMillis = Date.now(),
    forceLogoutRequestedAt = 0,
  ) {
    const lastSeenAt = timestampToMillis(device.lastSeenAt);
    const age = lastSeenAt ? nowMillis - lastSeenAt : Number.POSITIVE_INFINITY;
    const state =
      age <= ACTIVE_WINDOW_MS
        ? "active"
        : age <= RECENT_WINDOW_MS
          ? "recent"
          : "history";

    const lastAuthenticatedAt = timestampToMillis(
      device.lastAuthenticatedAt || device.lastLoginAt || device.firstSeenAt,
    );
    const normalizedForceLogoutRequestedAt = timestampToMillis(
      forceLogoutRequestedAt,
    );

    return {
      id: device.id,
      deviceId: device.id,
      displayName: cleanText(device.displayName, 160),
      deviceType: cleanText(device.deviceType, 40),
      model: cleanText(device.model, 80),
      os: cleanText(device.os, 80),
      browser: cleanText(device.browser, 80),
      maskedIp: cleanText(device.maskedIp, 80) || "不明",
      regionCountry: cleanText(device.regionCountry, 80),
      regionName: cleanText(device.regionName, 80),
      regionCity: cleanText(device.regionCity, 80),
      regionStatus: cleanText(device.regionStatus, 40),
      state,
      firstSeenAt: timestampToMillis(device.firstSeenAt),
      lastSeenAt,
      lastLoginAt: timestampToMillis(device.lastLoginAt),
      lastAuthenticatedAt,
      forceLogoutRequestedAt: normalizedForceLogoutRequestedAt,
      forceLogoutPending: shouldForceLogoutSession({
        authTimeMillis: lastAuthenticatedAt,
        deviceRequestedAt: normalizedForceLogoutRequestedAt,
      }),
      ipUpdatedAt: timestampToMillis(device.ipUpdatedAt),
      regionLookedUpAt: timestampToMillis(device.regionLookedUpAt),
      regionLastAttemptAt: timestampToMillis(device.regionLastAttemptAt),
      regionLastAttemptStatus: cleanText(
        device.regionLastAttemptStatus,
        40,
      ),
      expiresAt: timestampToMillis(device.expiresAt),
      loginCount: Number(device.loginCount || 0),
    };
  }

  async function listUserDevices(studentNumber) {
    const [devices, allDevicesSnapshot, deviceRequestsSnapshot] =
      await Promise.all([
        readDevices(studentNumber),
        accessCollection.doc(studentNumber).get(),
        accessCollection
          .doc(studentNumber)
          .collection("logoutRequests")
          .get(),
      ]);
    const risk = evaluateAccountSharingRisk(devices);
    const allDevicesRequestedAt = timestampToMillis(
      allDevicesSnapshot.data()?.forceLogoutRequestedAt,
    );
    const deviceRequests = new Map(
      deviceRequestsSnapshot.docs.map((document) => [
        document.id,
        timestampToMillis(document.data()?.forceLogoutRequestedAt),
      ]),
    );

    return {
      devices: devices
        .map((device) =>
          serializeDevice(
            device,
            Date.now(),
            Math.max(
              allDevicesRequestedAt,
              deviceRequests.get(device.id) || 0,
            ),
          ),
        )
        .sort((first, second) => second.lastSeenAt - first.lastSeenAt),
      risk,
      retentionDays: DEVICE_SESSION_RETENTION_DAYS,
      allDevicesForceLogoutRequestedAt: allDevicesRequestedAt,
    };
  }

  async function requestDeviceLogout(studentNumber, rawDeviceId) {
    const deviceId = normalizeDeviceId(rawDeviceId);
    if (!deviceId) throw new Error("invalid-device-id");

    const deviceRef = rootCollection
      .doc(studentNumber)
      .collection("loginDevices")
      .doc(deviceId);
    const deviceSnapshot = await deviceRef.get();
    if (!deviceSnapshot.exists) return { requested: false, reason: "not-found" };

    const now = new Date();
    await getDeviceAccessRef(studentNumber, deviceId).set({
      studentNumber,
      deviceId,
      forceLogoutRequestedAt: now,
      expiresAt: new Date(now.getTime() + FORCE_LOGOUT_RETENTION_MS),
      updatedAt: now,
    });

    return { requested: true, requestedAt: now.getTime() };
  }

  async function requestAllDevicesLogout(studentNumber) {
    const now = new Date();
    await accessCollection.doc(studentNumber).set(
      {
        studentNumber,
        forceLogoutRequestedAt: now,
        expiresAt: new Date(now.getTime() + FORCE_LOGOUT_RETENTION_MS),
        updatedAt: now,
      },
      { merge: true },
    );

    return { requested: true, requestedAt: now.getTime() };
  }

  async function deleteUserDevice(studentNumber, rawDeviceId) {
    const deviceId = normalizeDeviceId(rawDeviceId);
    if (!deviceId) throw new Error("invalid-device-id");

    await Promise.all([
      rootCollection
        .doc(studentNumber)
        .collection("loginDevices")
        .doc(deviceId)
        .delete(),
      getDeviceAccessRef(studentNumber, deviceId).delete(),
    ]);
    const risk = await refreshRiskSummary(studentNumber);
    return { deleted: true, risk };
  }

  async function listRiskSummaries() {
    const snapshot = await rootCollection.get();
    return snapshot.docs.map((document) => {
      const data = document.data() || {};
      return {
        studentNumber: document.id,
        level: data.level === "review" ? "review" : "normal",
        reasons: Array.isArray(data.reasons)
          ? data.reasons.map((reason) => cleanText(reason, 180)).slice(0, 3)
          : [],
        deviceCount: Number(data.deviceCount || 0),
        activeDeviceCount: Number(data.activeDeviceCount || 0),
        recentDeviceCount: Number(data.recentDeviceCount || 0),
        riskEvaluatedAt: timestampToMillis(data.riskEvaluatedAt),
      };
    });
  }

  async function cleanupExpiredRecords() {
    const now = new Date();
    const expiredDevices = await db
      .collectionGroup("loginDevices")
      .where("expiresAt", "<=", now)
      .limit(400)
      .get();
    const expiredCache = await geolocationCache
      .where("expiresAt", "<=", now)
      .limit(400)
      .get();
    const expiredAllDeviceRequests = await accessCollection
      .where("expiresAt", "<=", now)
      .limit(400)
      .get();
    const expiredDeviceRequests = await db
      .collectionGroup("logoutRequests")
      .where("expiresAt", "<=", now)
      .limit(400)
      .get();
    const affectedStudents = new Set();
    const deletionReferences = [];

    expiredDevices.docs.forEach((document) => {
      const studentDocument = document.ref.parent.parent;
      if (studentDocument) {
        affectedStudents.add(studentDocument.id);
        deletionReferences.push(
          getDeviceAccessRef(studentDocument.id, document.id),
        );
      }
      deletionReferences.push(document.ref);
    });
    expiredCache.docs.forEach((document) =>
      deletionReferences.push(document.ref),
    );
    expiredAllDeviceRequests.docs.forEach((document) =>
      deletionReferences.push(document.ref),
    );
    expiredDeviceRequests.docs.forEach((document) =>
      deletionReferences.push(document.ref),
    );

    const uniqueDeletionReferences = [
      ...new Map(
        deletionReferences.map((reference) => [reference.path, reference]),
      ).values(),
    ];

    for (let index = 0; index < uniqueDeletionReferences.length; index += 400) {
      const batch = db.batch();
      uniqueDeletionReferences
        .slice(index, index + 400)
        .forEach((reference) => batch.delete(reference));
      await batch.commit();
    }

    await Promise.all(
      [...affectedStudents].map((studentNumber) =>
        refreshRiskSummary(studentNumber),
      ),
    );

    return {
      devicesDeleted: expiredDevices.size,
      cacheEntriesDeleted: expiredCache.size,
      logoutRequestsDeleted:
        expiredAllDeviceRequests.size + expiredDeviceRequests.size,
    };
  }

  return {
    recordDeviceSession,
    checkDeviceLogout,
    listUserDevices,
    deleteUserDevice,
    requestDeviceLogout,
    requestAllDevicesLogout,
    listRiskSummaries,
    cleanupExpiredRecords,
  };
}

module.exports = {
  DEVICE_SESSION_RETENTION_DAYS,
  normalizeDeviceId,
  isPrimaryDeviceAuditAdminIdentity,
  extractClientIp,
  getIpPrivacyValues,
  parseDeviceInfo,
  evaluateAccountSharingRisk,
  shouldRefreshApproximateRegion,
  shouldForceLogoutSession,
  fetchApproximateRegion,
  createDeviceSessionStore,
};
