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
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

import { isPrimaryDeviceAuditViewer } from "./device_audit_access.mjs";
import { formatAcademicGrade } from "./grade_display.mjs";

import {
  getPrimaryPresenceDevice,
  normalizePresenceDevices,
} from "./presence_devices.mjs?v=20261001-2";

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

const checkmanabaAuthButton = document.getElementById(
  "checkmanabaAuthButton",
);

const checkActiveMailAuthButton = document.getElementById(
  "checkActiveMailAuthButton",
);

const manabaAuthProgress = document.getElementById("manabaAuthProgress");

const activeMailAuthProgress = document.getElementById(
  "activeMailAuthProgress",
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

const deviceAuditMount = document.getElementById("deviceAuditMount");

const deviceAuditTemplate = document.getElementById("deviceAuditTemplate");

let deviceAuditSection = null;

let deviceAuditStudentHeading = null;

let deviceSessionSummary = null;

let deviceRiskNotice = null;

let deviceRiskReasons = null;

let deviceSessionList = null;

let refreshDeviceSessionsButton = null;

let forceLogoutAllDevicesButton = null;

const studentFeatureAdmin = document.getElementById("studentFeatureAdmin");
const studentFeatureSummary = document.getElementById("studentFeatureSummary");
const studentFeatureStatus = document.getElementById("studentFeatureStatus");
const studentFeatureRealtimeStatus = document.getElementById("studentFeatureRealtimeStatus");
const studentEnrollmentPanel = document.getElementById("studentEnrollmentPanel");
const studentAttendancePanel = document.getElementById("studentAttendancePanel");
const studentExamPanel = document.getElementById("studentExamPanel");
const studentReferralPanel = document.getElementById("studentReferralPanel");

/* ========================================
   状態
======================================== */

let targetUserData = null;

let stopPresenceListener = null;

let deviceAuditAuthorized = false;

let studentFeatureData = null;
let studentFeatureRealtimeUnsubscribers = [];
let studentFeatureRealtimeTimer = null;
let studentFeaturePollingInterval = null;
let studentFeatureLoadInFlight = null;
let studentFeatureReloadQueued = false;

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
  loadStudentFeatures(),
  updateAssignmentNavBadge(),
  updateNewsNavBadge(),
]);

startStudentFeatureRealtime();

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
    formatAcademicGrade(targetUserData.grade, "未設定"),
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
    externalAuthStatusText(targetUserData, "manaba"),
  );

  const activeMailConfigured =
    Boolean(targetUserData.activeMailPasswordEncrypted) &&
    targetUserData.activeMailSetupSkipped !== true;

  setText(
    activeMailConfiguredValue,
    externalAuthStatusText(
      targetUserData,
      "activeMail",
      activeMailConfigured,
    ),
  );

  updateExternalAuthButtonAvailability();

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

}

/* ========================================
   機能別の利用・管理状況
======================================== */

const attendanceStatusOptions = {
  present: "出席",
  late: "遅刻",
  early_leave: "早退",
  late_and_early_leave: "遅刻・早退",
  absent: "欠席",
  unrecorded: "未打刻",
};

async function loadStudentFeatures({ silent = false } = {}) {
  if (!studentFeatureAdmin) return;
  if (studentFeatureLoadInFlight) {
    studentFeatureReloadQueued = true;
    return studentFeatureLoadInFlight;
  }

  if (!silent) {
    studentFeatureStatus.hidden = false;
    studentFeatureStatus.textContent = "機能別データを読み込んでいます...";
  }

  studentFeatureLoadInFlight = (async () => {
    try {
      const response = await httpsCallable(functions, "getStudentFeatureAdmin")({
        studentNumber: targetStudentNumber,
      });
      studentFeatureData = response.data || {};
      renderStudentFeatures();
      studentFeatureStatus.hidden = true;
      setStudentFeatureRealtimeStatus("自動更新中");
    } catch (error) {
      console.error("機能別データ取得エラー:", error);
      if (!studentFeatureData) {
        studentFeatureStatus.hidden = false;
        studentFeatureStatus.textContent = "機能別データを取得できませんでした。更新してもう一度お試しください。";
      }
      setStudentFeatureRealtimeStatus("自動更新を再接続しています。", true);
    } finally {
      studentFeatureLoadInFlight = null;
      if (studentFeatureReloadQueued) {
        studentFeatureReloadQueued = false;
        scheduleStudentFeatureReload(0);
      }
    }
  })();

  return studentFeatureLoadInFlight;
}

