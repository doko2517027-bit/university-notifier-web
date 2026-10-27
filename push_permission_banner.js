import { registerDevicePushSubscription } from "./push_subscription.js?v=20261026-1";

export function showAssignmentPushBanner(db, studentNumber) {
  const permission = () => "Notification" in window ? Notification.permission : "unsupported";
  if (permission() === "granted" || document.getElementById("assignmentPushBanner")) return;
  const deferredKey = `carematePushBannerDeferred:${studentNumber}`;
  try { if (sessionStorage.getItem(deferredKey) === "true") return; } catch { /* Optional preference. */ }

  if (!document.getElementById("assignmentPushBannerStyles")) {
    const style = document.createElement("style");
    style.id = "assignmentPushBannerStyles";
    style.textContent = `
      .cm-push-banner { display:flex; align-items:center; gap:16px; width:100%; min-width:0; max-width:700px; margin:0 auto 18px; padding:18px; border:1px solid #8ed3c9; border-left:5px solid #0f9d8a; border-radius:16px; background:#eefaf7; color:#173c36; box-sizing:border-box; text-align:left; }
      .cm-push-banner-copy { flex:1; min-width:0; }
      .cm-push-banner h2 { margin:0 0 6px; font:inherit; font-size:16px; font-weight:800; line-height:1.45; }
      .cm-push-banner p { margin:0; font:inherit; font-size:13px; line-height:1.65; overflow-wrap:anywhere; }
      .cm-push-banner-actions { display:grid; gap:8px; flex:0 0 145px; }
      .cm-push-banner button { min-height:42px; padding:9px 13px; border:1px solid #0f9d8a; border-radius:10px; background:#0f9d8a; color:white; font:inherit; font-size:14px; font-weight:750; cursor:pointer; }
      .cm-push-banner button[data-defer] { border-color:transparent; background:transparent; color:inherit; }
      .cm-push-banner button:disabled { opacity:.6; cursor:wait; }
      .cm-push-banner button:focus-visible { outline:3px solid #4cb9aa; outline-offset:2px; }
      .cm-push-banner [role=status] { margin-top:8px; }
      .dark .cm-push-banner { background:#171717; color:#f4f4f4; border-color:#36766b; border-left-color:#14b8a6; }
      @media(max-width:480px) { .cm-push-banner { flex-direction:column; align-items:stretch; gap:12px; padding:15px; } .cm-push-banner-actions { flex:auto; grid-template-columns:1fr 1fr; } }
    `;
    document.head.append(style);
  }

  const banner = document.createElement("section");
  banner.id = "assignmentPushBanner";
  banner.className = "cm-push-banner";
  banner.setAttribute("aria-labelledby", "assignmentPushBannerTitle");
  banner.innerHTML = `<div class="cm-push-banner-copy"><h2 id="assignmentPushBannerTitle">課題の通知を受け取りますか？</h2><p>新しい課題や締切をお知らせします。「通知を許可する」を押して、この端末で通知を受け取れるようにしましょう。</p><p role="status" hidden></p></div><div class="cm-push-banner-actions"><button type="button" data-enable>通知を許可する</button><button type="button" data-defer>あとで</button></div>`;
  const enable = banner.querySelector("[data-enable]");
  const message = banner.querySelector(".cm-push-banner-copy > p");
  const status = banner.querySelector("[role=status]");
  const remove = () => { banner.remove(); window.removeEventListener("focus", onFocus); };
  function onFocus() { if (permission() === "granted") remove(); }

  function explainUnavailable() {
    enable.textContent = "設定方法を見る";
    message.textContent = permission() === "denied"
      ? "この端末の通知がオフになっています。通知を許可すると、新しい課題や締切を受け取れます。"
      : "この開き方では通知を利用できません。ホーム画面への追加など、設定方法をご確認ください。";
  }
  if (permission() !== "default") explainUnavailable();
  enable.addEventListener("click", async () => {
    if (permission() === "granted") { remove(); return; }
    if (permission() !== "default") {
      status.hidden = false;
      status.textContent = permission() === "denied"
        ? "端末またはブラウザの設定で、このCareMateの通知を許可してください。iPhoneでは「設定」→「通知」→「CareMate」を確認してください。"
        : "iPhone・iPadではSafariの共有メニューから「ホーム画面に追加」し、追加したCareMateを開いてください。PC・Androidでは通知対応ブラウザで開いてください。";
      return;
    }
    enable.disabled = true;
    try {
      // Request inside the click so mobile browsers retain the user gesture.
      const granted = await Notification.requestPermission();
      if (granted !== "granted") {
        if (granted === "denied") explainUnavailable();
        return;
      }
      remove();
      await registerDevicePushSubscription(db, studentNumber, "login-banner", "sw.js");
    } catch (error) {
      console.warn("課題通知の登録に失敗しました:", error);
      // Permission and subscription are distinct; the common bootstrap repairs
      // permitted devices on the next page without asking for permission again.
    } finally { enable.disabled = false; }
  });
  banner.querySelector("[data-defer]").addEventListener("click", () => {
    try { sessionStorage.setItem(deferredKey, "true"); } catch { /* Optional preference. */ }
    remove();
  });
  window.addEventListener("focus", onFocus);
  (document.querySelector("main") || document.body).prepend(banner);
}
