import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("./loading_indicator.js", import.meta.url), "utf8");

function setup({ online = true, loading = false } = {}) {
  const documentEvents = new Map();
  const windowEvents = new Map();
  const classes = new Set();
  if (loading) classes.add("page-loading");
  const banner = { hidden: true, setAttribute() {} };
  const body = {
    dataset: {},
    prepend() {},
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
  };
  const window = {
    addEventListener: (name, handler) => {
      windowEvents.set(name, [...(windowEvents.get(name) || []), handler]);
    },
  };
  runInNewContext(source, {
    document: {
      body,
      createElement: () => banner,
      addEventListener: (name, handler) => documentEvents.set(name, handler),
    },
    window,
    navigator: { get onLine() { return online; } },
    location: { href: "https://caremate.example/index.html", origin: "https://caremate.example", pathname: "/index.html", search: "" },
    URL,
  });
  const click = (href, options = {}) => documentEvents.get("click")({
    button: 0,
    defaultPrevented: false,
    target: {
      closest: () => ({ href, target: "", hasAttribute: () => false }),
    },
    ...options,
  });
  const dispatch = (name, event = {}) => {
    for (const handler of windowEvents.get(name) || []) handler(event);
  };
  return { body, banner, classes, click, dispatch, setOnline: (value) => { online = value; } };
}

test("画面内のタブ移動で直ちに読み込み表示を出す", () => {
  const { body, classes, click } = setup();
  click("https://caremate.example/calendar.html");
  assert.equal(classes.has("page-busy"), true);
  assert.equal(body.dataset.loadingMessage, "画面を切り替えています…");
});

test("外部リンク、同じ画面、別タブを開く操作には出さない", () => {
  const { classes, click } = setup();
  click("https://outside.example/");
  click("https://caremate.example/index.html#section");
  click("https://caremate.example/calendar.html", { ctrlKey: true });
  assert.equal(classes.has("page-busy"), false);
});

test("戻る操作でキャッシュから復帰した画面の表示を解除する", () => {
  const { body, classes, click, dispatch } = setup();
  click("https://caremate.example/calendar.html");
  dispatch("pageshow", { persisted: true });
  assert.equal(classes.has("page-busy"), false);
  assert.equal(body.dataset.loadingMessage, undefined);
});

test("オフラインで開いた画面には常に案内を表示する", () => {
  const { body, banner } = setup({ online: false, loading: true });
  assert.equal(banner.hidden, false);
  assert.match(body.dataset.loadingMessage, /オフライン/);
});

test("通信断・復帰で案内を表示・解除する", () => {
  const { banner, dispatch, setOnline } = setup();
  setOnline(false);
  dispatch("offline");
  assert.equal(banner.hidden, false);
  setOnline(true);
  dispatch("online");
  assert.equal(banner.hidden, true);
});
