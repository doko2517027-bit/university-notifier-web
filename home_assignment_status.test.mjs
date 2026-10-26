import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const read = (name) => readFile(new URL(name, import.meta.url), "utf8");

test("削除や一覧からの消失を提出済みにせず、確認済みの提出状態は維持する", async () => {
  const source = await read("home.js");
  const context = vm.createContext({ Date, URL });
  vm.runInContext(source.slice(source.indexOf("function deadlineDate"), source.indexOf("function openDay")), context);
  assert.equal(context.assignmentState({ _isCurrent: false, deadline: "2099-10-27 18:20" }), "overdue");
  assert.equal(context.assignmentState({ _isCurrent: false, submitted: true }), "submitted");
  assert.equal(context.assignmentState({ status: "not submitted", _isCurrent: false }), "overdue");
  assert.equal(context.assignmentState({ _isCurrent: true, submitted: false, deadline: "2099-10-27 18:20" }), "pending");
  assert.equal(context.deadlineDate({ deadline: "2026-10-27 18:20" }).toISOString(), "2026-10-27T09:20:00.000Z");
});

test("課題カレンダーは提出済み・期限切れ・期限内を判定する", async () => {
  const source = await read("home.js");
  assert.match(source, /return "submitted"/);
  assert.match(source, /return deadline && deadline\.getTime\(\) < Date\.now\(\) \? "overdue" : "pending"/);
  assert.match(source, /提出済み/);
  assert.match(source, /if \(item\._isCurrent === false\) return "overdue"/);
  assert.match(source, /期限内・未提出/);
});

test("カレンダーの色は提出済み青・期限切れ赤・期限内未提出を明暗反転する", async () => {
  const css = await read("caremate_shell.css");
  assert.match(css, /\.cm-calendar-chip\.assignment\.is-submitted\s*\{[^}]*background:\s*#2563eb/);
  assert.match(css, /\.cm-calendar-chip\.assignment\.is-overdue\s*\{[^}]*background:\s*#d92f4c/);
  assert.match(css, /\.cm-calendar-chip\.assignment\.is-pending\s*\{[^}]*color:\s*#fff;[^}]*background:\s*#151515/);
  assert.match(css, /\.dark \.cm-calendar-chip\.assignment\.is-pending\s*\{[^}]*color:\s*#111;[^}]*background:\s*#f5f5f5/);
});
