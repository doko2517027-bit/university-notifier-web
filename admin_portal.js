import { signOutCareMate } from "./auth_core.js?v=20261028-2";
import { db } from "./auth_core.js?v=20261028-2";
import { callCareMate } from "./backend_client.js?v=20261028-2";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const newAccountForm = document.getElementById("newAccountForm");
const newAccountStatus = document.getElementById("newAccountStatus");
document.getElementById("signOutButton").addEventListener("click", () => {
  void signOutCareMate();
});
const securityButton = document.getElementById("runSecurityCheck");
const securityStatus = document.getElementById("securityStatus");
const securityResults = document.getElementById("securityResults");
securityButton?.addEventListener("click", async () => {
  securityButton.disabled = true;
  securityStatus.textContent = "権限と登録データを確認中…";
  securityResults.replaceChildren();
  try {
    const response = await callCareMate("adminRunSecurityCheck");
    const checks = [...(response.data?.checks || [])];
    try {
      await getDoc(doc(db, "systemPrivate", "careMateCredentials"));
      checks.push({ id: "rules", level: "fail", text: "Firestore機密領域が画面から読み取れます" });
    } catch (error) {
      checks.push({
        id: "rules",
        level: error?.code === "permission-denied" ? "pass" : "unknown",
        text: error?.code === "permission-denied" ? "Firestore機密領域のアクセス拒否" : "Firestoreルールの通信確認",
      });
    }
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
    const concern = checks.some((check) => check.level !== "pass");
    securityStatus.textContent = `${new Date(response.data?.checkedAt || Date.now()).toLocaleString("ja-JP")}に確認しました。${concern ? "要確認項目があります。" : "確認対象はすべて良好です。"}`;
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
    await callCareMate("createCareMateAccount", {
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
