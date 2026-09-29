import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("./splash_intro.js", import.meta.url), "utf8");

function setup({ shown = false, portrait = true, reduced = false, online = true, rejectPlay = false } = {}) {
  const events = new Map();
  const storage = new Map(shown ? [["caremateIntro20260929", "true"]] : []);
  const timeouts = new Map();
  let nextTimer = 0;
  const splash = { style: { display: "" }, classList: { add(value) { splash.hiddenClass = value; } } };
  const skip = { addEventListener(type, handler) { events.set(`skip:${type}`, handler); } };
  const video = {
    src: "",
    paused: false,
    loaded: false,
    addEventListener(type, handler) { events.set(`video:${type}`, handler); },
    pause() { this.paused = true; },
    removeAttribute(name) { if (name === "src") this.src = ""; },
    load() { this.loaded = true; },
    play() { return rejectPlay ? Promise.reject(Error("blocked")) : Promise.resolve(); },
  };
  const document = {
    hidden: false,
    getElementById(id) { return { splash, splashVideo: video, splashSkip: skip }[id]; },
    addEventListener(type, handler) { events.set(`document:${type}`, handler); },
    removeEventListener(type) { events.delete(`document:${type}`); },
  };
  runInNewContext(source, {
    document, navigator: { onLine: online },
    sessionStorage: { getItem(key) { return storage.get(key); }, setItem(key, value) { storage.set(key, value); } },
    matchMedia(query) { return { matches: query.includes("orientation") ? portrait : reduced }; },
    setTimeout(handler) { const id = ++nextTimer; timeouts.set(id, handler); return id; },
    clearTimeout(id) { timeouts.delete(id); },
  });
  return {
    splash, video, storage,
    dispatch(key) { events.get(key)?.(); },
    runTimers() { for (const [id, handler] of [...timeouts]) { timeouts.delete(id); handler(); } },
  };
}

test("portrait launch plays the mobile video and closes after playback", () => {
  const ui = setup();
  assert.equal(ui.splash.style.display, "flex");
  assert.equal(ui.video.src, "caremate-intro-mobile.mp4");
  assert.equal(ui.storage.get("caremateIntro20260929"), "true");
  ui.dispatch("video:ended");
  ui.runTimers();
  assert.equal(ui.splash.style.display, "none");
  assert.equal(ui.video.paused, true);
});

test("landscape launch plays desktop video and skip works", () => {
  const ui = setup({ portrait: false });
  assert.equal(ui.video.src, "caremate-intro-desktop.mp4");
  ui.dispatch("skip:click");
  ui.runTimers();
  assert.equal(ui.splash.style.display, "none");
});

test("repeat session, offline and reduced-motion launches do not block", () => {
  for (const options of [{ shown: true }, { online: false }, { reduced: true }]) {
    const ui = setup(options);
    assert.equal(ui.splash.style.display, "none");
    assert.equal(ui.video.src, "");
  }
});

test("playback failure exits instead of trapping the app", async () => {
  const ui = setup({ rejectPlay: true });
  await Promise.resolve();
  ui.runTimers();
  assert.equal(ui.splash.style.display, "none");
});
