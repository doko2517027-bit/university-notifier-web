import {
  db,
  realtimeDb,
  functions,
  auth,
  studentNumber as adminStudentNumber,
  setupTheme,
  initializePage,
  loadProfileImage,
  loadUserName,
  loadMyRanking,
  setupAdminTab,
  isAdmin,
  showToast,
  encryptData,
  updateAssignmentNavBadge,
  updateShareNavBadge,
  updateNewsNavBadge,
} from "./common.js";

import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  limit,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

import {
  ref,
  onValue,
  remove,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

/* ========================================
   対象学生
======================================== */

const params = new URLSearchParams(location.search);

const targetStudentNumber = params.get("studentNumber")?.trim() || "";

if (!/^\d{7}$/.test(targetStudentNumber)) {
  alert("学生番号が正しくありません。");

  location.href = "users_admin.html";

  throw new Error("学生番号が正しくありません。");
}

/* ========================================
   HTML要素
======================================== */

const userName = document.getElementById("userName");

const themeButton = document.getElementById("themeButton");

const topProfileImage = document.getElementById("topProfileImage");

const backButton = document.getElementById("backButton");

const studentDetailSubtitle = document.getElementById("studentDetailSubtitle");

const presenceStatus = document.getElementById("presenceStatus");

const currentPageValue = document.getElementById("currentPageValue");

const lastSeenValue = document.getElementById("lastSeenValue");

const backgroundStatus = document.getElementById("backgroundStatus");

const studentNumberValue = document.getElementById("studentNumberValue");

const studentNameValue = document.getElementById("studentNameValue");

const departmentValue = document.getElementById("departmentValue");

const majorValue = document.getElementById("majorValue");

const gradeValue = document.getElementById("gradeValue");

const admissionYearValue = document.getElementById("admissionYearValue");

const studentPageIdValue = document.getElementById("studentPageIdValue");

const rankingNicknameInput = document.getElementById("rankingNicknameInput");

const rankingDisplayMode = document.getElementById("rankingDisplayMode");

const rankingNicknamePromptStatus = document.getElementById(
  "rankingNicknamePromptStatus",
);

const rankingCurrentDisplayValue = document.getElementById(
  "rankingCurrentDisplayValue",
);

const lastLoginAtValue = document.getElementById("lastLoginAtValue");

const manabaVerifiedValue = document.getElementById("manabaVerifiedValue");

const activeMailConfiguredValue = document.getElementById(
  "activeMailConfiguredValue",
);

const pushConfiguredValue = document.getElementById("pushConfiguredValue");

const activeMailPassword = document.getElementById("activeMailPassword");

const activeMailPasswordConfirm = document.getElementById(
  "activeMailPasswordConfirm",
);

const manabaPassword = document.getElementById("manabaPassword");

const manabaPasswordConfirm = document.getElementById("manabaPasswordConfirm");

const careMatePassword = document.getElementById("careMatePassword");

const careMatePasswordConfirm = document.getElementById(
  "careMatePasswordConfirm",
);

const notifySchedule = document.getElementById("notifySchedule");

const notifyAssignment = document.getElementById("notifyAssignment");

const notifyReminder = document.getElementById("notifyReminder");

const notifyCourseNews = document.getElementById("notifyCourseNews");

const notifySystemNews = document.getElementById("notifySystemNews");

const notifySharePost = document.getElementById("notifySharePost");

const notifyLike = document.getElementById("notifyLike");

const notifyComment = document.getElementById("notifyComment");

const saveUserButton = document.getElementById("saveUserButton");

const deleteUserButton = document.getElementById("deleteUserButton");

const deleteConfirmModal1 = document.getElementById("deleteConfirmModal1");

const deleteConfirmStudent1 = document.getElementById("deleteConfirmStudent1");

const deleteConfirmYes1 = document.getElementById("deleteConfirmYes1");

const deleteConfirmNo1 = document.getElementById("deleteConfirmNo1");

const deleteConfirmModal2 = document.getElementById("deleteConfirmModal2");

const deleteStudentNumberInput = document.getElementById(
  "deleteStudentNumberInput",
);

const deleteConfirmNo2 = document.getElementById("deleteConfirmNo2");

const deleteConfirmYes2 = document.getElementById("deleteConfirmYes2");

const deviceAuditSection = document.getElementById("deviceAuditSection");

const deviceAuditStudentHeading = document.getElementById(
  "deviceAuditStudentHeading",
);

const deviceSessionSummary = document.getElementById("deviceSessionSummary");

const deviceRiskNotice = document.getElementById("deviceRiskNotice");

const deviceRiskReasons = document.getElementById("deviceRiskReasons");

const deviceSessionList = document.getElementById("deviceSessionList");

const refreshDeviceSessionsButton = document.getElementById(
  "refreshDeviceSessionsButton",
);

/* ========================================
   状態
======================================== */

let targetUserData = null;

let stopPresenceListener = null;

/*
FirestoreのWeb SDKでは、存在するサブコレクションを
自動ですべて列挙できません。

CareMateで学生ごとに使用しているサブコレクションは
ここへ追加します。
*/

const USER_SUBCOLLECTIONS = [
  "pushSubscriptions",
  "devices",
  "solvedQuestions",
  "enrolledSubjects",
  "attendanceRecords",
  "examProgress",
  "subjectPoints",
  "readNews",
  "notifications",
];

/*
学生番号をドキュメントIDとして使用している
トップレベルコレクション。
存在しないドキュメントを削除しても問題ありません。
*/

const DIRECT_USER_DOCUMENT_COLLECTIONS = [
  "courseLinks",
  "publicUsers",
  "userPresence",
  "attendance",
  "attendancePreferences",
  "attendanceRecords",
  "examProgress",
  "subjectPoints",
  "totalRanking",
];

/* ========================================
   初期化
======================================== */

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
  loadTargetUser(),
  updateAssignmentNavBadge(),
  updateShareNavBadge(),
  updateNewsNavBadge(),
]);

