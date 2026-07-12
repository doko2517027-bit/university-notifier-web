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
    showToast,
    setupOfflineAlert
} from "./common.js";

import {
    doc,
    getDoc,
    setDoc,
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
const scheduleType = document.getElementById("scheduleType");
const scheduleDate = document.getElementById("scheduleDate");
const loadScheduleButton = document.getElementById("loadScheduleButton");
const adminScheduleList = document.getElementById("adminScheduleList");

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

            const now = Date.now();

            let status = "⚫";

            if (user.lastActiveAt) {

                const diff =
                    now - user.lastActiveAt.toDate().getTime();

                if (diff <= 5 * 60 * 1000) {

                    status = "🟢";

                } else if (diff <= 30 * 60 * 1000) {

                    status = "🟡";

                } else {

                    status = "🔴";

                }

            }

            userList.innerHTML += `

            <div
                class="setting-row admin-user"
                data-id="${userDoc.id}">

                <span>

                    <b>${status} ${userDoc.id}</b><br>

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

    await loadSystemStatus();
}

async function loadSystemStatus() {

    try {

        const snap = await getDoc(
            doc(db, "system", "app")
        );

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

    loadScheduleButton.onclick = loadAdminSchedule;

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

        if (
            e.target.classList.contains(
                "save-schedule-override"
            )
        ) {

            await saveScheduleOverride(e.target);
            return;

        }
    
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

async function loadAdminSchedule() {

    const selectedType =
        scheduleType.value;

    const selectedDate =
        scheduleDate.value;

    if (!selectedDate) {

        alert("日付を選択してください。");
        return;

    }

    adminScheduleList.textContent =
        "講義を読み込んでいます...";

    try {

        const scheduleSnap = await getDoc(
            doc(db, "schedule", selectedType)
        );

        if (!scheduleSnap.exists()) {

            adminScheduleList.textContent =
                "時間割データが見つかりません。";

            return;

        }

        const scheduleData =
            scheduleSnap.data();

        const days =
            Array.isArray(scheduleData.days)
                ? scheduleData.days
                : [];

        const selectedDay = days.find(
            day => day.date === selectedDate
        );

        if (!selectedDay) {

            adminScheduleList.textContent =
                "選択した日付のデータはありません。";

            return;

        }

        const schedules =
            Array.isArray(selectedDay.schedules)
                ? selectedDay.schedules
                : [];

        if (schedules.length === 0) {

            adminScheduleList.textContent =
                "この日の講義はありません。";

            return;

        }

        const sortedSchedules = [...schedules].sort(
            (a, b) => {

                const gradeA =
                    Number(a.grade) || 0;

                const gradeB =
                    Number(b.grade) || 0;

                if (gradeA !== gradeB) {
                    return gradeA - gradeB;
                }

                const periodA =
                    Number(a.period) || 0;

                const periodB =
                    Number(b.period) || 0;

                return periodA - periodB;

            }
        );

        adminScheduleList.innerHTML =
            sortedSchedules.map(
                (schedule, index) => {

                    const originalSubject =
                        String(schedule.subject || "");

                    const overrideId =
                        createScheduleOverrideId({
                            scheduleType: selectedType,
                            date: selectedDate,
                            grade: schedule.grade,
                            period: schedule.period,
                            target: schedule.target,
                            kubun: schedule.kubun,
                            subject: originalSubject
                        });

                    return `

                    <div
                        class="card setting-card admin-schedule-item"
                        data-override-id="${escapeAdminHtml(overrideId)}"
                        data-schedule-type="${escapeAdminHtml(selectedType)}"
                        data-date="${escapeAdminHtml(selectedDate)}"
                        data-grade="${escapeAdminHtml(schedule.grade || "")}"
                        data-period="${escapeAdminHtml(schedule.period || "")}"
                        data-target="${escapeAdminHtml(schedule.target || "")}"
                        data-kubun="${escapeAdminHtml(schedule.kubun || "")}"
                        data-original-subject="${escapeAdminHtml(originalSubject)}"
                        data-original-building="${escapeAdminHtml(schedule.building || "")}"
                        data-original-room="${escapeAdminHtml(schedule.room || "")}"
                        data-original-teacher="${escapeAdminHtml(schedule.teacher || "")}">

                        <p>
                            <b>
                                ${escapeAdminHtml(schedule.grade || "-")}年
                                ${escapeAdminHtml(schedule.period || "-")}限
                            </b>
                        </p>

                        <label>
                            <b>科目</b>
                        </label>

                        <input
                            type="text"
                            class="admin-schedule-subject"
                            value="${escapeAdminHtml(schedule.subject || "")}">

                        <br><br>

                        <label>
                            <b>校舎</b>
                        </label>

                        <input
                            type="text"
                            class="admin-schedule-building"
                            value="${escapeAdminHtml(schedule.building || "")}">

                        <br><br>

                        <label>
                            <b>教室</b>
                        </label>

                        <input
                            type="text"
                            class="admin-schedule-room"
                            value="${escapeAdminHtml(schedule.room || "")}">

                        <br><br>

                        <label>
                            <b>教員</b>
                        </label>

                        <input
                            type="text"
                            class="admin-schedule-teacher"
                            value="${escapeAdminHtml(schedule.teacher || "")}">

                        <br><br>

                        <button
                            type="button"
                            class="btn btn-primary save-schedule-override">

                            手動変更を保存

                        </button>

                    </div>

                    `;

                }
            ).join("");

    } catch (error) {

        console.error(
            "講義一覧の取得に失敗しました:",
            error
        );

        adminScheduleList.textContent =
            "講義一覧の取得に失敗しました。";

    }

}

async function saveScheduleOverride(button) {

    const item =
        button.closest(".admin-schedule-item");

    if (!item) return;

    const subjectInput =
        item.querySelector(
            ".admin-schedule-subject"
        );

    const buildingInput =
        item.querySelector(
            ".admin-schedule-building"
        );

    const roomInput =
        item.querySelector(
            ".admin-schedule-room"
        );

    const teacherInput =
        item.querySelector(
            ".admin-schedule-teacher"
        );

    const subject =
        subjectInput.value.trim();

    const building =
        buildingInput.value.trim();

    const room =
        roomInput.value.trim();

    const teacher =
        teacherInput.value.trim();

    const originalSubject =
        item.dataset.originalSubject || "";

    const originalBuilding =
        item.dataset.originalBuilding || "";

    const originalRoom =
        item.dataset.originalRoom || "";

    const originalTeacher =
        item.dataset.originalTeacher || "";

    if (!subject) {

        alert("科目名は空にできません。");
        return;

    }

    const overriddenFields = {
        subject:
            subject !== originalSubject,

        building:
            building !== originalBuilding,

        room:
            room !== originalRoom,

        teacher:
            teacher !== originalTeacher
    };

    const hasChanges =
        Object.values(overriddenFields).some(
            value => value === true
        );

    if (!hasChanges) {

        showToast("変更された項目はありません");
        return;

    }

    button.disabled = true;
    button.textContent = "保存中...";

    try {

        await setDoc(
            doc(
                db,
                "scheduleOverrides",
                item.dataset.overrideId
            ),
            {
                scheduleType:
                    item.dataset.scheduleType,

                date:
                    item.dataset.date,

                grade:
                    item.dataset.grade,

                period:
                    item.dataset.period,

                target:
                    item.dataset.target,

                kubun:
                    item.dataset.kubun,

                originalSubject,

                subject,
                building,
                room,
                teacher,

                overriddenFields,

                updatedBy:
                    studentNumber,

                updatedAt:
                    serverTimestamp()
            }
        );

        showToast(
            "講義の手動変更を保存しました"
        );

        button.textContent = "保存済み";

    } catch (error) {

        console.error(
            "講義の手動変更保存に失敗しました:",
            error
        );

        alert(
            "講義の手動変更を保存できませんでした。"
        );

        button.textContent =
            "手動変更を保存";

    } finally {

        button.disabled = false;

    }

}


function escapeAdminHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}

function createScheduleOverrideId(schedule) {

    const rawId = [
        schedule.scheduleType,
        schedule.date,
        schedule.grade,
        schedule.period,
        schedule.target,
        schedule.kubun,
        schedule.subject
    ].map(value =>
        String(value || "").trim()
    ).join("__");

    return rawId
        .replace(/\//g, "／")
        .replace(/\s+/g, "_");

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
	
	loadDashboard();

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