/* Renewed CareMate service worker: no protected HTML or legacy UI is cached. */
const CACHE = "caremate-renewed-v5";
const CORE = ["./", "index.html", "offline.html", "ui_preferences.js", "manifest.json", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(CORE.map((asset) => cache.add(new Request(asset, { cache: "reload" }))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith("caremate-") && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try { return await fetch(request, { cache: "no-store" }); }
      catch { return await caches.match("offline.html") || Response.error(); }
    })());
    return;
  }
  // Only the small, non-sensitive shell can be served offline.
  const coreAsset = CORE.find((asset) => asset !== "./" && url.pathname.endsWith(asset.replace(/^\.\//, "")));
  if (coreAsset) {
    event.respondWith(fetch(request).catch(() => caches.match(new URL(coreAsset, self.registration.scope).href)));
  }
});

function targetUrl(raw) {
  try {
    const target = new URL(String(raw || "assignments.html"), self.registration.scope);
    const scope = new URL(self.registration.scope);
    if (target.origin === scope.origin && target.pathname.startsWith(scope.pathname)) return target.href;
  } catch { /* Invalid URL falls back to the assignments page. */ }
  return new URL("assignments.html", self.registration.scope).href;
}

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data?.json() || {}; }
    catch { payload = { body: event.data?.text() || "" }; }
    await self.registration.showNotification(String(payload.title || "CareMate 課題のお知らせ"), {
      body: String(payload.body || "課題を確認してください。"),
      icon: "icon-192.png",
      badge: "icon-192.png",
      data: { url: targetUrl(payload.url) },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = targetUrl(event.notification.data?.url);
    for (const client of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      await client.navigate(url);
      return client.focus();
    }
    return self.clients.openWindow(url);
  })());
});
