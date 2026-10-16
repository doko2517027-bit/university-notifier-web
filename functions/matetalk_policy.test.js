const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MATETALK_ADMIN,
  normalizeExchangeId,
  sanitizeMessage,
  studentRoomId,
  adminRoomId,
  canAccessRoom,
  scheduleEventKey,
} = require("./matetalk_policy");

test("交換IDは小文字化し安全な形式だけ許可する", () => {
  assert.equal(normalizeExchangeId(" Caremate_00 "), "caremate_00");
  assert.equal(normalizeExchangeId("短"), "");
  assert.equal(normalizeExchangeId("ab"), "");
});

test("学生ルームIDは参加者の順序によらず一定", () => {
  assert.equal(studentRoomId("2510001", "2510002"), studentRoomId("2510002", "2510001"));
  assert.equal(studentRoomId("2510001", "2510001"), "");
});

test("管理者ルームは2510044本人には作らない", () => {
  assert.equal(adminRoomId("2510147"), "admin_2510147");
  assert.equal(adminRoomId(MATETALK_ADMIN), "");
});

test("参加者だけがルームへアクセスできる", () => {
  const room = { participants: ["2510001", "2510002"] };
  assert.equal(canAccessRoom(room, "2510002"), true);
  assert.equal(canAccessRoom(room, "2510003"), false);
});

test("メッセージと予定キーを正規化する", () => {
  assert.equal(sanitizeMessage(" こんにちは\r\n世界 "), "こんにちは\n世界");
  assert.equal(scheduleEventKey({ kind: "timetable", date: "2026-10-20", startTime: "16:20", subject: "社会福祉論", classGroup: "Aクラス" }), "timetable:2026-10-20:16:20:社会福祉論:Aクラス");
});
