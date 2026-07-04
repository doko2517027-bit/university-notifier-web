import { VERSION } from "./version.js";
import {
    db,
    studentNumber,
    setupTheme,
    loadProfileImage,
    loadUserName
} from "./common.js";

import {
    
    doc,
    getDoc,
    deleteDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

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

const notifySchedule = document.getElementById("notifySchedule");
const notifyAssignment = document.getElementById("notifyAssignment");
const notifyReminder = document.getElementById("notifyReminder");
const notifyCourseNews = document.getElementById("notifyCourseNews");
const topProfileImage = document.getElementById("topProfileImage");
const themeButton = document.getElementById("themeButton");
const userName = document.getElementById("userName");

setupTheme(themeButton);

await initializePage([

    loadUserName(userName),
    loadProfileImage(topProfileImage),
    loadnotificationSettings()

]);

setupNotificationEvents();

document.getElementById("departmentText").textContent =
    localStorage.getItem("department") || "未登録";

document.getElementById("majorText").textContent =
    localStorage.getItem("major") || "なし";

document.getElementById("gradeText").textContent =
    localStorage.getItem("grade") || "未登録";

document.getElementById("versionText").textContent =
    `Version ${VERSION}`;

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

async function loadnotificationSettings() {

    if (!studentNumber) return;

    const snap = await getDoc(
        doc(db, "users", studentNumber)
    );

    if (!snap.exists()) return;

    const switchs =
        snap.data().notificationSettings || {};

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

        input.addEventListener("change", savenotificationSettings);

    });

}

async function savenotificationSettings() {

    if (!studentNumber) return;

    await updateDoc(
        doc(db, "users", studentNumber),
        {
            notificationSettings: {
                schedule: notifySchedule.checked,
                assignment: notifyAssignment.checked,
                reminder: notifyReminder.checked,
                courseNews: notifyCourseNews.checked
            }
        }
    );

}

document
.getElementById("profileButton")
.onclick = () => {

    location.href = "profile.html";

};