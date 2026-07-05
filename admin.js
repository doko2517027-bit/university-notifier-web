import { VERSION } from "./version.js";

import {
    db,
    studentNumber,
    setupTheme,
    initializePage,
    loadProfileImage,
    loadUserName,
    setupAdminTab,
    isAdmin,
    showToast
} from "./common.js";

import {
    doc,
    getDoc,
    updateDoc,
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const userName = document.getElementById("userName");
const themeButton = document.getElementById("themeButton");
const topProfileImage = document.getElementById("topProfileImage");

const userCount = document.getElementById("userCount");
const userCountDetail = document.getElementById("userCountDetail");
const userList = document.getElementById("userList");
const versionText = document.getElementById("versionText");
const firestoreStatus = document.getElementById("firestoreStatus");
const renderStatus = document.getElementById("renderStatus");

const systemNewsTitle = document.getElementById("systemNewsTitle");
const systemNewsBody = document.getElementById("systemNewsBody");
const postSystemNews = document.getElementById("postSystemNews");
const systemNewsList = document.getElementById("systemNewsList");

const maintenanceToggle = document.getElementById("maintenanceToggle");
const maintenanceMessage = document.getElementById("maintenanceMessage");
const saveMaintenance = document.getElementById("saveMaintenance");

const notifySchedule = document.getElementById("notifySchedule");
const notifyAssignment = document.getElementById("notifyAssignment");
const notifyReminder = document.getElementById("notifyReminder");
const notifyCourseNews = document.getElementById("notifyCourseNews");

setupTheme(themeButton);

const admin = await isAdmin();

if (!admin) {
    alert("管理者のみアクセスできます。");
    location.href = "index.html";
}

await initializePage([
    setupAdminTab(),
    loadUserName(userName),
    loadProfileImage(topProfileImage),
    loadDashboard(),
    loadSystemNews(),
    loadMaintenance(),
    loadNotificationSettings()
]);

setupEvents();

async function loadDashboard() {

    versionText.textContent = `Version ${VERSION}`;

    try {

        const usersSnap = await getDocs(
            collection(db, "users")
        );

        userCount.textContent =
            `${usersSnap.size}人`;

        userCountDetail.textContent =
            `${usersSnap.size}人`;

        userList.innerHTML = "";

        usersSnap.forEach(userDoc => {

            const user = userDoc.data();

            userList.innerHTML += `
                <div class="setting-row">
                    <span>
                        <b>${userDoc.id}</b><br>
                        <small>
                            ${user.department || user.major || "所属なし"}
                            ${user.grade || ""}
                        </small>
                    </span>
                </div>
            `;

        });

        firestoreStatus.textContent = "🟢 正常";

    } catch (e) {

        console.error(e);

        userCount.textContent = "取得失敗";
        userCountDetail.textContent = "取得失敗";
        userList.innerHTML = "ユーザー一覧の取得に失敗しました。";
        firestoreStatus.textContent = "🔴 エラー";

    }

    renderStatus.textContent = "🟢 未実装";

}

function loadSystemNews() {

    const q = query(
        collection(db, "systemNews"),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {

        if (snapshot.empty) {

            systemNewsList.innerHTML =
                "CareMateお知らせはありません。";

            return;

        }

        systemNewsList.innerHTML = "";

        snapshot.forEach(newsDoc => {

            const news = newsDoc.data();

            const date = news.createdAt
                ? news.createdAt.toDate()
                : null;

            const dateText = date
                ? `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}`
                : "";

            systemNewsList.innerHTML += `

            <div class="card setting-card">

                <p><b>${news.title}</b></p>

                <p>
                    ${(news.body || "").replace(/\n/g,"<br>")}
                </p>

                <small>${dateText}</small>

                <br><br>

                <button
                    class="btn btn-danger delete-system-news"
                    data-id="${newsDoc.id}">
                    削除
                </button>

            </div>

            `;

        });

    });

}

async function loadMaintenance() {

    const snap = await getDoc(
        doc(db, "system", "app")
    );

    if (!snap.exists()) return;

    const data = snap.data();

    maintenanceToggle.checked =
        data.maintenance === true;

    maintenanceMessage.value =
        data.message || "";

}

async function loadNotificationSettings() {

    if (!studentNumber) return;

    const snap = await getDoc(
        doc(db, "users", studentNumber)
    );

    if (!snap.exists()) return;

    const settings =
        snap.data().notificationSettings || {};

    notifySchedule.checked =
        settings.schedule ?? true;

    notifyAssignment.checked =
        settings.assignment ?? true;

    notifyReminder.checked =
        settings.reminder ?? true;

    notifyCourseNews.checked =
        settings.courseNews ?? true;

}

function setupEvents() {

    postSystemNews.onclick = postNews;

    saveMaintenance.onclick = saveMaintenanceSettings;

    document.getElementById("sendTestPush").onclick =
        sendTestNotification;

    document.getElementById("runSchedule").onclick = () => {
        alert("時間割取得の手動実行は後でRender APIに接続します。");
    };

    document.getElementById("runAssignments").onclick = () => {
        alert("課題取得の手動実行は後でRender APIに接続します。");
    };

    document.getElementById("runCourseNews").onclick = () => {
        alert("コースニュース取得の手動実行は後でRender APIに接続します。");
    };

    document.getElementById("runActiveMail").onclick = () => {
        alert("Active!Mail取得の手動実行は後でRender APIに接続します。");
    };

    document.getElementById("logout").onclick = () => {

        if (!confirm("ログアウトしますか？")) return;

        localStorage.removeItem("loggedIn");

        location.href = "login.html";

    };

    [
        notifySchedule,
        notifyAssignment,
        notifyReminder,
        notifyCourseNews
    ].forEach(input => {

        input.addEventListener(
            "change",
            saveNotificationSettings
        );

    });

    document.addEventListener("click", async (e) => {

        if (!e.target.classList.contains("delete-system-news")) {
            return;
        }

        const ok =
            confirm("このお知らせを削除しますか？");

        if (!ok) return;

        await deleteDoc(
            doc(db, "systemNews", e.target.dataset.id)
        );

        showToast("削除しました");

        

    });

}

async function postNews() {

    const title =
        systemNewsTitle.value.trim();

    const body =
        systemNewsBody.value.trim();

    if (!title || !body) {
        alert("タイトルと本文を入力してください。");
        return;
    }

    await addDoc(
        collection(db, "systemNews"),
        {
            title,
            body,
            author: studentNumber,
            createdAt: serverTimestamp()
        }
    );

    systemNewsTitle.value = "";
    systemNewsBody.value = "";

    showToast("投稿しました");

    

}

async function saveMaintenanceSettings() {

    await updateDoc(
        doc(db, "system", "app"),
        {
            maintenance: maintenanceToggle.checked,
            message: maintenanceMessage.value
        }
    );

    showToast("保存しました");

}

async function saveNotificationSettings() {

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

    showToast("通知設定を保存しました");

}

async function sendTestNotification() {

    if (!("Notification" in window)) {
        alert("この端末は通知に対応していません。");
        return;
    }

    const permission =
        await Notification.requestPermission();

    if (permission !== "granted") {
        alert("通知が許可されていません。");
        return;
    }

    new Notification("CareMate テスト通知", {
        body: "通知は正常に動作しています。",
        icon: "icon-192.png"
    });

}