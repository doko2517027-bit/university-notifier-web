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
    getDocs,
    serverTimestamp
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
const annualProgressionHelp = document.getElementById("annualProgressionHelp");
const annualProgressionList = document.getElementById("annualProgressionList");
const annualTransitionActivationDate = document.getElementById("annualTransitionActivationDate");
const startAnnualTransition = document.getElementById("startAnnualTransition");
const stopAnnualTransition = document.getElementById("stopAnnualTransition");

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
    loadAnnualProgression();

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
    loadAnnualProgression(),
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


function academicYearForTransition(date = new Date()) {

    return date.getMonth() < 3
        ? date.getFullYear() - 1
        : date.getFullYear();

}


function defaultTransitionDate() {

    const year = academicYearForTransition() + 1;

    return `${year}-04-01`;

}


async function loadAnnualProgression() {

    if (!annualProgressionList) return;

    try {

        const [systemSnap, usersSnap] = await Promise.all([
            getDoc(doc(db, "system", "app")),
            getDocs(collection(db, "users"))
        ]);

        const transition = systemSnap.data()?.annualTransition || {};
        const active = transition.enabled === true;
        const targetYear = Number(transition.academicYear || academicYearForTransition());

        if (annualTransitionActivationDate) {
            annualTransitionActivationDate.value = transition.activationDate || defaultTransitionDate();
        }

        startAnnualTransition.hidden = active;
        stopAnnualTransition.hidden = !active;

        if (annualProgressionHelp) {
            annualProgressionHelp.textContent = active
                ? `${targetYear}年度の確認を受付中です。反映予定日：${transition.activationDate || "未設定"}。対象：${scopeLabel(getAdminScope())}`
                : "年度末確認を開始すると、対象学生は次回アプリを開いた時に必ず回答します。回答内容は反映予定日まで現在の画面へ影響しません。";
        }

        if (!active) {
            annualProgressionList.innerHTML = "<p>年度末確認はまだ開始していません。</p>";
            return;
        }

        const candidates = usersSnap.docs
            .map(item => ({ id: item.id, ...item.data() }))
            .filter(user => matchesAdminScope(user, getAdminScope()))
            .sort((left, right) => String(left.id).localeCompare(String(right.id)));

        annualProgressionList.innerHTML = candidates.length > 0
            ? candidates.map(user => renderAnnualProgressionUser(user, targetYear)).join("")
            : "<p>対象学生はいません。</p>";

    } catch (error) {

        console.error("年度末確認取得エラー:", error);
        annualProgressionList.innerHTML = "<p>年度末確認を取得できませんでした。</p>";

    }

}


function renderAnnualProgressionUser(user, targetYear) {

    const grade = Number(String(user.grade || "").replace("年", ""));
    const name = String(user.name || user.userName || user.displayName || "氏名未設定");
    const response = user.annualTransitionResponse;
    const answered = Number(response?.academicYear) === targetYear;
    const labels = {
        promote: "進級予定",
        repeat: "留年",
        graduate: "卒業予定",
        withdraw: "退学"
    };

    return `
        <article class="attendance-review-card">
            <b>${escapeHtml(name)}</b>
            <p>${escapeHtml(user.id)} ／ ${grade || "未設定"}年<br>
                回答：${answered ? escapeHtml(labels[response.action] || "未設定") : "未回答"}</p>
        </article>
    `;

}


async function saveAnnualTransition(enabled) {

    const activationDate = annualTransitionActivationDate?.value;

    if (enabled && !/^\d{4}-\d{2}-\d{2}$/.test(activationDate || "")) {
        showToast("反映予定日を入力してください");
        return;
    }

    const targetYear = academicYearForTransition();
    const message = enabled
        ? `${targetYear}年度の年度末確認を開始します。学生には必須の確認画面が表示されます。`
        : "年度末確認を停止します。学生の確認画面は表示されなくなります。";

    if (!confirm(message)) return;

    try {

        await setDoc(doc(db, "system", "app"), {
            annualTransition: {
                enabled,
                academicYear: targetYear,
                activationDate: enabled ? activationDate : null,
                startedAt: enabled ? new Date().toISOString() : null,
                updatedAt: new Date().toISOString(),
                updatedBy: studentNumber || ""
            },
            updatedAt: serverTimestamp()
        }, { merge: true });

        showToast(enabled ? "年度末確認を開始しました" : "年度末確認を停止しました");
        await loadAnnualProgression();

    } catch (error) {

        console.error("年度末確認保存エラー:", error);
        showToast("設定の保存に失敗しました");

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

    startAnnualTransition?.addEventListener("click", () => saveAnnualTransition(true));
    stopAnnualTransition?.addEventListener("click", () => saveAnnualTransition(false));

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
