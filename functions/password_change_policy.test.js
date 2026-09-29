const assert = require("node:assert/strict");
const test = require("node:test");
const {
  hashPassword,
  matchesPasswordHash,
  isValidNewPassword,
} = require("./password_change_policy");

test("ログイン時と同じSHA-256で現在のパスワードを照合する", () => {
  const hash = hashPassword("新しいPass123");
  assert.equal(matchesPasswordHash("新しいPass123", hash), true);
  assert.equal(matchesPasswordHash("違うPass123", hash), false);
  assert.equal(matchesPasswordHash("新しいPass123", "broken"), false);
});

test("新しいパスワードは既存の6文字以上を維持する", () => {
  assert.equal(isValidNewPassword("12345"), false);
  assert.equal(isValidNewPassword("123456"), true);
  assert.equal(isValidNewPassword("x".repeat(129)), false);
});
