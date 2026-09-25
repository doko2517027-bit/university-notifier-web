import test from "node:test";
import assert from "node:assert/strict";
import { dateKey, parseManabaDeadline, normalizeGrade, matchesSharedAudience, monthCells, safeReminderMinutes, normalizeCalendarView, weekDays, shiftCalendarDate } from "./calendar_model.mjs";
import { JAPANESE_HOLIDAYS } from "./calendar_holidays.mjs";

test("Manaba締切を実在する日時だけ解析する", () => {
  assert.equal(dateKey(parseManabaDeadline("2026-10-13 16:30")), "2026-10-13");
  assert.equal(parseManabaDeadline("2026-02-30 10:00"), null);
});

test("共有予定は学科と学年で絞り、全学年も扱う", () => {
  const user = { department: "看護学科", grade: "２年", major: "" };
  assert.equal(matchesSharedAudience({ department: "看護学科", grade: "2" }, user), true);
  assert.equal(matchesSharedAudience({ department: "看護学科", grade: "4" }, user), false);
  assert.equal(matchesSharedAudience({ department: "", grade: "" }, user), true);
  assert.equal(normalizeGrade(user.grade), "2");
});

test("月表示は日曜日から42日で、休日も含む", () => {
  assert.equal(monthCells(2026, 8).length, 42);
  assert.equal(monthCells(2026, 8)[0].date, "2026-08-30");
  assert.equal(JAPANESE_HOLIDAYS["2026-09-22"], "国民の休日");
});

test("リマインダーは対応する時間だけを重複なく保存する", () => {
  assert.deepEqual(safeReminderMinutes([1440, 10, 10, 7]), [10, 1440]);
});

test("月・週・日の切り替えと期間移動は日付境界を保つ", () => {
  assert.equal(normalizeCalendarView("week"), "week");
  assert.equal(normalizeCalendarView("unknown"), "month");
  assert.deepEqual(weekDays("2026-09-25"), ["2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26"]);
  assert.equal(shiftCalendarDate("2026-01-31", "month", 1), "2026-02-28");
  assert.equal(shiftCalendarDate("2026-09-25", "week", 1), "2026-10-02");
  assert.equal(shiftCalendarDate("2026-09-25", "day", 1), "2026-09-26");
});
