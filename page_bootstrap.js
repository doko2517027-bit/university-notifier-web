import { auth, functions } from "./auth_core.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";
import { getIdTokenResult } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { normalizeNavigation, setStudentNumber } from "./common.js?v=20261021-1";

const pageScript = document.querySelector("script[data-care-page]");
const roleRequired = pageScript?.dataset.role || "";
const entry = pageScript?.dataset.entry || "";
let pageAuthorized = false;

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
  document.documentElement.dataset.assignmentAccess = access.data?.assignmentAccess === false ? "false" : "true";
  if (access.data?.assignmentAccess === false && location.pathname.endsWith("assignments.html")) {
    location.replace("home.html");
    throw Object.assign(new Error("課題なし画面では課題ページを利用できません。"), { redirecting: true });
  }
  normalizeNavigation();
  document.documentElement.classList.add("caremate-access-approved");
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((error) => console.warn("更新確認に失敗しました:", error));
  }
  document.querySelectorAll("[data-role-tab]").forEach((tab) => {
    tab.hidden = tab.dataset.roleTab !== role;
  });
  pageAuthorized = true;
} catch (error) {
  console.error("CareMate画面認証エラー:", error);
  if (!error?.redirecting) location.replace("index.html");
}

if (pageAuthorized && entry) {
  try {
    await import(entry);
  } catch (error) {
    console.error("CareMate画面読み込みエラー:", error);
    const message = document.createElement("p");
    message.className = "cm-status";
    message.setAttribute("role", "alert");
    message.textContent = "画面を読み込めませんでした。更新してもう一度お試しください。";
    document.querySelector("main")?.prepend(message);
  }
}