function renderStudentFeatures() {
  const enrollments = Array.isArray(studentFeatureData?.enrollments)
    ? studentFeatureData.enrollments.filter((item) => item && typeof item === "object")
    : [];
  const availableEnrollmentSubjects = Array.isArray(studentFeatureData?.availableEnrollmentSubjects)
    ? studentFeatureData.availableEnrollmentSubjects.filter((item) => item && typeof item === "object")
    : [];
  const attendance = Array.isArray(studentFeatureData?.attendanceRecords)
    ? studentFeatureData.attendanceRecords.filter((item) => item && typeof item === "object")
    : [];
  const progress = Array.isArray(studentFeatureData?.testProgress)
    ? studentFeatureData.testProgress.filter((item) => item && typeof item === "object")
    : [];
  const solved = Array.isArray(studentFeatureData?.solvedQuestions)
    ? studentFeatureData.solvedQuestions.filter((item) => item && typeof item === "object")
    : [];
  const referral = studentFeatureData?.referral || { invitedCount: 0, milestones: [] };
  const referralMilestones = Array.isArray(referral.milestones) ? referral.milestones : [];
  const referralHistories = Array.isArray(referral.histories) ? referral.histories : [];
  const referralAdjustments = Array.isArray(referral.adjustments) ? referral.adjustments : [];
  const activeEnrollments = enrollments.filter((item) => item.status === "enrolled");
  const activeEnrollmentIds = new Set(activeEnrollments.map((item) => String(item.id || "")));
  const enrollmentCandidates = availableEnrollmentSubjects.filter(
    (item) => !activeEnrollmentIds.has(String(item.id || "")),
  );
  studentFeatureSummary.innerHTML = `
    <div><small>履修</small><b>${activeEnrollments.length}科目</b></div>
    <div><small>出席記録</small><b>${attendance.length}件</b></div>
    <div><small>テスト進捗</small><b>${progress.length}件</b></div>
    <div><small>紹介</small><b>${Number(referral.invitedCount || 0)} / 10人</b></div>`;

  try {
    const context = studentFeatureData?.enrollmentContext || {};
    const initialRegistrationEditor = `
      <section class="student-enrollment-initial-editor">
        <div class="student-enrollment-initial-heading">
          <div><h3>${activeEnrollments.length ? "履修科目を追加" : "履修科目を初期登録"}</h3><p>${context.academicYear ? `${escapeAuditHtml(context.academicYear)}年度` : "対象年度"}・${escapeAuditHtml(semesterLabel(context.semester) || "対象学期")}の科目から選択できます。学生本人は登録後も従来どおり変更できます。</p></div>
          <span>${enrollmentCandidates.length}科目</span>
        </div>
        ${enrollmentCandidates.length ? `
          <div class="student-enrollment-initial-actions">
            <button type="button" class="btn" data-select-required-enrollment>必修をすべて選択</button>
            <b data-enrollment-selection-count>0科目選択</b>
          </div>
          <div class="student-enrollment-candidate-list">
            ${enrollmentCandidates.map((item) => `
              <label class="student-enrollment-candidate">
                <input type="checkbox" data-initial-enrollment-subject value="${escapeAuditHtml(item.id)}" data-required="${item.required === true ? "true" : "false"}" />
                <span><strong>${escapeAuditHtml(item.name)}</strong><small>${escapeAuditHtml([semesterLabel(item.semester), item.credits ? `${item.credits}単位` : "", item.required ? "必修" : "選択"].filter(Boolean).join("・"))}</small></span>
              </label>`).join("")}
          </div>
          <button type="button" class="btn btn-primary student-enrollment-register-button" data-register-initial-enrollments disabled>選択した科目を登録</button>
        ` : `<div class="student-feature-empty">現在の学年・学期で追加できる科目はありません。</div>`}
      </section>`;
    const currentEnrollmentList = enrollments.length
    ? `<p class="student-feature-help">履修中 ${activeEnrollments.length}科目 / 登録履歴 ${enrollments.length}件。登録済み科目は個別に変更できます。</p><div class="student-feature-list">${enrollments.map((item) => `
      <article class="student-feature-row" data-feature-row="enrollment" data-document-id="${escapeAuditHtml(item.id)}">
        <div><b>${escapeAuditHtml(item.name)}</b><small>${escapeAuditHtml([item.academicYear ? `${item.academicYear}年度` : "", semesterLabel(item.semester), item.credits ? `${item.credits}単位` : "", item.required ? "必修" : ""].filter(Boolean).join("・"))}</small></div>
        <div class="student-feature-edit"><select aria-label="履修状態"><option value="enrolled" ${item.status === "enrolled" ? "selected" : ""}>履修中</option><option value="not_enrolled" ${item.status === "not_enrolled" ? "selected" : ""}>履修から外す</option></select><button type="button" class="btn" data-save-feature>保存</button></div>
      </article>`).join("")}</div>`
      : '<div class="student-feature-empty">現在の履修登録はありません。上の科目一覧から初期登録してください。</div>';
    studentEnrollmentPanel.innerHTML = initialRegistrationEditor + currentEnrollmentList;
  } catch (error) {
    console.error("履修明細の描画エラー:", error);
    studentEnrollmentPanel.innerHTML = '<div class="student-feature-empty">履修明細を表示できませんでした。自動更新で再取得します。</div>';
  }

  try {
    studentAttendancePanel.innerHTML = attendance.length
    ? `<p class="student-feature-help">最新100件を表示します。変更すると管理者修正日時も記録されます。</p><div class="student-feature-list">${attendance.slice(0, 100).map((item) => `
      <article class="student-feature-row" data-feature-row="attendance" data-document-id="${escapeAuditHtml(item.id)}">
        <div><b>${escapeAuditHtml(item.subject)}</b><small>${escapeAuditHtml(item.date || "日付不明")} ${item.period ? `${item.period}限` : ""}${item.classGroup ? `・${escapeAuditHtml(item.classGroup)}クラス` : ""}・${escapeAuditHtml(item.statusLabel || attendanceStatusOptions[item.status] || "未打刻")}${item.judgementSource ? `・判定: ${escapeAuditHtml(item.judgementSource)}` : ""}${item.adminEditedAt ? `・修正済み ${escapeAuditHtml(formatAuditDate(item.adminEditedAt))}` : ""}</small></div>
        <div class="student-feature-edit"><select aria-label="出席状態">${Object.entries(attendanceStatusOptions).map(([value, label]) => `<option value="${value}" ${item.status === value ? "selected" : ""}>${label}</option>`).join("")}</select><button type="button" class="btn" data-save-feature>保存</button></div>
      </article>`).join("")}</div>`
      : '<div class="student-feature-empty">出席記録はまだありません。</div>';
  } catch (error) {
    console.error("出席明細の描画エラー:", error);
    studentAttendancePanel.innerHTML = '<div class="student-feature-empty">出席明細を表示できませんでした。自動更新で再取得します。</div>';
  }

  try {
    studentExamPanel.innerHTML = progress.length || solved.length
    ? `${progress.length ? `<p class="student-feature-help">現在位置と完了状態を修正できます。問題番号は1から始まります。</p><div class="student-feature-list">${progress.map((item) => `
      <article class="student-feature-row student-feature-exam-row" data-feature-row="examProgress" data-document-id="${escapeAuditHtml(item.id)}">
        <div><b>${escapeAuditHtml(item.subjectName)}</b><small>${escapeAuditHtml(testTypeLabel(item.type))}・単元 ${escapeAuditHtml(item.unitId || "未設定")}・現在 ${item.totalQuestions ? `${Math.min(item.totalQuestions, item.currentIndex + 1)} / ${item.totalQuestions}問` : "問題数不明"}${item.currentQuestionId ? `・問題ID ${escapeAuditHtml(item.currentQuestionId)}` : ""}</small>${item.currentQuestionText ? `<p class="student-feature-question">${escapeAuditHtml(item.currentQuestionText)}</p>` : ""}</div>
        <div class="student-feature-edit student-feature-exam-edit"><label>問題番号<input type="number" min="1" max="${Math.max(1, item.totalQuestions)}" value="${Math.min(Math.max(1, item.currentIndex + 1), Math.max(1, item.totalQuestions))}" /></label><label class="student-feature-check"><input type="checkbox" ${item.completed ? "checked" : ""} /> 完了</label><button type="button" class="btn" data-save-feature>保存</button></div>
      </article>`).join("")}</div>` : '<div class="student-feature-empty">進行中のテストはありません。</div>'}
      <details class="student-feature-solved"><summary>解答・獲得ポイント履歴 ${solved.length}件</summary>${solved.length ? solved.map((item) => `<div><b>${escapeAuditHtml(item.day || "日付不明")}・${escapeAuditHtml(item.questionId || "問題IDなし")}</b><span>${escapeAuditHtml(testTypeLabel(item.type))} / ${Number(item.points || 0)}pt</span></div>`).join("") : '<p>履歴はありません。</p>'}</details>`
      : '<div class="student-feature-empty">テスト対策の利用履歴はありません。</div>';
  } catch (error) {
    console.error("テスト明細の描画エラー:", error);
    studentExamPanel.innerHTML = '<div class="student-feature-empty">テスト対策の明細を表示できませんでした。自動更新で再取得します。</div>';
  }

  try {
    studentReferralPanel.innerHTML = `
    <div class="student-referral-overview"><strong>${Number(referral.invitedCount || 0)} / 10人</strong><div class="referral-admin-progress-track"><i style="width:${Math.min(100, Number(referral.invitedCount || 0) * 10)}%"></i></div></div>
    <div class="referral-admin-milestones">${referralMilestones.map((item) => `<span class="${item.unlocked ? "is-unlocked" : ""}">${item.count}人 ${item.unlocked ? "✓" : ""}</span>`).join("")}</div>
    <p class="student-feature-help">手動補正: ${Number(referral.manualAdjustment || 0)}人。成立履歴 ${referralHistories.length}件、補正履歴 ${referralAdjustments.length}件。</p>
      ${referralHistories.length ? `<details><summary>紹介成立履歴</summary>${referralHistories.map((item) => `<div>${escapeAuditHtml(item.inviterStudentNumber || "不明")} → ${escapeAuditHtml(item.codePreview || "コード")}${item.establishedAt ? `・${escapeAuditHtml(formatAuditDate(item.establishedAt))}` : ""}</div>`).join("")}</details>` : ""}`;
  } catch (error) {
    console.error("紹介明細の描画エラー:", error);
    studentReferralPanel.innerHTML = '<div class="student-feature-empty">紹介進捗の明細を表示できませんでした。自動更新で再取得します。</div>';
  }
}

