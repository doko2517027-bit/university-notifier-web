import { auth, functions } from "./auth_core.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";
import { getIdTokenResult } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { normalizeNavigation, setStudentNumber } from "./common.js";

const pageScript = document.querySelector("script[data-care-page]");
const roleRequired = pageScript?.dataset.role || "";
const entry = pageScript?.dataset.entry || "";

try {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error("ログインが必要です。");

  // A previously issued token alone cannot keep an account active.
  const access = await httpsCallable(functions, "checkCareMateAccess")();
  const role = access.data?.role;
  if (access.data?.active !== true || !["admin", "member"].includes(role)) {
    throw new Error("利用が許可されていません。");
  }
  if (roleRequired && role !== roleRequired) {
    location.replace("app.html");
    // Redirect before loading any privileged page module.
    throw Object.assign(new Error("この画面の利用権限がありません。"), { redirecting: true });
  }
  const token = await getIdTokenResult(user);
  const studentNumber = String(token.claims.studentNumber || "");
  if (user.uid !== `caremate-${studentNumber}` || !/^\d{7}$/.test(studentNumber)) {
    throw new Error("アカウントを確認できません。");
  }

  localStorage.setItem("studentNumber", studentNumber);
  localStorage.setItem("loggedIn", "true");
  setStudentNumber(studentNumber);
  document.documentElement.dataset.caremateRole = role;
  normalizeNavigation();
  document.documentElement.classList.add("caremate-access-approved");
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((error) => console.warn("更新確認に失敗しました:", error));
  }
  document.querySelectorAll("[data-role-tab]").forEach((tab) => {
    tab.hidden = tab.dataset.roleTab !== role;
  });
  if (entry) await import(entry);
} catch (error) {
  console.error("CareMate画面認証エラー:", error);
  if (!error?.redirecting) location.replace("index.html");
}
