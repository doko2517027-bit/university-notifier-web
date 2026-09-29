const crypto = require("node:crypto");

function hashPassword(password) {
  return crypto.createHash("sha256").update(password, "utf8").digest("hex");
}

function matchesPasswordHash(password, storedHash) {
  if (!/^[0-9a-f]{64}$/i.test(String(storedHash || ""))) return false;
  return crypto.timingSafeEqual(
    Buffer.from(hashPassword(password), "hex"),
    Buffer.from(storedHash, "hex"),
  );
}

function isValidNewPassword(password) {
  return typeof password === "string" && password.length >= 6 && password.length <= 128;
}

module.exports = { hashPassword, matchesPasswordHash, isValidNewPassword };