function setStudentFeatureRealtimeStatus(message, isError = false) {
  if (!studentFeatureRealtimeStatus) return;
  const suffix = message === "自動更新中"
    ? `・最終更新 ${new Date().toLocaleTimeString("ja-JP")}`
    : "";
  studentFeatureRealtimeStatus.textContent = `${message}${suffix}`;
  studentFeatureRealtimeStatus.classList.toggle("is-error", isError);
}

function scheduleStudentFeatureReload(delay = 180) {
  if (studentFeatureRealtimeTimer) clearTimeout(studentFeatureRealtimeTimer);
  studentFeatureRealtimeTimer = setTimeout(() => {
    studentFeatureRealtimeTimer = null;
    loadStudentFeatures({ silent: true });
  }, delay);
}

function startStudentFeatureRealtime() {
  if (!studentFeatureAdmin) return;
  stopStudentFeatureRealtime();
  const watchedCollections = [
    "enrolledSubjects",
    "attendanceRecords",
    "examProgress",
    "solvedQuestions",
  ];
  studentFeatureRealtimeUnsubscribers = watchedCollections.map((collectionName) => onSnapshot(
    collection(db, "users", targetStudentNumber, collectionName),
    () => scheduleStudentFeatureReload(),
    (error) => {
      console.error(`${collectionName}のリアルタイム監視エラー:`, error);
      setStudentFeatureRealtimeStatus("自動更新を再接続しています。", true);
      scheduleStudentFeatureReload(1000);
    },
  ));
  // 紹介進捗など管理者限定のCallable経由データも取りこぼさないよう、
  // 変更監視に加えて短い間隔の軽量再取得を行う。
  studentFeaturePollingInterval = setInterval(() => {
    if (document.visibilityState === "visible") scheduleStudentFeatureReload(0);
  }, 15000);
  setStudentFeatureRealtimeStatus("自動更新中");
}

