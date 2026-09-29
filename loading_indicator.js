// 各画面共通の遷移表示。認証モジュールの読み込み前から利用できるよう独立させる。
(() => {
  const offlineBanner = document.createElement("div");
  offlineBanner.id = "caremateOfflineBanner";
  offlineBanner.className = "offline-status-banner";
  offlineBanner.setAttribute("role", "status");
  offlineBanner.setAttribute("aria-live", "polite");
  offlineBanner.textContent = "オフラインです。保存済みの画面は閲覧できますが、通信が必要な操作はできません。";
  offlineBanner.hidden = true;
  document.body.prepend(offlineBanner);

  const refreshOfflineStatus = () => {
    const offline = navigator.onLine === false;
    offlineBanner.hidden = !offline;
    if (offline && document.body.classList.contains("page-loading")) {
      document.body.dataset.loadingMessage = "オフラインです。保存済みの画面を開いています…";
    }
  };
  window.CareMateOfflineStatus = { refresh: refreshOfflineStatus };
  window.addEventListener("offline", refreshOfflineStatus);
  window.addEventListener("online", refreshOfflineStatus);
  window.addEventListener("pageshow", refreshOfflineStatus);
  refreshOfflineStatus();

  const show = (message) => {
    if (!document.body) return;
    document.body.dataset.loadingMessage = navigator.onLine === false
      ? "オフラインです。保存済みの画面を開いています…"
      : message;
    document.body.classList.add("page-busy");
  };
  const hide = () => {
    if (!document.body) return;
    document.body.classList.remove("page-busy");
    delete document.body.dataset.loadingMessage;
  };

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.("a[href]");
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin ||
        (destination.pathname === location.pathname && destination.search === location.search)) return;
    show("画面を切り替えています…");
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) hide();
  });
  window.addEventListener("beforeunload", () => show("画面を切り替えています…"));
})();
