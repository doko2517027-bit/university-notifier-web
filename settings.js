import { auth, db, functions, signOutCareMate } from "./auth_core.js";
import { encryptData } from "./common.js";
import { savedExternalPasswordFields } from "./settings_password_fields.mjs";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";
import { getCareMatePushRegistrationStatus, registerDevicePushSubscription, requestPushPermissionWithEducation } from "./push_subscription.js";

const studentNumber = String((await auth.currentUser.getIdTokenResult()).claims.studentNumber || "");
const userRef = doc(db, "users", studentNumber);
const accountSummary = document.getElementById("accountSummary");
const manabaStatus = document.getElementById("manabaStatus");
const pushStatus = document.getElementById("pushStatus");
const notifyAssignment = document.getElementById("notifyAssignment");
const notifyReminder = document.getElementById("notifyReminder");

try {
  const snapshot = await getDoc(userRef);
  const user = snapshot.data() || {};
  accountSummary.textContent = `${user.name || "学生"}（${studentNumber}）`;
  manabaStatus.textContent = user.manabaResetRequired ? "連携の再設定が必要です。" : user.manabaVerified === true ? "連携済み" : user.manabaVerificationError ? "前回の確認に失敗しました。パスワードを確認してください。" : "次回の課題取得時に連携状態を確認します。";
  notifyAssignment.checked = user.notificationSettings?.assignment !== false;
  notifyReminder.checked = user.notificationSettings?.reminder !== false;
} catch (error) {
  console.error("設定の読み込みエラー:", error);
  accountSummary.textContent = "アカウント情報を取得できませんでした。";
  manabaStatus.textContent = "連携状態を確認できませんでした。";
}

document.getElementById("passwordForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById("passwordStatus");
  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  if (newPassword !== document.getElementById("confirmPassword").value) {
    status.textContent = "確認用パスワードが一致しません。";
    return;
  }
  const button = form.querySelector("button");
  button.disabled = true;
  status.textContent = "変更中…";
  try {
    await httpsCallable(functions, "changeCareMatePassword")({ currentPassword, newPassword });
    form.reset();
    status.textContent = "変更しました。新しいパスワードでログインし直してください。";
    await signOutCareMate();
  } catch (error) {
    console.error("パスワード変更エラー:", error);
    status.textContent = error.code === "functions/permission-denied" ? "現在のパスワードが違います。" : "変更できませんでした。入力と通信状態を確認してください。";
  } finally { button.disabled = false; }
});

document.getElementById("manabaForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  const status = document.getElementById("manabaSaveStatus");
  const input = document.getElementById("manabaPassword");
  button.disabled = true;
  status.textContent = "保存中…";
  try {
    const encrypted = await encryptData(input.value);
    await updateDoc(userRef, savedExternalPasswordFields("manaba", encrypted));
    input.value = "";
    manabaStatus.textContent = "次回の課題取得時に確認します。";
    status.textContent = "保存しました。";
  } catch (error) {
    console.error("manabaパスワード保存エラー:", error);
    status.textContent = "保存できませんでした。通信状態を確認してください。";
  } finally { button.disabled = false; }
});

for (const input of [notifyAssignment, notifyReminder]) {
  input.addEventListener("change", async () => {
    input.disabled = true;
    const value = input.checked;
    try {
      await updateDoc(userRef, { [`notificationSettings.${input === notifyAssignment ? "assignment" : "reminder"}`]: value });
    } catch (error) {
      console.error("通知設定保存エラー:", error);
      input.checked = !value;
      pushStatus.textContent = "通知設定を保存できませんでした。";
    } finally { input.disabled = false; }
  });
}

async function refreshPushStatus() {
  try {
    const status = await getCareMatePushRegistrationStatus(db, studentNumber, { repair: false });
    pushStatus.textContent = status.currentDeviceRegistered ? "この端末は通知登録済みです。" : status.registered ? "別の端末に通知登録があります。この端末でも登録できます。" : "この端末はまだ通知を受け取れません。";
  } catch (error) {
    console.warn("通知状態確認エラー:", error);
    pushStatus.textContent = "通知登録の状態を確認できませんでした。";
  }
}
void refreshPushStatus();
document.getElementById("enablePushButton").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    if (await requestPushPermissionWithEducation({ force: true }) !== "granted") {
      pushStatus.textContent = "端末の通知が許可されていません。";
      return;
    }
    await registerDevicePushSubscription(db, studentNumber, "settings", "sw.js");
    await refreshPushStatus();
  } catch (error) {
    console.error("通知登録エラー:", error);
    pushStatus.textContent = "通知登録に失敗しました。端末設定と通信状態を確認してください。";
  } finally { button.disabled = false; }
});

document.getElementById("logoutButton").addEventListener("click", () => { void signOutCareMate(); });