function stopStudentFeatureRealtime() {
  studentFeatureRealtimeUnsubscribers.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch (error) {
      console.error("機能別監視終了エラー:", error);
    }
  });
  studentFeatureRealtimeUnsubscribers = [];
  if (studentFeatureRealtimeTimer) clearTimeout(studentFeatureRealtimeTimer);
  studentFeatureRealtimeTimer = null;
  if (studentFeaturePollingInterval) clearInterval(studentFeaturePollingInterval);
  studentFeaturePollingInterval = null;
}

window.addEventListener("pagehide", stopStudentFeatureRealtime, { once: true });

function setStudentFeatureTab(tabName) {
  studentFeatureAdmin.querySelectorAll("[data-feature-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.featureTab === tabName);
  });
  studentFeatureAdmin.querySelectorAll("[data-feature-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.featurePanel !== tabName;
  });
}

async function saveStudentFeature(button) {
  const row = button.closest("[data-feature-row]");
  if (!row) return;
  const feature = row.dataset.featureRow;
  const data = {
    studentNumber: targetStudentNumber,
    feature,
    documentId: row.dataset.documentId,
  };
  if (feature === "enrollment" || feature === "attendance") {
    data.status = row.querySelector("select")?.value || "";
  } else if (feature === "examProgress") {
    const numberInput = row.querySelector('input[type="number"]');
    data.currentIndex = Math.max(0, Number(numberInput?.value || 1) - 1);
    data.completed = Boolean(row.querySelector('input[type="checkbox"]')?.checked);
  }
  const actionLabel = feature === "enrollment" && data.status === "not_enrolled"
    ? "この科目を履修登録から外しますか？"
    : "この内容で保存しますか？";
  if (!confirm(actionLabel)) return;
  button.disabled = true;
  button.textContent = "保存中...";
  try {
    await httpsCallable(functions, "updateStudentFeatureAdmin")(data);
    showToast("機能別の状態を保存しました");
    await loadStudentFeatures();
  } catch (error) {
    console.error("機能別データ更新エラー:", error);
    alert("変更を保存できませんでした。");
    button.disabled = false;
    button.textContent = "保存";
  }
}

