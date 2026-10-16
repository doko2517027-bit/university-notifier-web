const crypto = require("node:crypto");

const REFERRAL_MAX_INVITES = 10;
const REFERRAL_CODE_TTL_DAYS = 14;
const REFERRAL_PROOF_TTL_MINUTES = 15;
const REFERRAL_RATE_LIMIT_WINDOW_MINUTES = 15;
const REFERRAL_RATE_LIMIT_ATTEMPTS = 5;
const REFERRAL_MILESTONES = Object.freeze([
  { count: 2, title: "学習ポイント100pt", kind: "points", description: "テスト問題で貯まる累計ポイントへ100ptを一度だけ加算します。" },
  { count: 4, title: "全9色のテーマ変更", kind: "theme", description: "ライト・ブラックに加えて7色を解放。右上の🎨から全画面の色を変更できます。" },
  { count: 6, title: "写真背景", kind: "photo_background", description: "好きな写真をCareMate全画面の背景に設定できます。画像は既存のCloudinaryへ保存します。" },
  { count: 8, title: "背景カスタマイズ＋", kind: "background_effects", description: "写真背景のぼかし・明るさ・表示位置を自分好みに調整できます。" },
  { count: 10, title: "500円分デジタルギフト", kind: "gift", description: "運営者が確認後、紹介画面に受取ボタンを表示します。自動発行ではありません。" },
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
