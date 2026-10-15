import test from "node:test";
import assert from "node:assert/strict";
import { calculateAttendanceEligibility } from "./attendance_eligibility.mjs";

test("15回講義は6回目の欠席で初めて3分の2未満になる", () => {
  const initial = calculateAttendanceEligibility(15, 0, false);
  assert.equal(initial.requiredAttendance, 10);
  assert.equal(initial.firstDisqualifyingAbsence, 6);
  assert.equal(initial.remainingAbsences, 6);
  assert.equal(initial.isDisqualified, false);
});

test("次の欠席で資格を失う場合と資格喪失後を区別する", () => {
  const atRisk = calculateAttendanceEligibility(15, 5, false);
  assert.equal(atRisk.remainingAbsences, 1);
  assert.equal(atRisk.isAtRisk, true);
  assert.equal(atRisk.isDisqualified, false);

  const lost = calculateAttendanceEligibility(15, 6, false);
  assert.equal(lost.remainingAbsences, 0);
  assert.equal(lost.isAtRisk, false);
  assert.equal(lost.isDisqualified, true);
});

test("実習科目は5分の4を基準に計算する", () => {
  assert.deepEqual(calculateAttendanceEligibility(15, 3, true), {
    requiredAttendance: 12,
    firstDisqualifyingAbsence: 4,
    remainingAbsences: 1,
    isAtRisk: true,
    isDisqualified: false,
  });
});
