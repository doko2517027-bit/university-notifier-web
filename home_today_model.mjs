import { dateKey, matchesSharedAudience, parseManabaDeadline } from "./calendar_model.mjs";
import { PERIOD_TIMES } from "./attendance_policy.js";

export function asDate(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

export function todayKey(now = new Date()) {
  return dateKey(now);
}

export function hasTimeElapsed(endAt, now = new Date()) {
  const end = asDate(endAt);
  return Boolean(end && end.getTime() < now.getTime());
}

export function manualTodoIsDimmed(todo, now = new Date()) {
  if (todo.completed === true) return true;
  if (!/^\d{2}:\d{2}$/.test(String(todo.dueTime || ""))) return false;
  return hasTimeElapsed(`${todo.date}T${todo.dueTime}:00`, now);
}

export function lectureTimes(lecture) {
  const period = Number(String(lecture.period || "").normalize("NFKC").match(/\d+/)?.[0] || 0);
  return {
    startTime: lecture.startTime || PERIOD_TIMES[period]?.startTime || "",
    endTime: lecture.endTime || PERIOD_TIMES[period]?.endTime || "",
  };
}

export function findNextLecture(days = [], now = new Date()) {
  const candidates = [];
  for (const day of days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day.date || ""))) continue;
    for (const lecture of day.schedules || []) {
      const { startTime, endTime } = lectureTimes(lecture);
      if (!startTime || !lecture.subject) continue;
      const startsAt = asDate(`${day.date}T${startTime}:00`);
      if (startsAt && startsAt > now) candidates.push({ ...lecture, date: day.date, startTime, endTime, startsAt });
    }
  }
  candidates.sort((left, right) => left.startsAt - right.startsAt);
  return candidates[0] || null;
}

export function buildTodayAutomaticItems({ assignments = [], archivedAssignments = [], personalEvents = [], sharedEvents = [], lectures = [], user = {}, now = new Date() }) {
  const day = todayKey(now);
  const items = [];
  const seenAssignments = new Map();

  for (const assignment of [...assignments, ...archivedAssignments]) {
    const deadline = asDate(assignment.deadlineAt) || parseManabaDeadline(assignment.deadlineText || assignment.deadline);
    if (!deadline || dateKey(deadline) !== day) continue;
    const identity = String(assignment.url || "").trim() || `${assignment.course || ""}|${assignment.title || ""}`;
    const submitted = assignment.submitted === true || ["submitted", "提出済み"].includes(String(assignment.status || ""));
    if (seenAssignments.has(identity)) {
      if (submitted) seenAssignments.get(identity).submitted = true;
      continue;
    }
    const item = { kind: "assignment", title: assignment.title || "課題", detail: assignment.course || "課題", endAt: deadline, sortAt: deadline, identity, submitted };
    seenAssignments.set(identity, item);
    items.push(item);
  }

  for (const [kind, source] of [["personal", personalEvents], ["shared", sharedEvents]]) {
    for (const event of source) {
      if (kind === "shared" && !matchesSharedAudience(event, user)) continue;
      const start = asDate(event.startAt);
      const end = asDate(event.endAt) || start;
      if (!start || dateKey(start) > day || dateKey(end) < day) continue;
      const timeText = event.allDay === true ? "終日" : `${start.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}–${end.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`;
      items.push({ kind, title: event.title || "予定", detail: `${kind === "shared" ? "共有予定" : "自分の予定"}・${timeText}`, endAt: end, allDay: event.allDay === true, sortAt: start });
    }
  }

  for (const lecture of lectures) {
    const title = String(lecture.subject || "").trim();
    if (!title) continue;
    const { startTime, endTime } = lectureTimes(lecture);
    const period = String(lecture.period || "").trim();
    const periodText = period ? (period.includes("限") ? period : `${period}限`) : "";
    items.push({ kind: "lecture", title, detail: [periodText, startTime && endTime ? `${startTime}–${endTime}` : startTime, lecture.classSelectionRequired ? "クラス未選択" : lecture.classGroup ? `${lecture.classGroup}クラス` : ""].filter(Boolean).join("・"), endAt: /^\d{1,2}:\d{2}$/.test(endTime) ? `${day}T${endTime}:00` : null, sortAt: startTime ? `${day}T${startTime}:00` : null });
  }
  return items.sort((left, right) => (asDate(left.sortAt)?.getTime() || 0) - (asDate(right.sortAt)?.getTime() || 0));
}
