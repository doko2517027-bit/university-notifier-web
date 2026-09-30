import {
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

export const WEB_PUSH_PUBLIC_KEY =
  "BJk2fKTmfe7AZuXjW-IGMDyis_zN0iZ1B0oiG5MVefZ4n3W9mrBu-xBiWYjG_V6U2b5sGMuVXvKTbrwRKXSAiUs";

const PUSH_RENEWAL_STORAGE_KEY = "careMatePushRenewalVersion";
const PUSH_RENEWAL_VERSION = "20260924";
const PUSH_PERMISSION_PROMPT_SESSION_KEY =
  "careMatePushPermissionPromptShown";

function ensurePushPermissionDialogStyles() {
  if (document.getElementById("careMatePushPermissionDialogStyles")) return;

  const style = document.createElement("style");
  style.id = "careMatePushPermissionDialogStyles";
  style.textContent = `
    .push-permission-overlay {
      position: fixed;
      inset: 0;
      z-index: 50000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(15, 23, 42, .62);
      backdrop-filter: blur(7px);
      -webkit-backdrop-filter: blur(7px);
    }
    .push-permission-card {
      width: min(430px, 100%);
      box-sizing: border-box;
      padding: 28px 22px 22px;
      border: 1px solid var(--border, #d8e1e6);
      border-radius: 24px;
      background: var(--card, #fff);
      color: var(--text, #13213b);
      box-shadow: 0 24px 70px rgba(15, 23, 42, .3);
      text-align: center;
    }
    .push-permission-icon {
      display: grid;
      place-items: center;
      width: 68px;
      height: 68px;
      margin: 0 auto 14px;
      border-radius: 20px;
      background: color-mix(in srgb, var(--primary, #2563eb) 13%, transparent);
      font-size: 34px;
    }
    .push-permission-card h2 {
      margin: 0 0 12px;
      font-size: clamp(1.25rem, 4vw, 1.55rem);
      line-height: 1.35;
    }
    .push-permission-card p {
      margin: 0 0 12px;
      color: var(--subtext, #526174);
      line-height: 1.7;
      text-align: left;
    }
    .push-permission-note {
      padding: 12px 14px;
      border-radius: 14px;
      background: color-mix(in srgb, var(--primary, #2563eb) 8%, transparent);
      font-size: .92rem;
    }
    .push-permission-confirm {
      width: 100%;
      min-height: 48px;
      margin-top: 8px;
      border: 0;
      border-radius: 14px;
      background: var(--primary, #2563eb);
      color: #fff;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }
    .push-permission-confirm:disabled { opacity: .65; cursor: wait; }
  `;
  document.head.appendChild(style);
}

function showPushPermissionDialog({ title, message, note = "", buttonText, action }) {
  ensurePushPermissionDialogStyles();

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "push-permission-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "pushPermissionDialogTitle");
    overlay.innerHTML = `
      <section class="push-permission-card">
        <div class="push-permission-icon" aria-hidden="true">🔔</div>
        <h2 id="pushPermissionDialogTitle">${title}</h2>
        <p>${message}</p>
        ${note ? `<p class="push-permission-note">${note}</p>` : ""}
        <button type="button" class="push-permission-confirm">${buttonText}</button>
      </section>
    `;

    const button = overlay.querySelector(".push-permission-confirm");
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        resolve(await action());
      } catch (error) {
        console.warn("通知許可処理エラー:", error);
        resolve("error");
      } finally {
        overlay.remove();
      }
    });

    document.body.appendChild(overlay);
    button.focus();
  });
}

async function showPushPermissionUnavailable(permission) {
  const blocked = permission === "denied";
  return showPushPermissionDialog({
    title: blocked ? "通知がオフになっています" : "通知を設定できませんでした",
    message: blocked
      ? "「許可しない」が選択されているため、授業開始・課題締切・時間割変更・大学メールなどの大切な通知は届きません。"
      : "この端末または現在の開き方では、Push通知を利用できません。",
    note: blocked
      ? "端末の「設定」→「通知」→「CareMate」から通知を許可してください。"
      : "iPhone / iPadではCareMateをホーム画面に追加し、アプリとして開いてください。",
    buttonText: "確認しました",
    action: () => permission,
  });
}

