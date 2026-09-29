import { auth, functions, showPage, showLoadingIndicator, hideLoadingIndicator } from "./common.js?v=20260929-6";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";
import { signInWithCustomToken } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
const $ = (id) => document.getElementById(id);
showPage();
$("loginForm").onsubmit = async (e) => {
  e.preventDefault();
  const button = e.submitter,
    status = $("loginStatus"),
    id = $("staffId").value.trim();
  button.disabled = true;
  status.textContent = "ログインを確認中…";
  showLoadingIndicator("ログインを確認しています…");
  let navigating = false;
  try {
    const result = await httpsCallable(
      functions,
      "authenticateClinical",
    )({ studentNumber: id, password: $("password").value });
    await signInWithCustomToken(auth, result.data.token);
    localStorage.setItem("clinicalStaffId", id);
    navigating = true;
    location.replace("clinical_workspace.html");
  } catch (error) {
    console.error(error);
    status.textContent =
      error.code === "functions/permission-denied"
        ? "この職員IDにはClinical権限が設定されていません。管理者に確認してください。"
        : "ログインできませんでした。職員IDとパスワードを確認してください。";
  } finally {
    if (!navigating) {
      hideLoadingIndicator();
      button.disabled = false;
    }
  }
};
