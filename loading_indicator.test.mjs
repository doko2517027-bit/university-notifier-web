import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("./loading_indicator.js", import.meta.url), "utf8");

function setup() {
  const documentEvents = new Map();
  const windowEvents = new Map();
  const classes = new Set();
  const body = {
    dataset: {},
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
    },
  };
  runInNewContext(source, {
    document: {
      body,
      addEventListener: (name, handler) => documentEvents.set(name, handler),
    },
    window: {
      addEventListener: (name, handler) => windowEvents.set(name, handler),
    },
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
  return { body, classes, click, windowEvents };
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
  const { body, classes, click, windowEvents } = setup();
  click("https://caremate.example/calendar.html");
  windowEvents.get("pageshow")({ persisted: true });
  assert.equal(classes.has("page-busy"), false);
  assert.equal(body.dataset.loadingMessage, undefined);
});
