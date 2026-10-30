import { getApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

const PUBLIC = new Set(["authenticateCareMate", "redeemEntrancePhrase"]);
const ENDPOINT = "https://caremate-auth.onrender.com/api/";
const HEALTH_ENDPOINT = "https://caremate-auth.onrender.com/health";
let readyUntil = 0;
let warming;

// Start only when the login UI is opened, never periodically or on the public
// service-ended page. This overlaps cold startup with typing the credentials.
export async function warmCareMateBackend() {
  if (Date.now() < readyUntil) return true;
  if (warming) return warming;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  warming = (async () => {
    const response = await fetch(HEALTH_ENDPOINT, {
      signal: controller.signal, credentials: "omit", cache: "no-store",
      redirect: "error", referrerPolicy: "no-referrer",
    });
    if (!response.ok || (await response.json()).ready !== true) {
      throw new Error("Authentication service is not ready");
    }
    readyUntil = Date.now() + 120_000;
    return true;
  })().finally(() => {
    clearTimeout(timeout);
    warming = undefined;
  });
  return warming;
}

// Preserve the existing callable result/error shape without depending on
// billable Cloud Functions. The fixed HTTPS endpoint cannot be overridden by
// URL parameters or localStorage.
export async function callCareMate(name, data = {}) {
  if (!/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(name)) throw new TypeError("Invalid operation");
  const headers = { "Content-Type": "application/json" };
  if (!PUBLIC.has(name)) {
    const auth = getAuth(getApp());
    await auth.authStateReady();
    if (!auth.currentUser) throw Object.assign(new Error("ログインが必要です。"), { code: "functions/unauthenticated" });
    headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
  }
  const controller = new AbortController();
  // Send the real request immediately. Render queues it while a free instance
  // wakes, so waiting for a separate health probe first only adds latency and
  // previously allowed an aborted warm-up to cancel an otherwise valid login.
  // Never retry writes automatically; a retry could issue or consume data twice.
  const timeout = setTimeout(() => controller.abort(), 75_000);
  try {
    const response = await fetch(ENDPOINT + name, {
      method: "POST", headers, body: JSON.stringify({ data }),
      signal: controller.signal, credentials: "omit", cache: "no-store",
      redirect: "error", referrerPolicy: "no-referrer",
    });
    readyUntil = Date.now() + 120_000;
    let payload;
    try { payload = await response.json(); }
    catch { throw Object.assign(new Error("認証サービスを起動中です。しばらくしてからお試しください。"), { code: "functions/unavailable" }); }
    if (!response.ok || payload.error) {
      const code = String(payload.error?.status || "internal");
      throw Object.assign(new Error(String(payload.error?.message || "操作できませんでした。")), { code: `functions/${code}` });
    }
    return { data: payload.data };
  } catch (error) {
    if (error?.name === "AbortError") throw Object.assign(new Error("認証サービスの起動に時間がかかっています。もう一度お試しください。"), { code: "functions/deadline-exceeded" });
    throw error;
  } finally { clearTimeout(timeout); }
}
