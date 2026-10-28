import { getApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

const PUBLIC = new Set(["authenticateCareMate", "redeemEntrancePhrase"]);
const ENDPOINT = "https://caremate-auth.onrender.com/api/";
let readyUntil = 0;
let warming;

async function ensureReady(signal) {
  if (Date.now() < readyUntil) return;
  if (!warming) warming = (async () => {
    while (!signal.aborted) {
      try {
        const response = await fetch("https://caremate-auth.onrender.com/health", {
          signal, credentials: "omit", cache: "no-store", redirect: "error",
          referrerPolicy: "no-referrer",
        });
        if (response.ok && (await response.json()).ready === true) {
          readyUntil = Date.now() + 120_000;
          return;
        }
      } catch (error) { if (signal.aborted) throw error; }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    throw new DOMException("Startup timed out", "AbortError");
  })().finally(() => { warming = undefined; });
  await warming;
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
  // Free instances can require about one minute to wake. Retrying writes
  // automatically could issue a phrase or create an account twice.
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    // Only retry a read-only health request while a free instance wakes up.
    // The actual operation is sent exactly once, after the instance is ready.
    await ensureReady(controller.signal);
    const response = await fetch(ENDPOINT + name, {
      method: "POST", headers, body: JSON.stringify({ data }),
      signal: controller.signal, credentials: "omit", cache: "no-store",
      redirect: "error", referrerPolicy: "no-referrer",
    });
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
