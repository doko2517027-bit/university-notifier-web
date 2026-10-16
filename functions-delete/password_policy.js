const crypto = require("node:crypto");

function matchesPasswordHash(password, storedHash) {
  if (typeof password !== "string" || !/^[0-9a-f]{64}$/i.test(String(storedHash || ""))) return false;
  const actual = crypto.createHash("sha256").update(password, "utf8").digest();
  const expected = Buffer.from(storedHash, "hex");
  return crypto.timingSafeEqual(actual, expected);
}

module.exports = { matchesPasswordHash };
