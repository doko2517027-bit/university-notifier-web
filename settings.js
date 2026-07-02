import { VERSION } from "./version.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getFirestore,
    doc,
    getDoc,
    deleteDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEtS2NGZKqHFh29kmR9OjEpshbC1yvjFY",
  authDomain: "universitynotifier-67517.firebaseapp.com",
  projectId: "universitynotifier-67517",
  storageBucket: "universitynotifier-67517.firebasestorage.app",
  messagingSenderId: "908622250178",
  appId: "1:908622250178:web:3e355fce8698fcf179bb5b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const root = document.documentElement;

const department =
    localStorage.getItem("department");

const major =
    localStorage.getItem("major");

if (department === "看護学科") {

    root.style.setProperty(
        "--accent",
        "#F7EAC5"
    );

}
else if (major === "理学療法学専攻") {

    root.style.setProperty(
        "--accent",
        "#DDEBF7"
    );

}
else if (major === "作業療法学専攻") {

    root.style.setProperty(
        "--accent",
        "#E2EFDA"
    );

}

const studentNumber = localStorage.getItem("studentNumber");
const notifySchedule = document.getElementById("notifySchedule");
const notifyAssignment = document.getElementById("notifyAssignment");
const notifyReminder = document.getElementById("notifyReminder");
const notifyCourseNews = document.getElementById("notifyCourseNews");

loadUserName();

async function loadUserName() {

    if (!studentNumber) {
        return;
    }

    const snap = await getDoc(
        doc(db, "publicUsers", studentNumber)
    );

    if (!snap.exists()) {

        document.getElementById("userName").textContent =
            "Unknownさん";

        return;

    }

    document.getElementById("userName").textContent =
        snap.data().name + "さん";

}

document.getElementById("departmentText").textContent =
    localStorage.getItem("department") || "未登録";

document.getElementById("majorText").textContent =
    localStorage.getItem("major") || "なし";

document.getElementById("gradeText").textContent =
    localStorage.getItem("grade") || "未登録";

document.getElementById("versionText").textContent =
    `Version ${VERSION}`;

loadNotificationswitchs();
setupNotificationEvents();

// ダークモード
const themeButton = document.getElementById("themeButton");

// 前回の設定を反映
if (localStorage.getItem("theme") === "dark") {

    document.body.classList.add("dark");
    themeButton.textContent = "☀️";

} else {

    themeButton.textContent = "🌙";

}

// ボタンを押した時
themeButton.addEventListener("click", () => {

    document.body.classList.toggle("dark");

    if (document.body.classList.contains("dark")) {

        localStorage.setItem("theme", "dark");
        themeButton.textContent = "☀️";

    } else {

        localStorage.setItem("theme", "light");
        themeButton.textContent = "🌙";

    }

});

document
.getElementById("unregister")
.addEventListener("click", async () => {

    if (!confirm("登録を解除しますか？")) {
        return;
    }

    try {

    if (studentNumber) {

        await deleteDoc(
            doc(db, "users", studentNumber)
        );

        await deleteDoc(
            doc(db, "publicUsers", studentNumber)
        );

        await deleteDoc(
            doc(db, "courseLinks", studentNumber)
        );

        await deleteDoc(
            doc(db, "assignments", studentNumber)
        );

    }

} catch (e) {

    console.log(e);

}

    localStorage.clear();

    location.href = "register.html";

});

document
.getElementById("logout")
.addEventListener("click", () => {

    if (!confirm("ログアウトしますか？")) {
        return;
    }

    localStorage.removeItem("loggedIn");

    location.href = "login.html";

});

async function loadNotificationswitchs() {

    if (!studentNumber) return;

    const snap = await getDoc(
        doc(db, "users", studentNumber)
    );

    if (!snap.exists()) return;

    const switchs =
        snap.data().notificationswitchs || {};

    notifySchedule.checked =
        switchs.schedule ?? true;

    notifyAssignment.checked =
        switchs.assignment ?? true;

    notifyReminder.checked =
        switchs.reminder ?? true;

    notifyCourseNews.checked =
        switchs.courseNews ?? true;

}

function setupNotificationEvents() {

    [
        notifySchedule,
        notifyAssignment,
        notifyReminder,
        notifyCourseNews
    ].forEach(input => {

        input.addEventListener("change", saveNotificationswitchs);

    });

}

async function saveNotificationswitchs() {

    if (!studentNumber) return;

    await updateDoc(
        doc(db, "users", studentNumber),
        {
            notificationswitchs: {
                schedule: notifySchedule.checked,
                assignment: notifyAssignment.checked,
                reminder: notifyReminder.checked,
                courseNews: notifyCourseNews.checked
            }
        }
    );

}