await initializeDeviceAuditIfAuthorized();

startPresenceListener();

setupEvents();

/* ========================================
   学生情報取得
======================================== */

async function loadTargetUser() {
  try {
    const userRef = doc(db, "users", targetStudentNumber);

    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
      alert("指定された学生は存在しません。");

      location.href = "users_admin.html";

      return;
    }

    targetUserData = snapshot.data();

    renderUserInformation();
  } catch (error) {
    console.error("学生情報取得エラー:", error);

    alert("学生情報の取得に失敗しました。");
  }
}

function renderUserInformation() {
  if (!targetUserData) {
    return;
  }

  const displayName = getStudentName(targetUserData);

  setText(
    studentDetailSubtitle,
    displayName
      ? `${targetStudentNumber}・${displayName}`
      : targetStudentNumber,
  );

  setText(studentNumberValue, targetStudentNumber);

  setText(studentNameValue, displayName || "未登録");

  setText(departmentValue, targetUserData.department || "該当なし");

  setText(majorValue, targetUserData.major || "該当なし");

  setText(
    gradeValue,
    targetUserData.grade ? `${targetUserData.grade}` : "未設定",
  );

  setText(
    admissionYearValue,
    getAdmissionYear(targetUserData, targetStudentNumber),
  );

  setText(studentPageIdValue, targetUserData.studentPageId || "未設定");

  const rankingNickname = String(targetUserData.rankingNickname || "").trim();

  if (rankingNicknameInput) {
    rankingNicknameInput.value = rankingNickname;
  }

  const rankingMode =
    targetUserData.rankingDisplayMode === "nickname" && rankingNickname
      ? "nickname"
      : "student_number";

  if (rankingDisplayMode) {
    rankingDisplayMode.value = rankingMode;
  }

  if (rankingNicknamePromptStatus) {
    rankingNicknamePromptStatus.value =
      targetUserData.rankingNicknamePromptCompleted === true
        ? "completed"
        : "pending";
  }

  setText(
    rankingCurrentDisplayValue,
    rankingMode === "nickname" ? rankingNickname : targetStudentNumber,
  );

  setText(lastLoginAtValue, formatFirestoreDate(targetUserData.lastLoginAt));

  setText(
    manabaVerifiedValue,
    targetUserData.manabaVerified ? "✅ 認証済み" : "⚠️ 未認証",
  );

  const activeMailConfigured =
    Boolean(targetUserData.activeMailPasswordEncrypted) &&
    targetUserData.activeMailSetupSkipped !== true;

  setText(
    activeMailConfiguredValue,
    activeMailConfigured ? "✅ 設定済み" : "⚠️ 未設定",
  );

  const pushConfigured = Boolean(targetUserData.subscription);

  setText(pushConfiguredValue, pushConfigured ? "✅ 登録済み" : "⚠️ 未登録");

  const settings = targetUserData.notificationSettings || {};

  if (notifySchedule) {
    notifySchedule.checked = settings.schedule ?? true;
  }

  if (notifyAssignment) {
    notifyAssignment.checked = settings.assignment ?? true;
  }

  if (notifyReminder) {
    notifyReminder.checked = settings.reminder ?? true;
  }

  if (notifyCourseNews) {
    notifyCourseNews.checked = settings.courseNews ?? true;
  }

  if (notifySystemNews) {
    notifySystemNews.checked = settings.systemNews ?? true;
  }

  if (notifySharePost) {
    notifySharePost.checked = settings.sharePost ?? true;
  }

  if (notifyLike) {
    notifyLike.checked = settings.like ?? true;
  }

  if (notifyComment) {
    notifyComment.checked = settings.comment ?? true;
  }
}

