import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");

test("認証・画面読込・ログイン・画面移動は共通ローダーを使う", () => {
  const status = read("./page_status.js");
  const bootstrap = read("./page_bootstrap.js");
  const login = read("./login.js");
  assert.match(status, /caremate-loading-spinner/);
  assert.match(status, /画面を切り替えています/);
  assert.match(bootstrap, /利用権限を確認しています/);
  assert.match(bootstrap, /画面を読み込んでいます/);
  assert.match(bootstrap, /CareMatePageStatus\?\.ready/);
  assert.match(login, /CareMateLoading\?\.show\("ログインしています/);
});

test("画面の初期データ取得が終わってから読み込み状態を解除する", () => {
  const common = read("./common.js");
  const settle = common.indexOf("await Promise.allSettled(tasks)");
  const reveal = common.indexOf("showPage();", settle);
  assert.ok(settle >= 0 && reveal > settle);
});

test("すべての保護画面が共通ローダーを初期化する", () => {
  for (const name of read("./scripts/protected_pages.txt").trim().split(/\s+/)) {
    assert.match(read(`./${name}`), /page_status\.js/);
  }
});
