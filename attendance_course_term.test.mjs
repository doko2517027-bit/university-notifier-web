import test from "node:test";
import assert from "node:assert/strict";
import { resolveAttendanceCourseSemester, publishedScheduleSemesterForDate } from "./attendance_course_term.mjs";

test("当年度の科目を通期から前期に直したら個人の旧設定を上書きする", () => {
  assert.equal(resolveAttendanceCourseSemester(
    { academicYear: 2026, semester: "通期", registeredSemester: "後期" },
    { semester: "前期" },
    2026,
  ), "前期");
});

test("過年度の履修履歴は現在の科目設定で書き換えない", () => {
  assert.equal(resolveAttendanceCourseSemester(
    { academicYear: 2025, semester: "通期", registeredSemester: "後期" },
    { semester: "前期" },
    2026,
  ), "後期");
});

test("9月でも公式時間割が後期なら当日の表示は後期として扱う", () => {
  const timetable = { scheduleTerm: "後期", allDays: [{ date: "2026-09-28" }] };
  assert.equal(publishedScheduleSemesterForDate(timetable, "2026-09-28"), "後期");
  assert.equal(publishedScheduleSemesterForDate(timetable, "2026-05-01"), "");
});