/* ========================================
   2510044専用・ログイン端末確認
======================================== */

async function initializeDeviceAuditIfAuthorized() {
  if (!deviceAuditSection) return;

  try {
    await auth.authStateReady();
    const currentUser = auth.currentUser;
    const token = await currentUser?.getIdTokenResult();
    const isPrimaryAuditAdmin =
      currentUser?.uid === "caremate-2510044" &&
      token?.claims?.studentNumber === "2510044" &&
      token?.claims?.admin === true;

    if (!isPrimaryAuditAdmin) return;

    deviceAuditSection.hidden = false;
    updateDeviceAuditHeading();
    await loadDeviceSessions();
  } catch (error) {
    console.error("端末確認機能の初期化エラー:", error);
    deviceAuditSection.hidden = true;
  }
}

function updateDeviceAuditHeading() {
  if (!deviceAuditStudentHeading) return;

  const displayName = getStudentName(targetUserData || {});
  deviceAuditStudentHeading.textContent = displayName
    ? `${displayName}（${targetStudentNumber}）の端末`
    : `${targetStudentNumber} の端末`;
}

async function loadDeviceSessions() {
  if (!deviceSessionList || deviceAuditSection?.hidden) return;

  setText(deviceSessionSummary, "端末情報を確認しています...");
  deviceSessionList.innerHTML =
    '<div class="admin-user-loading">端末情報を読み込んでいます...</div>';

  try {
    const listUserLoginDevices = httpsCallable(
      functions,
      "listUserLoginDevices",
    );
    const result = await listUserLoginDevices({
      studentNumber: targetStudentNumber,
    });
    renderDeviceSessions(result.data || {});
  } catch (error) {
    console.error("端末情報取得エラー:", error);

    if (String(error?.code || "").includes("permission-denied")) {
      deviceAuditSection.hidden = true;
      return;
    }

    setText(deviceSessionSummary, "端末情報を取得できませんでした");
    deviceSessionList.innerHTML = `
      <div class="admin-user-loading">
        一時的に端末情報を取得できません。時間をおいて更新してください。
      </div>
    `;
  }
}

