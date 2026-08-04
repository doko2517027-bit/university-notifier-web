import {
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

export const WEB_PUSH_PUBLIC_KEY =
    "BJk2fKTmfe7AZuXjW-IGMDyis_zN0iZ1B0oiG5MVefZ4n3W9mrBu-xBiWYjG_V6U2b5sGMuVXvKTbrwRKXSAiUs";

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    const rawData = atob(base64);

    return Uint8Array.from(
        [...rawData].map(character => character.charCodeAt(0))
    );
}

function applicationServerKeyMatches(subscription) {
    const currentKey = subscription?.options?.applicationServerKey;

    if (!currentKey) return true;

    const expected = urlBase64ToUint8Array(WEB_PUSH_PUBLIC_KEY);
    const current = new Uint8Array(currentKey);

    return current.length === expected.length &&
        current.every((value, index) => value === expected[index]);
}

async function makeDeviceId(endpoint) {
    const bytes = new TextEncoder().encode(endpoint);
    const digest = await crypto.subtle.digest("SHA-256", bytes);

    return [...new Uint8Array(digest)]
        .map(value => value.toString(16).padStart(2, "0"))
        .join("");
}

export async function ensurePushSubscription(
    serviceWorkerPath = "/university-notifier-web/sw.js"
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

    const registration = await navigator.serviceWorker.register(
        serviceWorkerPath
    );
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();

    // 出席管理で以前使っていた別の鍵の購読だけを、この端末上で更新する。
    if (subscription && !applicationServerKeyMatches(subscription)) {
        await subscription.unsubscribe();
        subscription = null;
    }

    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey:
                urlBase64ToUint8Array(WEB_PUSH_PUBLIC_KEY)
        });
    }

    return subscription;
}

export async function savePushSubscription(
    db,
    userId,
    subscription,
    source = "unknown"
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
                auth: subscriptionData.keys?.auth || ""
            },
            source,
            userAgent: navigator.userAgent,
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );

    return { subscription, deviceId };
}

export async function registerDevicePushSubscription(
    db,
    userId,
    source = "unknown",
    serviceWorkerPath = "/university-notifier-web/sw.js"
) {
    const subscription = await ensurePushSubscription(serviceWorkerPath);
    return savePushSubscription(db, userId, subscription, source);
}
