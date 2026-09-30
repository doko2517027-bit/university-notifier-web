import test from "node:test";
import assert from "node:assert/strict";
import { academicYearAt, initialGradeForStudent, assessProgression, daysAfterDate, isLeaveActive, canReviseAnnualResponse } from "./academic_lifecycle.mjs";

test("入学年度から新規登録時の学年を年度ごとに判定する", () => {
  assert.equal(academicYearAt(new Date("2027-03-31T12:00:00+09:00")), 2026);
  assert.equal(academicYearAt(new Date("2027-04-01T12:00:00+09:00")), 2027);
  for (const [prefix, grade] of [["26", 1], ["25", 2], ["24", 3], ["23", 4]]) {
    assert.equal(initialGradeForStudent(`${prefix}10044`, 2026), grade);
  }
  assert.equal(initialGradeForStudent("2310044", 2027), null);
  assert.equal(initialGradeForStudent("2710044", 2027), 1);
});

test("看護の進級要件は学年別に科目数と単位を両方見る", () => {
  const missing = (grade, credits) => ({ required: true, grade, credits, status: "not_earned" });
  assert.equal(assessProgression({ department: "看護学科", grade: 1, records: [missing(1, 1), missing(1, 2)], complete: true }).status, "eligible");
  assert.equal(assessProgression({ department: "看護学科", grade: 1, records: [missing(1, 2), missing(1, 2)], complete: true }).status, "ineligible");
  assert.equal(assessProgression({ department: "看護学科", grade: 2, records: [missing(1, 1)], complete: true }).status, "ineligible");
  assert.equal(assessProgression({ department: "看護学科", grade: 3, records: [missing(3, 2), missing(3, 2)], complete: true }).status, "eligible");
  assert.equal(assessProgression({ department: "看護学科", grade: 3, records: [missing(3, 2), missing(3, 3)], complete: true }).status, "ineligible");
  assert.equal(assessProgression({ department: "看護学科", grade: 2, complete: false }).status, "unknown");
  assert.equal(assessProgression({ department: "理学療法学専攻", grade: 2 }).status, "eligible");
});

test("正式日付から30日後を削除予定日時にする", () => {
  assert.equal(daysAfterDate("2027-03-31", 30), "2027-04-29T15:00:00.000Z");
});

test("休学開始前は通常利用でき、開始日から休学扱いになる", () => {
  const user = { academicStatus: "leave", leaveSince: "2027-04-09T15:00:00.000Z" };
  assert.equal(isLeaveActive(user, new Date("2027-04-09T14:59:59.000Z")), false);
  assert.equal(isLeaveActive(user, new Date("2027-04-09T15:00:00.000Z")), true);
});

test("年度末の回答は受付中かつ反映前だけ本人が変更できる", () => {
  const transition = { enabled: true, academicYear: 2026 };
  const user = { annualTransitionResponse: { decisionVersion: 2, academicYear: 2026 } };
  assert.equal(canReviseAnnualResponse(transition, user), true);
  assert.equal(canReviseAnnualResponse({ ...transition, enabled: false }, user), false);
  assert.equal(canReviseAnnualResponse(transition, { ...user, annualProgression: { academicYear: 2026 } }), false);
});
