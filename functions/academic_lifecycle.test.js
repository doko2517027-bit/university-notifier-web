const test = require("node:test");
const assert = require("node:assert/strict");
const { officialStartDate, statusRetentionDate } = require("./academic_lifecycle.js");

test("卒業・退学の正式日付から30日後を保持期限にする", () => {
  assert.deepEqual(statusRetentionDate("2027-03-20"), {
    officialAt: "2027-03-19T15:00:00.000Z",
    deleteAt: "2027-04-18T15:00:00.000Z",
  });
  assert.equal(statusRetentionDate("2027-02-30"), null);
  assert.equal(statusRetentionDate("2027/03/20"), null);
});

test("休学開始日を日本時間の0時として保存する", () => {
  assert.equal(officialStartDate("2027-04-10"), "2027-04-09T15:00:00.000Z");
  assert.equal(officialStartDate("2027-02-30"), null);
});
