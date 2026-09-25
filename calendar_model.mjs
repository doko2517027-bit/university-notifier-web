export const REMINDER_OPTIONS = [
  { minutes: 0, label: "開始時刻" },
  { minutes: 10, label: "10分前" },
  { minutes: 60, label: "1時間前" },
  { minutes: 1440, label: "1日前" },
];

export function dateKey(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseManabaDeadline(value) {
  const match = String(value || "").match(
    /(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?\s*(\d{1,2}):(\d{2})/,
  );
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  if (
    date.getFullYear() !== year || date.getMonth() !== month - 1 ||
    date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute
  ) return null;
  return date;
}

export function normalizeGrade(value) {
  return String(value || "").normalize("NFKC").replace("年", "").trim();
}

export function matchesSharedAudience(event, user) {
  const department = String(event.department || "").trim();
  const major = String(event.major || "").trim();
  const grade = normalizeGrade(event.grade);
  return (
    (!department || department === String(user.department || "").trim()) &&
    (!major || major === String(user.major || "").trim()) &&
    (!grade || grade === normalizeGrade(user.grade))
  );
}

export function monthCells(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const start = new Date(year, monthIndex, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date: dateKey(date), inMonth: date.getMonth() === monthIndex };
  });
}

export function normalizeCalendarView(value) {
  return ["month", "week", "day"].includes(value) ? value : "month";
}

export function weekDays(value) {
  const date = value instanceof Date ? new Date(value) : new Date(`${dateKey(value)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return [];
  date.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(date);
    day.setDate(date.getDate() + index);
    return dateKey(day);
  });
}

export function shiftCalendarDate(value, view, amount) {
  const date = value instanceof Date ? new Date(value) : new Date(`${dateKey(value)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  if (normalizeCalendarView(view) === "month") {
    const day = date.getDate();
    const target = new Date(date.getFullYear(), date.getMonth() + amount, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, lastDay));
    return dateKey(target);
  }
  date.setDate(date.getDate() + amount * (view === "week" ? 7 : 1));
  return dateKey(date);
}

export function safeReminderMinutes(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(Number))]
    .filter((value) => [0, 10, 60, 1440].includes(value))
    .sort((a, b) => a - b);
}
