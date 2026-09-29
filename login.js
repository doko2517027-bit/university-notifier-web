import {
  db,
  initializePage,
  setupOfflineAlert,
  signInCareMateAuth,
  refreshAdminClaim,
  showLoadingIndicator,
  hideLoadingIndicator,
} from "./common.js?v=20260929-7";

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
