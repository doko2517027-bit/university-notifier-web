import { auth, db, authPersistenceReady } from "./auth_core.js?v=20261107-1";
import { getIdTokenResult } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { normalizeNavigation, setStudentNumber } from "./common.js?v=20261106-3";

const pageScript = document.querySelector("script[data-care-page]");
const roleRequired = pageScript?.dataset.role || "";
const entry = pageScript?.dataset.entry || "";
let pageAuthorized = false;

try {
  window.CareMatePageStatus?.show("利用権限を確認しています…");
  await authPersistenceReady;
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error("ログインが必要です。");

  // 画面遷移ごとのFirestore再照会は、無料枠の一時的な読み取り制限時に
  // 正常なログインまで解除してしまう。Firebaseが署名したIDトークンを
  // 画面表示に使い、実データは引き続きFirestore Rulesと各APIで
  // 現在のaccessを検証するため、停止済み利用者はデータを取得できない。
  const token = await getIdTokenResult(user);
  const role = token.claims.admin === true ? "admin" : "member";
  const access = { data: {
    active: true,
    role,
    assignmentAccess: token.claims.assignmentAccess !== false,
  } };
  if (roleRequired && role !== roleRequired) {
    location.replace("app.html");
    // Redirect before loading any privileged page module.
    throw Object.assign(new Error("この画面の利用権限がありません。"), { redirecting: true });
  }
  const studentNumber = String(token.claims.studentNumber || "");
  if (user.uid !== `caremate-${studentNumber}` || !/^\d{7}$/.test(studentNumber)) {
    throw new Error("アカウントを確認できません。");
  }

  localStorage.setItem("studentNumber", studentNumber);
  localStorage.setItem("loggedIn", "true");
  setStudentNumber(studentNumber);
  document.documentElement.dataset.caremateRole = role;
  document.documentElement.dataset.assignmentAccess = access.data?.assignmentAccess === false ? "false" : "true";
  if (access.data?.assignmentAccess === false && /\/(?:assignments|manaba)\.html$/.test(location.pathname)) {
    location.replace("home.html");
    throw Object.assign(new Error("課題なし画面では課題ページを利用できません。"), { redirecting: true });
  }
  normalizeNavigation();
  document.documentElement.classList.add("caremate-access-approved");
  window.CareMatePageStatus?.show("画面を読み込んでいます…");
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((error) => console.warn("更新確認に失敗しました:", error));
  }
  document.querySelectorAll("[data-role-tab]").forEach((tab) => {
    tab.hidden = tab.dataset.roleTab !== role;
  });
  pageAuthorized = true;
  if (access.data?.assignmentAccess !== false && "Notification" in window && Notification.permission === "granted") {
    void import("./push_subscription.js?v=20261026-1")
      .then(({ getCareMatePushRegistrationStatus }) => getCareMatePushRegistrationStatus(db, studentNumber))
      .catch((error) => console.warn("通知登録の更新に失敗しました:", error));
  } else if (access.data?.assignmentAccess !== false) {
    void import("./push_permission_banner.js?v=20261027-1")
      .then(({ showAssignmentPushBanner }) => showAssignmentPushBanner(db, studentNumber))
      .catch((error) => console.warn("通知案内を表示できませんでした:", error));
  }
} catch (error) {
  console.error("CareMate画面認証エラー:", error);
  if (!error?.redirecting) location.replace("index.html");
}

if (pageAuthorized && entry) {
  try {
    await import(entry);
    window.CareMatePageStatus?.ready();
  } catch (error) {
    console.error("CareMate画面読み込みエラー:", error);
    window.CareMatePageStatus?.fail("画面を読み込めませんでした。通信状態を確認して、もう一度お試しください。");
  }
} else if (pageAuthorized) {
  window.CareMatePageStatus?.ready();
}
