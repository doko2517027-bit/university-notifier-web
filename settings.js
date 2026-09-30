import { VERSION } from "./version.js";
import { savedExternalPasswordFields } from "./settings_password_fields.mjs";
import { academicYearAt, canReviseAnnualResponse, daysAfterDate, isLeaveActive } from "./academic_lifecycle.mjs";
import {
  db,
  auth,
  functions,
  studentNumber,
  setupTheme,
  initializePage,
  loadProfileImage,
  loadUserName,
  loadMyRanking,
  setupAdminTab,
  setupOfflineAlert,
  updateAssignmentNavBadge,
  updateShareNavBadge,
  updateNewsNavBadge,
  encryptData,
} from "./common.js";

import {
  doc,
  getDoc,
  getDocFromServer,
  deleteDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { signOut } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

import { registerDevicePushSubscription } from "./push_subscription.js";

const root = document.documentElement;

const department = localStorage.getItem("department");

const major = localStorage.getItem("major");

if (department === "看護学科") {
  root.style.setProperty("--accent", "#F7EAC5");
} else if (major === "理学療法学専攻") {
  root.style.setProperty("--accent", "#DDEBF7");
} else if (major === "作業療法学専攻") {
  root.style.setProperty("--accent", "#E2EFDA");
}

const notifySchedule = document.getElementById("notifySchedule");
const notifyAssignment = document.getElementById("notifyAssignment");
const notifyReminder = document.getElementById("notifyReminder");
const notifyCourseNews = document.getElementById("notifyCourseNews");
const notifySystemNews = document.getElementById("notifySystemNews");
const enablePushButton = document.getElementById("enablePushButton");

const topProfileImage = document.getElementById("topProfileImage");
const themeButton = document.getElementById("themeButton");
const userName = document.getElementById("userName");
const annualResponseSettings = document.getElementById("annualResponseSettings");
const annualResponseChoice = document.getElementById("annualResponseChoice");
const annualResponseReason = document.getElementById("annualResponseReason");
const annualResponseEffectiveDate = document.getElementById("annualResponseEffectiveDate");
const annualResponseLeaveStartDate = document.getElementById("annualResponseLeaveStartDate");
let annualResponseOriginal = null;

setupTheme(themeButton);

// 初期データの取得が遅くても、パスワード変更ボタンはすぐ使えるようにする。
void initializePage([
  setupAdminTab(),
  loadUserName(userName),
  loadMyRanking(),
  loadProfileImage(topProfileImage),
  loadnotificationSettings(),
  loadRegistrationInfo(),
  updateAssignmentNavBadge(),
  updateShareNavBadge(),
  updateNewsNavBadge(),
]);

setupNotificationEvents();

document.getElementById("departmentText").textContent =
  localStorage.getItem("department") || "未登録";

document.getElementById("majorText").textContent =
  localStorage.getItem("major") || "なし";

document.getElementById("gradeText").textContent =
  localStorage.getItem("grade") || "未登録";

async function loadRegistrationInfo() {
  document.getElementById("studentNumberText").textContent =
    studentNumber || "未登録";
  const [userSnap, publicSnap, systemSnap] = await Promise.all([
    getDocFromServer(doc(db, "users", studentNumber))
      .catch(() => getDoc(doc(db, "users", studentNumber))),
    getDoc(doc(db, "publicUsers", studentNumber)),
    getDoc(doc(db, "system", "app")).catch(() => null),
  ]);
  const data = userSnap.data() || {};
  const gradeValue = String(data.grade || localStorage.getItem("grade") || "");
  const currentGrade = Number(gradeValue.replace("年", ""));
  if (data.grade) localStorage.setItem("grade", gradeValue);
  if (data.department) localStorage.setItem("department", data.department);
  if (data.major) localStorage.setItem("major", data.major);
  document.getElementById("gradeText").textContent = currentGrade ? `${currentGrade}年` : "未登録";
  document.getElementById("departmentText").textContent = data.department || localStorage.getItem("department") || "未登録";
  document.getElementById("majorText").textContent = data.major || localStorage.getItem("major") || "なし";
  document.getElementById("registeredNameText").textContent =
    publicSnap.data()?.name || data.name || "未登録";
  const academicYear = academicYearAt();
  document.getElementById("graduationText").textContent = data.academicStatus === "leave"
    ? isLeaveActive(data) ? "休学中のため未定" : "休学予定のため未定"
    : ["graduated", "withdrawn"].includes(data.academicStatus)
      ? "－"
      : currentGrade
    ? `${academicYear + (4 - currentGrade) + 1}年3月予定`
    : "未登録";
  document.getElementById("academicStatusText").textContent =
    data.academicStatus === "leave"
      ? isLeaveActive(data) ? "休学中" : `休学予定（${data.leaveStartDate || "開始日未設定"}から）`
      : ({ repeat: "同学年を継続", graduated: "卒業", withdrawn: "退学" }[data.academicStatus] || "在籍中");
  renderAnnualResponseEditor(data, systemSnap?.data()?.annualTransition);
  document.getElementById("contactInboxLink").hidden =
    studentNumber !== "2510044";
}

function updateAnnualResponseRows() {
  const action = annualResponseChoice.value;
  const recommended = annualResponseOriginal?.recommendedAction || "";
  const changed = action !== annualResponseOriginal?.action;
  document.getElementById("annualResponseReasonRow").hidden = !changed && Boolean(recommended && action === recommended);
  document.getElementById("annualResponseEffectiveRow").hidden = !["graduate", "withdraw"].includes(action);
  document.getElementById("annualResponseLeaveRow").hidden = action !== "leave";
}

function renderAnnualResponseEditor(user, transition) {
  annualResponseSettings.hidden = !canReviseAnnualResponse(transition, user);
  if (annualResponseSettings.hidden) return;
  annualResponseOriginal = user.annualTransitionResponse;
  const grade = Number(String(user.grade || "").replace("年", ""));
  const choices = grade === 4
    ? [["graduate", "卒業"], ["repeat", "同学年を継続"], ["leave", "休学"], ["withdraw", "退学"]]
    : [["promote", "進級"], ["repeat", "同学年を継続"], ["leave", "休学"], ["withdraw", "退学"]];
  annualResponseChoice.innerHTML = choices.map(([value, label]) =>
    `<option value="${value}">${label}</option>`).join("");
  annualResponseChoice.value = annualResponseOriginal.action;
  annualResponseReason.value = annualResponseOriginal.overrideReason || "";
  annualResponseEffectiveDate.value = annualResponseOriginal.effectiveDate || "";
  annualResponseLeaveStartDate.value = annualResponseOriginal.leaveStartDate || "";
  const assessment = ({ eligible: "進級要件を満たす見込み", ineligible: "進級要件を満たさない見込み" })[annualResponseOriginal.automaticAssessment] || "判定保留";
  document.getElementById("annualResponseAssessment").textContent = `前回の自動判定：${assessment}。現在の回答は設定から変更できます。`;
  updateAnnualResponseRows();
}

annualResponseChoice.addEventListener("change", () => {
  if (annualResponseChoice.value !== annualResponseOriginal?.action) annualResponseReason.value = "";
  updateAnnualResponseRows();
});

document.getElementById("saveAnnualResponse").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const action = annualResponseChoice.value;
  const reason = annualResponseReason.value.trim();
  const changed = action !== annualResponseOriginal?.action;
  const recommended = annualResponseOriginal?.recommendedAction || "";
  if (!action || ((changed || !recommended || action !== recommended) && !reason)) {
    alert("回答を変更する場合や自動判定と異なる場合は、理由を入力してください。");
    return;
  }
  const effectiveDate = annualResponseEffectiveDate.value;
  const leaveStartDate = annualResponseLeaveStartDate.value;
  if (["graduate", "withdraw"].includes(action) && !daysAfterDate(effectiveDate, 0)) {
    alert("大学の正式な卒業日・退学日を選択してください。");
    return;
  }
  if (action === "leave" && !daysAfterDate(leaveStartDate, 0)) {
    alert("休学開始日を選択してください。");
    return;
  }
  if (!confirm("年度末の最終回答を変更しますか？")) return;
  button.disabled = true;
  try {
    await requireOwnLogin();
    const [userSnap, systemSnap] = await Promise.all([
      getDoc(doc(db, "users", studentNumber)),
      getDoc(doc(db, "system", "app")),
    ]);
    const user = userSnap.data() || {};
    const transition = systemSnap.data()?.annualTransition;
    if (!canReviseAnnualResponse(transition, user)) throw new Error("受付期間外、または既に反映済みです");
    const response = user.annualTransitionResponse;
    await updateDoc(doc(db, "users", studentNumber), {
      annualTransitionResponse: {
        ...response,
        action,
        overrideReason: reason,
        effectiveDate: ["graduate", "withdraw"].includes(action) ? effectiveDate : null,
        leaveStartDate: action === "leave" ? leaveStartDate : null,
        revisedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
      },
      updatedAt: serverTimestamp(),
    });
    annualResponseOriginal = { ...response, action, overrideReason: reason, effectiveDate, leaveStartDate };
    updateAnnualResponseRows();
    alert("回答を更新しました。反映予定日までは現在の学年・在籍状態のままです。");
  } catch (error) {
    console.error("年度末回答の変更エラー:", error);
    alert("回答を更新できませんでした。受付期間と通信状態を確認してください。");
  } finally {
    button.disabled = false;
  }
});

