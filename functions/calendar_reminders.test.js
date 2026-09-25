const test = require("node:test");
const assert = require("node:assert/strict");
const { reminderMinutes, isReminderDue, matchesAudience } = require("./calendar_reminders");

test("only supported reminder intervals are retained", () => {
  assert.deepEqual(reminderMinutes(["10", 10, 1440, 15]), [10, 1440]);
});

test("reminders are due once within a bounded retry window", () => {
  const start = new Date("2026-09-25T10:10:00+09:00");
  assert.equal(isReminderDue(start, 10, new Date("2026-09-25T10:00:00+09:00")), true);
  assert.equal(isReminderDue(start, 10, new Date("2026-09-25T09:59:00+09:00")), false);
  assert.equal(isReminderDue(start, 10, new Date("2026-09-25T10:30:00+09:00")), false);
});

test("shared plans are restricted to their selected grade", () => {
  const event = { department: "看護学科", grade: "２年" };
  assert.equal(matchesAudience(event, { department: "看護学科", grade: "2" }), true);
  assert.equal(matchesAudience(event, { department: "看護学科", grade: "4" }), false);
});
