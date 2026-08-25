/* ========================================
   CareMate Service Worker
   高速表示・Push通知・通知タップ処理
======================================== */

/*
Service Workerを更新した時は
この数字を1つ上げる。

例
caremate-static-v1
↓
caremate-static-v2
*/
const STATIC_CACHE = "caremate-static-v6";

const RUNTIME_CACHE = "caremate-runtime-v6";

const CACHE_NAMES = [STATIC_CACHE, RUNTIME_CACHE];

/*
確実に存在する主要ファイルだけ
先にキャッシュする。

1ファイル失敗しただけで
Service Worker全体のinstallを
失敗させないよう個別取得する。
*/
const CORE_ASSETS = [
  "./",

  "index.html",

  "style.css",

  "app.js",

  "common.js",

  "personal_timetable_data.js",

  "class_selection.js",

  "manifest.json",

  "version.js",

  "images/default.png",

  "icon-192.png",
];

/* ========================================
   Service Worker更新
======================================== */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);

      /*
                    addAll()では、
                    1個404になると全部失敗するため
                    個別にキャッシュする。
                    */
      await Promise.allSettled(
        CORE_ASSETS.map(async (asset) => {
          try {
            await cache.add(
              new Request(asset, {
                cache: "reload",
              }),
            );
          } catch (error) {
            console.warn("事前キャッシュ失敗:", asset, error);
          }
        }),
      );

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      /*
                    古いCareMateキャッシュを削除。
                    */
      const cacheKeys = await caches.keys();

      await Promise.all(
        cacheKeys.map((cacheName) => {
          const isCareMateCache = cacheName.startsWith("caremate-");

          const isCurrentCache = CACHE_NAMES.includes(cacheName);

          if (isCareMateCache && !isCurrentCache) {
            return caches.delete(cacheName);
          }

          return Promise.resolve();
        }),
      );

      /*
                    navigation preload対応ブラウザでは
                    Service Worker起動中にも
                    HTML通信を先行させる。
                    */
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch (error) {
          console.warn("Navigation Preload有効化失敗:", error);
        }
      }

      await self.clients.claim();
    })(),
  );
});

/* ========================================
   高速キャッシュ
======================================== */

self.addEventListener("fetch", (event) => {
  const request = event.request;

  /*
        GET以外は絶対に触らない。

        Firestore更新
        ログイン
        POST
        Functions
        などを壊さないため。
        */
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  /*
        CareMateと同じorigin以外は
        Service Workerキャッシュ対象外。

        Firebase
        Open-Meteo
        Google
        などは常に本来の通信を使う。
        */
  if (url.origin !== self.location.origin) {
    return;
  }

  /*
        HTMLページ遷移。
        最新版を最優先する。
        */
  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(event));

    return;
  }

  /*
        CSS / JS / 画像 / manifest等。

        まずキャッシュを即表示し、
        裏で最新版を取得する。
        */
  if (isStaticAsset(request, url)) {
    event.respondWith(handleStaticRequest(request));
  }
});

/*
HTMLは

最新ネットワーク
↓
失敗した時だけキャッシュ

にする。

古い時間割や画面を
通常時に優先表示しない。
*/
async function handleNavigationRequest(event) {
  const request = event.request;

  try {
    /*
        activateでNavigation Preloadが
        有効なら先に始まっている通信を使用。
        */
    const preloadResponse = await event.preloadResponse;

    if (preloadResponse) {
      const cache = await caches.open(RUNTIME_CACHE);

      cache.put(request, preloadResponse.clone());

      return preloadResponse;
    }

    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);

      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    /*
        オフライン等の場合だけ
        保存済みHTMLを使う。
        */
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    /*
        URLパラメータ付きindex等で
        完全一致しなかった時の保険。
        */
    const fallback = await caches.match("index.html");

    if (fallback) {
      return fallback;
    }

    throw error;
  }
}

