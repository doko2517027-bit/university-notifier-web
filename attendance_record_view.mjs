function timestampMillis(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function choosePreferredAttendanceRecord(current, candidate) {
  if (!current) return candidate;
  if (!candidate) return current;

  // 修正済みの判定は古い打刻レコードより優先する。
  if (current.manualEdited !== candidate.manualEdited) {
    return candidate.manualEdited === true ? candidate : current;
  }

  const currentTime = timestampMillis(current.editedAt || current.updatedAt || current.startStampedAt);
  const candidateTime = timestampMillis(candidate.editedAt || candidate.updatedAt || candidate.startStampedAt);
  return candidateTime > currentTime ? candidate : current;
}

export function dedupeAttendanceRecords(rows, keyOf) {
  const bySession = new Map();
  for (const record of rows) {
    const key = keyOf(record);
    bySession.set(key, choosePreferredAttendanceRecord(bySession.get(key), record));
  }
  return [...bySession.values()];
}
