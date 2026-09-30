const test = require("node:test");
const assert = require("node:assert/strict");
const { isPurgeEligible } = require("./account_cleanup.js");

test("旧ステータスや30日未満の学生は削除しない", () => {
  const now = Date.parse("2027-05-01T00:00:00+09:00");
  assert.equal(isPurgeEligible({ academicStatus: "graduated", graduatedAt: "2027-03-20" }, now), false);
  assert.equal(isPurgeEligible({
    academicStatus: "graduated",
    deletionLifecycleVersion: 1,
    graduatedAt: "2027-04-20",
    scheduledDeleteAt: "2027-05-19T15:00:00.000Z",
  }, now), false);
});

test("正式な卒業・退学日から30日後だけ削除対象にする", () => {
  const profile = {
    academicStatus: "graduated",
    deletionLifecycleVersion: 1,
    graduatedAt: "2027-03-20T00:00:00+09:00",
    scheduledDeleteAt: "2027-04-18T15:00:00.000Z",
  };
  assert.equal(isPurgeEligible(profile, Date.parse("2027-04-18T14:59:59Z")), false);
  assert.equal(isPurgeEligible(profile, Date.parse("2027-04-18T15:00:00Z")), true);
});