/*
JS/CSS/画像は

キャッシュ即返却
＋
裏で最新版取得

Stale While Revalidate方式。
*/
async function handleStaticRequest(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  const cachedResponse = await caches.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }

      return response;
    })
    .catch((error) => {
      if (!cachedResponse) {
        throw error;
      }

      return null;
    });

  /*
    キャッシュがあるなら
    ネットワークを待たず即返す。
    */
  if (cachedResponse) {
    /*
        Promise自体は走り続けるので
        次回用キャッシュが更新される。
        */
    return cachedResponse;
  }

  return networkPromise;
}

/*
キャッシュしてよい
静的ファイルだけ判定。
*/
function isStaticAsset(request, url) {
  if (
    ["script", "style", "image", "font", "manifest"].includes(
      request.destination,
    )
  ) {
    return true;
  }

  return /\.(?:js|css|png|jpg|jpeg|webp|svg|gif|ico|json)$/i.test(url.pathname);
}

/* ========================================
   Push通知受信
======================================== */

self.addEventListener("push", (event) => {
  event.waitUntil(handlePushEvent(event));
});

/**
 * Push通知を表示する。
 */
async function handlePushEvent(event) {
  const data = readPushData(event);

  const notificationType = resolveNotificationType(data);

  const targetUrl = createAttendanceTargetUrl(data, notificationType);

  const actions = createNotificationActions(notificationType);

  const title = data.title || getDefaultTitle(notificationType);

  const body = data.body || getDefaultBody(notificationType);

  const tag = data.tag || createNotificationTag(data, notificationType);

  const options = {
    body,

    icon: data.icon || "/icon-192.png",

    badge: data.badge || "/icon-192.png",

    tag,

    renotify: Boolean(tag),

    requireInteraction: true,

    timestamp: Date.now(),

    actions,

    data: {
      url: targetUrl.href,

      notificationType,

      defaultAction: getDefaultAction(notificationType),

      subject: normalizeText(data.subject),

      period: normalizePeriod(data.period),

      date: normalizeDate(data.date || data.attendanceDate),

      expiresAt: normalizeText(data.expiresAt),
    },
  };

  await self.registration.showNotification(title, options);
}

/* ========================================
   Pushデータ取得
======================================== */

/**
 * Pushデータを安全に読み込む。
 */
function readPushData(event) {
  if (!event.data) {
    return {};
  }

  try {
    const json = event.data.json();

    if (json && typeof json === "object") {
      return json;
    }
  } catch (error) {
    console.warn("Push JSON取得失敗:", error);
  }

  try {
    const text = event.data.text();

    return {
      title: "CareMate",

      body: text,
    };
  } catch (error) {
    console.warn("Pushテキスト取得失敗:", error);

    return {};
  }
}

/* ========================================
   通知種類
======================================== */

/**
 * 通知種類を決める。
 *
 * start
 * 講義開始10分前通知
 *
 * end
 * 講義終了5分前通知
 */
function resolveNotificationType(data) {
  const directValue = normalizeText(
    data.notificationType || data.attendanceType || data.type || data.action,
  ).toLowerCase();

  if (["start", "arrival", "attendance", "present"].includes(directValue)) {
    return "start";
  }

  if (["end", "finish", "departure"].includes(directValue)) {
    return "end";
  }

  const rawUrl = normalizeText(data.url);

  if (rawUrl) {
    try {
      const url = new URL(rawUrl, self.location.origin);

      const urlAction = normalizeText(
        url.searchParams.get("action"),
      ).toLowerCase();

      if (["start", "arrival", "attendance", "present"].includes(urlAction)) {
        return "start";
      }

      if (["end", "finish", "departure"].includes(urlAction)) {
        return "end";
      }
    } catch (error) {
      console.warn("Push URL解析失敗:", error);
    }
  }

  return "general";
}

/* ========================================
   通知ボタン
======================================== */

/**
 * 通知に表示する操作ボタンを返す。
 */
