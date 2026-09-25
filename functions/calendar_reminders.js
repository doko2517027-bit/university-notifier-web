const ALLOWED_MINUTES = new Set([0, 10, 60, 1440]);

function reminderMinutes(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(Number))]
    .filter((value) => ALLOWED_MINUTES.has(value));
}

function isReminderDue(startAt, minutes, now = new Date()) {
  const start = startAt?.toDate?.() || new Date(startAt);
  if (Number.isNaN(start.getTime()) || !ALLOWED_MINUTES.has(minutes)) return false;
  const elapsed = now.getTime() - (start.getTime() - minutes * 60000);
  return elapsed >= 0 && elapsed < 30 * 60000;
}

function matchesAudience(event, user) {
  const grade = (value) => String(value || "").normalize("NFKC").replace("年", "").trim();
  return (!event.department || event.department === user.department) &&
    (!event.major || event.major === user.major) &&
    (!event.grade || grade(event.grade) === grade(user.grade));
}

module.exports = { reminderMinutes, isReminderDue, matchesAudience };