function updateInitialEnrollmentSelection() {
  const checkboxes = [...studentEnrollmentPanel.querySelectorAll(
    "input[data-initial-enrollment-subject]",
  )];
  const selectedCount = checkboxes.filter((input) => input.checked).length;
  const counter = studentEnrollmentPanel.querySelector("[data-enrollment-selection-count]");
  const registerButton = studentEnrollmentPanel.querySelector("[data-register-initial-enrollments]");
  if (counter) counter.textContent = `${selectedCount}科目選択`;
  if (registerButton) registerButton.disabled = selectedCount === 0;
}

async function registerInitialEnrollments(button) {
  const subjectIds = [...studentEnrollmentPanel.querySelectorAll(
    "input[data-initial-enrollment-subject]:checked",
  )].map((input) => input.value).filter(Boolean);
  if (!subjectIds.length) return;
  if (!confirm(`${subjectIds.length}科目をこの学生の履修科目として登録しますか？`)) return;
  button.disabled = true;
  button.textContent = "登録中...";
  try {
    const response = await httpsCallable(functions, "updateStudentFeatureAdmin")({
      studentNumber: targetStudentNumber,
      feature: "enrollmentInitial",
      subjectIds,
    });
    showToast(`${Number(response.data?.registeredCount || subjectIds.length)}科目を登録しました`);
    await loadStudentFeatures();
  } catch (error) {
    console.error("履修科目初期登録エラー:", error);
    alert(error?.message?.replace(/^FirebaseError:\s*/, "") || "履修科目を登録できませんでした。");
    button.disabled = false;
    button.textContent = "選択した科目を登録";
  }
}

function semesterLabel(value) {
  if (value === "first" || value === "前期") return "前期";
  if (value === "second" || value === "後期") return "後期";
  if (value === "full" || value === "通期") return "通期";
  return String(value || "");
}

function testTypeLabel(value) {
  return ({ quiz: "選択問題", fillBlank: "穴埋め", qa: "一問一答", daily: "今日の一問", important: "重要ポイント" })[value] || String(value || "形式不明");
}

/* ========================================
   2510044専用・ログイン端末確認
======================================== */

async function initializeDeviceAuditIfAuthorized() {
  if (!deviceAuditMount || !deviceAuditTemplate) return;

  try {
    await auth.authStateReady();
    const currentUser = auth.currentUser;
    const token = await currentUser?.getIdTokenResult();
    const isPrimaryAuditAdmin = isPrimaryDeviceAuditViewer(
      currentUser,
      token?.claims,
    );

    if (!isPrimaryAuditAdmin) return;

    deviceAuditAuthorized = true;
    mountDeviceAuditSection();
    updateDeviceAuditHeading();
    await loadDeviceSessions();
  } catch (error) {
    console.error("端末確認機能の初期化エラー:", error);

    if (!deviceAuditAuthorized) {
      deviceAuditSection.hidden = true;
      return;
    }

    renderDeviceSessionError("error");
  }
}

function mountDeviceAuditSection() {
  if (deviceAuditSection || !deviceAuditMount || !deviceAuditTemplate) return;

  deviceAuditMount.append(deviceAuditTemplate.content.cloneNode(true));
  deviceAuditSection = document.getElementById("deviceAuditSection");
  deviceAuditStudentHeading = document.getElementById(
    "deviceAuditStudentHeading",
  );
  deviceSessionSummary = document.getElementById("deviceSessionSummary");
  deviceRiskNotice = document.getElementById("deviceRiskNotice");
  deviceRiskReasons = document.getElementById("deviceRiskReasons");
  deviceSessionList = document.getElementById("deviceSessionList");
  refreshDeviceSessionsButton = document.getElementById(
    "refreshDeviceSessionsButton",
  );
  forceLogoutAllDevicesButton = document.getElementById(
    "forceLogoutAllDevicesButton",
  );
}

function updateDeviceAuditHeading() {
  if (!deviceAuditStudentHeading) return;

  const displayName = getStudentName(targetUserData || {});
  deviceAuditStudentHeading.textContent = displayName
    ? `${displayName}（${targetStudentNumber}）の端末`
    : `${targetStudentNumber} の端末`;
}

async function loadDeviceSessions() {
  if (!deviceSessionList || !deviceAuditAuthorized) return;

  setText(deviceSessionSummary, "端末情報を確認しています...");
  renderDeviceRisk({});
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
      renderDeviceSessionError("permission-denied");
      return;
    }

    renderDeviceSessionError("error");
  }
}

