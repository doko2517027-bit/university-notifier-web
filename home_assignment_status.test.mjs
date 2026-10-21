import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (name) => readFile(new URL(name, import.meta.url), "utf8");

test("課題カレンダーは提出済み・期限切れ・期限内を判定する", async () => {
  const source = await read("home.js");
  assert.match(source, /return "submitted"/);
  assert.match(source, /return deadline && deadline\.getTime\(\) < Date\.now\(\) \? "overdue" : "pending"/);
  assert.match(source, /提出済み/);
  assert.match(source, /期限切れ・未提出/);
  assert.match(source, /期限内・未提出/);
});

test("カレンダーの色は提出済み青・期限切れ赤・期限内未提出を明暗反転する", async () => {
  const css = await read("caremate_shell.css");
  assert.match(css, /\.cm-calendar-chip\.assignment\.is-submitted\s*\{[^}]*background:\s*#2563eb/);
  assert.match(css, /\.cm-calendar-chip\.assignment\.is-overdue\s*\{[^}]*background:\s*#d92f4c/);
  assert.match(css, /\.cm-calendar-chip\.assignment\.is-pending\s*\{[^}]*color:\s*#fff;[^}]*background:\s*#151515/);
  assert.match(css, /\.dark \.cm-calendar-chip\.assignment\.is-pending\s*\{[^}]*color:\s*#111;[^}]*background:\s*#f5f5f5/);
});
