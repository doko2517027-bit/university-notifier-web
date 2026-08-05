import {
    db,
    realtimeDb,
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
    collection,
    getDocs,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
    ref,
    onValue
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";


const userName =
    document.getElementById("userName");

const themeButton =
    document.getElementById("themeButton");

const topProfileImage =
    document.getElementById("topProfileImage");

const backButton =
    document.getElementById("backButton");

const addUserButton =
    document.getElementById("addUserButton");

const refreshUsersButton =
    document.getElementById("refreshUsersButton");

const userSearchInput =
    document.getElementById("userSearchInput");

const departmentFilter =
    document.getElementById("departmentFilter");

const gradeFilter =
    document.getElementById("gradeFilter");

const statusFilter =
    document.getElementById("statusFilter");

const userTotalCount =
    document.getElementById("userTotalCount");

const onlineUserCount =
    document.getElementById("onlineUserCount");

const awayUserCount =
    document.getElementById("awayUserCount");

const offlineUserCount =
    document.getElementById("offlineUserCount");

const filteredUserCount =
    document.getElementById("filteredUserCount");

const userList =
    document.getElementById("userList");


let users = [];

let presenceStatuses = {};

let presenceTimer = null;

let stopUsersListener = null;


setupTheme(themeButton);


const admin = await isAdmin();

if (!admin) {

    alert("管理者のみアクセスできます。");

    location.href = "index.html";

    throw new Error(
        "管理者権限がありません。"
    );

}


await initializePage([
    setupAdminTab(),
    loadUserName(userName),
    loadMyRanking(),
    loadProfileImage(topProfileImage),
    loadUsers(),
    updateAssignmentNavBadge(),
    updateShareNavBadge(),
    updateNewsNavBadge()
]);


startUsersListener();

startPresenceListener();

setupEvents();

renderUsers();


async function loadUsers() {

    try {

        const snapshot =
            await getDocs(
                collection(db, "users")
            );

        users =
            snapshot.docs.map(userDoc => ({
                id: userDoc.id,
                ...userDoc.data()
            }));

        renderUsers();

    } catch (error) {

        console.error(
            "ユーザー取得エラー:",
            error
        );

        if (userList) {

            userList.innerHTML = `
                <div class="admin-user-loading">
                    ユーザー情報の取得に失敗しました。
                </div>
            `;

        }

    }

}


function startUsersListener() {

    if (stopUsersListener) {
        stopUsersListener();
    }

    stopUsersListener =
        onSnapshot(
            collection(db, "users"),
            snapshot => {

                users =
                    snapshot.docs.map(userDoc => ({
                        id: userDoc.id,
                        ...userDoc.data()
                    }));

                renderUsers();

            },
            error => {

                console.error(
                    "ユーザー監視エラー:",
                    error
                );

            }
        );

}


function startPresenceListener() {

    const statusRef =
        ref(
            realtimeDb,
            "status"
        );

    onValue(
        statusRef,
        snapshot => {

            presenceStatuses =
                snapshot.val() || {};

            renderUsers();

        },
        error => {

            console.error(
                "オンライン状態取得エラー:",
                error
            );

        }
    );

    clearInterval(
        presenceTimer
    );

    presenceTimer =
        setInterval(
            renderUsers,
            30 * 1000
        );

}


function setupEvents() {

    if (backButton) {

        backButton.onclick = () => {

            location.href =
                "admin.html";

        };

    }


    if (addUserButton) {

        addUserButton.onclick = () => {

            location.href =
                "admin_user_register.html";

        };

    }


    if (refreshUsersButton) {

        refreshUsersButton.onclick =
            async () => {

                refreshUsersButton.disabled =
                    true;

                refreshUsersButton.textContent =
                    "更新中...";

                await loadUsers();

                refreshUsersButton.disabled =
                    false;

                refreshUsersButton.textContent =
                    "↻ 更新";

                showToast(
                    "ユーザー情報を更新しました"
                );

            };

    }


    [
        userSearchInput,
        departmentFilter,
        gradeFilter,
        statusFilter
    ]
    .filter(Boolean)
    .forEach(element => {

        const eventName =
            element.tagName === "INPUT"
                ? "input"
                : "change";

        element.addEventListener(
            eventName,
            renderUsers
        );

    });


    if (userList) {

        userList.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        ".admin-user-detail-button"
                    );

                if (!button) {
                    return;
                }

                const selectedStudentNumber =
                    button.dataset.studentNumber;

                if (!selectedStudentNumber) {
                    return;
                }

                location.href =
                    "user_detail_admin.html" +
                    "?studentNumber=" +
                    encodeURIComponent(
                        selectedStudentNumber
                    );

            }
        );

    }

}


