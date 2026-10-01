const crypto = require("node:crypto");

const REFERRAL_MAX_INVITES = 10;
const REFERRAL_CODE_TTL_DAYS = 14;
const REFERRAL_PROOF_TTL_MINUTES = 15;
const REFERRAL_RATE_LIMIT_WINDOW_MINUTES = 15;
const REFERRAL_RATE_LIMIT_ATTEMPTS = 5;
const REFERRAL_MILESTONES = Object.freeze([
  { count: 2, title: "特典①（準備中）", kind: "caremate" },
  { count: 4, title: "特典②（準備中）", kind: "caremate" },
  { count: 6, title: "特典③（準備中）", kind: "caremate" },
  { count: 8, title: "特典④（準備中）", kind: "caremate" },
  { count: 10, title: "500円分デジタルギフト", kind: "gift" },
]);

function normalizeReferralCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 32);
}

function createReferralCode() {
  return crypto.randomBytes(10).toString("base64url").toUpperCase();
}

function createProofToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isReferralCodeUsable(code, now = Date.now()) {
  return Boolean(
    code &&
      code.used !== true &&
      code.revoked !== true &&
      timestampMillis(code.expiresAt) > now &&
      /^\d{7}$/.test(String(code.inviterStudentNumber || "")),
  );
}

function milestoneState(previous = {}, invitedCount, now = new Date()) {
  const next = { ...previous };
  REFERRAL_MILESTONES.forEach(({ count }) => {
    const key = `m${count}`;
    if (invitedCount >= count && !next[key]?.unlockedAt) {
      next[key] = { unlockedAt: now, claimedAt: null };
    }
  });
  return next;
}

function nextMilestone(invitedCount) {
  return REFERRAL_MILESTONES.find((item) => invitedCount < item.count) || null;
}

function validGiftUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

module.exports = {
  REFERRAL_MAX_INVITES,
  REFERRAL_CODE_TTL_DAYS,
  REFERRAL_PROOF_TTL_MINUTES,
  REFERRAL_RATE_LIMIT_WINDOW_MINUTES,
  REFERRAL_RATE_LIMIT_ATTEMPTS,
  REFERRAL_MILESTONES,
  normalizeReferralCode,
  createReferralCode,
  createProofToken,
  sha256,
  timestampMillis,
  isReferralCodeUsable,
  milestoneState,
  nextMilestone,
  validGiftUrl,
};
