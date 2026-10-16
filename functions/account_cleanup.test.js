const test = require("node:test");
const assert = require("node:assert/strict");
const { isPurgeEligible, deleteCareMateDataExceptExternalMedia } = require("./account_cleanup.js");
const { matchesPasswordHash } = require("../functions-delete/password_policy.js");

test("旧ステータスや30日未満の学生は削除しない", () => {
  const now = Date.parse("2027-05-01T00:00:00+09:00");
  assert.equal(isPurgeEligible({ academicStatus: "graduated", graduatedAt: "2027-03-20" }, now), false);
  assert.equal(isPurgeEligible({
    academicStatus: "graduated",
    deletionLifecycleVersion: 1,
    graduatedAt: "2027-04-20",
    scheduledDeleteAt: "2027-05-19T15:00:00.000Z",
  }, now), false);
});

test("正式な卒業・退学日から30日後だけ削除対象にする", () => {
  const profile = {
    academicStatus: "graduated",
    deletionLifecycleVersion: 1,
    graduatedAt: "2027-03-20T00:00:00+09:00",
    scheduledDeleteAt: "2027-04-18T15:00:00.000Z",
  };
  assert.equal(isPurgeEligible(profile, Date.parse("2027-04-18T14:59:59Z")), false);
  assert.equal(isPurgeEligible(profile, Date.parse("2027-04-18T15:00:00Z")), true);
});

test("アカウント削除は学生が参加する全メイトーク部屋を再帰削除する", async () => {
  const deletedPaths = [];
  const collection = (name) => ({
    doc: (id) => ({ path: `${name}/${id}` }),
    where: (field, operator, value) => ({
      get: async () => {
        if (name === "mateTalkRooms" && field === "participants" && operator === "array-contains" && value === "1234567") {
          return { size: 1, docs: [{ ref: { path: `${name}/group_for_student` } }] };
        }
        return { size: 0, docs: [] };
      },
    }),
    listDocuments: async () => [],
  });
  const services = {
    db: {
      collection,
      recursiveDelete: async (ref) => { deletedPaths.push(ref.path); },
    },
    auth: { deleteUser: async (uid) => { deletedPaths.push(`auth/${uid}`); } },
    realtimeDb: { ref: (path) => ({ remove: async () => { deletedPaths.push(`rtdb/${path}`); } }) },
  };

  const result = await deleteCareMateDataExceptExternalMedia(services, "1234567");

  assert.equal(result.deletedMateTalkRooms, 1);
  assert.ok(deletedPaths.includes("mateTalkRooms/group_for_student"));
  assert.ok(deletedPaths.includes("users/1234567"));
  assert.ok(deletedPaths.includes("referralIdentityRegistry/1234567"));
  assert.ok(deletedPaths.includes("auth/caremate-1234567"));
});

test("本人削除のパスワード照合は正しい値だけを受け入れる", () => {
  const crypto = require("node:crypto");
  const hash = crypto.createHash("sha256").update("secret-pass", "utf8").digest("hex");
  assert.equal(matchesPasswordHash("secret-pass", hash), true);
  assert.equal(matchesPasswordHash("wrong-pass", hash), false);
  assert.equal(matchesPasswordHash("secret-pass", "invalid"), false);
});
