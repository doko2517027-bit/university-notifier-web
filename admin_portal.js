import { signOutCareMate } from "./auth_core.js";
import { functions } from "./auth_core.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

const newAccountForm = document.getElementById("newAccountForm");
const newAccountStatus = document.getElementById("newAccountStatus");
document.getElementById("signOutButton").addEventListener("click", () => {
  void signOutCareMate();
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