function renderUsers() {

    if (!userList) {
        return;
    }

    updateSummary();

    const filteredUsers =
        getFilteredUsers();

    if (filteredUserCount) {

        filteredUserCount.textContent =
            `${filteredUsers.length}人を表示`;

    }

    if (filteredUsers.length === 0) {

        userList.innerHTML = `
            <div class="admin-user-loading">
                条件に一致するユーザーはいません。
            </div>
        `;

        return;

    }

    const sortedUsers =
        [...filteredUsers]
            .sort(compareUsers);

    userList.innerHTML =
        sortedUsers
            .map(createUserHtml)
            .join("");

}


function getFilteredUsers() {

    const keyword =
        String(
            userSearchInput?.value || ""
        )
        .trim()
        .toLowerCase();

    const selectedDepartment =
        departmentFilter?.value || "";

    const selectedGrade =
        gradeFilter?.value || "";

    const selectedStatus =
        statusFilter?.value || "";

    return users.filter(user => {

        const presence =
            presenceStatuses[user.id] || null;

        const statusKey =
            getPresenceStatusKey(
                presence
            );

        const userDepartment =
            getUserDepartment(user);

        const userNameText =
            getUserName(user);

        const matchesKeyword =
            !keyword ||
            String(user.id)
                .toLowerCase()
                .includes(keyword) ||
            userNameText
                .toLowerCase()
                .includes(keyword) ||
            userDepartment
                .toLowerCase()
                .includes(keyword);

        const matchesDepartment =
            !selectedDepartment ||
            userDepartment ===
                selectedDepartment;

        const matchesGrade =
            !selectedGrade ||
            String(user.grade || "") ===
                selectedGrade;

        const matchesStatus =
            !selectedStatus ||
            statusKey === selectedStatus;

        return (
            matchesKeyword &&
            matchesDepartment &&
            matchesGrade &&
            matchesStatus
        );

    });

}


function compareUsers(userA, userB) {

    const presenceA =
        presenceStatuses[userA.id] || null;

    const presenceB =
        presenceStatuses[userB.id] || null;

    const priorityA =
        getPresencePriority(
            presenceA
        );

    const priorityB =
        getPresencePriority(
            presenceB
        );

    if (priorityA !== priorityB) {

        return priorityA - priorityB;

    }

    const lastChangedA =
        Number(
            presenceA?.lastChanged || 0
        );

    const lastChangedB =
        Number(
            presenceB?.lastChanged || 0
        );

    if (lastChangedA !== lastChangedB) {

        return (
            lastChangedB -
            lastChangedA
        );

    }

    return String(userA.id)
        .localeCompare(
            String(userB.id),
            "ja"
        );

}


function createUserHtml(user) {

    const presence =
        presenceStatuses[user.id] || null;

    const status =
        formatPresenceStatus(
            presence
        );

    const pageName =
        presence?.pageName ||
        formatPageName(
            presence?.page
        );

    const rawPage =
        presence?.page || "";

    const studentName =
        getUserName(user);

    const department =
        getUserDepartment(user);

    const grade =
        user.grade
            ? `${user.grade}年`
            : "学年未設定";

    return `
        <div class="admin-user-item">

            <div class="admin-user-main">

                <div class="admin-user-title">

                    <strong>
                        ${status.icon}
                        ${escapeHtml(user.id)}
                    </strong>

                    <span class="admin-user-status">
                        ${escapeHtml(status.text)}
                    </span>

                </div>

                ${
                    studentName
                        ? `
                            <p class="admin-user-name">
                                ${escapeHtml(studentName)}
                            </p>
                        `
                        : ""
                }

                <p class="admin-user-affiliation">

                    ${escapeHtml(department)}

                    ・

                    ${escapeHtml(grade)}

                </p>

                <div class="admin-user-presence-detail">

                    <p>
                        <b>現在の画面：</b>

                        ${
                            pageName
                                ? escapeHtml(pageName)
                                : "取得できません"
                        }
                    </p>

                    ${
                        rawPage
                            ? `
                                <small>
                                    ${escapeHtml(rawPage)}
                                </small>
                            `
                            : ""
                    }

                    <p>
                        <b>接続状態：</b>
                        ${escapeHtml(status.text)}
                    </p>

                    <p>
                        <b>最終更新：</b>
                        ${
                            presence?.lastChanged
                                ? escapeHtml(
                                    formatLastSeen(
                                        Number(
                                            presence.lastChanged
                                        )
                                    )
                                )
                                : "接続履歴なし"
                        }
                    </p>

                </div>

            </div>

            <button
                type="button"
                class="btn btn-primary admin-user-detail-button"
                data-student-number="${escapeHtml(user.id)}">

                詳細を見る

            </button>

        </div>
    `;

}