function renderDeviceSessions(data) {
  const devices = Array.isArray(data.devices) ? data.devices : [];
  const risk = data.risk || {};

  setText(
    deviceSessionSummary,
    devices.length
      ? `${devices.length}台・最終利用順（最終利用から${Number(data.retentionDays || 30)}日間保持）`
      : "記録された端末はありません",
  );

  renderDeviceRisk(risk);

  if (!devices.length) {
    deviceSessionList.innerHTML = `
      <div class="admin-user-loading">
        次回ログインまたはアプリ利用時から端末が記録されます。
      </div>
    `;
    return;
  }

  const typeTotals = devices.reduce((totals, device) => {
    const type = String(device.deviceType || "端末");
    totals[type] = (totals[type] || 0) + 1;
    return totals;
  }, {});
  const typeIndexes = {};

  deviceSessionList.innerHTML = devices
    .map((device) => {
      const type = String(device.deviceType || "端末");
      typeIndexes[type] = (typeIndexes[type] || 0) + 1;
      const numberedType =
        typeTotals[type] > 1 ? `${type} ${typeIndexes[type]}` : type;
      const locationParts = [
        device.regionCountry,
        device.regionName,
        device.regionCity,
      ].filter((part, index, values) => part && values.indexOf(part) === index);
      const estimatedRegion = locationParts.length
        ? locationParts.join(" / ")
        : "不明";
      const state = formatDeviceState(device.state);
      const regionUpdatedAt = device.regionLookedUpAt
        ? formatAuditDate(device.regionLookedUpAt)
        : "取得履歴なし";
      const regionAttemptNote =
        device.regionLastAttemptStatus &&
        device.regionLastAttemptStatus !== "estimated"
          ? `（直近の再取得失敗：${formatAuditDate(device.regionLastAttemptAt)}）`
          : "";
      const reviewText =
        risk.level === "review" && Array.isArray(risk.reasons)
          ? `
            <div class="admin-device-card-review">
              <b>要確認理由：</b>${escapeAuditHtml(risk.reasons.join("・"))}
            </div>
          `
          : "";

      return `
        <article class="admin-device-item">
          <div class="admin-device-item-heading">
            <div>
              <strong>${escapeAuditHtml(numberedType)}</strong>
              <span class="admin-device-state admin-device-state-${escapeAuditHtml(device.state || "history")}">
                ${escapeAuditHtml(state)}
              </span>
            </div>
            <button
              type="button"
              class="btn btn-danger admin-device-delete-button"
              data-device-id="${escapeAuditHtml(device.deviceId || "")}"
              data-device-label="${escapeAuditHtml(numberedType)}"
            >
              履歴を削除
            </button>
          </div>

          <div class="admin-device-field-grid">
            <div><small>端末・機種</small><b>${escapeAuditHtml(device.model || "詳細不明")}</b></div>
            <div><small>OS</small><b>${escapeAuditHtml(device.os || "不明")}</b></div>
            <div><small>ブラウザ</small><b>${escapeAuditHtml(device.browser || "不明")}</b></div>
            <div>
              <small>マスク済みIP</small>
              <b>${escapeAuditHtml(device.maskedIp || "不明")}</b>
              <em>最終更新：${escapeAuditHtml(formatAuditDate(device.ipUpdatedAt))}</em>
            </div>
            <div class="admin-device-region-field">
              <small>推定地域（国 / 都道府県 / 市区町村）</small>
              <b>${escapeAuditHtml(estimatedRegion)}</b>
            </div>
            <div><small>初回確認</small><b>${escapeAuditHtml(formatAuditDate(device.firstSeenAt))}</b></div>
            <div><small>最終利用</small><b>${escapeAuditHtml(formatAuditDate(device.lastSeenAt))}</b></div>
            <div>
              <small>推定地域の最終更新</small>
              <b>${escapeAuditHtml(regionUpdatedAt)}</b>
              ${regionAttemptNote ? `<em>${escapeAuditHtml(regionAttemptNote)}</em>` : ""}
            </div>
          </div>
          ${reviewText}
        </article>
      `;
    })
    .join("");
}

function renderDeviceRisk(risk) {
  const isReview = risk?.level === "review";
  if (deviceRiskNotice) deviceRiskNotice.hidden = !isReview;
  if (!deviceRiskReasons) return;

  deviceRiskReasons.innerHTML = isReview
    ? (risk.reasons || [])
        .map((reason) => `<li>${escapeAuditHtml(reason)}</li>`)
        .join("")
    : "";
}

function formatDeviceState(state) {
  if (state === "active") return "現在利用中";
  if (state === "recent") return "最近利用";
  return "履歴";
}

function formatAuditDate(timestamp) {
  if (!timestamp) return "記録なし";

  const date = new Date(Number(timestamp));
  return Number.isNaN(date.getTime()) ? "日時不明" : date.toLocaleString("ja-JP");
}

function escapeAuditHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ========================================
   リアルタイム利用状況
======================================== */

function startPresenceListener() {
  if (stopPresenceListener) {
    stopPresenceListener();
  }

  const statusRef = ref(realtimeDb, `status/${targetStudentNumber}`);

  stopPresenceListener = onValue(
    statusRef,
    (snapshot) => {
      const presence = snapshot.val() || null;

      renderPresence(presence);
    },
    (error) => {
      console.error("Presence取得エラー:", error);

      setText(presenceStatus, "取得失敗");
    },
  );
}

