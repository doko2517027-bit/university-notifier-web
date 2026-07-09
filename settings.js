import { VERSION } from "./version.js";
import {
    db,
    studentNumber,
    setupTheme,
    initializePage,
    loadProfileImage,
    loadUserName,
    setupAdminTab,
    setupOfflineAlert
} from "./common.js";

import {
    
    doc,
    getDoc,
    deleteDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const PUBLIC_KEY =
"BJk2fKTmfe7AZuXjW-IGMDyis_zN0iZ1B0oiG5MVefZ4n3W9mrBu-xBiWYjG_V6U2b5sGMuVXvKTbrwRKXSAiUs";

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
const notifySystemNews = document.getElementById("notifySystemNews");
const notifySharePost = document.getElementById("notifySharePost");
const notifyLike = document.getElementById("notifyLike");
const notifyComment = document.getElementById("notifyComment");
const enablePushButton = document.getElementById("enablePushButton");

const topProfileImage = document.getElementById("topProfileImage");
const themeButton = document.getElementById("themeButton");
const userName = document.getElementById("userName");

setupTheme(themeButton);

await initializePage([

	setupAdminTab(),
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

    const manabaVerified =
        snap.data().manabaVerified === true;

    document
        .getElementById("systemNewsRow")
        .style.display =
        manabaVerified ? "flex" : "none";

    document
        .getElementById("shareNotificationGroup")
        .style.display =
        manabaVerified ? "block" : "none";

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

    notifySystemNews.checked =
        switchs.systemNews ?? true;

    notifySharePost.checked = 
        switchs.sharePost ?? true;

    notifyLike.checked = 
        switchs.like ?? true;

    notifyComment.checked = 
        switchs.comment ?? true;

}

function setupNotificationEvents() {

    [
        notifySchedule,
        notifyAssignment,
        notifyReminder,
        notifyCourseNews,
        notifySystemNews,
        notifySharePost,
        notifyLike,
        notifyComment
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
                courseNews: notifyCourseNews.checked,
                systemNews: notifySystemNews.checked,
                sharePost: notifySharePost.checked,
                like: notifyLike.checked,
                comment: notifyComment.checked
            }
        }
    );

}

document
.getElementById("profileButton")
.onclick = () => {

    location.href = "profile.html";

};

enablePushButton.onclick = async () => {

    const permission =
        await Notification.requestPermission();

    if (permission !== "granted") {
        alert("通知が許可されませんでした。iPhoneの設定から通知を許可してください。");
        return;
    }

    const registration =
        await navigator.serviceWorker.register("sw.js");

    await navigator.serviceWorker.ready;

    const oldSubscription =
        await registration.pushManager.getSubscription();

    if (oldSubscription) {
        await oldSubscription.unsubscribe();
    }

    const subscription =
        await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY)
        });

    await updateDoc(
        doc(db, "users", studentNumber),
        {
            subscription: JSON.parse(JSON.stringify(subscription))
        }
    );

    alert("通知を再登録しました。");

};

function urlBase64ToUint8Array(base64String) {

    const padding =
        "=".repeat((4 - base64String.length % 4) % 4);

    const base64 =
        (base64String + padding)
            .replace(/-/g, "+")
            .replace(/_/g, "/");

    const rawData = atob(base64);

    return Uint8Array.from(
        [...rawData].map(c => c.charCodeAt(0))
    );

}