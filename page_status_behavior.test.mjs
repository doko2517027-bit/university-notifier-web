import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("./page_status.js", import.meta.url), "utf8");

class FakeNode {
  constructor(tagName = "div") {
    this.tagName = tagName;
    this.children = [];
    this.hidden = false;
    this.attributes = new Map();
    this.className = "";
    this.textContent = "";
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener() {}
  hasAttribute(name) { return this.attributes.has(name); }
}

test("共通ローダーは表示・文言更新・解除・失敗表示を実行できる", () => {
  const byId = new Map();
  const documentEvents = new Map();
  const windowEvents = new Map();
  const documentElement = new FakeNode("html");
  documentElement.classList = { contains: () => false };
  const body = new FakeNode("body");
  const head = new FakeNode("head");
  const document = {
    readyState: "complete",
    head,
    body,
    documentElement,
    createElement(tagName) {
      const node = new FakeNode(tagName);
      Object.defineProperty(node, "id", {
        get() { return this._id || ""; },
        set(value) { this._id = value; byId.set(value, this); },
      });
      return node;
    },
    querySelector: () => null,
    addEventListener(name, handler) { documentEvents.set(name, handler); },
  };
  const window = {
    addEventListener(name, handler) { windowEvents.set(name, handler); },
  };

  runInNewContext(source, {
    document,
    window,
    location: { href: "https://caremate.example/home.html", origin: "https://caremate.example", pathname: "/home.html", search: "", reload() {} },
    URL,
    setTimeout: () => 1,
    clearTimeout() {},
  });

  const overlay = byId.get("caremateLoadingOverlay");
  assert.ok(overlay);
  window.CareMateLoading.show("確認しています…");
  assert.equal(overlay.hidden, false);
  assert.equal(documentElement.attributes.get("aria-busy"), "true");
  window.CareMateLoading.hide();
  assert.equal(overlay.hidden, true);
  assert.equal(documentElement.attributes.has("aria-busy"), false);
  window.CareMateLoading.fail("読めませんでした");
  assert.equal(overlay.hidden, false);
  assert.equal(overlay.children[0].children[1].textContent, "読めませんでした");
});