export async function requestPushPermissionWithEducation({ force = false } = {}) {
  if (
    !force &&
    sessionStorage.getItem(PUSH_PERMISSION_PROMPT_SESSION_KEY) === "true"
  ) {
    return "Notification" in window ? Notification.permission : "unsupported";
  }

  if (!("Notification" in window)) {
    await showPushPermissionUnavailable("unsupported");
    sessionStorage.setItem(PUSH_PERMISSION_PROMPT_SESSION_KEY, "true");
    return "unsupported";
  }

  if (Notification.permission === "granted") return "granted";

  if (Notification.permission === "denied") {
    await showPushPermissionUnavailable("denied");
    sessionStorage.setItem(PUSH_PERMISSION_PROMPT_SESSION_KEY, "true");
    return "denied";
  }

  const permission = await showPushPermissionDialog({
    title: "大切なお知らせを受け取るために",
    message:
      "CareMateは、授業の打刻、課題の締切、時間割の変更、大学メールなど、見逃せない情報をPush通知でお知らせします。",
    note:
      "次に表示される端末の確認画面で「許可」を選んでください。",
    buttonText: "通知を許可する",
    action: () => Notification.requestPermission(),
  });

  if (permission !== "granted") {
    await showPushPermissionUnavailable(permission);
  }

  sessionStorage.setItem(PUSH_PERMISSION_PROMPT_SESSION_KEY, "true");
  return permission;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);

  return Uint8Array.from(
    [...rawData].map((character) => character.charCodeAt(0)),
  );
}

function applicationServerKeyMatches(subscription) {
  const currentKey = subscription?.options?.applicationServerKey;

  if (!currentKey) return true;

  const expected = urlBase64ToUint8Array(WEB_PUSH_PUBLIC_KEY);
  const current = new Uint8Array(currentKey);

  return (
    current.length === expected.length &&
    current.every((value, index) => value === expected[index])
  );
}

async function makeDeviceId(endpoint) {
  const bytes = new TextEncoder().encode(endpoint);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function ensurePushSubscription(
  serviceWorkerPath = "/university-notifier-web/sw.js",
) {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    throw new Error("この端末はWeb Pushに対応していません。");
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("通知が許可されていません。");
  }

  const registration =
    await navigator.serviceWorker.register(serviceWorkerPath);
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();

  // 失効した古い購読を、既存利用者がアプリを開いた時に一度だけ更新する。
  if (
    subscription &&
    (!applicationServerKeyMatches(subscription) ||
      localStorage.getItem(PUSH_RENEWAL_STORAGE_KEY) !== PUSH_RENEWAL_VERSION)
  ) {
    await subscription.unsubscribe();
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(WEB_PUSH_PUBLIC_KEY),
    });
  }

  localStorage.setItem(PUSH_RENEWAL_STORAGE_KEY, PUSH_RENEWAL_VERSION);

  return subscription;
}

export async function savePushSubscription(
  db,
  userId,
  subscription,
  source = "unknown",
) {
  const subscriptionData = subscription.toJSON();
  const deviceId = await makeDeviceId(subscriptionData.endpoint);

  await setDoc(
    doc(db, "users", userId, "pushSubscriptions", deviceId),
    {
      endpoint: subscriptionData.endpoint,
      expirationTime: subscriptionData.expirationTime || null,
      keys: {
        p256dh: subscriptionData.keys?.p256dh || "",
        auth: subscriptionData.keys?.auth || "",
      },
      source,
      userAgent: navigator.userAgent,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return { subscription, deviceId };
}

export async function registerDevicePushSubscription(
  db,
  userId,
  source = "unknown",
  serviceWorkerPath = "/university-notifier-web/sw.js",
) {
  const subscription = await ensurePushSubscription(serviceWorkerPath);
  return savePushSubscription(db, userId, subscription, source);
}
