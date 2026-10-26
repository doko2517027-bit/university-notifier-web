"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { deadlineMs, reminderDue } = require("./assignment_notification_policy.js");

test("締切は端末・サーバーの現地時刻に関係なく日本時間で解釈する", () => {
  assert.equal(deadlineMs("2026-10-27 18:20"), Date.parse("2026-10-27T09:20:00Z"));
  assert.ok(Number.isNaN(deadlineMs("未定")));
});
test("通知時刻前には送らず、到達時に送り、期限切れ後は送らない", () => {
  const deadline = deadlineMs("2026-10-27 18:20");
  const target = deadline - 3600000;
  assert.equal(reminderDue(deadline, 60, target - 1), false);
  assert.equal(reminderDue(deadline, 60, target), true);
  assert.equal(reminderDue(deadline, 60, target + 59000), true);
  assert.equal(reminderDue(deadline, 60, target + 600000), false);
  assert.equal(reminderDue(deadline, 60, deadline), false);
});
