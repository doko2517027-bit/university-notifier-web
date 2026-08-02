import { VERSION } from "./version.js";

import {
    db,
    realtimeDb,
    studentNumber,
    setupTheme,
    initializePage,
    loadProfileImage,
    loadUserName,
    setupAdminTab,
    isAdmin,
    showToast,
    updateAssignmentNavBadge,
    updateShareNavBadge,
    updateNewsNavBadge
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

import {
    ref,
    onValue
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const userName = document.getElementById("userName");
const themeButton = document.getElementById("themeButton");
const topProfileImage = document.getElementById("topProfileImage");

const userCount = document.getElementById("userCount");
const userCountDetail = document.getElementById("userCountDetail");
const userList = document.getElementById("userList");
const versionText = document.getElementById("versionText");
const firestoreStatus = document.getElementById("firestoreStatus");
const renderStatus = document.getElementById("renderStatus");
const lastCronText = document.getElementById("lastCronText");
const lastScheduleCheckText = document.getElementById("lastScheduleCheckText");
const lastAssignmentCheckText = document.getElementById("lastAssignmentCheckText");

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
const notifySystemNews = document.getElementById("notifySystemNews");
const notifySharePost = document.getElementById("notifySharePost");
const notifyLike = document.getElementById("notifyLike");
const notifyComment = document.getElementById("notifyComment");
const reportList = document.getElementById("reportList");
const PUBLIC_KEY = "BJk2fKTmfe7AZuXjW-IGMDyis_zN0iZ1B0oiG5MVefZ4n3W9mrBu-xBiWYjG_V6U2b5sGMuVXvKTbrwRKXSAiUs";
const enablePushButton = document.getElementById("enablePushButton");

let systemAppPromise = null;
let presenceStatuses = {};
let dashboardUsers = [];
let presenceTimer = null;

function getSystemAppSnapshot() {

    if (!systemAppPromise) {

        systemAppPromise = getDoc(
            doc(db, "system", "app")
        );

    }

    return systemAppPromise;

}

setupTheme(themeButton);

const admin = await isAdmin();

if (!admin) {
    alert("管理者のみアクセスできます。");
    location.href = "index.html";
}

await initializePage([
    setupAdminTab(),
    loadUserName(userName),
    loadReports(),
    loadProfileImage(topProfileImage),
    loadDashboard(),
    loadSystemStatus(),
    loadSystemNews(),
    loadMaintenance(),
    loadNotificationSettings(),
    updateAssignmentNavBadge(),
    updateShareNavBadge(),
    updateNewsNavBadge()
]);

startPresenceListener();

setupEvents();

async function loadDashboard() {

    versionText.textContent =
        `Version ${VERSION}`;

    try {

        const usersSnap = await getDocs(
            collection(db, "users")
        );

        dashboardUsers =
            usersSnap.docs.map(userDoc => ({
                id: userDoc.id,
                ...userDoc.data()
            }));

        userCount.textContent =
            `${dashboardUsers.length}人`;

        userCountDetail.textContent =
            `${dashboardUsers.length}人`;

        renderDashboardUsers();

        firestoreStatus.textContent =
            "🟢 正常";

    } catch (error) {

        console.error(error);

        userCount.textContent =
            "取得失敗";

        userCountDetail.textContent =
            "取得失敗";

        userList.innerHTML =
            "ユーザー一覧の取得に失敗しました。";

        firestoreStatus.textContent =
            "🔴 エラー";

    }

}

function startPresenceListener() {

    const statusRef = ref(
        realtimeDb,
        "status"
    );

    onValue(
        statusRef,
        snapshot => {

            presenceStatuses =
                snapshot.val() || {};

            renderDashboardUsers();

        },
        error => {

            console.error(
                "Presence取得エラー:",
                error
            );

        }
    );

    clearInterval(presenceTimer);

    presenceTimer = setInterval(
        renderDashboardUsers,
        30 * 1000
    );

}

function renderDashboardUsers() {

    if (!userList) {
        return;
    }

    if (dashboardUsers.length === 0) {

        userList.innerHTML =
            "登録ユーザーはいません。";

        return;

    }

    const sortedUsers = [
        ...dashboardUsers
    ].sort((a, b) => {

        const statusA =
            getPresencePriority(
                presenceStatuses[a.id]
            );

        const statusB =
            getPresencePriority(
                presenceStatuses[b.id]
            );

        if (statusA !== statusB) {
            return statusA - statusB;
        }

        const changedA =
            Number(
                presenceStatuses[a.id]
                    ?.lastChanged || 0
            );

        const changedB =
            Number(
                presenceStatuses[b.id]
                    ?.lastChanged || 0
            );

        return changedB - changedA;

    });

    const html = sortedUsers
        .map(user => {

            const presence =
                presenceStatuses[user.id] || null;

            const status =
                formatPresenceStatus(presence);

            const pageName =
                presence?.pageName ||
                formatPageName(
                    presence?.page
                );

            return `
                <div
                    class="setting-row admin-user"
                    data-id="${user.id}">

                    <span>

                        <b>
                            ${status.icon}
                            ${user.id}
                        </b>

                        <br>

                        <span class="admin-presence-status">
                            ${status.text}
                        </span>

                        ${
                            pageName
                                ? `
                                    <br>

                                    <small class="admin-presence-page">
                                        📱 ${pageName}
                                    </small>
                                `
                                : ""
                        }

                        <br>

                        <small>
                            ${
                                user.department ||
                                user.major ||
                                "所属なし"
                            }

                            ${user.grade || ""}
                        </small>

                    </span>

                </div>
            `;

        })
        .join("");

    userList.innerHTML = html;

}

function getPresencePriority(presence) {

    if (!presence) {
        return 3;
    }

    if (presence.state === "online") {
        return 0;
    }

    if (presence.state === "away") {
        return 1;
    }

    return 2;

}

function formatPresenceStatus(presence) {

    if (!presence) {

        return {
            icon: "⚫",
            text: "接続履歴なし"
        };

    }

    const state =
        presence.state || "offline";

    const lastChanged =
        Number(
            presence.lastChanged || 0
        );

    if (state === "online") {

        return {
            icon: "🟢",
            text: "オンライン"
        };

    }

    if (state === "away") {

        return {
            icon: "🟡",
            text: "バックグラウンド"
        };

    }

    return {
        icon: "🔴",
        text: formatLastSeen(lastChanged)
    };

}

function formatLastSeen(timestamp) {

    if (!timestamp) {
        return "オフライン";
    }

    const diff =
        Math.max(
            0,
            Date.now() - timestamp
        );

    const seconds =
        Math.floor(diff / 1000);

    const minutes =
        Math.floor(diff / 60000);

    const hours =
        Math.floor(diff / 3600000);

    const days =
        Math.floor(diff / 86400000);

    if (seconds < 30) {
        return "たった今";
    }

    if (minutes < 1) {
        return `${seconds}秒前`;
    }

    if (minutes < 60) {
        return `${minutes}分前`;
    }

    if (hours < 24) {
        return `${hours}時間前`;
    }

    if (days < 7) {
        return `${days}日前`;
    }

    const date =
        new Date(timestamp);

    return (
        `${date.getMonth() + 1}/` +
        `${date.getDate()} ` +
        `${String(date.getHours())
            .padStart(2, "0")}:` +
        `${String(date.getMinutes())
            .padStart(2, "0")}`
    );

}

function formatPageName(page) {

    if (!page) {
        return "";
    }

    const fileName =
        String(page)
            .split("/")
            .pop();

    const pageNames = {
        "index.html": "ホーム画面",
        "news.html": "お知らせ",
        "share.html": "共有画面",
        "post.html": "投稿作成",
        "comments.html": "コメント画面",
        "profile.html": "プロフィール",
        "settings.html": "設定画面",
        "assignment.html": "課題画面",
        "exam.html": "テスト対策",
        "quiz.html": "四択問題",
        "fill_blank.html": "穴埋め問題",
        "daily_question.html": "今日の1問",
        "must_remember.html": "重要ポイント",
        "weather-settings.html": "天気設定",
        "admin.html": "管理画面"
    };

    return (
        pageNames[fileName] ||
        fileName
    );

}

async function loadSystemStatus() {

    try {

        const snap =
            await getSystemAppSnapshot();

        if (!snap.exists()) {
            renderStatus.textContent = "⚫ 未確認";
            return;
        }

        const data = snap.data();

        if (data.renderStatus === "ok") {
            renderStatus.textContent = "🟢 正常";
        } else if (data.renderStatus === "running") {
            renderStatus.textContent = "🟡 実行中";
        } else if (data.renderStatus === "error") {
            renderStatus.textContent = "🔴 エラー";
        } else {
            renderStatus.textContent = "⚫ 未確認";
        }

        lastCronText.textContent =
            formatAdminDate(data.lastCronAt);

        lastScheduleCheckText.textContent =
            formatAdminDate(data.lastScheduleCheckAt);

        lastAssignmentCheckText.textContent =
            formatAdminDate(data.lastAssignmentCheckAt);

    } catch (e) {

        console.error(e);

        renderStatus.textContent = "🔴 取得失敗";

    }

}

function formatAdminDate(timestamp) {

    if (!timestamp) {
        return "----";
    }

    const date = timestamp.toDate();

    return (
        `${date.getFullYear()}/` +
        `${date.getMonth() + 1}/` +
        `${date.getDate()} ` +
        `${String(date.getHours()).padStart(2, "0")}:` +
        `${String(date.getMinutes()).padStart(2, "0")}`
    );

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

function loadReports() {

    const q = query(
        collection(db, "reports"),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {

        if (snapshot.empty) {

            reportList.innerHTML =
                "通報はありません。";

            return;

        }

        reportList.innerHTML = "";

        snapshot.forEach(reportDoc => {

            const report = reportDoc.data();

            reportList.innerHTML += `

            <div class="card setting-card">

                <p>
                    <b>種類：</b>
                    ${report.type === "post" ? "投稿" : "コメント"}
                </p>

                <p>
                    <b>対象者：</b>
                    ${report.targetStudentNumber || "-"}
                </p>

                <p>
                    <b>通報者：</b>
                    ${report.reporterStudentNumber || "-"}
                </p>

                <p>
                    <b>理由：</b><br>
                    ${(report.reason || "").replace(/\n/g, "<br>")}
                </p>

                <p>
                    <b>状態：</b>
                    ${report.status || "open"}
                </p>

                <button
                    class="btn btn-danger delete-reported-post"
                    data-report-id="${reportDoc.id}"
                    data-post-id="${report.postId || ""}">

                    投稿を削除

                </button>

                <br><br>

                <button
                    class="btn btn-secondary close-report"
                    data-report-id="${reportDoc.id}">

                    対応済みにする

                </button>

            </div>

            `;

        });

    });

}

async function loadMaintenance() {

    const snap =
        await getSystemAppSnapshot();

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

    notifySystemNews.checked =
        settings.systemNews ?? true;

    notifySharePost.checked =
        settings.sharePost ?? true;

    notifyLike.checked =
        settings.like ?? true;

    notifyComment.checked =
        settings.comment ?? true;

}

function setupEvents() {

    enablePushButton.onclick = enablePushNotification;

    postSystemNews.onclick = postNews;

    saveMaintenance.onclick = saveMaintenanceSettings;

    document.getElementById("sendTestPush").onclick =
        sendTestNotification;
    document.getElementById("logout").onclick = () => {

        if (!confirm("ログアウトしますか？")) return;

        localStorage.removeItem("loggedIn");

        location.href = "login.html";

    };

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

        input.addEventListener(
            "change",
            saveNotificationSettings
        );

    });

    document.addEventListener("click", async (e) => {
    
        if (e.target.classList.contains("close-report")) {

            await updateDoc(
                doc(db, "reports", e.target.dataset.reportId),
                {
                    status: "closed"
                }
            );
        
            showToast("対応済みにしました");
            return;
        
        }
	
        if (e.target.classList.contains("delete-reported-post")) {
        
            const ok =
                confirm("この投稿を削除しますか？");
        
            if (!ok) return;
        
            await deleteDoc(
                doc(db, "posts", e.target.dataset.postId)
            );
        
            await updateDoc(
                doc(db, "reports", e.target.dataset.reportId),
                {
                    status: "closed"
                }
            );
        
            showToast("投稿を削除しました");
            return;
        
        }
	
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
            createdAt: serverTimestamp(),

            notifyTarget: "allUsers",
            notificationSentAt: null
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
                courseNews: notifyCourseNews.checked,
                systemNews: notifySystemNews.checked,
                sharePost: notifySharePost.checked,
                like: notifyLike.checked,
                comment: notifyComment.checked
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

document.addEventListener("click", async (e) => {

    const row =
        e.target.closest(".admin-user");

    if (!row) return;

    openUserDetail(row.dataset.id);

});

async function openUserDetail(studentNumber) {

    const snap = await getDoc(
        doc(db, "users", studentNumber)
    );

    if (!snap.exists()) return;

    const user = snap.data();

    let text = `

学籍番号：${studentNumber}

学科：${user.department || "-"}

専攻：${user.major || "-"}

学年：${user.grade || "-"}

`;

    if (user.lastLoginAt) {

        text += `

最終ログイン

${user.lastLoginAt.toDate().toLocaleString()}

`;

    }

    const ok = confirm(
	    text + "\n\nこのユーザーを削除しますか？"
	);
	
	if (!ok) return;
	
	const deleteOk = confirm(
	    "本当に削除しますか？\nこの操作は元に戻せません。"
	);
	
	if (!deleteOk) return;
	
	await deleteDoc(
	    doc(db, "users", studentNumber)
	);
	
	showToast("ユーザーを削除しました");
	
	await loadDashboard();

}

async function enablePushNotification() {

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
        alert("通知が許可されませんでした。");
        return;
    }

    const registration =
        await navigator.serviceWorker.register("sw.js");

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

    showToast("通知を再登録しました");

}

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