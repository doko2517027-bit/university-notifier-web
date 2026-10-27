import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = (await readFile(new URL("./push_permission_banner.js", import.meta.url), "utf8"))
  .replace(/^import[^\n]+\n/, "").replace("export function", "function");

function setup(permission) {
  const elements = [];
  const storage = new Map();
  const counts = { requests: 0, registered: 0 };
  function element() {
    const node = { events: {}, removed: false, textContent: "", hidden: false,
      setAttribute() {}, append(child) { elements.push(child); }, prepend(child) { elements.push(child); },
      remove() { this.removed = true; }, addEventListener(name, fn) { this.events[name] = fn; },
      querySelector(selector) { return this.children[selector] ||= element(); }, children: {},
    };
    return node;
  }
  const document = { createElement: element, head: element(), body: element(),
    getElementById: (id) => elements.find((node) => node.id === id && !node.removed),
    querySelector: () => document.body,
  };
  const Notification = { permission, async requestPermission() { counts.requests++; this.permission = "granted"; return "granted"; } };
  const window = { Notification, events: {}, addEventListener(name, fn) { this.events[name] = fn; }, removeEventListener(name) { delete this.events[name]; } };
  const context = vm.createContext({ document, window, Notification, console,
    sessionStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    registerDevicePushSubscription: async () => { counts.registered++; },
  });
  vm.runInContext(source, context);
  return { context, counts, document, Notification, window, storage,
    banner: () => document.getElementById("assignmentPushBanner") };
}

test("許可済みならバナーも許可要求も出さない", () => {
  const state = setup("granted");
  state.context.showAssignmentPushBanner({}, "2510044");
  assert.equal(state.banner(), undefined);
  assert.equal(state.counts.requests, 0);
});

test("未許可ならバナーを表示し、ボタン操作で許可と端末登録を行う", async () => {
  const state = setup("default");
  state.context.showAssignmentPushBanner({}, "2510044");
  assert.ok(state.banner());
  assert.equal(state.counts.requests, 0);
  await state.banner().querySelector("[data-enable]").events.click();
  assert.equal(state.counts.requests, 1);
  assert.equal(state.counts.registered, 1);
  assert.equal(state.banner(), undefined);
});

test("あとでを選ぶと同一ログイン中は再表示しない", () => {
  const state = setup("default");
  state.context.showAssignmentPushBanner({}, "2510044");
  state.banner().querySelector("[data-defer]").events.click();
  state.context.showAssignmentPushBanner({}, "2510044");
  assert.equal(state.banner(), undefined);
  assert.equal(state.storage.get("carematePushBannerDeferred:2510044"), "true");
});

test("拒否済みでは許可要求を繰り返さず設定方法を表示する", async () => {
  const state = setup("denied");
  state.context.showAssignmentPushBanner({}, "2510044");
  await state.banner().querySelector("[data-enable]").events.click();
  assert.equal(state.counts.requests, 0);
  assert.match(state.banner().querySelector("[role=status]").textContent, /設定/);
});

test("別画面で許可されたらバナーを閉じる", () => {
  const state = setup("default");
  state.context.showAssignmentPushBanner({}, "2510044");
  state.Notification.permission = "granted";
  state.window.events.focus();
  assert.equal(state.banner(), undefined);
});
