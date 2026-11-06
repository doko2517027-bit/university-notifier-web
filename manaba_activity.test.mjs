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
  assert.match(html, /id="manabaPagination"/);
  assert.match(script, /const PAGE_SIZE = 5/);
  assert.match(script, /first \+ 2/);
  assert.match(script, /visible\.slice\(\(currentPage - 1\) \* PAGE_SIZE/);
});

test("manabaリンクは大学manabaのHTTPSだけを開く", async () => {
  const [script, html, styles] = await Promise.all([read("./manaba.js"), read("./manaba.html"), read("./caremate_shell.css")]);
  assert.match(script, /url\.protocol === "https:" && url\.hostname === "sums\.manaba\.jp"/);
  assert.match(script, /noopener noreferrer/);
  assert.match(html, /cm-manaba-page/);
  assert.match(styles, /@media \(min-width: 761px\)[\s\S]*\.cm-manaba-categories/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*grid-template-columns: repeat\(2/);
  assert.match(styles, /@media \(max-width: 360px\)[\s\S]*grid-template-columns: 1fr/);
});
