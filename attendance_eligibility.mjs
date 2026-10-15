export function calculateAttendanceEligibility(
  totalLectures,
  absenceCount,
  isPractical = false,
) {
  const total = Math.max(0, Math.trunc(Number(totalLectures) || 0));
  if (!total) return null;

  const absences = Math.max(0, Math.trunc(Number(absenceCount) || 0));
  const numerator = isPractical ? 4 : 2;
  const denominator = isPractical ? 5 : 3;
  const requiredAttendance = Math.ceil((total * numerator) / denominator);
  const firstDisqualifyingAbsence = total - requiredAttendance + 1;
  const remainingAbsences = Math.max(
    0,
    firstDisqualifyingAbsence - absences,
  );

  return {
    requiredAttendance,
    firstDisqualifyingAbsence,
    remainingAbsences,
    isAtRisk: remainingAbsences === 1,
    isDisqualified: absences >= firstDisqualifyingAbsence,
  };
}
