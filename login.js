import {
  db,
  initializePage,
  setupOfflineAlert,
  signInCareMateAuth,
  refreshAdminClaim,
  showLoadingIndicator,
  hideLoadingIndicator,
  auth,
  functions,
} from "./common.js?v=20260929-7";

import { signInWithCustomToken } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const studentNumber = document.getElementById("studentNumber");
const appPassword = document.getElementById("appPassword");
const loginButton = document.getElementById("loginButton");
const registerButton = document.getElementById("registerButton");
const studentLoginRole = document.getElementById("studentLoginRole");
const guardianLoginRole = document.getElementById("guardianLoginRole");
let loginRole = "student";

function setLoginRole(role) {
  loginRole = role;
  const guardian = role === "guardian";
  studentLoginRole.classList.toggle("btn-primary", !guardian);
  studentLoginRole.classList.toggle("is-active", !guardian);
  guardianLoginRole.classList.toggle("btn-primary", guardian);
  guardianLoginRole.classList.toggle("is-active", guardian);
  document.getElementById("loginIdentifierLabel").textContent = guardian ? "連携する学生の学籍番号" : "学籍番号";
  document.getElementById("loginPasswordLabel").textContent = guardian ? "保護者用パスワード" : "アプリ用パスワード";
  appPassword.placeholder = guardian ? "保護者登録時のパスワード" : "登録したパスワード";
}
studentLoginRole.addEventListener("click", () => setLoginRole("student"));
guardianLoginRole.addEventListener("click", () => setLoginRole("guardian"));

await initializePage();

registerButton.addEventListener("click", () => {
  showLoadingIndicator("登録画面を開いています…");
  location.href = "register.html";
});

loginButton.addEventListener("click", async () => {
  const value = studentNumber.value.trim();

  if (!/^\d{7}$/.test(value)) {
    alert("学籍番号は7桁の数字で入力してください。");
    return;
  }

  if (appPassword.value.trim() === "") {
    alert("パスワードを入力してください。");
    return;
  }

  const originalLabel = loginButton.textContent;
  let navigating = false;
  loginButton.disabled = true;
  loginButton.textContent = "ログイン中…";
  showLoadingIndicator("ログインを確認しています…");
  const slowTimer = setTimeout(() => {
    showLoadingIndicator("接続に時間がかかっています…");
  }, 10000);
  try {
    if (loginRole === "guardian") {
      const authenticateGuardian = httpsCallable(functions, "authenticateGuardian");
      const result = await authenticateGuardian({ studentNumber: value, password: appPassword.value });
      await signInWithCustomToken(auth, result.data.token);
      localStorage.clear();
      localStorage.setItem("careMateRole", "guardian");
      localStorage.setItem("guardianLoggedIn", "true");
      localStorage.setItem("guardianStudentNumber", value);
      navigating = true;
      location.href = "guardian_timetable.html";
      return;
    }
    const userRef = doc(db, "users", value);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      alert("登録されていません。");
      return;
    }
    const user = userSnap.data();
    const inputHash = await hashPassword(appPassword.value);
    if (inputHash !== user.appPasswordHash) {
      alert("学籍番号またはパスワードが違います。");
      return;
    }

    showLoadingIndicator("ログインしています…");
    await signInCareMateAuth(value, appPassword.value);
    await refreshAdminClaim();

    localStorage.removeItem("careMateRole");
    localStorage.removeItem("guardianLoggedIn");
    localStorage.removeItem("guardianStudentNumber");
    localStorage.setItem("registered", "true");
    localStorage.setItem("loggedIn", "true");
    localStorage.setItem("studentNumber", value);
    localStorage.setItem("department", user.department || "");
    localStorage.setItem("major", user.major || "");
    localStorage.setItem("grade", user.grade || "");
    localStorage.setItem("manabaId", user.manabaId || "");
    localStorage.setItem("migrated", "true");

    // 利用時刻の保存が遅くてもログイン画面から先へ進める。
    const lastLoginUpdate = updateDoc(userRef, {
      lastLoginAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    }).catch((error) => console.warn("最終ログイン時刻を保存できませんでした:", error));
    await Promise.race([
      lastLoginUpdate,
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);

    navigating = true;
    showLoadingIndicator("ホームを開いています…");
    location.href = "index.html";
  } catch (error) {
    console.error("Firebase認証エラー:", error);
    alert(
      error?.code === "functions/unauthenticated"
        ? "学籍番号またはパスワードが違います。"
        : "ログインできませんでした。通信状態を確認して、時間をおいて再度お試しください。",
    );
  } finally {
    clearTimeout(slowTimer);
    if (!navigating) {
      hideLoadingIndicator();
      loginButton.disabled = false;
      loginButton.textContent = originalLabel;
    }
  }
});

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