function renderPresence(presence) {
  if (!presence) {
    setText(presenceStatus, "⚫ 接続履歴なし");

    setText(currentPageValue, "取得できません");

    setText(lastSeenValue, "接続履歴なし");

    setText(backgroundStatus, "不明");

    return;
  }

  const state = presence.state || "offline";

  if (state === "online") {
    setText(presenceStatus, "🟢 オンライン");

    setText(backgroundStatus, "アプリを表示中");
  } else if (state === "away") {
    setText(presenceStatus, "🟡 バックグラウンド");

    setText(backgroundStatus, "バックグラウンド");
  } else {
    setText(presenceStatus, "🔴 オフライン");

    setText(backgroundStatus, "アプリを閉じています");
  }

  const pageName = presence.pageName || formatPageName(presence.page);

  setText(currentPageValue, pageName || "取得できません");

  setText(lastSeenValue, formatLastSeen(Number(presence.lastChanged || 0)));
}

/* ========================================
   イベント
======================================== */

function setupEvents() {
  if (backButton) {
    backButton.onclick = () => {
      location.href = "users_admin.html";
    };
  }

  if (saveUserButton) {
    saveUserButton.onclick = saveUserChanges;
  }

  if (refreshDeviceSessionsButton) {
    refreshDeviceSessionsButton.onclick = async () => {
      refreshDeviceSessionsButton.disabled = true;
      refreshDeviceSessionsButton.textContent = "更新中...";
      await loadDeviceSessions();
      refreshDeviceSessionsButton.disabled = false;
      refreshDeviceSessionsButton.textContent = "↻ 更新";
    };
  }

  if (deviceSessionList) {
    deviceSessionList.addEventListener("click", async (event) => {
      const button = event.target.closest(".admin-device-delete-button");
      if (!button) return;

      const deviceId = button.dataset.deviceId || "";
      const deviceLabel = button.dataset.deviceLabel || "この端末";
      const confirmed = confirm(
        `${deviceLabel}（${targetStudentNumber}）の端末履歴を削除しますか？\nこの操作は元に戻せません。`,
      );
      if (!confirmed) return;

      button.disabled = true;
      button.textContent = "削除中...";

      try {
        const deleteUserLoginDevice = httpsCallable(
          functions,
          "deleteUserLoginDevice",
        );
        await deleteUserLoginDevice({
          studentNumber: targetStudentNumber,
          deviceId,
        });
        showToast(`${deviceLabel}の履歴を削除しました`);
        await loadDeviceSessions();
      } catch (error) {
        console.error("端末履歴削除エラー:", error);
        alert("端末履歴を削除できませんでした。時間をおいて再度お試しください。");
        button.disabled = false;
        button.textContent = "履歴を削除";
      }
    });
  }

  if (deleteUserButton) {
    deleteUserButton.onclick = () => {
      if (targetStudentNumber === adminStudentNumber) {
        alert("現在ログインしている管理者自身は削除できません。");

        return;
      }

      if (deleteConfirmStudent1) {
        deleteConfirmStudent1.textContent = `対象：${targetStudentNumber}`;
      }

      openModal(deleteConfirmModal1);
    };
  }

  if (deleteConfirmNo1) {
    deleteConfirmNo1.onclick = () => {
      closeModal(deleteConfirmModal1);
    };
  }

  if (deleteConfirmYes1) {
    deleteConfirmYes1.onclick = () => {
      closeModal(deleteConfirmModal1);

      if (deleteStudentNumberInput) {
        deleteStudentNumberInput.value = "";
      }

      updateFinalDeleteButton();

      openModal(deleteConfirmModal2);

      deleteStudentNumberInput?.focus();
    };
  }

  if (deleteConfirmNo2) {
    deleteConfirmNo2.onclick = () => {
      closeModal(deleteConfirmModal2);
    };
  }

  if (deleteStudentNumberInput) {
    deleteStudentNumberInput.addEventListener("input", updateFinalDeleteButton);
  }

  if (deleteConfirmYes2) {
    deleteConfirmYes2.onclick = executeCompleteDeletion;
  }

  [deleteConfirmModal1, deleteConfirmModal2]
    .filter(Boolean)
    .forEach((modal) => {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) {
          closeModal(modal);
        }
      });
    });
}

/* ========================================
   保存処理
======================================== */

