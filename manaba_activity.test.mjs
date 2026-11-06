import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (name) => readFile(new URL(name, import.meta.url), "utf8");

test("課題通知ありの利用者にはmanaba履歴タブと分類ボタンを表示する", async () => {
  const [html, script, nav] = await Promise.all([
    read("./manaba.html"), read("./manaba.js"), read("./common.js"),
  ]);
  assert.match(nav, /href: "manaba\.html"/);
  assert.match(html, /manabaCategoryNav/);
  for (const category of ["course_news", "portfolio", "thread", "content", "project", "grade", "coaching", "peer_review"]) {
    assert.match(script, new RegExp(`\\["${category}"`));
  }
  assert.match(script, /onSnapshot\(collection\(db, "manabaActivity"/);
  assert.match(script, /取得済みの履歴を含む/);
});

test("manabaリンクは大学manabaのHTTPSだけを開く", async () => {
  const script = await read("./manaba.js");
  assert.match(script, /url\.protocol === "https:" && url\.hostname === "sums\.manaba\.jp"/);
  assert.match(script, /noopener noreferrer/);
});
