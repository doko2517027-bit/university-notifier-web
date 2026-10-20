import { signOutCareMate } from "./auth_core.js";
import { functions } from "./auth_core.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

const newAccountForm = document.getElementById("newAccountForm");
const newAccountStatus = document.getElementById("newAccountStatus");
document.getElementById("signOutButton").addEventListener("click", () => {
  void signOutCareMate();
});
const securityButton = document.getElementById("runSecurityCheck");
const securityStatus = document.getElementById("securityStatus");
const securityResults = document.getElementById("securityResults");
const migrateButton = document.getElementById("migrateCredentials");
migrateButton?.addEventListener("click", async () => {
  if (!confirm("既存のログイン・manaba認証情報を、ブラウザから読めない安全な保存先へ移行しますか？")) return;
  migrateButton.disabled = true;
  securityStatus.textContent = "認証情報を安全に移行中…";
  try {
    const response = await httpsCallable(functions, "adminMigrateLegacyCredentials")();
    const data = response.data || {};
    securityStatus.textContent = data.failed?.length
      ? `移行できないアカウントが${data.failed.length}件あります。データは削除せず維持しました。`
      : `移行完了：ログイン${data.passwordsMoved || 0}件、manaba${data.manabaMoved || 0}件。`;
    if (!data.failed?.length) migrateButton.hidden = true;
  } catch (error) {
    console.error("認証情報移行エラー:", error);
    securityStatus.textContent = "移行できませんでした。主管理者でログインしているか確認してください。";
  } finally { migrateButton.disabled = false; }
});
securityButton?.addEventListener("click", async () => {
  securityButton.disabled = true;
  securityStatus.textContent = "権限と登録データを確認中…";
  securityResults.replaceChildren();
  try {
    const response = await httpsCallable(functions, "adminRunSecurityCheck")();
    const checks = response.data?.checks || [];
    const labels = { pass: "良好", warn: "要改善", fail: "要修正", unknown: "未検査" };
    for (const check of checks) {
      const row = document.createElement("div");
      row.className = `cm-security-row ${["pass", "warn", "fail", "unknown"].includes(check.level) ? check.level : "unknown"}`;
      const level = document.createElement("strong");
      level.textContent = labels[check.level] || labels.unknown;
      const text = document.createElement("span");
      text.textContent = check.text;
      row.append(level, text);
      securityResults.append(row);
    }
    const concern = checks.some((check) => check.level === "warn" || check.level === "fail");
    securityStatus.textContent = `${new Date(response.data?.checkedAt || Date.now()).toLocaleString("ja-JP")}に確認しました。${concern ? "要確認項目があります。安全が保証された状態ではありません。" : "この簡易点検で異常は見つかりませんでした。未検査項目もあります。"}`;
  } catch (error) {
    console.error("セキュリティ確認エラー:", error);
    securityStatus.textContent = "確認を完了できませんでした。管理者権限と通信状態を確認してください。";
  } finally {
    securityButton.disabled = false;
  }
});
newAccountForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = newAccountForm.querySelector("button[type=submit]");
  const studentNumber = document.getElementById("newStudentNumber").value.trim();
  const name = document.getElementById("newStudentName").value.trim();
  const passwordInput = document.getElementById("newStudentPassword");
  button.disabled = true;
  newAccountStatus.textContent = "登録しています…";
  try {
    await httpsCallable(functions, "createCareMateAccount")({
      studentNumber, name, password: passwordInput.value,
    });
    passwordInput.value = "";
    document.getElementById("newStudentNumber").value = "";
    document.getElementById("newStudentName").value = "";
    newAccountStatus.textContent = `${studentNumber} のアカウントを登録しました。`;
  } catch (error) {
    console.error("学生アカウント登録エラー:", error);
    const messages = {
      "functions/already-exists": "この学籍番号はすでに登録されています。",
      "functions/invalid-argument": error.message || "入力内容を確認してください。",
      "functions/permission-denied": "管理者権限を確認できませんでした。",
    };
    newAccountStatus.textContent = messages[error?.code] || "登録できませんでした。通信状態をご確認ください。";
  } finally {
    button.disabled = false;
  }
});
