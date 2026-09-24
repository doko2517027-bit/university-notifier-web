const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeGrade,
  attendanceNotificationType,
  canRetryAttendanceDispatch,
} = require("./attendance_policy");

test("公式時間割の全角学年と学生の半角学年を同じ学年として扱う", () => {
  assert.equal(normalizeGrade("２年"), normalizeGrade("2年"));
  assert.equal(normalizeGrade("２年"), "2");
  assert.notEqual(normalizeGrade("４年"), normalizeGrade("2年"));
});

test("送信済み端末は重複送信せず、失敗時だけ1分後に再試行する", () => {
  const now = 120_000;
  assert.equal(
    canRetryAttendanceDispatch([{ result: "sent" }], 0, now),
    false,
  );
  assert.equal(
    canRetryAttendanceDispatch([{ result: "failed" }], 90_000, now),
    false,
  );
  assert.equal(
    canRetryAttendanceDispatch([{ result: "failed" }], 60_000, now),
    true,
  );
  assert.equal(canRetryAttendanceDispatch([], 60_000, now), true);
});

test("起動が数分遅れても講義開始と終了前の通知を判定する", () => {
  const start = 9 * 60;
  const end = 10 * 60 + 30;

  assert.equal(attendanceNotificationType(start - 11, start, end), "");
  assert.equal(attendanceNotificationType(start - 10, start, end), "arrival");
  assert.equal(attendanceNotificationType(start - 6, start, end), "arrival");
  assert.equal(attendanceNotificationType(start - 5, start, end), "");
  assert.equal(attendanceNotificationType(end - 5, start, end), "departure");
  assert.equal(attendanceNotificationType(end - 1, start, end), "departure");
  assert.equal(attendanceNotificationType(end, start, end), "");
});