document.getElementById("saveManabaPassword").onclick = () =>
  saveExternalPassword("manaba");
document.getElementById("saveActiveMailPassword").onclick = () =>
  saveExternalPassword("activeMail");
async function requireOwnLogin() {
  await auth.authStateReady();
  if (!studentNumber || auth.currentUser?.uid !== `caremate-${studentNumber}`) {
    throw new Error("ログイン状態を確認できません");
  }
}
async function saveExternalPassword(kind) {
  const button = document.getElementById(
    kind === "manaba" ? "saveManabaPassword" : "saveActiveMailPassword",
  );
  const input = document.getElementById(
    kind === "manaba" ? "newManabaPassword" : "newActiveMailPassword",
  );
  if (!input.value.trim()) {
    alert("新しいパスワードを入力してください。");
    return;
  }
  if (
    !confirm(
      `${kind === "manaba" ? "Manaba" : "ActiveMail"}の保存パスワードを変更しますか？`,
    )
  )
    return;
  button.disabled = true;
  try {
    await requireOwnLogin();
    const encrypted = await encryptData(input.value);
    const fields = savedExternalPasswordFields(kind, encrypted);
    await updateDoc(doc(db, "users", studentNumber), fields);
    input.value = "";
    alert("CareMateに保存したパスワードを更新しました。次回の連携時に確認されます。");
  } catch (error) {
    console.error("保存パスワード更新エラー:", error);
    alert("保存できませんでした。通信状態とログイン状態を確認して再度お試しください。");
  } finally {
    button.disabled = false;
  }
}
document.getElementById("saveCareMatePassword").onclick = async () => {
  const button = document.getElementById("saveCareMatePassword");
  const currentInput = document.getElementById("currentCareMatePassword");
  const newInput = document.getElementById("newCareMatePassword");
  const confirmInput = document.getElementById("confirmCareMatePassword");
  const pass = newInput.value;
  const again = confirmInput.value;
  if (!currentInput.value) {
    alert("現在のパスワードを入力してください。");
    return;
  }
  if (pass.length < 6) {
    alert("6文字以上で入力してください。");
    return;
  }
  if (pass.length > 128) {
    alert("128文字以内で入力してください。");
    return;
  }
  if (pass !== again) {
    alert("確認入力が一致しません。");
    return;
  }
  if (!confirm("CareMateのログインパスワードを変更しますか？")) return;
  button.disabled = true;
  try {
    await requireOwnLogin();
    const changePassword = httpsCallable(functions, "changeCareMatePassword");
    await changePassword({ currentPassword: currentInput.value, newPassword: pass });
    currentInput.value = "";
    newInput.value = "";
    confirmInput.value = "";
    localStorage.removeItem("loggedIn");
    try {
      await signOut(auth);
    } catch (signOutError) {
      console.warn("パスワード変更後のログアウトエラー:", signOutError);
    }
    alert("CareMateのパスワードを変更しました。新しいパスワードでログインし直してください。");
    location.href = "login.html";
  } catch (error) {
    console.error("CareMateパスワード変更エラー:", error);
    alert(
      error?.code === "functions/permission-denied"
        ? "現在のパスワードが違います。"
        : error?.code === "functions/invalid-argument"
          ? "現在とは異なる新しいパスワードを入力してください。"
        : "変更できませんでした。通信状態とログイン状態を確認して再度お試しください。",
    );
  } finally {
    button.disabled = false;
  }
};
document.getElementById("sendContact").onclick = async () => {
  const message = document.getElementById("contactMessage").value.trim();
  if (!message) {
    alert("お問い合わせ内容を入力してください。");
    return;
  }
  if (!confirm("この内容を管理者へ送信しますか？")) return;
  try {
    await addDoc(collection(db, "contacts"), {
      studentNumber,
      category: document.getElementById("contactCategory").value,
      message,
      status: "new",
      createdAt: serverTimestamp(),
    });
    document.getElementById("contactMessage").value = "";
    alert(
      "送信しました。返信は『お問い合わせの履歴・返信を見る』から確認できます。",
    );
  } catch (error) {
    console.error("お問い合わせ送信エラー:", error);
    alert("送信できませんでした。ログインし直してからもう一度お試しください。");
  }
};

