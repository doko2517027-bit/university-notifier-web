import {
  db,
  realtimeDb,
  functions,
  auth,
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
  updateNewsNavBadge,
} from "./common.js";

import {
  readAdminScopeFromUrl,
  matchesAdminScope,
  withAdminScope,
} from "./admin_scope.js";

import { isPrimaryDeviceAuditViewer } from "./device_audit_access.mjs";

import {
  collection,
  getDocs,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

import {
  ref,
  onValue,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const userName = document.getElementById("userName");

const themeButton = document.getElementById("themeButton");

const topProfileImage = document.getElementById("topProfileImage");

const backButton = document.getElementById("backButton");

const addUserButton = document.getElementById("addUserButton");

const refreshUsersButton = document.getElementById("refreshUsersButton");

const userSearchInput = document.getElementById("userSearchInput");

const departmentFilter = document.getElementById("departmentFilter");

const gradeFilter = document.getElementById("gradeFilter");

const statusFilter = document.getElementById("statusFilter");

const userTotalCount = document.getElementById("userTotalCount");

const onlineUserCount = document.getElementById("onlineUserCount");

const awayUserCount = document.getElementById("awayUserCount");

const offlineUserCount = document.getElementById("offlineUserCount");

const filteredUserCount = document.getElementById("filteredUserCount");

const userList = document.getElementById("userList");

let users = [];

let presenceStatuses = {};

let presenceTimer = null;

let stopUsersListener = null;

let deviceRiskSummaries = {};

let deviceAuditEnabled = false;

let deviceSummaryLoadState = "hidden";

let expandedDeviceStudentNumber = "";

let deviceDetailsByStudent = {};

const adminScope = readAdminScopeFromUrl();

setupTheme(themeButton);

const admin = await isAdmin();

if (!admin) {
  alert("管理者のみアクセスできます。");

  location.href = "index.html";

  throw new Error("管理者権限がありません。");
}

await initializePage([
  setupAdminTab(),
  loadUserName(userName),
  loadMyRanking(),
  loadProfileImage(topProfileImage),
  loadUsers(),
  updateAssignmentNavBadge(),
  updateShareNavBadge(),
  updateNewsNavBadge(),
]);

await initializeDeviceRiskSummariesIfAuthorized();

if (departmentFilter) {
  departmentFilter.value = adminScope.major || adminScope.department || "";
}

if (gradeFilter) {
  gradeFilter.value = adminScope.grade || "";
}

startUsersListener();

startPresenceListener();

setupEvents();

renderUsers();

async function loadUsers() {
  try {
    const snapshot = await getDocs(collection(db, "users"));

    users = snapshot.docs.map((userDoc) => ({
      id: userDoc.id,
      ...userDoc.data(),
    }));

    renderUsers();
  } catch (error) {
    console.error("ユーザー取得エラー:", error);

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

  stopUsersListener = onSnapshot(
    collection(db, "users"),
    (snapshot) => {
      users = snapshot.docs.map((userDoc) => ({
        id: userDoc.id,
        ...userDoc.data(),
      }));

      renderUsers();
    },
    (error) => {
      console.error("ユーザー監視エラー:", error);
    },
  );
}

function startPresenceListener() {
  const statusRef = ref(realtimeDb, "status");

  onValue(
    statusRef,
    (snapshot) => {
      presenceStatuses = snapshot.val() || {};

      renderUsers();
    },
    (error) => {
      console.error("オンライン状態取得エラー:", error);
    },
  );

  clearInterval(presenceTimer);

  presenceTimer = setInterval(renderUsers, 30 * 1000);
}

function setupEvents() {
  if (backButton) {
    backButton.onclick = () => {
      location.href = withAdminScope("admin.html");
    };
  }

  if (addUserButton) {
    addUserButton.onclick = () => {
      location.href = withAdminScope("admin_user_register.html");
    };
  }

  if (refreshUsersButton) {
    refreshUsersButton.onclick = async () => {
      refreshUsersButton.disabled = true;

      refreshUsersButton.textContent = "更新中...";

      await loadUsers();

      if (deviceAuditEnabled) {
        await loadDeviceRiskSummaries();

        if (expandedDeviceStudentNumber) {
          await loadUserDeviceDetails(expandedDeviceStudentNumber);
        }
      }

      refreshUsersButton.disabled = false;

      refreshUsersButton.textContent = "↻ 更新";

      showToast("ユーザー情報を更新しました");
    };
  }

  [userSearchInput, departmentFilter, gradeFilter, statusFilter]
    .filter(Boolean)
    .forEach((element) => {
      const eventName = element.tagName === "INPUT" ? "input" : "change";

      element.addEventListener(eventName, renderUsers);
    });

  if (userList) {
    userList.addEventListener("click", async (event) => {
      const deleteButton = event.target.closest(
        ".admin-user-device-delete-button",
      );

      if (deleteButton) {
        await deleteUserDeviceFromList(deleteButton);
        return;
      }

      const toggleButton = event.target.closest(
        ".admin-user-device-toggle-button",
      );

      if (toggleButton) {
        await toggleUserDeviceDetails(toggleButton.dataset.studentNumber || "");
        return;
      }

      const button = event.target.closest(".admin-user-detail-button");

      if (!button) {
        return;
      }

      const selectedStudentNumber = button.dataset.studentNumber;

      if (!selectedStudentNumber) {
        return;
      }

      location.href =
        "user_detail_admin.html" +
        "?studentNumber=" +
        encodeURIComponent(selectedStudentNumber);
    });
  }
}

async function initializeDeviceRiskSummariesIfAuthorized() {
  try {
    await auth.authStateReady();
    const token = await auth.currentUser?.getIdTokenResult();
    deviceAuditEnabled = isPrimaryDeviceAuditViewer(
      auth.currentUser,
      token?.claims,
    );

    if (!deviceAuditEnabled) return;

    deviceSummaryLoadState = "loading";
    renderUsers();
    await loadDeviceRiskSummaries();
  } catch (error) {
    console.error("端末確認サマリー初期化エラー:", error);
    deviceAuditEnabled = false;
    deviceSummaryLoadState = "hidden";
    deviceRiskSummaries = {};
  }
}

async function loadDeviceRiskSummaries(showLoading = true) {
  if (!deviceAuditEnabled) return;

  if (showLoading) {
    deviceSummaryLoadState = "loading";
    renderUsers();
  }

  try {
    const listDeviceRiskSummaries = httpsCallable(
      functions,
      "listDeviceRiskSummaries",
    );
    const result = await listDeviceRiskSummaries();
    const summaries = Array.isArray(result.data?.summaries)
      ? result.data.summaries
      : [];

    deviceRiskSummaries = Object.fromEntries(
      summaries.map((summary) => [summary.studentNumber, summary]),
    );
    deviceSummaryLoadState = "ready";
    renderUsers();
  } catch (error) {
    console.error("端末確認サマリー取得エラー:", error);

    if (String(error?.code || "").includes("permission-denied")) {
      deviceSummaryLoadState = "permission-denied";
    } else {
      deviceSummaryLoadState = "error";
    }

    deviceRiskSummaries = {};
    renderUsers();
  }
}

function renderUsers() {
  if (!userList) {
    return;
  }

  updateSummary();

  const filteredUsers = getFilteredUsers();

  if (filteredUserCount) {
    filteredUserCount.textContent = `${filteredUsers.length}人を表示`;
  }

  if (filteredUsers.length === 0) {
    userList.innerHTML = `
            <div class="admin-user-loading">
                条件に一致するユーザーはいません。
            </div>
        `;

    return;
  }

  const sortedUsers = [...filteredUsers].sort(compareUsers);

  userList.innerHTML = sortedUsers.map(createUserHtml).join("");
}

function getFilteredUsers() {
  const keyword = String(userSearchInput?.value || "")
    .trim()
    .toLowerCase();

  const selectedDepartment = departmentFilter?.value || "";

  const selectedGrade = gradeFilter?.value || "";

  const selectedStatus = statusFilter?.value || "";

  return users.filter((user) => {
    const presence = presenceStatuses[user.id] || null;

    const statusKey = getPresenceStatusKey(presence);

    const userDepartment = getUserDepartment(user);

    const userNameText = getUserName(user);

    const rankingNicknameText = String(user.rankingNickname || "");

    const matchesKeyword =
      !keyword ||
      String(user.id).toLowerCase().includes(keyword) ||
      userNameText.toLowerCase().includes(keyword) ||
      rankingNicknameText.toLowerCase().includes(keyword) ||
      userDepartment.toLowerCase().includes(keyword);

    const matchesDepartment =
      !selectedDepartment || userDepartment === selectedDepartment;

    const matchesGrade =
      !selectedGrade || String(user.grade || "") === selectedGrade;

    const matchesStatus = !selectedStatus || statusKey === selectedStatus;

    return (
      matchesAdminScope(user, adminScope) &&
      matchesKeyword &&
      matchesDepartment &&
      matchesGrade &&
      matchesStatus
    );
  });
}

function compareUsers(userA, userB) {
  const presenceA = presenceStatuses[userA.id] || null;

  const presenceB = presenceStatuses[userB.id] || null;

  const priorityA = getPresencePriority(presenceA);

  const priorityB = getPresencePriority(presenceB);

  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  const lastChangedA = Number(presenceA?.lastChanged || 0);

  const lastChangedB = Number(presenceB?.lastChanged || 0);

  if (lastChangedA !== lastChangedB) {
    return lastChangedB - lastChangedA;
  }

  return String(userA.id).localeCompare(String(userB.id), "ja");
}

function createUserHtml(user) {
  const presence = presenceStatuses[user.id] || null;

  const status = formatPresenceStatus(presence);

  const pageName = presence?.pageName || formatPageName(presence?.page);

  const rawPage = presence?.page || "";

  const studentName = getUserName(user);

  const rankingNickname = String(user.rankingNickname || "").trim();

  const rankingNicknameLabel = rankingNickname || "未設定";

  const department = getUserDepartment(user);

  const grade = user.grade ? `${user.grade}` : "学年未設定";

  const deviceSummaryHtml = createDeviceSummaryHtml(user);

  return `
        <div class="admin-user-item">

            <div class="admin-user-main">

                <div class="admin-user-title">

                    <strong>
                        ${status.icon}
                        ${escapeHtml(user.id)}
                        /
                        ${escapeHtml(rankingNicknameLabel)}
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

                ${deviceSummaryHtml}

                <div class="admin-user-presence-detail">

                    <p>
                        <b>現在の画面：</b>

                        ${pageName ? escapeHtml(pageName) : "取得できません"}
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
                                formatLastSeen(Number(presence.lastChanged)),
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

function createDeviceSummaryHtml(user) {
  if (!deviceAuditEnabled) return "";

  const isExpanded = expandedDeviceStudentNumber === user.id;
  const detailButton = `
    <button
      type="button"
      class="btn admin-user-device-toggle-button admin-user-device-detail-button"
      data-student-number="${escapeHtml(user.id)}"
      aria-expanded="${isExpanded ? "true" : "false"}">
      ${isExpanded ? "端末情報を閉じる" : "端末情報を見る"}
    </button>
  `;
  const expandedPanel = createExpandedDevicePanelHtml(user.id);

  if (deviceSummaryLoadState === "loading") {
    return `
      <div class="admin-user-device-summary is-loading">
        <div>
          <span class="admin-user-device-summary-label">🔐 端末情報</span>
          <strong>読み込み中...</strong>
        </div>
        ${detailButton}
      </div>
      ${expandedPanel}
    `;
  }

  if (deviceSummaryLoadState === "permission-denied") {
    return `
      <div class="admin-user-device-summary is-error">
        <div>
          <span class="admin-user-device-summary-label">🔐 端末情報</span>
          <strong>権限を確認できませんでした</strong>
        </div>
        ${detailButton}
      </div>
      ${expandedPanel}
    `;
  }

  if (deviceSummaryLoadState === "error") {
    return `
      <div class="admin-user-device-summary is-error">
        <div>
          <span class="admin-user-device-summary-label">🔐 端末情報</span>
          <strong>取得エラー</strong>
        </div>
        ${detailButton}
      </div>
      ${expandedPanel}
    `;
  }

  const summary = deviceRiskSummaries[user.id] || null;
  const deviceCount = Math.max(0, Number(summary?.deviceCount || 0));
  const needsReview =
    summary?.level === "review" && summary?.reasons?.length > 0;
  const statusText = deviceCount ? `端末${deviceCount}台` : "端末履歴なし";
  const reviewHtml = needsReview
    ? `
        <span class="admin-user-device-review-badge">要確認</span>
        <small>${escapeHtml(summary.reasons.join("・"))}</small>
      `
    : '<span class="admin-user-device-normal-badge">要確認なし</span>';

  return `
    <div class="admin-user-device-summary${needsReview ? " is-review" : ""}">
      <div>
        <span class="admin-user-device-summary-label">🔐 端末情報</span>
        <strong>${escapeHtml(statusText)}</strong>
        ${reviewHtml}
      </div>
      ${detailButton}
    </div>
    ${expandedPanel}
  `;
}

function createExpandedDevicePanelHtml(studentNumber) {
  if (expandedDeviceStudentNumber !== studentNumber) return "";

  const detail = deviceDetailsByStudent[studentNumber];

  if (!detail || detail.state === "loading") {
    return `
      <div class="admin-user-device-panel">
        <div class="admin-user-loading">端末情報を読み込んでいます...</div>
      </div>
    `;
  }

  if (detail.state === "permission-denied") {
    return `
      <div class="admin-user-device-panel is-error">
        <div class="admin-user-loading">権限がないため端末情報を取得できません。</div>
      </div>
    `;
  }

  if (detail.state === "error") {
    return `
      <div class="admin-user-device-panel is-error">
        <div class="admin-user-loading">端末情報の取得に失敗しました。時間をおいて再度お試しください。</div>
      </div>
    `;
  }

  const devices = Array.isArray(detail.data?.devices)
    ? detail.data.devices
    : [];
  const risk = detail.data?.risk || {};
  const reasons = Array.isArray(risk.reasons) ? risk.reasons : [];
  const riskHtml =
    risk.level === "review" && reasons.length
      ? `
          <div class="admin-user-device-panel-risk">
            <strong>⚠️ アカウント共有の可能性・要確認</strong>
            <span>${escapeHtml(reasons.join("・"))}</span>
          </div>
        `
      : '<div class="admin-user-device-panel-normal">要確認となる利用状況はありません。</div>';

  if (!devices.length) {
    return `
      <div class="admin-user-device-panel">
        ${riskHtml}
        <div class="admin-user-loading">
          この学生の端末履歴はまだありません。次回ログイン後に記録されます。
        </div>
      </div>
    `;
  }

  const typeTotals = devices.reduce((totals, device) => {
    const type = String(device.deviceType || "端末");
    totals[type] = (totals[type] || 0) + 1;
    return totals;
  }, {});
  const typeIndexes = {};
  const deviceCards = devices
    .map((device) => {
      const type = String(device.deviceType || "端末");
      typeIndexes[type] = (typeIndexes[type] || 0) + 1;
      const deviceName =
        typeTotals[type] > 1 ? `${type} ${typeIndexes[type]}` : type;
      const locationParts = [
        device.regionCountry,
        device.regionName,
        device.regionCity,
      ].filter((part, index, values) => part && values.indexOf(part) === index);
      const estimatedRegion = locationParts.length
        ? locationParts.join(" / ")
        : "不明";
      const stateLabel = formatAuditDeviceState(device.state);

      return `
        <article class="admin-user-device-panel-item">
          <div class="admin-user-device-panel-heading">
            <div>
              <strong>${escapeHtml(deviceName)}</strong>
              <span>${escapeHtml(stateLabel)}</span>
            </div>
            <button
              type="button"
              class="btn btn-danger admin-user-device-delete-button"
              data-student-number="${escapeHtml(studentNumber)}"
              data-device-id="${escapeHtml(device.deviceId || "")}"
              data-device-label="${escapeHtml(deviceName)}">
              履歴を削除
            </button>
          </div>
          <div class="admin-user-device-panel-grid">
            <div><small>端末・機種</small><b>${escapeHtml(device.model || device.displayName || "詳細不明")}</b></div>
            <div><small>マスク済みIP</small><b>${escapeHtml(device.maskedIp || "不明")}</b></div>
            <div><small>推定地域</small><b>${escapeHtml(estimatedRegion)}</b></div>
            <div><small>最終利用</small><b>${escapeHtml(formatDeviceAuditDate(device.lastSeenAt))}</b></div>
          </div>
        </article>
      `;
    })
    .join("");

  return `
    <div class="admin-user-device-panel">
      ${riskHtml}
      <div class="admin-user-device-panel-list">${deviceCards}</div>
      <p class="admin-user-device-panel-note">
        推定地域はIP由来で、実際の場所と異なる場合があります。GPS・緯度経度は収集していません。
      </p>
    </div>
  `;
}

async function toggleUserDeviceDetails(studentNumber) {
  if (!deviceAuditEnabled || !/^\d{7}$/.test(studentNumber)) return;

  if (expandedDeviceStudentNumber === studentNumber) {
    expandedDeviceStudentNumber = "";
    renderUsers();
    return;
  }

  expandedDeviceStudentNumber = studentNumber;
  renderUsers();

  if (deviceDetailsByStudent[studentNumber]?.state !== "ready") {
    await loadUserDeviceDetails(studentNumber);
  }
}

async function loadUserDeviceDetails(studentNumber) {
  if (!deviceAuditEnabled || !/^\d{7}$/.test(studentNumber)) return;

  deviceDetailsByStudent[studentNumber] = { state: "loading" };
  renderUsers();

  try {
    const listUserLoginDevices = httpsCallable(
      functions,
      "listUserLoginDevices",
    );
    const result = await listUserLoginDevices({ studentNumber });
    deviceDetailsByStudent[studentNumber] = {
      state: "ready",
      data: result.data || {},
    };
  } catch (error) {
    console.error("端末詳細取得エラー:", error);
    deviceDetailsByStudent[studentNumber] = {
      state: String(error?.code || "").includes("permission-denied")
        ? "permission-denied"
        : "error",
    };
  }

  renderUsers();
}

async function deleteUserDeviceFromList(button) {
  if (!deviceAuditEnabled) return;

  const studentNumber = button.dataset.studentNumber || "";
  const deviceId = button.dataset.deviceId || "";
  const deviceLabel = button.dataset.deviceLabel || "この端末";

  if (!/^\d{7}$/.test(studentNumber) || !deviceId) return;
  if (
    !confirm(
      `${deviceLabel}（${studentNumber}）の端末履歴を削除しますか？\nこの操作は元に戻せません。`,
    )
  ) {
    return;
  }

  button.disabled = true;
  button.textContent = "削除中...";

  try {
    const deleteUserLoginDevice = httpsCallable(
      functions,
      "deleteUserLoginDevice",
    );
    await deleteUserLoginDevice({ studentNumber, deviceId });
    showToast(`${deviceLabel}の履歴を削除しました`);
    await loadUserDeviceDetails(studentNumber);
    await loadDeviceRiskSummaries(false);
  } catch (error) {
    console.error("端末履歴削除エラー:", error);
    alert("端末履歴を削除できませんでした。時間をおいて再度お試しください。");
    button.disabled = false;
    button.textContent = "履歴を削除";
  }
}

function formatAuditDeviceState(state) {
  if (state === "active") return "現在利用中";
  if (state === "recent") return "最近利用";
  return "履歴";
}

function formatDeviceAuditDate(value) {
  const timestamp = Number(value || 0);
  if (!timestamp) return "不明";

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "不明";

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function updateSummary() {
  let onlineCount = 0;

  let awayCount = 0;

  let offlineCount = 0;

  let unknownCount = 0;

  users.forEach((user) => {
    const statusKey = getPresenceStatusKey(presenceStatuses[user.id]);

    if (statusKey === "online") {
      onlineCount += 1;
    } else if (statusKey === "away") {
      awayCount += 1;
    } else if (statusKey === "offline") {
      offlineCount += 1;
    } else {
      unknownCount += 1;
    }
  });

  if (userTotalCount) {
    userTotalCount.textContent = `${users.length}人`;
  }

  if (onlineUserCount) {
    onlineUserCount.textContent = `${onlineCount}人`;
  }

  if (awayUserCount) {
    awayUserCount.textContent = `${awayCount}人`;
  }

  if (offlineUserCount) {
    offlineUserCount.textContent = `${offlineCount + unknownCount}人`;

    offlineUserCount.title = `オフライン ${offlineCount}人 / 接続履歴なし ${unknownCount}人`;
  }
}

function getPresenceStatusKey(presence) {
  if (!presence) {
    return "unknown";
  }

  if (presence.state === "online") {
    return "online";
  }

  if (presence.state === "away") {
    return "away";
  }

  return "offline";
}

function getPresencePriority(presence) {
  const statusKey = getPresenceStatusKey(presence);

  const priorities = {
    online: 0,
    away: 1,
    offline: 2,
    unknown: 3,
  };

  return priorities[statusKey] ?? 4;
}

function formatPresenceStatus(presence) {
  if (!presence) {
    return {
      icon: "⚫",
      text: "接続履歴なし",
    };
  }

  if (presence.state === "online") {
    return {
      icon: "🟢",
      text: "オンライン",
    };
  }

  if (presence.state === "away") {
    return {
      icon: "🟡",
      text: "バックグラウンド",
    };
  }

  return {
    icon: "🔴",
    text: `オフライン・${formatLastSeen(Number(presence.lastChanged || 0))}`,
  };
}

function formatLastSeen(timestamp) {
  if (!timestamp) {
    return "日時不明";
  }

  const difference = Math.max(0, Date.now() - timestamp);

  const seconds = Math.floor(difference / 1000);

  const minutes = Math.floor(difference / 60000);

  const hours = Math.floor(difference / 3600000);

  const days = Math.floor(difference / 86400000);

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

  const date = new Date(timestamp);

  return (
    `${date.getFullYear()}/` +
    `${date.getMonth() + 1}/` +
    `${date.getDate()} ` +
    `${String(date.getHours()).padStart(2, "0")}:` +
    `${String(date.getMinutes()).padStart(2, "0")}`
  );
}

function formatPageName(page) {
  if (!page) {
    return "";
  }

  const fileName = String(page).split("?")[0].split("#")[0].split("/").pop();

  const pageNames = {
    "index.html": "ホーム",
    "assignments.html": "課題一覧",
    "assignment.html": "課題詳細",
    "news.html": "お知らせ",
    "requests.html": "機能リクエスト",
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
    "system_news_admin.html": "CareMateお知らせ管理",
  };

  return pageNames[fileName] || fileName || "不明な画面";
}

function getUserDepartment(user) {
  return user.department || user.major || "所属未設定";
}

function getUserName(user) {
  return String(user.name || user.userName || user.displayName || "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.addEventListener("beforeunload", () => {
  clearInterval(presenceTimer);

  if (stopUsersListener) {
    stopUsersListener();
  }
});
