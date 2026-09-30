export function dayNumberFromLocalDateKey(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
  if (!match) return 0;
  return Math.floor(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) /
      86400000,
  );
}

export function stableQuestionOffset(subjectId, unitId) {
  return [...`${subjectId || ""}|${unitId || ""}`].reduce(
    (sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0,
    7,
  );
}

export function dailyQuestionIndex({ dateKey, subjectId, unitId, poolLength }) {
  const length = Math.max(0, Number(poolLength) || 0);
  if (!length) return -1;
  return (
    (dayNumberFromLocalDateKey(dateKey) +
      stableQuestionOffset(subjectId, unitId)) %
    length
  );
}
