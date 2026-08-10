import { VERSION } from "./version.js";

import {
    getAdminScope,
    saveAdminScope,
    scopeLabel,
    withAdminScope,
    matchesAdminScope
} from "./admin_scope.js";

import {
    db,
    studentNumber,
    setupTheme,
    initializePage,
    loadProfileImage,
    loadUserName,
    loadMyRanking,
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
    setDoc,
    updateDoc,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
    registerDevicePushSubscription
} from "./push_subscription.js";


/* ========================================
   HTML要素
======================================== */

const userName =
    document.getElementById("userName");

const themeButton =
    document.getElementById("themeButton");

const topProfileImage =
    document.getElementById("topProfileImage");


const userCount =
    document.getElementById("userCount");

const adminScopeDepartment = document.getElementById("adminScopeDepartment");
const adminScopeMajor = document.getElementById("adminScopeMajor");
const adminScopeGrade = document.getElementById("adminScopeGrade");
const adminScopeCurrent = document.getElementById("adminScopeCurrent");

const versionText =
    document.getElementById("versionText");

const firestoreStatus =
    document.getElementById("firestoreStatus");

const renderStatus =
    document.getElementById("renderStatus");

const lastCronText =
    document.getElementById("lastCronText");

const lastScheduleCheckText =
    document.getElementById(
        "lastScheduleCheckText"
    );

const lastAssignmentCheckText =
    document.getElementById(
        "lastAssignmentCheckText"
    );


const maintenanceToggle =
    document.getElementById(
        "maintenanceToggle"
    );

const maintenanceMessage =
    document.getElementById(
        "maintenanceMessage"
    );

const saveMaintenance =
    document.getElementById(
        "saveMaintenance"
    );


const notifySchedule =
    document.getElementById(
        "notifySchedule"
    );

const notifyAssignment =
    document.getElementById(
        "notifyAssignment"
    );

const notifyReminder =
    document.getElementById(
        "notifyReminder"
    );

const notifyCourseNews =
    document.getElementById(
        "notifyCourseNews"
    );

const notifySystemNews =
    document.getElementById(
        "notifySystemNews"
    );

const notifySharePost =
    document.getElementById(
        "notifySharePost"
    );

const notifyLike =
    document.getElementById(
        "notifyLike"
    );

const notifyComment =
    document.getElementById(
        "notifyComment"
    );


const enablePushButton =
    document.getElementById(
        "enablePushButton"
    );

const sendTestPush =
    document.getElementById(
        "sendTestPush"
    );

const logoutButton =
    document.getElementById(
        "logout"
    );


/* ========================================
   状態
======================================== */

let systemAppPromise = null;


function currentAdminScope() {

    return saveAdminScope({
        department: adminScopeDepartment?.value || "",
        major: adminScopeMajor?.value || "",
        grade: adminScopeGrade?.value || ""
    });

}


function renderAdminScope() {

    const scope = currentAdminScope();

    if (adminScopeCurrent) {
        adminScopeCurrent.textContent =
            `現在の管理対象：${scopeLabel(scope)}`;
    }

    loadDashboard();

}


function getSystemAppSnapshot() {

    if (!systemAppPromise) {

        systemAppPromise =
            getDoc(
                doc(
                    db,
                    "system",
                    "app"
                )
            );

    }

    return systemAppPromise;

}


/* ========================================
   初期化
======================================== */

setupTheme(themeButton);


const admin =
    await isAdmin();

if (!admin) {

    alert(
        "管理者のみアクセスできます。"
    );

    location.href =
        "index.html";

    throw new Error(
        "管理者権限がありません。"
    );

}


await initializePage([
    setupAdminTab(),
    loadUserName(userName),
    loadMyRanking(),
    loadProfileImage(topProfileImage),
    loadDashboard(),
    loadSystemStatus(),
    loadMaintenance(),
    loadNotificationSettings(),
    updateAssignmentNavBadge(),
    updateShareNavBadge(),
    updateNewsNavBadge()
]);


const storedAdminScope = getAdminScope();

if (adminScopeDepartment) adminScopeDepartment.value = storedAdminScope.department;
if (adminScopeMajor) adminScopeMajor.value = storedAdminScope.major;
if (adminScopeGrade) adminScopeGrade.value = storedAdminScope.grade;

renderAdminScope();


setupEvents();


/* ========================================
   ダッシュボード
======================================== */

