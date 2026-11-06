import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (name) => readFile(new URL(name, import.meta.url), "utf8");

test("課題一覧はFirestore更新を再読込なしで受け取る", async () => {
  const source = await read("assignments.js");
  assert.match(source, /onSnapshot\(doc\(db, "assignments", studentNumber\)/);
  assert.doesNotMatch(source, /getDoc\(/);
  assert.match(source, /新しい取得結果は自動で反映/);
});

test("課題一覧は公開前・提出済み・受付中未提出・締切済み未提出を区別する", async () => {
  const source = await read("assignments.js");
  assert.match(source, /return "submitted"/);
  assert.match(source, /return "upcoming"/);
  assert.match(source, /return dueDate\(item\) < Date\.now\(\) \? "overdue" : "pending"/);
  assert.match(source, /提出済み/);
  assert.match(source, /受付中・未提出/);
  assert.match(source, /締切済み・未提出/);
  assert.match(source, /公開前/);
});

test("ホームと課題一覧は画面表示中も締切状態を再判定する", async () => {
  const home = await read("home.js");
  const assignments = await read("assignments.js");
  assert.match(home, /30 \* 1000/);
  assert.match(assignments, /30 \* 1000/);
});

test("各状態の色は提出済み青・締切済み赤・公開前緑・公開済み締切前を白にする", async () => {
  const css = await read("caremate_shell.css");
  assert.match(css, /\.cm-assignment-card\.is-submitted[^}]*#2563eb/);
  assert.match(css, /\.cm-assignment-card\.is-overdue[^}]*#d92f4c/);
  assert.match(css, /\.cm-assignment-card\.is-pending \.cm-assignment-state[^}]*background: #fff/);
  assert.match(css, /\.cm-assignment-card\.is-upcoming[^}]*#15966a/);
  assert.match(css, /\.dark \.cm-assignment-card\.is-pending \.cm-assignment-state[^}]*background: #fff/);
});