function createNotificationActions(notificationType) {
  /*
   * 開始通知。
   *
   * 開始打刻または欠席を選べる。
   */
  if (notificationType === "start") {
    return [
      {
        action: "start",

        title: "開始打刻",
      },

      {
        action: "absent",

        title: "欠席",
      },
    ];
  }

  /*
   * 終了通知。
   *
   * 早退通知は出さない。
   * 終了打刻だけ表示する。
   */
  if (notificationType === "end") {
    return [
      {
        action: "end",

        title: "終了打刻",
      },
    ];
  }

  return [];
}

/* ========================================
   通知文
======================================== */

function getDefaultTitle(notificationType) {
  if (notificationType === "start") {
    return "講義開始10分前です";
  }

  if (notificationType === "end") {
    return "講義終了5分前です";
  }

  return "CareMate";
}

function getDefaultBody(notificationType) {
  if (notificationType === "start") {
    return "講義の開始打刻をしてください。";
  }

  if (notificationType === "end") {
    return "講義の終了打刻をしてください。";
  }

  return "CareMateからのお知らせです。";
}

/* ========================================
   通知URL
======================================== */

/**
 * 通知から開く出席管理画面URLを作る。
 */
function createAttendanceTargetUrl(data, notificationType) {
  /*
   * GitHub Pagesでは
   *
   * https://...github.io/university-notifier-web/
   *
   * がService Workerのscopeになる。
   *
   * origin直下 "/" を使うと
   * /university-notifier-web/ が消えるため、
   * 必ずregistration.scopeを基準にする。
   */

  const fallbackUrl = new URL("index.html", self.registration.scope);

  let url;

  try {
    /*
     * Firebase Functions側から渡されたURLを
     * 最優先でそのまま使う。
     *
     * 出席通知
     * → attendance_check.html
     *
     * クラス選択通知
     * → index.html
     */

    url = data.url ? new URL(data.url, self.registration.scope) : fallbackUrl;
  } catch (error) {
    console.warn("通知URL作成失敗:", error);

    url = new URL(fallbackUrl.href);
  }

  /*
   * Functions側のURLにすでに
   *
   * subject
   * period
   * date
   * action
   * recordId
   * scheduleId
   * classGroup
   * startTime
   * endTime
   *
   * が入っている。
   *
   * ここでは消さずに補助情報だけ追加する。
   */

  const subject = normalizeText(data.subject);

  const period = normalizePeriod(data.period);

  const date = normalizeDate(data.date || data.attendanceDate);

  if (subject && !url.searchParams.has("subject")) {
    url.searchParams.set("subject", subject);
  }

  if (period && !url.searchParams.has("period")) {
    url.searchParams.set("period", String(period));
  }

  if (date && !url.searchParams.has("date")) {
    url.searchParams.set("date", date);
  }

  /*
   * actionはFunctions側の
   * arrival / departure を優先する。
   *
   * URLにactionがない古い通知だけ補完。
   */

  if (!url.searchParams.has("action")) {
    if (notificationType === "start") {
      url.searchParams.set("action", "arrival");
    }

    if (notificationType === "end") {
      url.searchParams.set("action", "departure");
    }
  }

  return url;
}

/* ========================================
   通知タグ
======================================== */

function createNotificationTag(data, notificationType) {
  const date = normalizeDate(data.date || data.attendanceDate) || "today";

  const period = normalizePeriod(data.period) || "unknown";

  const subject = normalizeText(data.subject) || "lecture";

  return ["attendance", notificationType, date, period, subject].join("-");
}

/* ========================================
   通知タップ
======================================== */

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(handleNotificationClick(event));
});

/**
 * 通知または通知ボタンを押した時の処理。
 */
