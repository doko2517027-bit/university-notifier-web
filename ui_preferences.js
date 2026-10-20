/* Shared appearance and touch preferences for every CareMate screen. */
(function () {
  const storageKey = "theme";
  const root = document.documentElement;
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
    if (browserColor) browserColor.content = dark ? "#121b28" : "#0f9d8a";
    document.querySelectorAll("[data-cm-theme-toggle]").forEach((button) => {
      button.textContent = button.dataset.cmThemeFloating === "true"
        ? (dark ? "☀️ ライト" : "🌙 ダーク")
        : (dark ? "☀️" : "🌙");
      button.setAttribute("aria-label", dark ? "ライトモードに切り替える" : "ダークモードに切り替える");
      button.setAttribute("aria-pressed", String(dark));
      button.title = dark ? "ライトモードに切り替える" : "ダークモードに切り替える";
    });
  }

  function setTheme(theme) {
    paint(theme);
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
    .cm-floating-theme { position: fixed; z-index: 90; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); min-height: 42px; padding: 8px 13px; border: 1px solid #b8c8d4; border-radius: 999px; background: #fff; color: #17304a; box-shadow: 0 3px 12px #17243c25; font: 700 13px/1.2 -apple-system, BlinkMacSystemFont, sans-serif; cursor: pointer; }
    .dark .cm-floating-theme { background: #243444; color: #f3f7fb; border-color: #5b7286; }
    .cm-floating-theme:focus-visible { outline: 3px solid #4f83d6; outline-offset: 2px; }
    body.cm-has-floating-theme { padding-top: max(74px, calc(env(safe-area-inset-top) + 58px)) !important; }
    .dark body.cm-login-page { background: #111b29; color: #f3f7fb; }
    .dark .notice, .dark .login-card, .dark .search-box { background: #1d2a3b; border-color: #41546c; color: #f3f7fb; }
    .dark .login-header h1, .dark .login-card label { color: #f3f7fb; }
    .dark .notice p, .dark .login-header p, .dark .entry-message { color: #b8c9db; }
    .dark .login-card input, .dark .search-box input { background: #142132; border-color: #597087; color: #f3f7fb; }
    .dark .search-box button { color: #d9e6f4; }
    .dark body.cm-offline-page { background: #111b29; color: #f3f7fb; }
    .dark body.cm-offline-page main { background: #1d2a3b; }
    .dark body.cm-offline-page p { color: #b8c9db; }
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
    button.className = "cm-floating-theme";
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