function renderDeviceSessionError(state) {
  renderDeviceRisk({});

  if (state === "permission-denied") {
    setText(deviceSessionSummary, "端末情報を表示する権限を確認できませんでした");
    deviceSessionList.innerHTML = `
      <div class="admin-user-loading">
        権限がないため端末情報を取得できません。
      </div>
    `;
    return;
  }

  setText(deviceSessionSummary, "端末情報の取得エラー");
  deviceSessionList.innerHTML = `
    <div class="admin-user-loading">
      一時的に端末情報を取得できません。時間をおいて更新してください。
    </div>
  `;
}

function renderDeviceSessions(data) {
  const devices = Array.isArray(data.devices) ? data.devices : [];
  const risk = data.risk || {};

  setText(
    deviceSessionSummary,
    devices.length
      ? `${devices.length}台・最終利用順（最終利用から${Number(data.retentionDays || 30)}日間保持）`
      : "端末履歴なし",
  );

  renderDeviceRisk(risk);

  if (!devices.length) {
    deviceSessionList.innerHTML = `
      <div class="admin-user-loading">
        この学生の端末履歴はまだありません。次回ログイン後に記録されます。
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
      const state = device.forceLogoutPending
        ? "強制ログアウト要求済み"
        : formatDeviceState(device.state);
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
              <span class="admin-device-state admin-device-state-${device.forceLogoutPending ? "logout-pending" : escapeAuditHtml(device.state || "history")}">
                ${escapeAuditHtml(state)}
              </span>
            </div>
            <div class="admin-device-item-actions">
              <button
                type="button"
                class="btn btn-danger admin-device-force-logout-button"
                data-device-id="${escapeAuditHtml(device.deviceId || "")}"
                data-device-label="${escapeAuditHtml(numberedType)}"
                ${device.forceLogoutPending ? "disabled" : ""}
              >
                ${device.forceLogoutPending ? "ログアウト要求済み" : "この端末を強制ログアウト"}
              </button>
              <button
                type="button"
                class="btn admin-device-delete-button"
                data-device-id="${escapeAuditHtml(device.deviceId || "")}"
                data-device-label="${escapeAuditHtml(numberedType)}"
              >
                履歴を削除
              </button>
            </div>
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

async function forceLogoutDevice(button) {
  if (!deviceAuditAuthorized) return;

  const deviceId = button.dataset.deviceId || "";
  const deviceLabel = button.dataset.deviceLabel || "この端末";
  if (!deviceId) return;

  const confirmed = confirm(
    `${deviceLabel}（${targetStudentNumber}）を強制ログアウトしますか？\nこの端末でCareMateを再度利用するにはログインが必要になります。`,
  );
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "ログアウト要求中...";

  try {
    const forceLogoutUserDevice = httpsCallable(
      functions,
      "forceLogoutUserDevice",
    );
    await forceLogoutUserDevice({
      studentNumber: targetStudentNumber,
      deviceId,
    });
    showToast(`${deviceLabel}へ強制ログアウトを要求しました`);
    await loadDeviceSessions();
  } catch (error) {
    console.error("端末強制ログアウトエラー:", error);
    alert("端末を強制ログアウトできませんでした。時間をおいて再度お試しください。");
    button.disabled = false;
    button.textContent = "この端末を強制ログアウト";
  }
}

async function forceLogoutAllDevices() {
  if (!deviceAuditAuthorized || !forceLogoutAllDevicesButton) return;

  const confirmed = confirm(
    `${targetStudentNumber}のすべての端末を強制ログアウトしますか？\n現在ログイン中のすべての端末で、再度ログインが必要になります。`,
  );
  if (!confirmed) return;

  forceLogoutAllDevicesButton.disabled = true;
  forceLogoutAllDevicesButton.textContent = "全端末へ要求中...";

  try {
    const forceLogoutAllUserDevices = httpsCallable(
      functions,
      "forceLogoutAllUserDevices",
    );
    await forceLogoutAllUserDevices({
      studentNumber: targetStudentNumber,
    });
    showToast("すべての端末へ強制ログアウトを要求しました");
    await loadDeviceSessions();
  } catch (error) {
    console.error("全端末強制ログアウトエラー:", error);
    alert("すべての端末を強制ログアウトできませんでした。時間をおいて再度お試しください。");
  } finally {
    forceLogoutAllDevicesButton.disabled = false;
    forceLogoutAllDevicesButton.textContent =
      "すべての端末からログアウト";
  }
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
  const entries = normalizePresenceDevices(presence, {
    now: Date.now(),
    offlineRetentionMs: 15 * 60 * 1000,
  });

  if (!entries.length) {
    setText(presenceStatus, "⚫ 接続履歴なし");

    setText(currentPageValue, "取得できません");

    setText(lastSeenValue, "接続履歴なし");

    setText(backgroundStatus, "不明");

    return;
  }

  const primaryPresence = getPrimaryPresenceDevice(presence, {
    now: Date.now(),
    offlineRetentionMs: 15 * 60 * 1000,
  });

  const onlineCount = entries.filter((item) => item.state === "online").length;
  const awayCount = entries.filter((item) => item.state === "away").length;
  const state = primaryPresence.state || "offline";

  if (state === "online") {
    setText(presenceStatus, `🟢 ${entries.length}台中${onlineCount}台オンライン`);
  } else if (state === "away") {
    setText(presenceStatus, `🟡 ${entries.length}台中${awayCount}台バックグラウンド`);
  } else {
    setText(presenceStatus, `🔴 ${entries.length}台オフライン`);
  }

  setText(
    currentPageValue,
    entries
      .map(
        (item, index) =>
          `${item.deviceLabel || `端末 ${index + 1}`}：${item.pageName || formatPageName(item.page) || "取得できません"}`,
      )
      .join(" / "),
  );
  setText(
    backgroundStatus,
    entries
      .map((item, index) => {
        const label = item.deviceLabel || `端末 ${index + 1}`;
        const stateLabel =
          item.state === "online"
            ? "表示中"
            : item.state === "away"
              ? "バックグラウンド"
              : "オフライン";
        return `${label}：${stateLabel}`;
      })
      .join(" / "),
  );
  setText(
    lastSeenValue,
    formatLastSeen(
      Math.max(...entries.map((item) => Number(item.lastChanged || 0))),
    ),
  );
}

/* ========================================
   イベント
======================================== */

function setupEvents() {
  if (studentFeatureAdmin) {
    studentFeatureAdmin.addEventListener("click", async (event) => {
      const tabButton = event.target.closest("[data-feature-tab]");
      if (tabButton) {
        setStudentFeatureTab(tabButton.dataset.featureTab);
        return;
      }
      const selectRequiredButton = event.target.closest("[data-select-required-enrollment]");
      if (selectRequiredButton) {
        studentEnrollmentPanel.querySelectorAll(
          'input[data-initial-enrollment-subject][data-required="true"]',
        ).forEach((input) => { input.checked = true; });
        updateInitialEnrollmentSelection();
        return;
      }
      const initialEnrollmentButton = event.target.closest("[data-register-initial-enrollments]");
      if (initialEnrollmentButton) {
        await registerInitialEnrollments(initialEnrollmentButton);
        return;
      }
      const saveButton = event.target.closest("[data-save-feature]");
      if (saveButton) await saveStudentFeature(saveButton);
    });
    studentFeatureAdmin.addEventListener("change", (event) => {
      if (event.target.matches("input[data-initial-enrollment-subject]")) {
        updateInitialEnrollmentSelection();
      }
    });
  }

  if (backButton) {
    backButton.onclick = () => {
      location.href = "users_admin.html";
    };
  }

  if (saveUserButton) {
    saveUserButton.onclick = saveUserChanges;
  }

  if (checkmanabaAuthButton) {
    checkmanabaAuthButton.onclick = () => runExternalAuthCheck("manaba");
  }

  if (checkActiveMailAuthButton) {
    checkActiveMailAuthButton.onclick = () =>
      runExternalAuthCheck("activeMail");
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

  if (forceLogoutAllDevicesButton) {
    forceLogoutAllDevicesButton.onclick = forceLogoutAllDevices;
  }

  if (deviceSessionList) {
    deviceSessionList.addEventListener("click", async (event) => {
      const forceLogoutButton = event.target.closest(
        ".admin-device-force-logout-button",
      );
      if (forceLogoutButton) {
        await forceLogoutDevice(forceLogoutButton);
        return;
      }

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

function updateExternalAuthButtonAvailability() {
  const manabaConfigured = Boolean(
    targetUserData?.manabaId && targetUserData?.manabaPasswordEncrypted,
  );
  const activeMailConfigured = Boolean(
    targetUserData?.activeMailPasswordEncrypted,
  );
  if (checkmanabaAuthButton && checkmanabaAuthButton.dataset.running !== "true") {
    checkmanabaAuthButton.disabled = !manabaConfigured;
    checkmanabaAuthButton.title = manabaConfigured
      ? "保存済みのmanaba情報で認証できるか確認します"
      : "manaba IDとパスワードの設定後に実行できます";
  }
  if (
    checkActiveMailAuthButton &&
    checkActiveMailAuthButton.dataset.running !== "true"
  ) {
    checkActiveMailAuthButton.disabled = !activeMailConfigured;
    checkActiveMailAuthButton.title = activeMailConfigured
      ? "保存済みのActive!Mail情報で認証できるか確認します"
      : "Active!Mailパスワードの設定後に実行できます";
  }
}

async function runExternalAuthCheck(service) {
  const ismanaba = service === "manaba";
  const button = ismanaba
    ? checkmanabaAuthButton
    : checkActiveMailAuthButton;
  const progressElement = ismanaba
    ? manabaAuthProgress
    : activeMailAuthProgress;
  if (!button || !progressElement || button.dataset.running === "true") return;

  const randomPart =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replaceAll("-", "")
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const requestId = `auth_${Date.now()}_${randomPart}`;
  button.dataset.running = "true";
  button.disabled = true;
  button.textContent = "実行中...";
  progressElement.hidden = false;
  updateExternalAuthProgress(progressElement, {
    progress: 0,
    status: "running",
    message: "実行準備中",
  });

  const stopProgress = onSnapshot(
    doc(db, "externalAuthChecks", requestId),
    (snapshot) => {
      if (snapshot.exists()) {
        updateExternalAuthProgress(progressElement, snapshot.data());
      }
    },
    (error) => {
      console.error("認証確認進捗取得エラー:", error);
    },
  );

  try {
    const check = httpsCallable(functions, "runExternalAuthCheck", {
      timeout: 120_000,
    });
    const response = await check({
      studentNumber: targetStudentNumber,
      service,
      requestId,
    });
    updateExternalAuthProgress(progressElement, {
      progress: 100,
      status: response.data?.verified ? "success" : "failed",
      message: response.data?.verified
        ? "認証に成功しました"
        : response.data?.configured === false
          ? "設定されていません"
          : "認証に失敗しました",
    });
    await loadTargetUser();
  } catch (error) {
    console.error("外部認証確認エラー:", error);
    updateExternalAuthProgress(progressElement, {
      progress: 100,
      status: "error",
      message: "確認できませんでした。時間をおいて再実行してください",
    });
  } finally {
    window.setTimeout(stopProgress, 1500);
    button.dataset.running = "false";
    button.textContent = "もう一度確認";
    updateExternalAuthButtonAvailability();
  }
}

function updateExternalAuthProgress(element, data) {
  const progress = Math.max(0, Math.min(100, Number(data?.progress || 0)));
  const message = String(data?.message || "認証を確認しています");
  const heading = element.querySelector(".external-auth-progress-heading");
  const track = element.querySelector(".external-auth-progress-track");
  const bar = track?.querySelector("i");
  element.dataset.status = String(data?.status || "running");
  if (heading) {
    heading.querySelector("span").textContent = message;
    heading.querySelector("b").textContent = `${progress}%`;
  }
  if (track) track.setAttribute("aria-valuenow", String(progress));
  if (bar) bar.style.width = `${progress}%`;
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

  const newmanabaPassword = manabaPassword?.value.trim() || "";

  const manabaConfirm = manabaPasswordConfirm?.value.trim() || "";

  const newCareMatePassword = careMatePassword?.value.trim() || "";

  const careMateConfirm = careMatePasswordConfirm?.value.trim() || "";

  if (newActiveMailPassword !== activeMailConfirm) {
    alert("Active!Mailパスワードが一致しません。");

    return;
  }

  if (newmanabaPassword !== manabaConfirm) {
    alert("manabaパスワードが一致しません。");

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

  if (newmanabaPassword && newmanabaPassword.length < 4) {
    alert("manabaパスワードを確認してください。");

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

      adminUpdatedAt: serverTimestamp(),

      adminUpdatedBy: adminStudentNumber || "",
    };

    if (newActiveMailPassword) {
      updates.activeMailPasswordEncrypted = await encryptData(
        newActiveMailPassword,
      );

      updates.activeMailSetupSkipped = false;

      updates.activeMailResetRequired = false;

      updates.activeMailVerified = null;

      updates.activeMailVerifiedAt = null;

      updates.activeMailVerificationError = null;
    }

    if (newmanabaPassword) {
      updates.manabaPasswordEncrypted = await encryptData(newmanabaPassword);

      updates.manabaSetupSkipped = false;

      updates.manabaResetRequired = false;

      /*
            パスワード変更後は再認証が必要なので
            未認証へ戻す
            */

      updates.manabaVerified = null;

      updates.manabaVerifiedAt = null;

      updates.manabaVerificationError = null;
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

function externalAuthStatusText(user, service, configuredOverride = null) {
  const configured =
    configuredOverride === null
      ? Boolean(user[`${service}PasswordEncrypted`]) &&
        user[`${service}SetupSkipped`] !== true
      : configuredOverride;

  if (!configured) return "⚠️ 未設定";
  if (user[`${service}ResetRequired`] === true) {
    return "❌ 再設定が必要";
  }
  if (user[`${service}Verified`] === true) {
    const checkedAt = formatFirestoreDate(user[`${service}LastCheckedAt`]);
    return `✅ 認証済み（${checkedAt}）`;
  }
  return "⏳ Render自動確認待ち";
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
