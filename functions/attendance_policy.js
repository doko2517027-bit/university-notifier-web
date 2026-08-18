const PERIOD_TIMES = Object.freeze({
  1: { startTime: "09:00", endTime: "10:30" },
  2: { startTime: "10:40", endTime: "12:10" },
  3: { startTime: "13:00", endTime: "14:30" },
  4: { startTime: "14:40", endTime: "16:10" },
  5: { startTime: "16:20", endTime: "17:50" },
});

function normalizeCourseName(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[（(]含?日本国憲法[)）]/g, "")
    .replace(/[（(]対面[)）]/g, "")
    .replace(/[（(][ab]クラス[)）]/g, "")
    .replace(/[\s　・･()（）「」『』]/g, "");
}

function slotId(scheduleId, date, period, subject) {
  return `${scheduleId}_${date}_P${period}_${encodeURIComponent(subject)}`;
}

function minutesFromTime(value) {
  const [hours, minutes] = String(value || "")
    .split(":")
    .map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes)
    ? hours * 60 + minutes
    : null;
}

function localMinutes(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function classifyArrival(date, startTime) {
  const delta = localMinutes(date) - minutesFromTime(startTime);
  if (delta <= 0) return "出席";
  if (delta <= 30) return "遅刻";
  return "欠席";
}

function classifyDeparture(date, endTime) {
  const delta = minutesFromTime(endTime) - localMinutes(date);
  if (delta <= 0) return "退席";
  if (delta <= 30) return "早退";
  return "欠席";
}

module.exports = {
  PERIOD_TIMES,
  normalizeCourseName,
  slotId,
  minutesFromTime,
  classifyArrival,
  classifyDeparture,
};