async function saveUserChanges() {
  if (!saveUserButton) {
    return;
  }

  const rankingNickname = rankingNicknameInput?.value.trim() || "";

  const nextRankingDisplayMode =
    rankingDisplayMode?.value === "nickname" ? "nickname" : "student_number";

  const rankingPromptCompleted =
    rankingNicknamePromptStatus?.value === "completed";

  if (nextRankingDisplayMode === "nickname" && !rankingNickname) {
    alert("ニックネーム表示を選択する場合は、ニックネームを入力してください。");

    rankingNicknameInput?.focus();

    return;
  }

  if (rankingNickname.length > 20) {
    alert("ニックネームは20文字以内で入力してください。");

    return;
  }

  const newActiveMailPassword = activeMailPassword?.value.trim() || "";

  const activeMailConfirm = activeMailPasswordConfirm?.value.trim() || "";

  const newManabaPassword = manabaPassword?.value.trim() || "";

  const manabaConfirm = manabaPasswordConfirm?.value.trim() || "";

  const newCareMatePassword = careMatePassword?.value.trim() || "";

  const careMateConfirm = careMatePasswordConfirm?.value.trim() || "";

  if (newActiveMailPassword !== activeMailConfirm) {
    alert("Active!Mailパスワードが一致しません。");

    return;
  }

  if (newManabaPassword !== manabaConfirm) {
    alert("Manabaパスワードが一致しません。");

    return;
  }

  if (newCareMatePassword !== careMateConfirm) {
    alert("CareMateログインパスワードが一致しません。");

    return;
  }

  if (newCareMatePassword && newCareMatePassword.length < 6) {
    alert("CareMateログインパスワードは6文字以上で入力してください。");

    return;
  }

  if (newActiveMailPassword && newActiveMailPassword.length < 4) {
    alert("Active!Mailパスワードを確認してください。");

    return;
  }

  if (newManabaPassword && newManabaPassword.length < 4) {
    alert("Manabaパスワードを確認してください。");

    return;
  }

  saveUserButton.disabled = true;

  saveUserButton.textContent = "保存中...";

  try {
    const updates = {
      rankingNickname: rankingNickname,

      rankingDisplayMode: nextRankingDisplayMode,

      rankingNicknamePromptCompleted: rankingPromptCompleted,

      rankingNicknameUpdatedAt: serverTimestamp(),

      rankingNicknameUpdatedBy: adminStudentNumber || "",

      "notificationSettings.schedule": notifySchedule?.checked ?? true,

      "notificationSettings.assignment": notifyAssignment?.checked ?? true,

      "notificationSettings.reminder": notifyReminder?.checked ?? true,

      "notificationSettings.courseNews": notifyCourseNews?.checked ?? true,

      "notificationSettings.systemNews": notifySystemNews?.checked ?? true,

      "notificationSettings.sharePost": notifySharePost?.checked ?? true,

      "notificationSettings.like": notifyLike?.checked ?? true,

      "notificationSettings.comment": notifyComment?.checked ?? true,

      adminUpdatedAt: serverTimestamp(),

      adminUpdatedBy: adminStudentNumber || "",
    };

    if (newActiveMailPassword) {
      updates.activeMailPasswordEncrypted = await encryptData(
        newActiveMailPassword,
      );

      updates.activeMailSetupSkipped = false;

      updates.activeMailResetRequired = false;
    }

    if (newManabaPassword) {
      updates.manabaPasswordEncrypted = await encryptData(newManabaPassword);

      updates.manabaSetupSkipped = false;

      updates.manabaResetRequired = false;

      /*
            パスワード変更後は再認証が必要なので
            未認証へ戻す
            */

      updates.manabaVerified = false;

      updates.manabaVerifiedAt = null;
    }

    if (newCareMatePassword) {
      const passwordBytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(newCareMatePassword),
      );

      const passwordHash = [...new Uint8Array(passwordBytes)]
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");

      updates.appPasswordHash = passwordHash;
    }

    await updateDoc(doc(db, "users", targetStudentNumber), updates);

    if (activeMailPassword) {
      activeMailPassword.value = "";
    }

    if (activeMailPasswordConfirm) {
      activeMailPasswordConfirm.value = "";
    }

    if (manabaPassword) {
      manabaPassword.value = "";
    }

    if (manabaPasswordConfirm) {
      manabaPasswordConfirm.value = "";
    }

    if (careMatePassword) {
      careMatePassword.value = "";
    }

    if (careMatePasswordConfirm) {
      careMatePasswordConfirm.value = "";
    }

    showToast("学生情報を保存しました");

    await loadTargetUser();
  } catch (error) {
    console.error("学生情報保存エラー:", error);

    alert("学生情報の保存に失敗しました。");
  } finally {
    saveUserButton.disabled = false;

    saveUserButton.textContent = "変更内容を保存";
  }
}

/* ========================================
   完全削除
======================================== */

