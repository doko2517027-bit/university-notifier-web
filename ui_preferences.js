/* Shared appearance and touch preferences for every CareMate screen. */
(function () {
  const storageKey = "theme";
  const root = document.documentElement;
  let transitionTimer;
  let storedTheme = "light";
  try {
    storedTheme = localStorage.getItem(storageKey) === "dark" ? "dark" : "light";
  } catch (_) {
    // Private browsing can make storage unavailable; the control still works.
  }

  function paint(theme) {
    const dark = theme === "dark";
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";
    const browserColor = document.querySelector('meta[name="theme-color"]');
    if (browserColor) browserColor.content = dark ? "#090909" : "#0f9d8a";
    document.querySelectorAll("[data-cm-theme-toggle]").forEach((button) => {
      button.textContent = dark ? "☀️" : "🌙";
      button.setAttribute("aria-label", dark ? "ライトモードに切り替える" : "ダークモードに切り替える");
      button.setAttribute("aria-pressed", String(dark));
      button.title = dark ? "ライトモードに切り替える" : "ダークモードに切り替える";
    });
  }

  function setTheme(theme) {
    const buttons = [...document.querySelectorAll("[data-cm-theme-toggle]")];
    const animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (animate) {
      root.classList.add("cm-theme-transition");
      // Establish the starting colors before swapping the theme class.
      void root.offsetWidth;
    }
    paint(theme);
    if (animate) {
      buttons.forEach((button) => button.animate?.([
        { opacity: 0.3, transform: "scale(0.88)" },
        { opacity: 1, transform: "scale(1)" },
      ], { duration: 320, easing: "ease-out" }));
      clearTimeout(transitionTimer);
      transitionTimer = setTimeout(() => root.classList.remove("cm-theme-transition"), 380);
    }
    try { localStorage.setItem(storageKey, theme); } catch (_) { /* session only */ }
  }

  function bind(button) {
    if (!button || button.dataset.cmThemeToggle === "true") return;
    button.dataset.cmThemeToggle = "true";
    button.type = "button";
    button.addEventListener("click", () => setTheme(root.classList.contains("dark") ? "light" : "dark"));
    paint(root.classList.contains("dark") ? "dark" : "light");
  }

  window.CareMatePreferences = { bind, setTheme };
  paint(storedTheme);

  const style = document.createElement("style");
  style.textContent = `
    html, body { touch-action: pan-x pan-y; }
    button, a, input, select, textarea { touch-action: manipulation; }
    .cm-floating-theme { position: fixed; z-index: 90; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); display: flex; align-items: center; justify-content: center; width: 50px; height: 50px; padding: 0; border: 0; border-radius: 50%; background: #fff; color: #111; box-shadow: 0 6px 18px #0002; font: 24px/1 -apple-system, BlinkMacSystemFont, sans-serif; cursor: pointer; }
    .dark .cm-floating-theme { background: #1c1c1c; color: #f5f5f5; box-shadow: 0 6px 18px #0008; }
    .cm-floating-theme:focus-visible { outline: 3px solid #4f83d6; outline-offset: 2px; }
    html.cm-theme-transition body, html.cm-theme-transition body *, html.cm-theme-transition body *::before, html.cm-theme-transition body *::after { transition: background-color .32s ease, color .32s ease, border-color .32s ease, box-shadow .32s ease; }
    body.cm-has-floating-theme { padding-top: max(74px, calc(env(safe-area-inset-top) + 58px)) !important; }
    .dark body.cm-login-page { background: #090909; color: #f5f5f5; }
    .dark .notice, .dark .login-card, .dark .search-box { background: #1c1c1c; border-color: #3c3c3c; color: #f5f5f5; }
    .dark .login-header h1, .dark .login-card label { color: #f3f7fb; }
    .dark .notice p, .dark .login-header p, .dark .entry-message { color: #bcbcbc; }
    .dark .login-card input, .dark .search-box input { background: #101010; border-color: #555; color: #f5f5f5; }
    .dark .search-box button { color: #ddd; }
    .cm-entry-notice .cm-floating-theme { display: none; }
    body.cm-entry-notice.cm-has-floating-theme { padding-top: max(24px, env(safe-area-inset-top)) !important; }
    .dark body.cm-entry-notice { background: #f8fafc; color: #1e293b; color-scheme: light; }
    .dark body.cm-entry-notice .notice, .dark body.cm-entry-notice .search-box { background: #fff; color: #1e293b; border-color: #e2e8f0; }
    .dark body.cm-entry-notice .notice p, .dark body.cm-entry-notice .entry-message { color: #64748b; }
    .dark body.cm-entry-notice .search-box input { background: transparent; color: #1e293b; }
    .dark body.cm-entry-notice .search-box button { color: #64748b; }
    .dark body.cm-offline-page { background: #090909; color: #f5f5f5; }
    .dark body.cm-offline-page main { background: #1c1c1c; }
    .dark body.cm-offline-page p { color: #bcbcbc; }
  `;
  document.head.append(style);

  document.addEventListener("DOMContentLoaded", () => {
    paint(root.classList.contains("dark") ? "dark" : "light");
    const existing = document.getElementById("themeButton");
    if (existing) {
      bind(existing);
      return;
    }
    const button = document.createElement("button");
    button.className = "circle-button cm-floating-theme";
    button.dataset.cmThemeFloating = "true";
    document.body.classList.add("cm-has-floating-theme");
    document.body.append(button);
    bind(button);
  });

  window.addEventListener("storage", (event) => {
    if (event.key === storageKey) paint(event.newValue === "dark" ? "dark" : "light");
  });
  window.addEventListener("pageshow", () => {
    try { paint(localStorage.getItem(storageKey) === "dark" ? "dark" : "light"); }
    catch (_) { /* retain the current session preference */ }
  });

  ["gesturestart", "gesturechange", "gestureend"].forEach((type) => {
    document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
  });
  document.addEventListener("touchmove", (event) => {
    if (event.touches.length > 1) event.preventDefault();
  }, { passive: false });
})();
