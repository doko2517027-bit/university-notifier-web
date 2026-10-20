const crypto = require("node:crypto");
const ITERATIONS = 600_000;
const PREFIX = "pbkdf2-v1";
const LEGACY_SHA256 = /^[0-9a-f]{64}$/i;

function hashPassword(password) {
  return derive(password, "direct");
}

function hashLegacyPassword(legacyHash) {
  if (!LEGACY_SHA256.test(String(legacyHash || ""))) throw new TypeError("Invalid legacy hash");
  return derive(legacyHash.toLowerCase(), "layered");
}

function derive(value, mode) {
  const salt = crypto.randomBytes(32);
  const digest = crypto.pbkdf2Sync(value, salt, ITERATIONS, 32, "sha256");
  return `${PREFIX}$${mode}$${ITERATIONS}$${salt.toString("hex")}$${digest.toString("hex")}`;
}

function needsPasswordUpgrade(storedHash) {
  return LEGACY_SHA256.test(String(storedHash || "")) || String(storedHash || "").startsWith(`${PREFIX}$layered$`);
}

function matchesPasswordHash(password, storedHash) {
  const encoded = String(storedHash || "");
  if (LEGACY_SHA256.test(encoded)) {
    const digest = crypto.createHash("sha256").update(password, "utf8").digest();
    return crypto.timingSafeEqual(digest, Buffer.from(encoded, "hex"));
  }
  const parts = encoded.split("$");
  if (parts.length !== 5 || parts[0] !== PREFIX || !["direct", "layered"].includes(parts[1]) || parts[2] !== String(ITERATIONS)
    || !/^[0-9a-f]{64}$/i.test(parts[3]) || !/^[0-9a-f]{64}$/i.test(parts[4])) return false;
  const input = parts[1] === "layered"
    ? crypto.createHash("sha256").update(password, "utf8").digest("hex")
    : password;
  const digest = crypto.pbkdf2Sync(input, Buffer.from(parts[3], "hex"), ITERATIONS, 32, "sha256");
  return crypto.timingSafeEqual(digest, Buffer.from(parts[4], "hex"));
}

function isValidNewPassword(password) {
  return typeof password === "string" && password.length >= 6 && password.length <= 128;
}

module.exports = { hashPassword, hashLegacyPassword, matchesPasswordHash, needsPasswordUpgrade, isValidNewPassword };