function updateFinalDeleteButton() {
  if (!deleteConfirmYes2) {
    return;
  }

  deleteConfirmYes2.disabled =
    deleteStudentNumberInput?.value.trim() !== targetStudentNumber;
}

async function executeCompleteDeletion() {
  if (deleteStudentNumberInput?.value.trim() !== targetStudentNumber) {
    alert("学籍番号が一致しません。");

    return;
  }

  deleteConfirmYes2.disabled = true;

  deleteConfirmYes2.textContent = "削除中...";

  try {
    await httpsCallable(
      functions,
      "deleteCareMateUser",
    )({
      studentNumber: targetStudentNumber,
    });

    closeModal(deleteConfirmModal2);

    showToast("ユーザー情報を削除しました");

    setTimeout(() => {
      location.href = "users_admin.html";
    }, 700);
  } catch (error) {
    console.error("ユーザー完全削除エラー:", error);

    alert(
      "削除処理に失敗しました。\n" +
        "一部の情報だけ削除されている可能性があります。",
    );

    deleteConfirmYes2.disabled = false;

    deleteConfirmYes2.textContent = "はい";
  }
}

async function deleteAllKnownUserData(selectedStudentNumber) {
  const userRef = doc(db, "users", selectedStudentNumber);

  /*
    users/{学籍番号}以下の
   既知サブコレクションを削除
    */

  for (const subcollectionName of USER_SUBCOLLECTIONS) {
    await deleteCollectionDocuments(collection(userRef, subcollectionName));
  }

  /*
    courseNews/{学籍番号}/news
    */

  const courseNewsRef = doc(db, "courseNews", selectedStudentNumber);

  await deleteCollectionDocuments(collection(courseNewsRef, "news"));

  await deleteDoc(courseNewsRef);

  /*
    学籍番号をドキュメントIDとしている
   トップレベルドキュメント
    */

  for (const collectionName of DIRECT_USER_DOCUMENT_COLLECTIONS) {
    await deleteDoc(doc(db, collectionName, selectedStudentNumber));
  }

  /*
    Realtime Databaseの接続状態
    */

  await remove(ref(realtimeDb, `status/${selectedStudentNumber}`));

  /*
    最後にusers本体を削除
    */

  await deleteDoc(userRef);
}

/*
サブコレクションのドキュメントを
400件ずつ削除する
*/

async function deleteCollectionDocuments(collectionRef) {
  while (true) {
    const snapshot = await getDocs(query(collectionRef, limit(400)));

    if (snapshot.empty) {
      return;
    }

    const batch = writeBatch(db);

    snapshot.docs.forEach((documentSnapshot) => {
      batch.delete(documentSnapshot.ref);
    });

    await batch.commit();
  }
}

/* ========================================
   共通処理
======================================== */

function getStudentName(user) {
  return String(user.name || user.userName || user.displayName || "");
}

function getAdmissionYear(user, selectedStudentNumber) {
  if (user.admissionYear) {
    return String(user.admissionYear);
  }

  const yearText = selectedStudentNumber.substring(0, 2);

  const yearNumber = Number(yearText);

  if (!Number.isInteger(yearNumber)) {
    return "不明";
  }

  return String(2000 + yearNumber);
}

function formatFirestoreDate(timestamp) {
  if (!timestamp) {
    return "記録なし";
  }

  try {
    const date =
      typeof timestamp.toDate === "function"
        ? timestamp.toDate()
        : new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "日時不明";
    }

    return date.toLocaleString("ja-JP");
  } catch {
    return "日時不明";
  }
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

  return date.toLocaleString("ja-JP");
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
    "user_detail_admin.html": "学生詳細",
    "system_news_admin.html": "CareMateお知らせ管理",
  };

  return pageNames[fileName] || fileName || "不明な画面";
}

function setText(element, value) {
  if (!element) {
    return;
  }

  element.textContent = String(value ?? "----");
}

function openModal(modal) {
  if (!modal) {
    return;
  }

  modal.hidden = false;

  document.body.classList.add("admin-modal-open");
}

function closeModal(modal) {
  if (!modal) {
    return;
  }

  modal.hidden = true;

  if (deleteConfirmModal1?.hidden && deleteConfirmModal2?.hidden) {
    document.body.classList.remove("admin-modal-open");
  }
}

window.addEventListener("beforeunload", () => {
  if (stopPresenceListener) {
    stopPresenceListener();
  }
});
