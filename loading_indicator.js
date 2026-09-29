// 各画面共通の遷移表示。認証モジュールの読み込み前から利用できるよう独立させる。
(() => {
  const show = (message) => {
    if (!document.body) return;
    document.body.dataset.loadingMessage = message;
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
