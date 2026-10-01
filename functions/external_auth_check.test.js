const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { decryptStoredCredential } = require("./external_auth_check.js");

function encryptLikeCareMate(value) {
  const key = Buffer.from("UniversityNotifier2026".padEnd(32, "0"), "utf8");
  const iv = Buffer.alloc(12, 7);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString("base64");
}

function encryptLegacyCareMate(value) {
  const key = Buffer.from("UniversityNotifier2026".padEnd(32, "0"), "utf8");
  const iv = Buffer.alloc(12, 9);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString("base64");
}

test("CareMateで保存した外部認証パスワードだけをサーバー側で復号する", () => {
  assert.equal(decryptStoredCredential(encryptLikeCareMate("test-password")), "test-password");
});

test("初期版で保存したJSON化前のパスワードも復号できる", () => {
  assert.equal(
    decryptStoredCredential(encryptLegacyCareMate("legacy-password")),
    "legacy-password",
  );
});

test("壊れた保存値は認証処理へ渡さない", () => {
  assert.throws(() => decryptStoredCredential("invalid"));
});
