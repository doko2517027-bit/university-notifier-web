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
  updateNewsNavBadge,
} from "./common.js";

import {
  readAdminScopeFromUrl,
  matchesAdminScope,
  withAdminScope,
} from "./admin_scope.js";

import { isPrimaryDeviceAuditViewer } from "./device_audit_access.mjs";

import {
  getPrimaryPresenceDevice,
  normalizePresenceDevices,
} from "./presence_devices.mjs?v=20261001-2";

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

let studentUpdateChecks = {};

let stopStudentUpdateChecksListener = null;

let deviceRiskSummaries = {};

let deviceAuditEnabled = false;

let deviceSummaryLoadState = "hidden";

let expandedDeviceStudentNumber = "";

let deviceDetailsByStudent = {};

let registeredAdminIds = new Set();

let adminRegistrationLoadState = "hidden";
// 明示的にログアウトするまでは、最後に使った端末をオフライン表示で残す。
const presenceDisplayOptions = () => ({});

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

startStudentUpdateChecksListener();

if (deviceAuditEnabled) startPresenceListener();

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

function startStudentUpdateChecksListener() {
  if (stopStudentUpdateChecksListener) stopStudentUpdateChecksListener();
  stopStudentUpdateChecksListener = onSnapshot(
    collection(db, "studentUpdateChecks"),
    (snapshot) => {
      studentUpdateChecks = Object.fromEntries(
        snapshot.docs.map((item) => [item.id, item.data() || {}]),
      );
      renderUsers();
    },
    (error) => {
      console.error("学生別更新状況の取得エラー:", error);
      studentUpdateChecks = {};
      renderUsers();
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
        await Promise.all([
          loadDeviceRiskSummaries(),
          loadRegisteredAdminIds(),
        ]);

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
      const updateButton = event.target.closest(
        ".admin-user-update-check-button",
      );
      if (updateButton) {
        await requestStudentUpdateCheck(updateButton);
        return;
      }

      const forceAllButton = event.target.closest(
        ".admin-user-device-force-all-button",
      );

      if (forceAllButton) {
        await forceLogoutAllUserDevicesFromList(forceAllButton);
        return;
      }

      const forceDeviceButton = event.target.closest(
        ".admin-user-device-force-logout-button",
      );

      if (forceDeviceButton) {
        await forceLogoutUserDeviceFromList(forceDeviceButton);
        return;
      }

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

      const adminRegisterButton = event.target.closest(
        ".admin-user-admin-register-button",
      );

      if (adminRegisterButton) {
        await registerUserAsAdmin(adminRegisterButton);
        return;
      }

      const adminRevokeButton = event.target.closest(
        ".admin-user-admin-revoke-button",
      );
      if (adminRevokeButton) {
        await revokeUserAdmin(adminRevokeButton);
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

async function registerUserAsAdmin(button) {
  if (!deviceAuditEnabled) return;

  const targetStudentNumber = button.dataset.studentNumber || "";
  if (!/^\d{7}$/.test(targetStudentNumber)) return;

  const targetUser = users.find((item) => item.id === targetStudentNumber);
  const targetName = getUserName(targetUser || {});
  const targetLabel = targetName
    ? `${targetStudentNumber}（${targetName}）`
    : targetStudentNumber;

  if (
    !confirm(
      `${targetLabel}を管理者に登録しますか？\n登録後は次回ログインから管理画面を利用できます。`,
    )
  ) {
    return;
  }

  button.disabled = true;
  button.textContent = "登録中...";
  try {
    const registerCareMateAdmin = httpsCallable(
      functions,
      "registerCareMateAdmin",
    );
    await registerCareMateAdmin({ studentNumber: targetStudentNumber });
    registeredAdminIds.add(targetStudentNumber);
    adminRegistrationLoadState = "ready";
    renderUsers();
    showToast(`${targetStudentNumber}を管理者に登録しました`);
  } catch (error) {
    console.error("管理者登録エラー:", error);
    alert("管理者に登録できませんでした。時間をおいて再度お試しください。");
    button.disabled = false;
    button.textContent = "管理者に登録";
  }
}

async function revokeUserAdmin(button) {
  if (!deviceAuditEnabled) return;
  const targetStudentNumber = button.dataset.studentNumber || "";
  if (!/^\d{7}$/.test(targetStudentNumber) || targetStudentNumber === "2510044") return;
  if (!confirm(`${targetStudentNumber}の管理者権限を解除しますか？\n対象者は管理画面を利用できなくなり、ログイン中の認証も更新されます。`)) return;
  button.disabled = true;
  button.textContent = "解除中…";
  try {
    const revokeCareMateAdmin = httpsCallable(functions, "revokeCareMateAdmin");
    await revokeCareMateAdmin({ studentNumber: targetStudentNumber });
    registeredAdminIds.delete(targetStudentNumber);
    renderUsers();
    showToast(`${targetStudentNumber}の管理者権限を解除しました`);
  } catch (error) {
    console.error("管理者解除エラー:", error);
    alert("管理者権限を解除できませんでした。");
    button.disabled = false;
    button.textContent = "管理者解除";
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

    document.querySelectorAll(".primary-admin-only").forEach((element) => {
      element.hidden = !deviceAuditEnabled;
    });
    if (!deviceAuditEnabled) return;

    deviceSummaryLoadState = "loading";
    renderUsers();
    await Promise.all([
      loadDeviceRiskSummaries(),
      loadRegisteredAdminIds(),
    ]);
  } catch (error) {
    console.error("端末確認サマリー初期化エラー:", error);
    deviceAuditEnabled = false;
    deviceSummaryLoadState = "hidden";
    deviceRiskSummaries = {};
  }
}

async function loadRegisteredAdminIds() {
  if (!deviceAuditEnabled) return;

  adminRegistrationLoadState = "loading";
  renderUsers();
  try {
    const listCareMateAdmins = httpsCallable(functions, "listCareMateAdmins");
    const result = await listCareMateAdmins();
    registeredAdminIds = new Set(
      (result.data?.studentNumbers || []).filter((item) => /^\d{7}$/.test(item)),
    );
    adminRegistrationLoadState = "ready";
  } catch (error) {
    console.error("管理者一覧取得エラー:", error);
    registeredAdminIds = new Set();
    adminRegistrationLoadState = "error";
  }
  renderUsers();
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
    const presence = getPrimaryPresenceDevice(
      presenceStatuses[user.id],
      presenceDisplayOptions(),
    );

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
  const presenceA = getPrimaryPresenceDevice(
    presenceStatuses[userA.id],
    presenceDisplayOptions(),
  );

  const presenceB = getPrimaryPresenceDevice(
    presenceStatuses[userB.id],
    presenceDisplayOptions(),
  );

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
  const presenceEntries = normalizePresenceDevices(
    presenceStatuses[user.id],
    presenceDisplayOptions(),
  );

  const presence = getPrimaryPresenceDevice(
    presenceStatuses[user.id],
    presenceDisplayOptions(),
  );

  const status = formatPresenceStatus(presence);

  const studentName = getUserName(user);

  const rankingNickname = String(user.rankingNickname || "").trim();

  const rankingNicknameLabel = rankingNickname || "未設定";

  const department = getUserDepartment(user);

  const grade = user.grade ? `${user.grade}` : "学年未設定";

  const deviceSummaryHtml = createDeviceSummaryHtml(user);

  const adminRegistrationHtml = createAdminRegistrationHtml(user.id);

  const updateCheckHtml = createStudentUpdateCheckHtml(user.id);

  return `
        <div class="admin-user-item">

            <div class="admin-user-main">

                <div class="admin-user-title">

                    <strong>
                        ${deviceAuditEnabled ? status.icon : "👤"}
                        ${escapeHtml(user.id)}
                        /
                        ${escapeHtml(rankingNicknameLabel)}
                    </strong>

                    ${deviceAuditEnabled ? `<span class="admin-user-status">
                        ${escapeHtml(status.text)}
                    </span>` : ""}

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

                ${deviceAuditEnabled ? `<div class="admin-user-presence-detail">
                    ${createPresenceDeviceHtml(presenceEntries)}

                </div>` : ""}

                ${updateCheckHtml}

            </div>

            <div class="admin-user-item-actions">
                ${adminRegistrationHtml}
                <button
                    type="button"
                    class="btn admin-user-update-check-button"
                    data-student-number="${escapeHtml(user.id)}"
                    ${["queued", "running"].includes(studentUpdateChecks[user.id]?.status) ? "disabled" : ""}>
                    ${["queued", "running"].includes(studentUpdateChecks[user.id]?.status) ? "更新確認中…" : "↻ この学生を更新"}
                </button>
                <button
                    type="button"
                    class="btn btn-primary admin-user-detail-button"
                    data-student-number="${escapeHtml(user.id)}">

                    詳細を見る

                </button>
            </div>

        </div>
    `;
}

function createStudentUpdateCheckHtml(studentNumber) {
  const data = studentUpdateChecks[studentNumber] || null;
  const progress = Math.max(0, Math.min(100, Number(data?.progress || 0)));
  const status = String(data?.status || "idle");
  const statusLabels = {
    idle: "未実行",
    queued: "実行待ち",
    running: "更新確認中",
    success: "更新完了",
    partial: "一部確認できませんでした",
    failed: "更新失敗",
    "dispatch-failed": "開始失敗",
  };
  const message = String(
    data?.message || "必要な時に右側の更新ボタンから確認できます。",
  );
  const completedAt = data?.completedAt;
  const timeLabel = completedAt
    ? `・${formatDeviceAuditDate(completedAt)}`
    : "";

  return `
    <div class="admin-student-update-status" data-status="${escapeHtml(status)}">
      <div class="admin-student-update-heading">
        <span><b>${escapeHtml(statusLabels[status] || "確認状況")}</b>${escapeHtml(timeLabel)}</span>
        <strong>${progress}%</strong>
      </div>
      <div
        class="admin-student-update-track"
        role="progressbar"
        aria-label="${escapeHtml(studentNumber)}の更新確認進捗"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow="${progress}">
        <i style="width:${progress}%"></i>
      </div>
      <small>${escapeHtml(message)}</small>
    </div>
  `;
}

async function requestStudentUpdateCheck(button) {
  const targetStudentNumber = String(button.dataset.studentNumber || "");
  if (!/^\d{7}$/.test(targetStudentNumber)) return;
  button.disabled = true;
  button.textContent = "受付中…";
  try {
    const requestUpdate = httpsCallable(functions, "requestStudentUpdateCheck");
    await requestUpdate({ studentNumber: targetStudentNumber });
    showToast(`${targetStudentNumber}の更新確認を受け付けました`);
  } catch (error) {
    console.error("学生別更新確認の受付エラー:", error);
    const message = String(error?.message || "");
    alert(
      message.includes("現在更新確認中") || message.includes("5分")
        ? message
        : "更新確認を開始できませんでした。時間をおいて再度お試しください。",
    );
    button.disabled = false;
    button.textContent = "↻ この学生を更新";
  }
}

function createAdminRegistrationHtml(targetStudentNumber) {
  if (!deviceAuditEnabled) return "";

  if (["hidden", "loading"].includes(adminRegistrationLoadState)) {
    return '<button type="button" class="btn admin-user-admin-register-button" disabled>管理者確認中...</button>';
  }

  if (adminRegistrationLoadState === "error") {
    return '<button type="button" class="btn admin-user-admin-register-button" disabled>管理者状態を取得できません</button>';
  }

  if (registeredAdminIds.has(targetStudentNumber)) {
    if (targetStudentNumber === "2510044") {
      return '<span class="admin-user-admin-badge">主管理者</span>';
    }
    return `<button type="button" class="btn btn-danger admin-user-admin-revoke-button" data-student-number="${escapeHtml(targetStudentNumber)}">管理者解除</button>`;
  }

  return `
    <button
      type="button"
      class="btn admin-user-admin-register-button"
      data-student-number="${escapeHtml(targetStudentNumber)}">
      管理者に登録
    </button>
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
  const allDevicesActionHtml = `
    <div class="admin-user-device-panel-actions">
      <button
        type="button"
        class="btn btn-danger admin-user-device-force-all-button"
        data-student-number="${escapeHtml(studentNumber)}">
        すべての端末からログアウト
      </button>
    </div>
  `;

  if (!devices.length) {
    return `
      <div class="admin-user-device-panel">
        ${riskHtml}
        ${allDevicesActionHtml}
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
      const displayedState = device.forceLogoutPending
        ? "強制ログアウト要求済み"
        : stateLabel;

      return `
        <article class="admin-user-device-panel-item">
          <div class="admin-user-device-panel-heading">
            <div>
              <strong>${escapeHtml(deviceName)}</strong>
              <span class="${device.forceLogoutPending ? "is-logout-pending" : ""}">${escapeHtml(displayedState)}</span>
            </div>
            <div class="admin-user-device-panel-item-actions">
              <button
                type="button"
                class="btn btn-danger admin-user-device-force-logout-button"
                data-student-number="${escapeHtml(studentNumber)}"
                data-device-id="${escapeHtml(device.deviceId || "")}"
                data-device-label="${escapeHtml(deviceName)}"
                ${device.forceLogoutPending ? "disabled" : ""}>
                ${device.forceLogoutPending ? "ログアウト要求済み" : "この端末を強制ログアウト"}
              </button>
              <button
                type="button"
                class="btn admin-user-device-delete-button"
                data-student-number="${escapeHtml(studentNumber)}"
                data-device-id="${escapeHtml(device.deviceId || "")}"
                data-device-label="${escapeHtml(deviceName)}">
                履歴を削除
              </button>
            </div>
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
      ${allDevicesActionHtml}
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

async function forceLogoutUserDeviceFromList(button) {
  if (!deviceAuditEnabled) return;

  const studentNumber = button.dataset.studentNumber || "";
  const deviceId = button.dataset.deviceId || "";
  const deviceLabel = button.dataset.deviceLabel || "この端末";
  if (!/^\d{7}$/.test(studentNumber) || !deviceId) return;

  if (
    !confirm(
      `${deviceLabel}（${studentNumber}）を強制ログアウトしますか？\nこの端末でCareMateを再度利用するにはログインが必要になります。`,
    )
  ) {
    return;
  }

  button.disabled = true;
  button.textContent = "ログアウト要求中...";

  try {
    const forceLogoutUserDevice = httpsCallable(
      functions,
      "forceLogoutUserDevice",
    );
    await forceLogoutUserDevice({ studentNumber, deviceId });
    showToast(`${deviceLabel}へ強制ログアウトを要求しました`);
    await loadUserDeviceDetails(studentNumber);
  } catch (error) {
    console.error("端末強制ログアウトエラー:", error);
    alert("端末を強制ログアウトできませんでした。時間をおいて再度お試しください。");
    button.disabled = false;
    button.textContent = "この端末を強制ログアウト";
  }
}

async function forceLogoutAllUserDevicesFromList(button) {
  if (!deviceAuditEnabled) return;

  const studentNumber = button.dataset.studentNumber || "";
  if (!/^\d{7}$/.test(studentNumber)) return;

  if (
    !confirm(
      `${studentNumber}のすべての端末を強制ログアウトしますか？\n現在ログイン中のすべての端末で、再度ログインが必要になります。`,
    )
  ) {
    return;
  }

  button.disabled = true;
  button.textContent = "全端末へ要求中...";

  try {
    const forceLogoutAllUserDevices = httpsCallable(
      functions,
      "forceLogoutAllUserDevices",
    );
    await forceLogoutAllUserDevices({ studentNumber });
    showToast("すべての端末へ強制ログアウトを要求しました");
    await loadUserDeviceDetails(studentNumber);
  } catch (error) {
    console.error("全端末強制ログアウトエラー:", error);
    alert("すべての端末を強制ログアウトできませんでした。時間をおいて再度お試しください。");
    button.disabled = false;
    button.textContent = "すべての端末からログアウト";
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
    const statusKey = getPresenceStatusKey(
      getPrimaryPresenceDevice(
        presenceStatuses[user.id],
        presenceDisplayOptions(),
      ),
    );

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

function createPresenceDeviceHtml(entries) {
  if (!entries.length) {
    return '<p><b>現在の画面：</b>接続履歴なし</p>';
  }
  return `
    <div class="admin-user-presence-device-list">
      ${entries.map((presence, index) => {
        const status = formatPresenceStatus(presence);
        const pageName = presence.pageName || formatPageName(presence.page) || "取得できません";
        const label = presence.deviceLabel || `端末 ${index + 1}`;
        return `
          <div class="admin-user-presence-device">
            <b>${escapeHtml(label)}</b>
            <span>${escapeHtml(status.icon)} ${escapeHtml(pageName)}</span>
            <small>${escapeHtml(status.text)}・${escapeHtml(formatLastSeen(Number(presence.lastChanged || 0)))}</small>
          </div>`;
      }).join("")}
    </div>`;
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