async function handleNotificationClick(event) {
  const notificationData = event.notification.data || {};

  const targetUrl = createClickTargetUrl(
    notificationData,

    event.action,
  );

  const clientList = await self.clients.matchAll({
    type: "window",

    includeUncontrolled: true,
  });

  /*
   * CareMateがすでに開いている場合は、
   * その画面を出席管理へ移動して前面表示する。
   */
  for (const client of clientList) {
    try {
      const clientUrl = new URL(client.url);

      if (clientUrl.origin !== self.location.origin) {
        continue;
      }

      if ("navigate" in client) {
        await client.navigate(targetUrl.href);
      }

      if ("focus" in client) {
        return client.focus();
      }
    } catch (error) {
      console.warn("既存画面の再利用失敗:", error);
    }
  }

  /*
   * 開いている画面がなければ
   * 新しい画面を開く。
   */
  return self.clients.openWindow(targetUrl.href);
}

/* ========================================
   タップ後URL
======================================== */

/**
 * 押された通知ボタンをURLへ反映する。
 */
function createClickTargetUrl(notificationData, clickedAction) {
  const fallbackUrl = new URL("index.html", self.registration.scope);

  let url;

  try {
    url = notificationData.url
      ? new URL(notificationData.url, self.registration.scope)
      : fallbackUrl;
  } catch {
    url = new URL(fallbackUrl.href);
  }

  /*
   * 通知内ボタンが押された場合だけ
   * actionを書き換える。
   *
   * 通知本体タップの場合は、
   * Functionsから渡された
   * arrival/departureをそのまま使う。
   */

  const clicked = normalizeText(clickedAction).toLowerCase();

  if (clicked) {
    if (["start", "arrival", "attendance", "present"].includes(clicked)) {
      url.searchParams.set("action", "arrival");

      url.searchParams.set("choice", "arrival");

      url.searchParams.set("source", "start_notification");
    } else if (["absent", "absence"].includes(clicked)) {
      url.searchParams.set("action", "arrival");

      url.searchParams.set("choice", "absence");

      url.searchParams.set("source", "start_notification");
    } else if (["end", "finish", "departure"].includes(clicked)) {
      url.searchParams.set("action", "departure");

      url.searchParams.set("choice", "departure");

      url.searchParams.set("source", "end_notification");
    }
  }

  const subject = normalizeText(notificationData.subject);

  const period = normalizePeriod(notificationData.period);

  const date = normalizeDate(notificationData.date);

  if (subject && !url.searchParams.has("subject")) {
    url.searchParams.set("subject", subject);
  }

  if (period && !url.searchParams.has("period")) {
    url.searchParams.set("period", String(period));
  }

  if (date && !url.searchParams.has("date")) {
    url.searchParams.set("date", date);
  }

  return url;
}

/**
 * 古い通知ボタン名も
 * 新しい名前へ変換する。
 */
function normalizeClickedAction(value) {
  const action = normalizeText(value).toLowerCase();

  const aliases = {
    start: "start",

    arrival: "start",

    attendance: "start",

    present: "start",

    absent: "absent",

    absence: "absent",

    end: "end",

    finish: "end",

    departure: "end",
  };

  return aliases[action] || "";
}

/* ========================================
   初期操作
======================================== */

function getDefaultAction(notificationType) {
  if (notificationType === "start") {
    return "start";
  }

  if (notificationType === "end") {
    return "end";
  }

  return "";
}

/* ========================================
   共通変換
======================================== */

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePeriod(value) {
  const period = Number(
    String(value ?? "")
      .replace("限", "")
      .trim(),
  );

  return Number.isInteger(period) ? period : "";
}

function normalizeDate(value) {
  const text = normalizeText(value);

  if (!text) {
    return "";
  }

  const cleaned = text

    .replace(/年|\/|\./g, "-")

    .replace(/月/g, "-")

    .replace(/日/g, "")

    .replace(/-+/g, "-");

  const match = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (!match) {
    return "";
  }

  return (
    `${match[1]}-` +
    `${match[2].padStart(2, "0")}-` +
    `${match[3].padStart(2, "0")}`
  );
}