function updateSummary() {

    let onlineCount = 0;

    let awayCount = 0;

    let offlineCount = 0;

    let unknownCount = 0;

    users.forEach(user => {

        const statusKey =
            getPresenceStatusKey(
                presenceStatuses[user.id]
            );

        if (statusKey === "online") {

            onlineCount += 1;

        } else if (
            statusKey === "away"
        ) {

            awayCount += 1;

        } else if (
            statusKey === "offline"
        ) {

            offlineCount += 1;

        } else {

            unknownCount += 1;

        }

    });

    if (userTotalCount) {

        userTotalCount.textContent =
            `${users.length}人`;

    }

    if (onlineUserCount) {

        onlineUserCount.textContent =
            `${onlineCount}人`;

    }

    if (awayUserCount) {

        awayUserCount.textContent =
            `${awayCount}人`;

    }

    if (offlineUserCount) {

        offlineUserCount.textContent =
            `${offlineCount + unknownCount}人`;

        offlineUserCount.title =
            `オフライン ${offlineCount}人 / 接続履歴なし ${unknownCount}人`;

    }

}


function getPresenceStatusKey(
    presence
) {

    if (!presence) {
        return "unknown";
    }

    if (
        presence.state === "online"
    ) {
        return "online";
    }

    if (
        presence.state === "away"
    ) {
        return "away";
    }

    return "offline";

}


function getPresencePriority(
    presence
) {

    const statusKey =
        getPresenceStatusKey(
            presence
        );

    const priorities = {
        online: 0,
        away: 1,
        offline: 2,
        unknown: 3
    };

    return (
        priorities[statusKey] ?? 4
    );

}


function formatPresenceStatus(
    presence
) {

    if (!presence) {

        return {
            icon: "⚫",
            text: "接続履歴なし"
        };

    }

    if (
        presence.state === "online"
    ) {

        return {
            icon: "🟢",
            text: "オンライン"
        };

    }

    if (
        presence.state === "away"
    ) {

        return {
            icon: "🟡",
            text: "バックグラウンド"
        };

    }

    return {
        icon: "🔴",
        text: `オフライン・${formatLastSeen(
            Number(
                presence.lastChanged || 0
            )
        )}`
    };

}


function formatLastSeen(
    timestamp
) {

    if (!timestamp) {
        return "日時不明";
    }

    const difference =
        Math.max(
            0,
            Date.now() - timestamp
        );

    const seconds =
        Math.floor(
            difference / 1000
        );

    const minutes =
        Math.floor(
            difference / 60000
        );

    const hours =
        Math.floor(
            difference / 3600000
        );

    const days =
        Math.floor(
            difference / 86400000
        );

    if (seconds < 30) {
        return "たった今";
    }

    if (seconds < 60) {
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

}


function formatPageName(page) {

    if (!page) {
        return "";
    }

    const fileName =
        String(page)
            .split("?")[0]
            .split("#")[0]
            .split("/")
            .pop();

    const pageNames = {
        "index.html": "ホーム",
        "assignments.html": "課題一覧",
        "assignment.html": "課題詳細",
        "news.html": "お知らせ",
        "share.html": "共有",
        "post.html": "投稿作成",
        "comments.html": "コメント",
        "profile.html": "プロフィール",
        "settings.html": "設定",
        "exam.html": "テスト対策",
        "quiz.html": "四択問題",
        "fill_blank.html": "穴埋め問題",
        "daily_question.html": "今日の1問",
        "must_remember.html": "重要ポイント",
        "weather-settings.html": "天気設定",
        "admin.html": "管理画面",
        "users_admin.html": "ユーザー管理",
        "exam_admin.html": "テスト管理",
        "subjects_admin.html": "履修科目管理",
        "curriculum_admin.html": "カリキュラム管理",
        "attendance_admin.html": "出席管理",
        "reports_admin.html": "通報管理",
        "system_news_admin.html": "CareMateお知らせ管理"
    };

    return (
        pageNames[fileName] ||
        fileName ||
        "不明な画面"
    );

}


function getUserDepartment(user) {

    return (
        user.department ||
        user.major ||
        "所属未設定"
    );

}


function getUserName(user) {

    return String(
        user.name ||
        user.userName ||
        user.displayName ||
        ""
    );

}


function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


window.addEventListener(
    "beforeunload",
    () => {

        clearInterval(
            presenceTimer
        );

        if (stopUsersListener) {
            stopUsersListener();
        }

    }
);