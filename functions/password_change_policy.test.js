const assert = require("node:assert/strict");
const test = require("node:test");
const {
  hashPassword,
  hashLegacyPassword,
  matchesPasswordHash,
  needsPasswordUpgrade,
  isValidNewPassword,
} = require("./password_change_policy");

test("新しいパスワードはsalt付きPBKDF2で保存する", () => {
  const hash = hashPassword("新しいPass123");
  assert.match(hash, /^pbkdf2-v1\$direct\$600000\$/);
  assert.equal(matchesPasswordHash("新しいPass123", hash), true);
  assert.equal(matchesPasswordHash("違うPass123", hash), false);
  assert.equal(matchesPasswordHash("新しいPass123", "broken"), false);
});

test("旧SHA-256をパスワードを変えずに保護し、次回ログインで直接方式に更新できる", () => {
  const legacy = require("node:crypto").createHash("sha256").update("旧Pass123").digest("hex");
  const layered = hashLegacyPassword(legacy);
  assert.equal(matchesPasswordHash("旧Pass123", legacy), true);
  assert.equal(matchesPasswordHash("旧Pass123", layered), true);
  assert.equal(matchesPasswordHash("違うPass123", layered), false);
  assert.equal(needsPasswordUpgrade(layered), true);
  assert.equal(needsPasswordUpgrade(hashPassword("旧Pass123")), false);
});

test("新しいパスワードは既存の6文字以上を維持する", () => {
  assert.equal(isValidNewPassword("12345"), false);
  assert.equal(isValidNewPassword("123456"), true);
  assert.equal(isValidNewPassword("x".repeat(129)), false);
});
