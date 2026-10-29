/* CareMate common full-screen loading UI. This file is a classic script so it
 * can appear before authentication and page modules have finished loading. */
(() => {
  const ensureLoadingController = () => {
    if (window.CareMateLoading) return window.CareMateLoading;

    const style = document.createElement("style");
    style.textContent = `
      #caremateLoadingOverlay {
        visibility: visible !important;
        position: fixed;
        inset: 0;
        z-index: 2147483600;
        display: grid;
        place-items: center;
        box-sizing: border-box;
        padding: 24px;
        background: rgba(248, 250, 252, .96);
        color: #16324f;
        text-align: center;
        backdrop-filter: blur(4px);
      }
      html.dark #caremateLoadingOverlay {
        background: rgba(7, 7, 7, .96);
        color: #fff;
      }
      #caremateLoadingOverlay[hidden] { display: none !important; }
      .caremate-loading-content { display: grid; justify-items: center; width: min(100%, 420px); }
      .caremate-loading-spinner {
        width: 44px;
        height: 44px;
        box-sizing: border-box;
        border: 4px solid rgba(37, 99, 235, .18);
        border-top-color: #2563eb;
        border-radius: 50%;
        animation: caremate-unified-loading-spin .75s linear infinite;
      }
      html.dark .caremate-loading-spinner {
        border-color: rgba(255, 255, 255, .18);
        border-top-color: #fff;
      }
      .caremate-loading-message { margin: 18px 0 0; font-size: 15px; font-weight: 800; line-height: 1.7; }
      .caremate-loading-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 20px; }
      .caremate-loading-actions button, .caremate-loading-actions a {
        min-height: 44px;
        padding: 10px 16px;
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        background: #fff;
        color: #1e293b;
        font: inherit;
        font-weight: 750;
        text-decoration: none;
        cursor: pointer;
      }
      .caremate-loading-actions button { border-color: #2563eb; background: #2563eb; color: #fff; }
      @keyframes caremate-unified-loading-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .caremate-loading-spinner { animation-duration: 2s; } }
    `;
    document.head.append(style);

    let overlay;
    let messageNode;
    let spinner;
    let actions;
    let currentMessage = "読み込み中…";
    let visible = false;

    const mount = () => {
      if (overlay || !document.body) return;
      overlay = document.createElement("section");
      overlay.id = "caremateLoadingOverlay";
      overlay.setAttribute("role", "status");
      overlay.setAttribute("aria-live", "polite");
      overlay.setAttribute("aria-label", "読み込み中");
      overlay.hidden = !visible;

      const content = document.createElement("div");
      content.className = "caremate-loading-content";
      spinner = document.createElement("div");
      spinner.className = "caremate-loading-spinner";
      spinner.setAttribute("aria-hidden", "true");
      messageNode = document.createElement("p");
      messageNode.className = "caremate-loading-message";
      messageNode.textContent = currentMessage;
      actions = document.createElement("div");
      actions.className = "caremate-loading-actions";
      actions.hidden = true;
      content.append(spinner, messageNode, actions);
      overlay.append(content);
      document.body.append(overlay);
    };

    const show = (message = "読み込み中…") => {
      currentMessage = String(message || "読み込み中…");
      visible = true;
      mount();
      if (!overlay) return;
      messageNode.textContent = currentMessage;
      spinner.hidden = false;
      actions.hidden = true;
      actions.replaceChildren();
      overlay.hidden = false;
      document.documentElement.setAttribute("aria-busy", "true");
    };

    const hide = () => {
      visible = false;
      if (overlay) overlay.hidden = true;
      document.documentElement.removeAttribute("aria-busy");
    };

    const fail = (message = "画面を読み込めませんでした。通信状態を確認して、もう一度お試しください。") => {
      currentMessage = String(message);
      visible = true;
      mount();
      if (!overlay) return;
      messageNode.textContent = currentMessage;
      spinner.hidden = true;
      actions.replaceChildren();
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "再読み込み";
      retry.addEventListener("click", () => location.reload());
      const login = document.createElement("a");
      login.href = "index.html";
      login.textContent = "ログイン画面へ";
      actions.append(retry, login);
      actions.hidden = false;
      overlay.hidden = false;
      document.documentElement.removeAttribute("aria-busy");
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        mount();
        if (visible) show(currentMessage);
      }, { once: true });
    } else {
      mount();
    }

    window.CareMateLoading = { show, hide, fail };
    return window.CareMateLoading;
  };

  const loading = ensureLoadingController();

  if (!window.__CareMateNavigationLoadingInstalled) {
    window.__CareMateNavigationLoadingInstalled = true;
    document.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest?.("a[href]");
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const destination = new URL(link.href, location.href);
      if (destination.origin !== location.origin ||
          (destination.pathname === location.pathname && destination.search === location.search)) return;
      loading.show("画面を切り替えています…");
    });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) loading.hide();
    });
    window.addEventListener("beforeunload", () => loading.show("画面を切り替えています…"));
  }

  let timer;
  let failureTimer;
  const startProtectedPage = () => {
    if (!document.querySelector("script[data-care-page]") || document.documentElement.classList.contains("caremate-access-approved")) return;
    loading.show("利用権限を確認しています…");
    timer = setTimeout(() => loading.show("確認に時間がかかっています。そのままお待ちください…"), 15000);
    failureTimer = setTimeout(() => loading.fail("画面を読み込めませんでした。通信状態を確認して、もう一度お試しください。"), 90000);
  };

  window.CareMatePageStatus = {
    show(message) {
      clearTimeout(timer);
      loading.show(message);
    },
    ready() {
      clearTimeout(timer);
      clearTimeout(failureTimer);
      loading.hide();
    },
    fail(message) {
      clearTimeout(timer);
      clearTimeout(failureTimer);
      loading.fail(message);
    },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startProtectedPage, { once: true });
  else startProtectedPage();
})();