document.getElementById("versionText").textContent = `Version ${VERSION}`;

document.getElementById("unregister").addEventListener("click", async () => {
  if (!confirm("登録を解除しますか？")) {
    return;
  }

  try {
    if (studentNumber) {
      await deleteDoc(doc(db, "users", studentNumber));

      await deleteDoc(doc(db, "publicUsers", studentNumber));

      await deleteDoc(doc(db, "courseLinks", studentNumber));

      await deleteDoc(doc(db, "assignments", studentNumber));
    }
  } catch (error) {
    console.error("登録解除エラー:", error);
    alert("登録を解除できませんでした。ログインし直してからお試しください。");
    return;
  }

  localStorage.clear();

  location.href = "register.html";
});

document.getElementById("logout").addEventListener("click", () => {
  if (!confirm("ログアウトしますか？")) {
    return;
  }

  localStorage.removeItem("loggedIn");

  location.href = "login.html";
});

async function loadnotificationSettings() {
  if (!studentNumber) return;

  const snap = await getDoc(doc(db, "users", studentNumber));

  if (!snap.exists()) return;

  const manabaVerified = snap.data().manabaVerified === true;

  document.getElementById("systemNewsRow").style.display = manabaVerified
    ? "flex"
    : "none";

  const switchs = snap.data().notificationSettings || {};

  notifySchedule.checked = switchs.schedule ?? true;

  notifyAssignment.checked = switchs.assignment ?? true;

  notifyReminder.checked = switchs.reminder ?? true;

  notifyCourseNews.checked = switchs.courseNews ?? true;

  notifySystemNews.checked = switchs.systemNews ?? true;
}

function setupNotificationEvents() {
  [
    notifySchedule,
    notifyAssignment,
    notifyReminder,
    notifyCourseNews,
    notifySystemNews,
  ].forEach((input) => {
    input.addEventListener("change", savenotificationSettings);
  });
}

async function savenotificationSettings() {
  if (!studentNumber) return;

  await updateDoc(doc(db, "users", studentNumber), {
    notificationSettings: {
      schedule: notifySchedule.checked,
      assignment: notifyAssignment.checked,
      reminder: notifyReminder.checked,
      courseNews: notifyCourseNews.checked,
      systemNews: notifySystemNews.checked,
    },
  });
}

document.getElementById("profileButton").onclick = () => {
  location.href = "profile.html";
};

enablePushButton.onclick = async () => {
  await registerDevicePushSubscription(db, studentNumber, "settings", "sw.js");

  alert("通知を再登録しました。");
};