async function loadDashboard() {

    setText(
        versionText,
        `Version ${VERSION}`
    );


    try {

        const usersSnapshot =
            await getDocs(
                collection(
                    db,
                    "users"
                )
            );


        const scopedUsers = usersSnapshot.docs
            .map(userDocument => userDocument.data())
            .filter(user => matchesAdminScope(user, getAdminScope()));

        setText(userCount, `${scopedUsers.length}人`);


        setText(
            firestoreStatus,
            "🟢 正常"
        );

    } catch (error) {

        console.error(
            "ダッシュボード取得エラー:",
            error
        );


        setText(
            userCount,
            "取得失敗"
        );


        setText(
            firestoreStatus,
            "🔴 エラー"
        );

    }

}


/* ========================================
   システム状態
======================================== */

async function loadSystemStatus() {

    try {

        const snapshot =
            await getSystemAppSnapshot();


        if (!snapshot.exists()) {

            setText(
                renderStatus,
                "⚫ 未確認"
            );

            setText(
                lastCronText,
                "----"
            );

            setText(
                lastScheduleCheckText,
                "----"
            );

            setText(
                lastAssignmentCheckText,
                "----"
            );

            return;

        }


        const data =
            snapshot.data();


        const renderStatusText = {

            ok:
                "🟢 正常",

            running:
                "🟡 実行中",

            error:
                "🔴 エラー"

        };


        setText(
            renderStatus,
            renderStatusText[
                data.renderStatus
            ] || "⚫ 未確認"
        );


        setText(
            lastCronText,
            formatAdminDate(
                data.lastCronAt
            )
        );


        setText(
            lastScheduleCheckText,
            formatAdminDate(
                data.lastScheduleCheckAt
            )
        );


        setText(
            lastAssignmentCheckText,
            formatAdminDate(
                data.lastAssignmentCheckAt
            )
        );

    } catch (error) {

        console.error(
            "システム状態取得エラー:",
            error
        );


        setText(
            renderStatus,
            "🔴 取得失敗"
        );

    }

}


function formatAdminDate(timestamp) {

    if (!timestamp) {
        return "----";
    }


    try {

        const date =
            typeof timestamp.toDate ===
            "function"
                ? timestamp.toDate()
                : new Date(timestamp);


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "----";

        }


        return (
            `${date.getFullYear()}/` +
            `${date.getMonth() + 1}/` +
            `${date.getDate()} ` +
            `${String(
                date.getHours()
            ).padStart(2, "0")}:` +
            `${String(
                date.getMinutes()
            ).padStart(2, "0")}`
        );

    } catch {

        return "----";

    }

}


/* ========================================
   メンテナンス設定
======================================== */

async function loadMaintenance() {

    try {

        const snapshot =
            await getSystemAppSnapshot();


        if (!snapshot.exists()) {
            return;
        }


        const data =
            snapshot.data();


        if (maintenanceToggle) {

            maintenanceToggle.checked =
                data.maintenance === true;

        }


        if (maintenanceMessage) {

            maintenanceMessage.value =
                data.message || "";

        }

    } catch (error) {

        console.error(
            "メンテナンス設定取得エラー:",
            error
        );

    }

}


async function saveMaintenanceSettings() {

    if (
        !maintenanceToggle ||
        !maintenanceMessage ||
        !saveMaintenance
    ) {

        return;

    }


    saveMaintenance.disabled =
        true;

    saveMaintenance.textContent =
        "保存中...";


    try {

        await setDoc(
            doc(
                db,
                "system",
                "app"
            ),
            {
                maintenance:
                    maintenanceToggle.checked,

                message:
                    maintenanceMessage.value
                        .trim()
            },
            {
                merge: true
            }
        );


        systemAppPromise = null;


        showToast(
            "メンテナンス設定を保存しました"
        );

    } catch (error) {

        console.error(
            "メンテナンス設定保存エラー:",
            error
        );


        alert(
            "メンテナンス設定の保存に失敗しました。"
        );

    } finally {

        saveMaintenance.disabled =
            false;

        saveMaintenance.textContent =
            "保存する";

    }

}


/* ========================================
   管理者本人の通知設定
======================================== */

async function loadNotificationSettings() {

    if (!studentNumber) {
        return;
    }


    try {

        const snapshot =
            await getDoc(
                doc(
                    db,
                    "users",
                    studentNumber
                )
            );


        if (!snapshot.exists()) {
            return;
        }


        const settings =
            snapshot.data()
                .notificationSettings ||
            {};


        setChecked(
            notifySchedule,
            settings.schedule ?? true
        );

        setChecked(
            notifyAssignment,
            settings.assignment ?? true
        );

        setChecked(
            notifyReminder,
            settings.reminder ?? true
        );

        setChecked(
            notifyCourseNews,
            settings.courseNews ?? true
        );

        setChecked(
            notifySystemNews,
            settings.systemNews ?? true
        );

        setChecked(
            notifySharePost,
            settings.sharePost ?? true
        );

        setChecked(
            notifyLike,
            settings.like ?? true
        );

        setChecked(
            notifyComment,
            settings.comment ?? true
        );

    } catch (error) {

        console.error(
            "通知設定取得エラー:",
            error
        );

    }

}


