import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (name) => readFile(new URL(name, import.meta.url), "utf8");

test("課題カレンダーはホームにあり、日別詳細と自分の予定追加を持つ", async () => {
  const [home, script, rules] = await Promise.all([read("./home.html"), read("./home.js"), read("./firestore.rules")]);
  assert.match(home, /id="calendarGrid"/);
  assert.match(home, /id="calendarDayOverlay"/);
  assert.match(home, /id="personalEventForm"/);
  assert.match(script, /manabaの課題を開く/);
  assert.match(script, /calendarPersonal/);
  assert.match(home, /data-entry="\.\/home\.js\?v=/);
  assert.match(script, /for \(const task of tasks\) \{/);
  assert.match(script, /assignmentState\(task\)/);
  assert.match(script, /cm-calendar-chip assignment is-\$\{state\}/);
  assert.doesNotMatch(script, /ほか .*件|\$\{count\}件/);
  assert.match(rules, /match \/calendarPersonal\/\{studentNumber\}\/items\/\{id\}/);
  assert.match(rules, /allow get, list: if owner\(studentNumber\)/);
});

test("課題タブは締切順の一覧だけで、提出チェックを持たない", async () => {
  const [html, script] = await Promise.all([read("./assignments.html"), read("./assignments.js")]);
  assert.doesNotMatch(html, /calendarGrid|課題カレンダー/);
  assert.match(script, /dueDate\(a\) - dueDate\(b\)/);
  assert.match(html, /data-entry="\.\/assignments\.js\?v=/);
  assert.doesNotMatch(script, /calendarAssignments/);
  assert.match(script, /課題を開く/);
  assert.doesNotMatch(script, /assignmentCompletions|checkbox|提出済みにする/);
});
