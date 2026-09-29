// ホームを開いた最初の1回だけOPを再生。動画障害でも画面操作を妨げない。
(() => {
  const splash = document.getElementById("splash");
  const video = document.getElementById("splashVideo");
  const skip = document.getElementById("splashSkip");
  if (!splash || !video || !skip) return;

  let alreadyShown = false;
  try {
    alreadyShown = sessionStorage.getItem("caremateIntro20260929") === "true";
  } catch (_) {
    // 保存領域が使えない環境でもOP自体は利用できる。
  }
  if (alreadyShown || navigator.onLine === false ||
      matchMedia("(prefers-reduced-motion: reduce)").matches) {
    splash.style.display = "none";
    return;
  }

  let finished = false;
  let startTimeout;
  let playbackTimeout;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(startTimeout);
    clearTimeout(playbackTimeout);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    video.pause();
    splash.classList.add("hide");
    setTimeout(() => {
      splash.style.display = "none";
      video.removeAttribute("src");
      video.load();
    }, 250);
  };

  skip.addEventListener("click", finish);
  video.addEventListener("ended", finish, { once: true });
  video.addEventListener("error", finish, { once: true });
  video.addEventListener("playing", () => {
    clearTimeout(startTimeout);
    playbackTimeout = setTimeout(finish, 6500);
  }, { once: true });
  const onVisibilityChange = () => {
    if (document.hidden) finish();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  splash.style.display = "flex";
  try {
    sessionStorage.setItem("caremateIntro20260929", "true");
  } catch (_) {
    // 一時的な保存失敗は再生を妨げない。
  }
  video.src = matchMedia("(orientation: portrait)").matches
    ? "caremate-intro-mobile.mp4"
    : "caremate-intro-desktop.mp4";
  startTimeout = setTimeout(finish, 3000);
  try {
    video.play()?.catch(finish);
  } catch (_) {
    finish();
  }
})();
