const test = require("node:test");
const assert = require("node:assert/strict");
const { manualUpdateDecision } = require("./manual_update_policy.js");

test("実行中の同じ学生は重複してキューへ入れない", () => {
  assert.deepEqual(
    manualUpdateDecision({ status: "running", updatedAt: 900 }, 1000),
    { allowed: false, reason: "already-running" },
  );
});

test("完了直後は連打を防ぎ、5分後は再実行できる", () => {
  assert.equal(
    manualUpdateDecision({ status: "success", updatedAt: 1000 }, 2000).reason,
    "cooldown",
  );
  assert.equal(
    manualUpdateDecision({ status: "success", updatedAt: 1000 }, 301001).allowed,
    true,
  );
});

test("30分止まった処理は再実行できる", () => {
  assert.equal(
    manualUpdateDecision({ status: "queued", updatedAt: 1000 }, 1801001).allowed,
    true,
  );
});
