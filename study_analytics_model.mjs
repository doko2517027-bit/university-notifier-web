const DAY_MS = 86_400_000;

export function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function localDateKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return `${hours}時間${minutes ? `${minutes}分` : ""}`;
  return `${minutes}分`;
}

export function studyWindowStart(range, now = new Date()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  if (range === "today") return date.getTime();
  if (range === "7d") return date.getTime() - 6 * DAY_MS;
  if (range === "30d") return date.getTime() - 29 * DAY_MS;
  if (range === "month") return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  if (range === "3m") return new Date(date.getFullYear(), date.getMonth() - 2, 1).getTime();
  if (range === "1y") return new Date(date.getFullYear() - 1, date.getMonth(), date.getDate()).getTime();
  return 0;
}

function sessionSeconds(session) {
  const value = Number(session.durationSeconds || 0);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 43_200) : 0;
}

export function summarizeStudyData(sessions = [], attempts = [], now = new Date()) {
  const nowMs = new Date(now).getTime();
  const todayStart = studyWindowStart("today", now);
  const weekStart = studyWindowStart("7d", now);
  const monthStart = studyWindowStart("month", now);
  const normalizedSessions = sessions.map((item) => ({
    ...item,
    time: toMillis(item.endedAt || item.startedAt || item.createdAt),
    seconds: sessionSeconds(item),
  }));
  const normalizedAttempts = attempts.map((item) => ({
    ...item,
    time: toMillis(item.answeredAt || item.createdAt),
  }));
  const sumSince = (start) => normalizedSessions
    .filter((item) => item.time >= start && item.time <= nowMs)
    .reduce((total, item) => total + item.seconds, 0);
  const answered = normalizedAttempts.filter((item) => item.correct === true || item.correct === false);
  const correct = answered.filter((item) => item.correct === true).length;
  const uniqueQuestions = new Set(normalizedAttempts.map((item) => item.questionKey || item.questionId).filter(Boolean));
  const days = new Map();
  normalizedSessions.forEach((item) => {
    if (!item.time || !item.seconds) return;
    const key = localDateKey(item.time);
    days.set(key, (days.get(key) || 0) + item.seconds);
  });
  const sortedDays = [...days.keys()].sort();
  let currentStreak = 0;
  for (let cursor = new Date(now); ; cursor = new Date(cursor.getTime() - DAY_MS)) {
    const key = localDateKey(cursor);
    if (!days.has(key)) {
      if (currentStreak === 0 && key === localDateKey(now)) continue;
      break;
    }
    currentStreak += 1;
  }
  let longestStreak = 0;
  let run = 0;
  let previous = 0;
  sortedDays.forEach((key) => {
    const stamp = new Date(`${key}T00:00:00`).getTime();
    run = previous && stamp - previous === DAY_MS ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = stamp;
  });
  return {
    todaySeconds: sumSince(todayStart),
    weekSeconds: sumSince(weekStart),
    monthSeconds: sumSince(monthStart),
    totalSeconds: sumSince(0),
    todayQuestions: normalizedAttempts.filter((item) => item.time >= todayStart).length,
    totalAttempts: normalizedAttempts.length,
    answeredCount: answered.length,
    correctCount: correct,
    incorrectCount: answered.length - correct,
    accuracy: answered.length ? (correct / answered.length) * 100 : null,
    uniqueAnswered: uniqueQuestions.size,
    currentStreak,
    longestStreak,
    days,
  };
}

export function aggregateBySubject(sessions = [], attempts = []) {
  const map = new Map();
  const ensure = (id, name) => {
    const key = String(id || name || "other");
    if (!map.has(key)) map.set(key, {
      id: key,
      name: String(name || id || "その他"),
      seconds: 0,
      attempts: 0,
      correct: 0,
      responseSeconds: 0,
    });
    return map.get(key);
  };
  sessions.forEach((item) => {
    ensure(item.subjectId, item.subjectName).seconds += sessionSeconds(item);
  });
  attempts.forEach((item) => {
    const row = ensure(item.subjectId, item.subjectName);
    row.attempts += 1;
    if (item.correct === true) row.correct += 1;
    row.responseSeconds += Math.max(0, Number(item.responseSeconds) || 0);
  });
  return [...map.values()].map((row) => ({
    ...row,
    accuracy: row.attempts ? (row.correct / row.attempts) * 100 : null,
    averageResponseSeconds: row.attempts ? row.responseSeconds / row.attempts : null,
  })).sort((a, b) => b.seconds - a.seconds || b.attempts - a.attempts);
}

