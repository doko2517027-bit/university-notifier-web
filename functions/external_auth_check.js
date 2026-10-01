const crypto = require("node:crypto");

const CREDENTIAL_SECRET = "UniversityNotifier2026";
const ACTIVE_MAIL_URL = "https://activemail.kagoyamail.jp";

function decryptStoredCredential(encryptedText) {
  const raw = Buffer.from(String(encryptedText || ""), "base64");
  if (raw.length <= 28) throw new Error("stored-credential-invalid");
  const iv = raw.subarray(0, 12);
  const encryptedWithTag = raw.subarray(12);
  const ciphertext = encryptedWithTag.subarray(0, encryptedWithTag.length - 16);
  const authenticationTag = encryptedWithTag.subarray(encryptedWithTag.length - 16);
  const key = Buffer.from(CREDENTIAL_SECRET.padEnd(32, "0"), "utf8");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authenticationTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
  // 初期版は文字列をそのままAES-GCMで保存し、現行版はJSON文字列として保存する。
  // 旧利用者だけ認証確認が例外終了しないよう、復号後の形式を両方受け付ける。
  try {
    return JSON.parse(decrypted);
  } catch (error) {
    if (error instanceof SyntaxError && decrypted) return decrypted;
    throw error;
  }
}

async function blockHeavyResources(context) {
  await context.route("**/*", async (route) => {
    if (["image", "font", "media", "stylesheet"].includes(route.request().resourceType())) {
      await route.abort();
      return;
    }
    await route.continue();
  });
}

async function verifyManaba({ browser, user, updateProgress }) {
  const loginId = String(user.manabaId || "").trim();
  const encryptedPassword = user.manabaPasswordEncrypted;
  if (!loginId || !encryptedPassword) {
    return { configured: false, verified: false, message: "Manabaが未設定です。" };
  }
  const password = String(decryptStoredCredential(encryptedPassword));
  await updateProgress(25, "Manabaへ接続しています");
  const context = await browser.newContext();
  await blockHeavyResources(context);
  const page = await context.newPage();
  page.setDefaultTimeout(25_000);
  try {
    await page.goto("https://sums.manaba.jp/ct/login", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await updateProgress(45, "ログイン情報を入力しています");
    await page.locator('input[name="userid"]').fill(loginId);
    await page.locator('input[name="password"]').fill(password);
    await updateProgress(65, "Manabaで認証しています");
    await page.getByRole("button", { name: "ログイン" }).click();
    await page.waitForLoadState("domcontentloaded", { timeout: 25_000 });
    await updateProgress(90, "認証結果を確認しています");
    const verified = !page.url().includes("/ct/login");
    return {
      configured: true,
      verified,
      message: verified ? "Manaba認証に成功しました。" : "Manaba認証に失敗しました。",
    };
  } finally {
    await context.close();
  }
}

async function verifyActiveMail({ browser, studentNumber, user, updateProgress }) {
  const encryptedPassword = user.activeMailPasswordEncrypted;
  if (!encryptedPassword) {
    return { configured: false, verified: false, message: "Active!Mailが未設定です。" };
  }
  const password = String(decryptStoredCredential(encryptedPassword));
  await updateProgress(25, "Active!Mailへ接続しています");
  const context = await browser.newContext();
  await blockHeavyResources(context);
  const page = await context.newPage();
  page.setDefaultTimeout(25_000);
  try {
    await page.goto(ACTIVE_MAIL_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await updateProgress(45, "ログイン情報を入力しています");
    await page.locator('input[name="am_authid"]').fill(`${studentNumber}@sums.ac.jp`);
    await page.locator('input[name="am_authpasswd"]').fill(password);
    await updateProgress(65, "Active!Mailで認証しています");
    await page.locator('input[type="submit"]').click();
    for (let attempt = 0; attempt < 24 && page.frames().length < 2; attempt += 1) {
      await page.waitForTimeout(250);
      if (attempt === 7) await updateProgress(75, "メール画面を読み込んでいます");
      if (attempt === 15) await updateProgress(85, "認証結果を確認しています");
    }
    const loginVisible = await page.locator('input[name="am_authpasswd"]').isVisible().catch(() => false);
    const verified = page.frames().length >= 2 && !loginVisible;
    await updateProgress(90, "認証結果を確認しています");
    return {
      configured: true,
      verified,
      message: verified ? "Active!Mail認証に成功しました。" : "Active!Mail認証に失敗しました。",
    };
  } finally {
    await context.close();
  }
}

module.exports = {
  decryptStoredCredential,
  verifyActiveMail,
  verifyManaba,
};
