const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeReferralCode,
  createReferralCode,
  isReferralCodeUsable,
  milestoneState,
  nextMilestone,
  validGiftUrl,
  REFERRAL_MILESTONES,
} = require("./referral_policy");

test("招待コードは推測困難なランダム形式で正規化できる", () => {
  const first = createReferralCode();
  const second = createReferralCode();
  assert.match(first, /^[A-Z0-9_-]{12,32}$/);
  assert.notEqual(first, second);
  assert.equal(normalizeReferralCode(" ab-c 12 "), "ABC12");
});

test("使用済み・期限切れ・招待者不明のコードは利用できない", () => {
  const future = new Date(Date.now() + 60_000);
  assert.equal(isReferralCodeUsable({ used: false, expiresAt: future, inviterStudentNumber: "2510054" }), true);
  assert.equal(isReferralCodeUsable({ used: true, expiresAt: future, inviterStudentNumber: "2510054" }), false);
  assert.equal(isReferralCodeUsable({ used: false, expiresAt: new Date(0), inviterStudentNumber: "2510054" }), false);
});

test("2・4・6・8・10人の特典を一度だけ解放する", () => {
  const unlocked = new Date("2026-10-01T00:00:00Z");
  const state = milestoneState({}, 6, unlocked);
  assert.equal(state.m2.unlockedAt, unlocked);
  assert.equal(state.m4.unlockedAt, unlocked);
  assert.equal(state.m6.unlockedAt, unlocked);
  assert.equal(state.m8, undefined);
  const preserved = milestoneState({ ...state, m2: { unlockedAt: "old", claimedAt: "done" } }, 8, new Date());
  assert.equal(preserved.m2.unlockedAt, "old");
  assert.equal(preserved.m2.claimedAt, "done");
  assert.equal(nextMilestone(8).count, 10);
  assert.equal(nextMilestone(10), null);
  assert.deepEqual(
    REFERRAL_MILESTONES.map(({ count, kind }) => [count, kind]),
    [[2, "points"], [4, "theme"], [6, "pet"], [8, "pet_accessory"], [10, "gift"]],
  );
});

test("ギフトURLは認証情報を含まないHTTPSだけを許可する", () => {
  assert.equal(validGiftUrl("https://example.com/gift/abc"), true);
  assert.equal(validGiftUrl("http://example.com/gift"), false);
  assert.equal(validGiftUrl("https://user:pass@example.com/gift"), false);
});