async function saveNotificationSettings() {

    if (!studentNumber) {
        return;
    }


    try {

        await updateDoc(
            doc(
                db,
                "users",
                studentNumber
            ),
            {
                notificationSettings: {

                    schedule:
                        getChecked(
                            notifySchedule,
                            true
                        ),

                    assignment:
                        getChecked(
                            notifyAssignment,
                            true
                        ),

                    reminder:
                        getChecked(
                            notifyReminder,
                            true
                        ),

                    courseNews:
                        getChecked(
                            notifyCourseNews,
                            true
                        ),

                    systemNews:
                        getChecked(
                            notifySystemNews,
                            true
                        ),

                    sharePost:
                        getChecked(
                            notifySharePost,
                            true
                        ),

                    like:
                        getChecked(
                            notifyLike,
                            true
                        ),

                    comment:
                        getChecked(
                            notifyComment,
                            true
                        )
                }
            }
        );


        showToast(
            "通知設定を保存しました"
        );

    } catch (error) {

        console.error(
            "通知設定保存エラー:",
            error
        );


        alert(
            "通知設定の保存に失敗しました。"
        );

    }

}


/* ========================================
   イベント
======================================== */

function setupEvents() {

    [
        adminScopeDepartment,
        adminScopeMajor,
        adminScopeGrade
    ]
    .filter(Boolean)
    .forEach(input => {

        input.addEventListener(
            "change",
            renderAdminScope
        );

    });


    document.querySelectorAll(
        ".admin-menu-card[onclick]"
    )
    .forEach(card => {

        const match = card
            .getAttribute("onclick")
            ?.match(/location\.href='([^']+)'/);

        if (!match) {
            return;
        }

        card.onclick = () => {

            location.href = withAdminScope(match[1]);

        };

    });

    if (enablePushButton) {

        enablePushButton.onclick =
            enablePushNotification;

    }


    if (sendTestPush) {

        sendTestPush.onclick =
            sendTestNotification;

    }


    if (saveMaintenance) {

        saveMaintenance.onclick =
            saveMaintenanceSettings;

    }


    if (logoutButton) {

        logoutButton.onclick = () => {

            if (
                !confirm(
                    "ログアウトしますか？"
                )
            ) {

                return;

            }


            localStorage.removeItem(
                "loggedIn"
            );


            location.href =
                "login.html";

        };

    }


    [
        notifySchedule,
        notifyAssignment,
        notifyReminder,
        notifyCourseNews,
        notifySystemNews,
        notifySharePost,
        notifyLike,
        notifyComment
    ]
    .filter(Boolean)
    .forEach(input => {

        input.addEventListener(
            "change",
            saveNotificationSettings
        );

    });

}


/* ========================================
   Push通知
======================================== */

async function enablePushNotification() {

    try {

        await registerDevicePushSubscription(
            db,
            studentNumber,
            "admin",
            "sw.js"
        );


        showToast(
            "通知を再登録しました"
        );

    } catch (error) {

        console.error(
            "Push通知登録エラー:",
            error
        );


        alert(
            error.message ||
            "通知の登録に失敗しました。"
        );

    }

}


async function sendTestNotification() {

    if (
        !(
            "Notification"
            in window
        )
    ) {

        alert(
            "この端末は通知に対応していません。"
        );

        return;

    }


    const permission =
        await Notification
            .requestPermission();


    if (
        permission !==
        "granted"
    ) {

        alert(
            "通知が許可されていません。"
        );

        return;

    }


    new Notification(
        "CareMate テスト通知",
        {
            body:
                "通知は正常に動作しています。",

            icon:
                "icon-192.png"
        }
    );

}


/* ========================================
   共通
======================================== */

function setText(
    element,
    value
) {

    if (!element) {
        return;
    }

    element.textContent =
        String(value ?? "");

}


function setChecked(
    element,
    value
) {

    if (!element) {
        return;
    }

    element.checked =
        value === true;

}


function getChecked(
    element,
    fallback
) {

    if (!element) {
        return fallback;
    }

    return element.checked;

}