export function aggregateAttempts(attempts = [], keyName = "unitId") {
  const map = new Map();
  attempts.forEach((item) => {
    const id = String(item[keyName] || "unclassified");
    const nameKey = keyName === "unitId" ? "unitName" : "subjectName";
    if (!map.has(id)) map.set(id, { id, name: item[nameKey] || "未分類", attempts: 0, correct: 0, responseSeconds: 0 });
    const row = map.get(id);
    row.attempts += 1;
    if (item.correct === true) row.correct += 1;
    row.responseSeconds += Math.max(0, Number(item.responseSeconds) || 0);
  });
  return [...map.values()].map((row) => ({
    ...row,
    incorrect: row.attempts - row.correct,
    accuracy: row.attempts ? (row.correct / row.attempts) * 100 : null,
    averageResponseSeconds: row.attempts ? row.responseSeconds / row.attempts : null,
    dataSufficient: row.attempts >= 5,
  }));
}

export function problemStats(attempts = []) {
  const map = new Map();
  [...attempts].sort((a, b) => toMillis(a.answeredAt) - toMillis(b.answeredAt)).forEach((item) => {
    const key = item.questionKey || `${item.type || "quiz"}:${item.subjectId || ""}:${item.unitId || ""}:${item.questionId || ""}`;
    if (!map.has(key)) map.set(key, { key, attempts: [], correct: 0, incorrect: 0, consecutiveCorrect: 0 });
    const row = map.get(key);
    row.attempts.push(item);
    row.question = item.question || row.question || "問題";
    row.subjectId = item.subjectId || row.subjectId;
    row.subjectName = item.subjectName || row.subjectName;
    row.unitId = item.unitId || row.unitId;
    row.unitName = item.unitName || row.unitName;
    row.type = item.type || row.type || "quiz";
    if (item.correct === true) {
      row.correct += 1;
      row.consecutiveCorrect += 1;
    } else if (item.correct === false) {
      row.incorrect += 1;
      row.consecutiveCorrect = 0;
    }
    row.last = item;
  });
  return [...map.values()].map((row) => ({
    ...row,
    accuracy: row.attempts.length ? (row.correct / row.attempts.length) * 100 : null,
    firstCorrect: row.attempts[0]?.correct === true,
    improved: row.attempts.some((item) => item.correct === false) && row.last?.correct === true,
    averageResponseSeconds: row.attempts.length
      ? row.attempts.reduce((sum, item) => sum + Math.max(0, Number(item.responseSeconds) || 0), 0) / row.attempts.length
      : null,
  }));
}

export function weakAreaRanking(rows = []) {
  return rows.map((row) => ({
    ...row,
    weaknessScore: row.dataSufficient
      ? (100 - (row.accuracy || 0)) * Math.log2(row.attempts + 1)
      : null,
  })).sort((a, b) => {
    if (a.weaknessScore == null) return 1;
    if (b.weaknessScore == null) return -1;
    return b.weaknessScore - a.weaknessScore;
  });
}

export function nextReviewAt(attempts = [], now = new Date()) {
  const sorted = [...attempts].sort((a, b) => toMillis(a.answeredAt) - toMillis(b.answeredAt));
  const last = sorted.at(-1);
  if (!last) return new Date(now).getTime();
  const correctRun = [...sorted].reverse().findIndex((item) => item.correct !== true);
  const run = correctRun === -1 ? sorted.length : correctRun;
  const intervals = [1, 3, 7, 14, 30];
  const days = last.correct === true ? intervals[Math.min(run, intervals.length - 1)] : 1;
  return toMillis(last.answeredAt) + days * DAY_MS;
}

export function buildStudyReport(sessions = [], attempts = [], now = new Date()) {
  const summary = summarizeStudyData(sessions, attempts, now);
  const subjects = aggregateBySubject(sessions, attempts);
  const units = weakAreaRanking(aggregateAttempts(attempts, "unitId"));
  const topStudy = subjects[0];
  const weak = units.find((item) => item.dataSufficient);
  const comment = !sessions.length && !attempts.length
    ? "学習を記録すると、ここにデータに基づく振り返りが表示されます。"
    : `${topStudy ? `${topStudy.name}の学習記録が最も多いです。` : ""}${weak ? ` ${weak.name}は正答率${Math.round(weak.accuracy)}%のため、復習候補です。` : " 解答データが5件以上になると苦手単元を判定します。"}`.trim();
  return { summary, subjects, units, topStudy, weak, comment };
}

export function sessionsToCsv(sessions = []) {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const header = ["学習日", "開始", "終了", "学習時間（分）", "科目", "内容", "方法"];
  const rows = sessions.map((item) => [
    localDateKey(toMillis(item.startedAt || item.createdAt)),
    new Date(toMillis(item.startedAt)).toLocaleTimeString("ja-JP"),
    new Date(toMillis(item.endedAt)).toLocaleTimeString("ja-JP"),
    Math.round(sessionSeconds(item) / 60),
    item.subjectName || "その他",
    item.content || "",
    item.source === "exam" ? "テスト対策問題" : "自主学習",
  ]);
  return [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}
