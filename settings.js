import { VERSION } from "./version.js";
import {
  db,
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
  deleteDoc,
  updateDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

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

setupTheme(themeButton);

await initializePage([
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
  const [userSnap, publicSnap] = await Promise.all([
    getDoc(doc(db, "users", studentNumber)),
    getDoc(doc(db, "publicUsers", studentNumber)),
  ]);
  const data = userSnap.data() || {},
    currentGrade = Number(data.grade || localStorage.getItem("grade") || 0);
  document.getElementById("registeredNameText").textContent =
    publicSnap.data()?.name || data.name || "未登録";
  const now = new Date(),
    academicYear =
      now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  document.getElementById("graduationText").textContent = currentGrade
    ? `${academicYear + (4 - currentGrade) + 1}年3月予定`
    : "未登録";
  document.getElementById("contactInboxLink").hidden =
    studentNumber !== "2510044";
}

document.getElementById("saveManabaPassword").onclick = () =>
  saveExternalPassword("manaba");
document.getElementById("saveActiveMailPassword").onclick = () =>
  saveExternalPassword("activeMail");
async function saveExternalPassword(kind) {
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
  const encrypted = await encryptData(input.value.trim());
  const fields =
    kind === "manaba"
      ? {
          manabaPasswordEncrypted: encrypted,
          manabaVerified: false,
          manabaVerifiedAt: null,
        }
      : {
          activeMailPasswordEncrypted: encrypted,
          activeMailResetRequired: false,
        };
  await setDoc(doc(db, "users", studentNumber), fields, { merge: true });
  input.value = "";
  alert("変更しました。");
}
document.getElementById("saveCareMatePassword").onclick = async () => {
  const pass = document.getElementById("newCareMatePassword").value,
    again = document.getElementById("confirmCareMatePassword").value;
  if (pass.length < 6) {
    alert("6文字以上で入力してください。");
    return;
  }
  if (pass !== again) {
    alert("確認入力が一致しません。");
    return;
  }
  if (!confirm("CareMateのログインパスワードを変更しますか？")) return;
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(pass),
  );
  const hash = [...new Uint8Array(bytes)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  await updateDoc(doc(db, "users", studentNumber), { appPasswordHash: hash });
  document.getElementById("newCareMatePassword").value = "";
  document.getElementById("confirmCareMatePassword").value = "";
  alert("変更しました。");
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
  } catch (e) {
    console.log(e);
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
