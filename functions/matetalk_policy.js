const crypto = require("node:crypto");

const MATETALK_ADMIN = "2510044";

function normalizeStudentNumber(value) {
  const normalized = String(value || "").trim();
  return /^\d{7}$/.test(normalized) ? normalized : "";
}

function normalizeExchangeId(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{3,19}$/.test(normalized) ? normalized : "";
}

function sanitizeNickname(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 20);
}

function sanitizeMessage(value) {
  return String(value || "").replace(/\r\n?/g, "\n").trim().slice(0, 2000);
}

function studentRoomId(left, right) {
  const participants = [normalizeStudentNumber(left), normalizeStudentNumber(right)]
    .filter(Boolean)
    .sort();
  if (participants.length !== 2 || participants[0] === participants[1]) return "";
  return `student_${crypto.createHash("sha256").update(participants.join(":"))
    .digest("hex").slice(0, 24)}`;
}

function adminRoomId(studentNumber) {
  const normalized = normalizeStudentNumber(studentNumber);
  return normalized && normalized !== MATETALK_ADMIN ? `admin_${normalized}` : "";
}

function canAccessRoom(room, studentNumber) {
  const normalized = normalizeStudentNumber(studentNumber);
  return Boolean(normalized && Array.isArray(room?.participants) && room.participants.includes(normalized));
}

function scheduleEventKey(event = {}) {
  return [
    String(event.kind || "schedule"),
    String(event.date || ""),
    String(event.startTime || ""),
    String(event.title || event.subject || "").replace(/\s+/g, " ").trim(),
    String(event.classGroup || "").replace(/\s+/g, " ").trim(),
  ].join(":").slice(0, 500);
}

module.exports = {
  MATETALK_ADMIN,
  normalizeStudentNumber,
  normalizeExchangeId,
  sanitizeNickname,
  sanitizeMessage,
  studentRoomId,
  adminRoomId,
  canAccessRoom,
  scheduleEventKey,
};
