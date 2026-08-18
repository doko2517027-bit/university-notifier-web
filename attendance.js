import {
  db,
  studentNumber,
  setupTheme,
  loadProfileImage,
  initializePage,
  setupAdminTab,
  setupOfflineAlert,
  updateAssignmentNavBadge,
  updateShareNavBadge,
  updateNewsNavBadge,
  setupAttendanceWebPush,
} from "./common.js";

import {
  loadPersonalTimetableData,
  isEnrolledScheduleItem,
  normalizeCourseName,
} from "./personal_timetable_data.js";

import {
  doc,
  getDoc,
  collection,
  getDocs,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  classifyStartStamp,
  classifyEndStamp,
  getAttendanceActionState,
  ATTENDANCE_STATUS,
} from "./attendance_rules.js";

import {
  ATTENDANCE_STAMP_SOURCE,
  normalizeAttendanceLecture,
  createAttendanceRecordId,
  recalculateAttendanceStatus,
  stampAttendanceStart,
  stampAttendanceEnd,
  stampAttendanceEarlyLeave,
  markAttendanceAbsent,
} from "./attendance_stamp.js";

import { VERSION } from "./version.js";

/* ========================================
   DOM
======================================== */

const el = {
  back: document.getElementById("backButton"),

  theme: document.getElementById("themeButton"),

  profile: document.getElementById("profileButton"),

  image: document.getElementById("topProfileImage"),

  version: document.getElementById("version"),

  date: document.getElementById("attendanceCurrentDate"),

  time: document.getElementById("attendanceCurrentTime"),

  currentStatus: document.getElementById("attendanceCurrentStatus"),

  notificationState: document.getElementById("attendanceNotificationState"),

  enableNotifications: document.getElementById("enableAttendanceNotifications"),

  refresh: document.getElementById("attendanceRefreshButton"),

  todayList: document.getElementById("attendanceTodayList"),

  empty: document.getElementById("attendanceEmptyState"),

  recordList: document.getElementById("attendanceRecordList"),

  present: document.getElementById("attendanceSummaryPresent"),

  late: document.getElementById("attendanceSummaryLate"),

  early: document.getElementById("attendanceSummaryEarlyLeave"),

  absent: document.getElementById("attendanceSummaryAbsent"),

  pending: document.getElementById("attendanceSummaryPending"),

  confirmOverlay: document.getElementById("attendanceConfirmOverlay"),

  confirmIcon: document.getElementById("attendanceConfirmIcon"),

  confirmTitle: document.getElementById("attendanceConfirmTitle"),

  confirmSubject: document.getElementById("attendanceConfirmSubject"),

  confirmDetail: document.getElementById("attendanceConfirmDetail"),

  confirmButton: document.getElementById("attendanceConfirmButton"),

  cancelButton: document.getElementById("attendanceCancelButton"),

  resultOverlay: document.getElementById("attendanceResultOverlay"),

  resultIcon: document.getElementById("attendanceResultIcon"),

  resultLabel: document.getElementById("attendanceResultLabel"),

  resultTitle: document.getElementById("attendanceResultTitle"),

  resultStatus: document.getElementById("attendanceResultStatus"),

  resultMessage: document.getElementById("attendanceResultMessage"),

  resultClose: document.getElementById("attendanceResultClose"),

  resultHome: document.getElementById("attendanceResultHome"),

  subjectTermLabel:
    document.getElementById("attendanceTermLabel") ||
    document.getElementById("attendanceAcademicLabel"),

  termSelect: document.getElementById("attendanceTermSelect"),

  enrollmentNotice: document.getElementById("attendanceEnrollmentNotice"),

  subjectList:
    document.getElementById("attendanceSubjectList") ||
    document.getElementById("attendanceSubjectRateList"),

  subjectEmpty: document.getElementById("attendanceSubjectEmpty"),

  manualAbsent: document.getElementById("attendanceSummaryManualAbsent"),

  convertedAbsent: document.getElementById("attendanceSummaryConvertedAbsent"),

  totalAbsent: document.getElementById("attendanceSummaryTotalAbsent"),

  conversionText: document.getElementById("attendanceLateEarlyConversionText"),

  editOverlay: document.getElementById("attendanceEditOverlay"),

  editClose: document.getElementById("attendanceEditCloseButton"),

  editCancel: document.getElementById("attendanceEditCancelButton"),

  editSave: document.getElementById("attendanceEditSaveButton"),

  editSubject: document.getElementById("attendanceEditSubject"),

  editLectureInfo: document.getElementById("attendanceEditLectureInfo"),

  editCurrentStatus: document.getElementById("attendanceEditCurrentStatus"),

  editReason: document.getElementById("attendanceEditReason"),

  editError: document.getElementById("attendanceEditError"),

  toast: document.getElementById("attendanceToast"),

  helpButton: document.getElementById("attendanceRuleButton"),

  helpPopup: document.getElementById("attendanceRulePopup"),
};

/* ========================================
   状態
======================================== */

let effectiveDate = localDateKey();

let userData = {};

let lectures = [];

let records = new Map();

let allRecords = [];

let enrolledSubjects = [];

let termLectures = [];

let academicTerm = {
  academicYear: new Date().getFullYear(),

  semester: "前期",

  grade: "",
};

let selectedAttendanceTerm = null;

let availableAttendanceTerms = [];

let notificationTestExpiryTimer = null;

let scheduleData = null;

let enrolledAliases = new Map();

let missingClasses = [];

/*
前回描画した講義HTML。
同じならDOMを書き換えない。
*/
let lastLectureCardsHtml = "";

let pendingAction = null;

let loading = false;

/*
最後に出席データを取得した時刻。
*/
let attendanceLastLoadedAt = 0;

let toastTimer = null;

let pendingAttendanceEdit = null;

const CLASS_SELECTION_NONE = "__NONE__";

/* ========================================
   出席判定用現在時刻
======================================== */

function getAttendanceNow(lecture = null) {
  if (
    lecture &&
    lecture.attendanceNotificationTest === true &&
    lecture.attendanceNotificationTestClock
  ) {
    const testDate = new Date(lecture.attendanceNotificationTestClock);

    if (!Number.isNaN(testDate.getTime())) {
      return testDate;
    }
  }

  return new Date();
}

/* ========================================
   初期化
======================================== */

if (localStorage.getItem("loggedIn") !== "true" || !studentNumber) {
  location.href = "login.html";
} else {
  setupTheme(el.theme);

  setupOfflineAlert();

  setupEvents();

  startClock();

  await initializePage([
    setupAdminTab(),

    loadProfileImage(el.image),

    updateAssignmentNavBadge(),

    updateShareNavBadge(),

    updateNewsNavBadge(),

    initializeAttendance(),
  ]);
}

/* ========================================
   イベント
======================================== */

function setupEvents() {
  if (el.back) {
    el.back.onclick = () => {
      if (history.length > 1) {
        history.back();
      } else {
        location.href = "index.html";
      }
    };
  }

  if (el.profile) {
    el.profile.onclick = () => {
      location.href = "profile.html";
    };
  }

  if (el.version) {
    el.version.textContent = `Version ${VERSION}`;
  }

  if (el.refresh) {
    el.refresh.onclick = () => {
      refreshAttendance();
    };
  }

  if (el.termSelect) {
    el.termSelect.onchange = handleAttendanceTermChange;
  }

  if (el.enableNotifications) {
    el.enableNotifications.onclick = enableNotifications;
  }

  if (el.cancelButton) {
    el.cancelButton.onclick = closeConfirmation;
  }

  if (el.confirmButton) {
    el.confirmButton.onclick = executeAction;
  }

  if (el.resultClose) {
    el.resultClose.onclick = () => {
      closeOverlay(el.resultOverlay);
    };
  }

  if (el.resultHome) {
    el.resultHome.onclick = () => {
      location.href = "index.html";
    };
  }

  if (el.todayList) {
    el.todayList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-attendance-action]");

      if (!button) {
        return;
      }

      const action = button.dataset.attendanceAction || "";

      if (action === "open_home") {
        location.href = "index.html";

        return;
      }

      const lecture = lectures[Number(button.dataset.lectureIndex)];

      if (!lecture) {
        return;
      }

      openConfirmation(action, lecture);
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      return;
    }

    /*
            30秒以内に最新データを取得済みなら
            Firestoreを全部読み直さない。

            時計・ボタン状態だけ更新する。
            */
    if (Date.now() - attendanceLastLoadedAt < 30 * 1000) {
      renderLectureCards();

      updateCurrentLectureStatus();

      return;
    }

    void refreshAttendance(true);
  });

  if (el.editClose) {
    el.editClose.onclick = closeAttendanceEditDialog;
  }

  if (el.editCancel) {
    el.editCancel.onclick = closeAttendanceEditDialog;
  }

  if (el.editSave) {
    el.editSave.onclick = executeAttendanceEdit;
  }

  if (el.editOverlay) {
    el.editOverlay.addEventListener("click", (event) => {
      if (event.target === el.editOverlay) {
        closeAttendanceEditDialog();
      }
    });
  }

  if (el.helpButton && el.helpPopup) {
    el.helpButton.onclick = (event) => {
      event.stopPropagation();

      el.helpPopup.hidden = !el.helpPopup.hidden;
    };
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-edit-attendance]");

  if (!target) {
    return;
  }

  /*
        未来の講義・判定待ちは
        編集画面を開かない。
        */
  if (target.dataset.editLocked === "true") {
    return;
  }

  openAttendanceEditDialog({
    date: target.dataset.editAttendance || "",

    period: target.dataset.period || "",

    subject: target.dataset.subject || "",

    currentStatus: target.dataset.currentStatus || "未打刻",

    recordId: target.dataset.recordId || "",
  });
});

/* ========================================
   ページ読み込み
======================================== */

async function initializeAttendance() {
  updateNotificationState();

  await loadAttendanceData();

  renderAll();

  setInterval(() => {
    /*
            画面を見ていない間は
            DOMを再生成しない。
            */
    if (document.hidden) {
      return;
    }

    renderLectureCards();

    updateCurrentLectureStatus();
  }, 30 * 1000);
}

async function refreshAttendance(silent = false) {
  if (loading) {
    return;
  }

  try {
    setRefreshState(true);

    await loadAttendanceData();

    renderAll();

    if (!silent) {
      showToast("出席情報を更新しました。");
    }
  } catch (error) {
    console.error("出席情報更新エラー:", error);

    showToast("出席情報を更新できませんでした。");
  } finally {
    setRefreshState(false);
  }
}

/* ========================================
   データ取得
======================================== */

async function loadAttendanceData() {
  loading = true;

  try {
    const [userSnap, systemSnap] = await Promise.all([
      getDoc(doc(db, "users", studentNumber)),

      getDoc(doc(db, "system", "app")),
    ]);

    userData = userSnap.exists() ? userSnap.data() : {};

    if (userData.manabaVerified !== true) {
      alert("出席管理はManabaログイン確認が完了している学生のみ利用できます。");

      location.href = "index.html";

      throw new Error("Manabaログイン確認が完了していません。");
    }

    effectiveDate = resolveEffectiveDate(userData);

    const systemData = systemSnap.exists() ? systemSnap.data() : {};

    /*
        ユーザー情報はすでに取得済みなので
        personal_timetable_data側で再取得しない。

        さらにホームと同様、
        entries生成も不要。

        履修情報＋時間割だけ取得する。
        */
    const personalTimetable = await loadPersonalTimetableData({
      userData,
      buildEntries: false,
    });

    if (!selectedAttendanceTerm) {
      selectedAttendanceTerm = resolveStudentAttendanceTerm(
        userData,
        systemData,
      );
    }

    academicTerm = {
      ...selectedAttendanceTerm,
    };

    enrolledSubjects = normalizeEnrolledSubjects(
      personalTimetable?.enrolled || [],
    );

    const scheduleId =
      personalTimetable?.scheduleDocumentId || resolveScheduleId(userData);

    if (!scheduleId) {
      throw new Error("対応する時間割がありません。");
    }

    /*
        personal_timetable_data側ですでに
        取得した最新時間割を再利用。
        */
    scheduleData = personalTimetable?.scheduleData || null;

    enrolledAliases = personalTimetable?.aliasToCourse || new Map();

    const rawLectures = scheduleData
      ? extractLectures(scheduleData, effectiveDate, scheduleId)
      : [];

    /*
        履修登録済み講義だけ取得
        */

    let enrolled = rawLectures

      .map((item) => attachEnrolledSubjectData(item, enrolledAliases))

      .filter(Boolean);

    /*
        出席通知テスト講義を
        出席管理画面にも追加する。

        これで、

        通知テスト
        ↓
        出席管理にテスト科目表示
        ↓
        開始・終了打刻

        まで同じ講義として扱える。
        */

    const notificationTest = userData?.attendanceNotificationTest || {};

    const notificationTestActive =
      notificationTest.enabled === true &&
      normalizeDate(notificationTest.date) === effectiveDate &&
      getNotificationTestExpiryMs(notificationTest) > Date.now();

    if (notificationTestActive) {
      const testLectures = Array.isArray(notificationTest.lectures)
        ? notificationTest.lectures
        : [notificationTest];

      for (const test of testLectures) {
        const subject = normalizeText(test.subject);

        if (!subject) {
          continue;
        }

        /*
                履修登録しているテスト科目だけ対象
                */

        if (
          !isEnrolledScheduleItem(
            {
              subject,
            },
            enrolledAliases,
          )
        ) {
          continue;
        }

        const period = normalizePeriod(test.period || 1);

        const testId =
          `${notificationTest.testId || "today"}_` +
          `${period}_` +
          `${test.classGroup || "all"}`;

        /*
                Firebase Functions側の
                テスト通知recordIdと合わせる。
                */

        const testScheduleId = `${scheduleId}_test_${testId}`;

        enrolled.push({
          subject,

          grade: userData.grade || localStorage.getItem("grade") || "",

          period,

          classGroup: test.classGroup || "",

          startTime: test.startTime || "",

          endTime: test.endTime || "",

          building: "CareMate",

          room: "クラス通知テスト",

          date: effectiveDate,

          scheduleDocumentId: testScheduleId,

          attendanceNotificationTest: true,

          attendanceNotificationTestClock:
            userData?.attendanceTestClock?.enabled === true &&
            normalizeDate(userData.attendanceTestClock.date) ===
              effectiveDate &&
            /^\d{2}:\d{2}$/.test(userData.attendanceTestClock.time || "") &&
            Date.parse(userData.attendanceTestClock.expiresAt || "") >
              Date.now()
              ? `${effectiveDate}T${userData.attendanceTestClock.time}:00`
              : null,

          testId,
        });
      }
    }

    /*
        日付 × 科目 × 時限ごとの
        クラス選択を反映
        */

    const classResult = buildStudentLectures(
      enrolled,

      userData.classSelections || {},

      effectiveDate,

      scheduleId,
    );

    lectures = classResult.lectures;

    missingClasses = classResult.missing;

    rebuildTermLectures();

    await loadRecords();

    /*
        最新データ取得完了時刻。
        */
    attendanceLastLoadedAt = Date.now();

    scheduleNotificationTestExpiryRefresh();
  } finally {
    loading = false;
  }
}

function hasAttendanceEnrollment(term, snapshot) {
  return snapshot.docs.some((doc) => {
    const data = doc.data();

    return (
      Number(data.academicYear) === Number(term.academicYear) &&
      normalizeSemester(data.semester || data.registeredSemester) ===
        term.semester
    );
  });
}

/* ========================================
   時間割取得
======================================== */

function resolveScheduleId(data) {
  const department = normalizeText(
    data.department || localStorage.getItem("department"),
  );

  const major = normalizeText(data.major || localStorage.getItem("major"));

  if (department === "看護学科") {
    return "ns_yamate";
  }

  if (major === "理学療法学専攻") {
    return "pt";
  }

  if (major === "作業療法学専攻") {
    return "ot";
  }

  return "";
}

function attachEnrolledSubjectData(item, aliases) {
  const scheduleSubject = normalizeText(
    item?.subject || item?.name || item?.title,
  );

  const course = aliases?.get(normalizeCourseName(scheduleSubject));

  if (!course) {
    return null;
  }

  return {
    ...item,

    subject: scheduleSubject,

    subjectId: normalizeText(course.subjectId || course.id || item.subjectId),

    subjectKey: normalizeText(
      course.subjectKey || course.name || course.id || item.subjectKey,
    ),

    enrolledSubjectName: normalizeText(course.name || scheduleSubject),

    isPractical: course.isPractical === true,

    lectureCount: Number(course.lectureCount || item.lectureCount || 0),
  };
}

function extractLectures(data, date, scheduleId) {
  const rows = normalizeAttendanceScheduleRows(data, scheduleId, academicTerm);

  if (rows.length) {
    return rows.filter((item) => item.date === date);
  }

  return (Array.isArray(data.today) ? data.today : []).map((item) => ({
    ...item,

    date,

    scheduleDocumentId: scheduleId,
  }));
}

/* ========================================
   クラス選択反映
======================================== */

function buildStudentLectures(source, selections, date, scheduleId) {
  const groups = new Map();

  /*
    日付 × 科目 × 時限
    でまとめる
    */

  for (const item of source) {
    const subject = normalizeText(item.subject || item.name || item.title);

    const period = normalizePeriod(item.period);

    if (!subject || !period) {
      continue;
    }

    const key = `${date}|${subject}|${period}`;

    if (!groups.has(key)) {
      groups.set(key, {
        date,
        subject,
        period,

        rows: [],

        options: new Set(),
      });
    }

    const group = groups.get(key);

    const row = {
      ...item,

      date,

      subject,

      period,

      /*
            テスト講義には専用scheduleIdが
            入っているので上書きしない
            */
      scheduleDocumentId: item.scheduleDocumentId || scheduleId,
    };

    group.rows.push(row);

    /*
        classGroupが書かれている場合だけ
        クラス候補として取得する。
        */

    extractClassGroups(row.classGroup).forEach((value) =>
      group.options.add(value),
    );
  }

  const result = [];

  const missing = [];

  for (const group of groups.values()) {
    const options = [...group.options].sort();

    const selected = resolveSelectedClass(
      selections,

      group.date,

      group.subject,

      group.period,
    );

    /*
        classGroup記載なし

        → クラス選択不要
        */

    if (options.length === 0) {
      const preferred = group.rows[0];

      result.push({
        ...mergeRows(group.rows, preferred),

        date: group.date,

        subject: group.subject,

        period: group.period,

        selectedClassGroup: "",

        classOptions: [],

        scheduleDocumentId: preferred?.scheduleDocumentId || scheduleId,
      });

      continue;
    }

    /*
        classGroupが1つでも書かれていれば
        必ず選択が必要。

        例：
        成人看護学（Aクラス）

        → Aクラス
        → クラスなし

        のどちらかを選択する。
        */

    if (!selected) {
      missing.push({
        date: group.date,

        subject: group.subject,

        period: group.period,

        options,
      });

      /*
            未選択の講義は
            打刻対象にしない
            */

      continue;
    }

    /*
        「クラスなし」

        → 今日この講義を受けない

        ・出席管理に表示しない
        ・打刻対象にしない
        */

    if (selected === CLASS_SELECTION_NONE) {
      continue;
    }

    /*
        選択したクラスに対応する
        講義だけ取得
        */

    const matchingRows = group.rows.filter((row) => {
      const rowGroups = extractClassGroups(row.classGroup);

      /*
                    クラス表記なしの補助行が
                    同じ講義に含まれている場合は残す
                    */

      if (rowGroups.length === 0) {
        return true;
      }

      return rowGroups.includes(selected);
    });

    /*
        選択したクラスの講義がない

        → 対象外
        */

    if (!matchingRows.length) {
      continue;
    }

    const preferred =
      matchingRows.find((row) =>
        extractClassGroups(row.classGroup).includes(selected),
      ) || matchingRows[0];

    result.push({
      ...mergeRows(matchingRows, preferred),

      date: group.date,

      subject: group.subject,

      period: group.period,

      selectedClassGroup: selected,

      classOptions: options,

      scheduleDocumentId: preferred?.scheduleDocumentId || scheduleId,
    });
  }

  result.sort(
    (left, right) =>
      Number(left.period) - Number(right.period) ||
      String(left.startTime || "").localeCompare(String(right.startTime || "")),
  );

  return {
    lectures: result,

    missing,
  };
}

function mergeRows(rows, preferred) {
  const merged = {
    ...rows[0],

    ...preferred,
  };

  const fields = [
    "subjectId",

    "subjectKey",

    "startTime",

    "endTime",

    "teacher",

    "building",

    "room",
  ];

  for (const field of fields) {
    if (normalizeText(merged[field])) {
      continue;
    }

    const row = rows.find((item) => normalizeText(item[field]));

    if (row) {
      merged[field] = row[field];
    }
  }

  return merged;
}

function resolveSelectedClass(selections, date, subject, period) {
  const slashDate = date.replaceAll("-", "/");

  const keys = [
    `${subject}_${date}_${period}`,

    `${subject}_${slashDate}_${period}`,

    `${subject}_${date}_${period}限`,

    `${subject}__${period}`,

    `${date}_${subject}_${period}`,

    [
      encodeURIComponent(date),
      encodeURIComponent(subject),
      encodeURIComponent(String(period)),
    ].join("__"),
  ];

  for (const key of keys) {
    const value = selections[key];

    const selected = normalizeSelection(value);

    if (selected) {
      return selected;
    }
  }

  return "";
}

function normalizeSelection(value) {
  if (value && typeof value === "object") {
    return normalizeSelection(value.classGroup || value.class || value.value);
  }

  const raw = normalizeText(value);

  /*
    クラスなし
    */

  if (raw === CLASS_SELECTION_NONE) {
    return CLASS_SELECTION_NONE;
  }

  return extractClassGroups(raw)[0] || "";
}

function extractClassGroups(value) {
  if (!value) {
    return [];
  }

  const original = toHalfWidth(String(value).toUpperCase().trim());

  if (/^(全員|共通|合同|指定なし|なし|ALL)$/i.test(original)) {
    return [];
  }

  const groups = new Set();

  const rangePattern = /([A-Z])\s*[-–—〜～]\s*([A-Z])/g;

  for (const match of original.matchAll(rangePattern)) {
    const start = match[1].charCodeAt(0);

    const end = match[2].charCodeAt(0);

    for (let code = start; code <= end; code++) {
      groups.add(String.fromCharCode(code));
    }
  }

  const cleaned = original

    .replace(rangePattern, "")

    .replaceAll("クラス", "")

    .replaceAll("組", "")

    .replaceAll("班", "");

  (cleaned.match(/[A-Z]/g) || []).forEach((group) => groups.add(group));

  return [...groups].sort();
}

function isVisibleAttendanceRecord(record) {
  if (record?.attendanceNotificationTest !== true) {
    return true;
  }

  const test = userData?.attendanceNotificationTest || {};

  const expiresAt = getNotificationTestExpiryMs(test);

  if (
    test.enabled !== true ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now()
  ) {
    return false;
  }

  const activeTestId = normalizeText(test.testId);

  const recordTestId = normalizeText(record.testId);

  if (!activeTestId || !recordTestId) {
    return true;
  }

  return (
    recordTestId === activeTestId || recordTestId.startsWith(`${activeTestId}_`)
  );
}

/*
 * 通知テストは、退席通知を送信した後20分間だけ表示する。
 * 退席通知前は、従来の安全用 expiresAt を使う。
 */
function getNotificationTestExpiryMs(test) {
  const departureSentAt = test?.departureSentAt;

  const departureSentMs =
    typeof departureSentAt?.toMillis === "function"
      ? departureSentAt.toMillis()
      : Date.parse(departureSentAt || "");

  if (Number.isFinite(departureSentMs)) {
    return departureSentMs + 20 * 60 * 1000;
  }

  return Date.parse(test?.expiresAt || "");
}

function scheduleNotificationTestExpiryRefresh() {
  if (notificationTestExpiryTimer) {
    clearTimeout(notificationTestExpiryTimer);

    notificationTestExpiryTimer = null;
  }

  const test = userData?.attendanceNotificationTest || {};

  const expiresAt = getNotificationTestExpiryMs(test);

  if (
    test.enabled !== true ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now()
  ) {
    return;
  }

  const delay = Math.max(250, expiresAt - Date.now() + 250);

  notificationTestExpiryTimer = setTimeout(() => {
    refreshAttendance(true);
  }, delay);
}

/* ========================================
   出席記録取得
======================================== */

async function loadRecords() {
  const snap = await getDocs(
    collection(db, "users", studentNumber, "attendanceRecords"),
  );

  allRecords = snap.docs.map((item) => ({
    id: item.id,

    ...item.data(),
  }));

  records = new Map(
    allRecords

      .filter((item) => normalizeDate(item.date) === effectiveDate)

      .filter(isVisibleAttendanceRecord)

      .map((item) => [item.id, item]),
  );
}

/*
 * 過去の通知テストには testId がない記録があるため、
 * 当日の科目・時限でもフォールバックして集計する。
 */
function getRecordForLecture(lecture) {
  const direct = records.get(createAttendanceRecordId(lecture));

  if (direct) return direct;

  if (!lecture.attendanceNotificationTest) return null;

  return (
    allRecords.find(
      (item) =>
        isVisibleAttendanceRecord(item) &&
        normalizeDate(item.date) === effectiveDate &&
        Number(item.period) === Number(lecture.period) &&
        item.subject === lecture.subject &&
        item.attendanceNotificationTest === true &&
        (!item.testId || item.testId === lecture.testId),
    ) || null
  );
}

/* ========================================
   描画
======================================== */

function renderAll() {
  renderDate();

  renderLectureCards();

  renderSummary();

  renderRecordList();

  renderAttendanceTermSelector();

  renderSubjectAttendanceList();

  updateCurrentLectureStatus();
}

function renderDate() {
  if (!el.date) {
    return;
  }

  const date = createDate(effectiveDate);

  const formatted = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",

    month: "long",

    day: "numeric",

    weekday: "short",
  }).format(date);

  const test = userData.attendanceTestClock || {};

  const testActive =
    test.enabled === true &&
    normalizeDate(test.date) === effectiveDate &&
    Date.parse(test.expiresAt || "") > Date.now();

  el.date.textContent = testActive ? `${formatted}（表示テスト）` : formatted;
}

function renderLectureCards() {
  if (!el.todayList) {
    return;
  }

  if (!lectures.length) {
    const nextHtml = missingClasses.length ? renderMissingClassCard() : "";

    if (nextHtml !== lastLectureCardsHtml) {
      lastLectureCardsHtml = nextHtml;

      el.todayList.innerHTML = nextHtml;
    }

    if (el.empty) {
      el.empty.hidden = missingClasses.length > 0;
    }

    return;
  }

  if (el.empty) {
    el.empty.hidden = true;
  }

  const cards = lectures.map((lecture, index) =>
    renderLectureCard(lecture, index),
  );

  if (missingClasses.length) {
    cards.unshift(renderMissingClassCard());
  }

  const nextHtml = cards.join("");

  if (nextHtml === lastLectureCardsHtml) {
    return;
  }

  lastLectureCardsHtml = nextHtml;

  el.todayList.innerHTML = nextHtml;
}

function renderLectureCard(lecture, index) {
  let normalized;

  try {
    normalized = normalizeAttendanceLecture(lecture);
  } catch (error) {
    console.error("講義情報変換エラー:", lecture, error);

    return `
            <div class="card setting-card">

                <h3>
                    ${escapeHtml(lecture.subject || "科目名なし")}
                </h3>

                <p>
                    講義時間を確認できないため打刻できません。
                </p>

            </div>
        `;
  }

  const recordId = createAttendanceRecordId(normalized);

  const record = getRecordForLecture(lecture);

  const finalResult = resolveResult(record);

  const state = getAttendanceActionState({
    now: getAttendanceNow(normalized),

    lecture: normalized.lectureWindow,

    isTest: normalized.attendanceNotificationTest === true,
  });

  const hasStart = Boolean(record?.startStampedAt || record?.startKind);

  const hasEnd = Boolean(record?.endStampedAt || record?.endKind);

  const absent =
    record?.absenceTapped === true ||
    finalResult.status === ATTENDANCE_STATUS.ABSENT;

  const canStart = state.canStartStamp && !hasStart && !hasEnd && !absent;

  const canAbsent = state.canMarkAbsent && !hasStart && !hasEnd && !absent;

  const canEarly = state.canTapEarlyLeave && hasStart && !hasEnd && !absent;

  const canEnd = state.canEndStamp && hasStart && !hasEnd && !absent;

  const classText = normalized.classGroup
    ? `${normalized.classGroup}クラス`
    : "クラス指定なし";

  const roomText = [normalized.building, normalized.room]
    .filter(Boolean)
    .join(" ");

  return `
        <article
            class="card setting-card attendance-lecture-card">

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    gap:12px;
                    align-items:flex-start;
                ">

                <div>

                    <p
                        style="
                            margin:0 0 5px;
                            color:var(--subtext);
                            font-size:13px;
                        ">

                        ${normalized.period}限・
                        ${escapeHtml(normalized.startTime)}
                        〜
                        ${escapeHtml(normalized.endTime)}

                    </p>

                    <h3 style="margin:0;">

                        ${escapeHtml(normalized.subject)}

                    </h3>

                </div>

                ${statusBadge(finalResult)}

            </div>


            <p style="margin:12px 0 5px;">

                <b>クラス：</b>

                ${escapeHtml(classText)}

            </p>


            ${
              roomText
                ? `
                        <p style="margin:5px 0;">

                            <b>教室：</b>

                            ${escapeHtml(roomText)}

                        </p>
                    `
                : ""
            }


            ${
              normalized.teacher
                ? `
                        <p style="margin:5px 0;">

                            <b>担当：</b>

                            ${escapeHtml(normalized.teacher)}

                        </p>
                    `
                : ""
            }


            ${stampDetails(record)}


            <p
                style="
                    margin:13px 0;
                    color:var(--subtext);
                    font-size:13px;
                    line-height:1.6;
                ">

                ${escapeHtml(guidance(normalized, record, finalResult, state))}

            </p>


            <div
                style="
                    display:grid;
                    grid-template-columns:
                        repeat(
                            2,
                            minmax(0,1fr)
                        );
                    gap:10px;
                ">

                <button
                    type="button"
                    class="btn btn-primary"
                    data-attendance-action="start"
                    data-lecture-index="${index}"
                    ${canStart ? "" : "disabled"}>

                    ▶ 開始打刻

                </button>


                <button
                    type="button"
                    class="btn btn-secondary"
                    data-attendance-action="absent"
                    data-lecture-index="${index}"
                    ${canAbsent ? "" : "disabled"}>

                    ✕ 欠席

                </button>


                <button
                    type="button"
                    class="btn btn-danger"
                    data-attendance-action="early_leave"
                    data-lecture-index="${index}"
                    ${canEarly ? "" : "disabled"}>

                    ↪ 早退

                </button>


                <button
                    type="button"
                    class="btn btn-primary"
                    data-attendance-action="end"
                    data-lecture-index="${index}"
                    ${canEnd ? "" : "disabled"}>

                    ■ 終了打刻

                </button>

            </div>

        </article>
    `;
}

function renderMissingClassCard() {
  const list = missingClasses
    .map(
      (item) => `

                <li>

                    ${item.period}限

                    ${escapeHtml(item.subject)}

                    （${escapeHtml(item.options.join("・"))}）

                </li>

            `,
    )
    .join("");

  return `
        <div class="card setting-card">

            <h3>
                🏫 クラス選択が必要です
            </h3>

            <p>
                自分のクラスが未選択の講義は、
                打刻対象にできません。
            </p>

            <ul
                style="
                    padding-left:20px;
                    line-height:1.8;
                ">

                ${list}

            </ul>

            <button
                type="button"
                class="btn btn-primary"
                data-attendance-action="open_home">

                ホームでクラスを選択

            </button>

        </div>
    `;
}

/* ========================================
   今日の集計
======================================== */

function renderSummary() {
  const count = {
    present: 0,

    late: 0,

    early: 0,

    directAbsent: 0,

    timingAbsent: 0,

    convertedAbsent: 0,

    totalAbsent: 0,

    pending: 0,
  };

  const countedRecordIds = new Set();

  const addResultToCount = (result, record) => {
    switch (result.status) {
      case ATTENDANCE_STATUS.PRESENT:
        count.present++;
        break;

      case ATTENDANCE_STATUS.LATE:
        count.late++;
        break;

      case ATTENDANCE_STATUS.EARLY_LEAVE:
        count.early++;
        break;

      case ATTENDANCE_STATUS.LATE_AND_EARLY_LEAVE:
        count.late++;
        count.early++;
        break;

      case ATTENDANCE_STATUS.ABSENT:
        if (record?.absenceTapped === true || record?.manualEdited === true) {
          count.directAbsent++;
        } else {
          count.timingAbsent++;
        }
        break;

      default:
        count.pending++;
    }
  };

  for (const lecture of lectures) {
    let record;

    try {
      record = getRecordForLecture(lecture);
    } catch {
      count.pending++;

      continue;
    }

    const result = resolveResult(record);

    addResultToCount(result, record);

    if (record?.id) countedRecordIds.add(record.id);
  }

  count.convertedAbsent = Math.floor((count.late + count.early) / 3);

  count.totalAbsent =
    count.directAbsent + count.timingAbsent + count.convertedAbsent;

  if (el.present) {
    el.present.textContent = String(count.present);
  }

  if (el.late) {
    el.late.textContent = String(count.late);
  }

  if (el.early) {
    el.early.textContent = String(count.early);
  }

  if (el.absent) {
    el.absent.textContent = String(count.directAbsent + count.timingAbsent);
  }

  if (el.manualAbsent) {
    el.manualAbsent.textContent = String(count.directAbsent);
  }

  if (el.convertedAbsent) {
    el.convertedAbsent.textContent = String(count.convertedAbsent);
  }

  if (el.totalAbsent) {
    el.totalAbsent.textContent = String(count.totalAbsent);
  }

  if (el.pending) {
    el.pending.textContent = String(count.pending);
  }
}

/* ========================================
   今日の記録一覧
======================================== */

function renderRecordList() {
  if (!el.recordList) {
    return;
  }

  const rows = [...records.values()].sort(
    (left, right) => Number(left.period || 0) - Number(right.period || 0),
  );

  if (!rows.length) {
    el.recordList.innerHTML = `
            <div class="card setting-card">

                今日の打刻記録はまだありません。

            </div>
        `;

    return;
  }

  el.recordList.innerHTML = rows
    .map((record) => {
      const result = resolveResult(record);

      return `
                    <div class="card setting-card">

                        <div
                            style="
                                display:flex;
                                justify-content:space-between;
                                gap:12px;
                                align-items:flex-start;
                            ">

                            <div>

                                <b>

                                    ${escapeHtml(record.period || "-")}限

                                    ${escapeHtml(
                                      record.subject || "科目名なし",
                                    )}

                                </b>

                                <p
                                    style="
                                        margin:7px 0 0;
                                        color:var(--subtext);
                                        font-size:13px;
                                    ">

                                    開始：
                                    ${escapeHtml(
                                      formatTimestamp(record.startStampedAt),
                                    )}

                                    <br>

                                    終了：
                                    ${escapeHtml(
                                      formatTimestamp(record.endStampedAt),
                                    )}

                                </p>

                            </div>

                            ${statusBadge(result)}

                        </div>

                    </div>
                `;
    })
    .join("");
}

/* ========================================
   科目別出席状況
======================================== */

function resolveAcademicTerm(dateKey, data = {}) {
  const date = createDate(dateKey);

  const year = date.getFullYear();

  const month = date.getMonth() + 1;

  const academicYear = month >= 4 ? year : year - 1;

  const semester = month >= 4 && month <= 9 ? "前期" : "後期";

  return {
    academicYear,

    semester,

    grade: normalizeGrade(data.grade || localStorage.getItem("grade")),
  };
}

function resolveStudentAttendanceTerm(data = {}, systemData = {}) {
  const fallback = resolveAcademicTerm(effectiveDate, data);

  const configuredSemester = normalizeSemester(
    systemData.attendanceCurrentSemester,
  );

  return {
    ...fallback,

    semester:
      configuredSemester === "前期" || configuredSemester === "後期"
        ? configuredSemester
        : fallback.semester,
  };
}

function normalizeEnrolledSubjects(source) {
  /*
    Firestore QuerySnapshotでも
    すでに配列化された履修情報でも
    使えるようにする。
    */
  const sourceRows = Array.isArray(source)
    ? source
    : (source?.docs || []).map((item) => ({
        id: item.id,

        ...item.data(),
      }));

  const rows = sourceRows

    .filter((item) => {
      const status = normalizeText(item.status);

      return !status || status === "enrolled";
    })

    .map((item) => {
      const academicYear = Number(item.academicYear || 0);

      const semester = normalizeSemester(
        item.registeredSemester || item.semester,
      );

      const grade = resolveEnrollmentGrade(item.grade, academicYear);

      return {
        ...item,

        academicYear,

        semester,

        registeredSemester: semester,

        grade,

        name: normalizeText(
          item.name || item.subject || item.subjectKey || item.id,
        ),

        subjectId: normalizeText(item.subjectId || item.id),

        subjectKey: normalizeText(item.subjectKey || item.name || item.id),

        lectureCount: Math.max(0, Number(item.lectureCount || 0)),

        isPractical: item.isPractical === true,
      };
    })

    .filter((item) => Boolean(item.name));

  availableAttendanceTerms = createAvailableAttendanceTerms(rows);

  return rows.sort((left, right) => left.name.localeCompare(right.name, "ja"));
}

function resolveEnrollmentGrade(value, academicYear) {
  const direct = normalizeGrade(value);

  if (direct) {
    return direct;
  }

  const currentGrade = Number(
    normalizeGrade(userData.grade || localStorage.getItem("grade")),
  );

  if (!Number.isInteger(currentGrade) || currentGrade <= 0) {
    return "";
  }

  const currentAcademicYear = resolveAcademicTerm(
    effectiveDate,
    userData,
  ).academicYear;

  const targetYear = Number(academicYear || currentAcademicYear);

  const inferred = currentGrade - (currentAcademicYear - targetYear);

  return Number.isInteger(inferred) && inferred >= 1 && inferred <= 6
    ? String(inferred)
    : "";
}

function createAvailableAttendanceTerms(subjects) {
  const map = new Map();

  const addTerm = (academicYear, grade, semester) => {
    if (!academicYear || (semester !== "前期" && semester !== "後期")) {
      return;
    }

    const key = [academicYear, grade, semester].join("|");

    if (!map.has(key)) {
      map.set(key, {
        academicYear,
        grade,
        semester,
      });
    }
  };

  for (const item of subjects) {
    const academicYear = Number(item.academicYear || 0);

    const grade = normalizeGrade(item.grade);

    const semester = normalizeSemester(
      item.registeredSemester || item.semester,
    );

    if (semester === "通年") {
      addTerm(academicYear, grade, "前期");

      addTerm(academicYear, grade, "後期");

      continue;
    }

    addTerm(academicYear, grade, semester);
  }

  const order = {
    前期: 0,
    後期: 1,
  };

  return [...map.values()].sort(
    (left, right) =>
      left.academicYear - right.academicYear ||
      Number(left.grade || 0) - Number(right.grade || 0) ||
      order[left.semester] - order[right.semester],
  );
}

function doesSubjectMatchTerm(subject, term) {
  const year = Number(subject.academicYear || 0);

  const semester = normalizeSemester(
    subject.registeredSemester || subject.semester,
  );

  const grade = normalizeGrade(subject.grade);

  const termGrade = normalizeGrade(term.grade);

  return (
    (!year || year === Number(term.academicYear)) &&
    (!semester ||
      semester === "通年" ||
      semester === normalizeSemester(term.semester)) &&
    (!grade || !termGrade || grade === termGrade)
  );
}

function resolveAttendanceScheduleDate(row, term) {
  const direct = normalizeDate(row?.date);

  if (direct) {
    return direct;
  }

  const text = normalizeText(row?.day);

  if (!text) {
    return "";
  }

  const full = text.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);

  if (full) {
    return (
      `${full[1]}-` +
      `${full[2].padStart(2, "0")}-` +
      `${full[3].padStart(2, "0")}`
    );
  }

  const short = text.match(/(\d{1,2})月\s*(\d{1,2})日/);

  if (!short) {
    return "";
  }

  const month = Number(short[1]);

  const day = Number(short[2]);

  const academicYear = Number(term?.academicYear || 0);

  if (!academicYear) {
    return "";
  }

  const year = month >= 4 ? academicYear : academicYear + 1;

  return (
    `${year}-` +
    `${String(month).padStart(2, "0")}-` +
    `${String(day).padStart(2, "0")}`
  );
}

function normalizeAttendanceScheduleRows(data, scheduleId, term) {
  const rows = [];

  const seen = new Set();

  const addRow = (item, inheritedDate = "") => {
    if (!item || typeof item !== "object") {
      return;
    }

    const ownDate = resolveAttendanceScheduleDate(item, term);

    const date = ownDate || inheritedDate;

    /*
     * 日付グループの中に
     * schedules がある形式にも対応
     */
    if (Array.isArray(item.schedules)) {
      for (const child of item.schedules) {
        addRow(child, date);
      }
    }

    /*
     * 実際の講義行だけ追加
     */
    const subject = normalizeText(item.subject || item.name || item.title);

    const period = normalizePeriod(item.period);

    if (!date || !subject || !period) {
      return;
    }

    const classGroup = normalizeText(item.classGroup);

    const key = [
      date,
      normalizeSubjectIdentity(subject),
      period,
      classGroup,
    ].join("|");

    if (seen.has(key)) {
      return;
    }

    seen.add(key);

    rows.push({
      ...item,

      subject,

      period,

      date,

      scheduleDocumentId: scheduleId,
    });
  };

  /*
   * 現行形式
   */
  if (Array.isArray(data?.allDays)) {
    for (const entry of data.allDays) {
      addRow(entry);
    }
  }

  /*
   * 旧形式・互換形式
   */
  if (Array.isArray(data?.days)) {
    for (const entry of data.days) {
      addRow(entry);
    }
  }

  /*
   * 万一 schedules が
   * ドキュメント直下にある場合も対応
   */
  if (Array.isArray(data?.schedules)) {
    for (const entry of data.schedules) {
      addRow(entry);
    }
  }

  return rows.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      Number(left.period) - Number(right.period),
  );
}

function buildTermLectures(data, scheduleId, aliases, term, selections) {
  const rows = normalizeAttendanceScheduleRows(data, scheduleId, term);

  const grouped = new Map();

  for (const row of rows) {
    const date = row.date;

    if (!date || !isDateInAcademicTerm(date, term)) {
      continue;
    }

    const enrolledItem = attachEnrolledSubjectData(row, aliases);

    if (!enrolledItem) {
      continue;
    }

    if (!grouped.has(date)) {
      grouped.set(date, []);
    }

    grouped.get(date).push({
      ...enrolledItem,

      date,

      scheduleDocumentId: scheduleId,
    });
  }

  const result = [];

  for (const [date, source] of grouped) {
    if (date <= effectiveDate) {
      const classResult = buildStudentLectures(
        source,
        selections,
        date,
        scheduleId,
      );

      result.push(...classResult.lectures);
    } else {
      result.push(
        ...buildFutureAttendanceLectures(source, date, scheduleId, selections),
      );
    }
  }

  return result.sort(
    (left, right) =>
      String(left.date || "").localeCompare(String(right.date || "")) ||
      Number(left.period || 0) - Number(right.period || 0),
  );
}

function buildFutureAttendanceLectures(source, date, scheduleId, selections) {
  /*
   * まず通常のクラス選択処理を行う。
   *
   * すでにクラス選択されている予定なら
   * そのクラスをそのまま使う。
   */
  const selectedResult = buildStudentLectures(
    source,
    selections,
    date,
    scheduleId,
  );

  const selectedKeys = new Set(
    selectedResult.lectures.map(
      (lecture) =>
        `${normalizeSubjectIdentity(lecture.subject)}|${normalizePeriod(
          lecture.period,
        )}`,
    ),
  );

  const groups = new Map();

  for (const item of source) {
    const subject = normalizeText(item.subject || item.name || item.title);

    const period = normalizePeriod(item.period);

    if (!subject || !period) {
      continue;
    }

    const key = `${normalizeSubjectIdentity(subject)}|${period}`;

    /*
     * すでに本人のクラスが確定している講義は
     * generic予定を追加しない。
     */
    if (selectedKeys.has(key)) {
      continue;
    }

    if (!groups.has(key)) {
      groups.set(key, {
        subject,
        period,
        rows: [],
      });
    }

    groups.get(key).rows.push(item);
  }

  const futureLectures = [...selectedResult.lectures];

  for (const group of groups.values()) {
    const preferred = group.rows[0];

    futureLectures.push({
      ...preferred,

      date,

      subject: group.subject,

      period: group.period,

      scheduleDocumentId: preferred?.scheduleDocumentId || scheduleId,

      selectedClassGroup: "",

      classOptions: [
        ...new Set(
          group.rows.flatMap((row) => extractClassGroups(row.classGroup)),
        ),
      ],

      attendancePlanned: true,
    });
  }

  futureLectures.sort(
    (left, right) => Number(left.period || 0) - Number(right.period || 0),
  );

  return futureLectures;
}

function createAttendanceTermKey(term) {
  return [
    Number(term?.academicYear || 0),
    normalizeGrade(term?.grade),
    normalizeSemester(term?.semester),
  ].join("|");
}

function isSameAttendanceTerm(left, right) {
  if (Number(left?.academicYear || 0) !== Number(right?.academicYear || 0)) {
    return false;
  }

  if (
    normalizeSemester(left?.semester) !== normalizeSemester(right?.semester)
  ) {
    return false;
  }

  const leftGrade = normalizeGrade(left?.grade);

  const rightGrade = normalizeGrade(right?.grade);

  return !leftGrade || !rightGrade || leftGrade === rightGrade;
}

function attendanceTermOptionLabel(term) {
  const grade = normalizeGrade(term?.grade);

  const semester = normalizeSemester(term?.semester);

  if (grade) {
    return `${grade}年` + `${semester}`;
  }

  return `${term.academicYear}年度 ` + `${semester}`;
}

function renderAttendanceTermSelector() {
  if (!el.termSelect) {
    return;
  }

  const enrolledCurrent = availableAttendanceTerms.find((term) =>
    isSameAttendanceTerm(term, academicTerm),
  );

  const options = enrolledCurrent
    ? [...availableAttendanceTerms]
    : [
        {
          ...academicTerm,
          unavailable: true,
        },
        ...availableAttendanceTerms,
      ];

  el.termSelect.innerHTML = options
    .map((term) => {
      const key = createAttendanceTermKey(term);

      const suffix = term.unavailable ? "（未履修）" : "";

      return `
                    <option
                        value="${escapeHtml(key)}"
                        ${term.unavailable ? "disabled" : ""}>
                        ${escapeHtml(attendanceTermOptionLabel(term) + suffix)}
                    </option>
                `;
    })
    .join("");

  const selectedKey = createAttendanceTermKey(enrolledCurrent || academicTerm);

  el.termSelect.value = selectedKey;

  el.termSelect.disabled = availableAttendanceTerms.length === 0;

  if (el.enrollmentNotice) {
    el.enrollmentNotice.hidden = Boolean(enrolledCurrent);
  }
}

function handleAttendanceTermChange() {
  if (!el.termSelect) {
    return;
  }

  const selected = availableAttendanceTerms.find(
    (term) => createAttendanceTermKey(term) === el.termSelect.value,
  );

  if (!selected) {
    return;
  }

  selectedAttendanceTerm = {
    ...selected,
  };

  academicTerm = {
    ...selected,
  };

  rebuildTermLectures();

  renderAttendanceTermSelector();

  renderSubjectAttendanceList();
}

function rebuildTermLectures() {
  const scheduleId = resolveScheduleId(userData);

  termLectures =
    scheduleData && scheduleId
      ? buildTermLectures(
          scheduleData,
          scheduleId,
          enrolledAliases,
          academicTerm,
          userData.classSelections || {},
        )
      : [];
}

function renderSubjectAttendanceList() {
  if (!el.subjectList) {
    return;
  }

  if (el.subjectTermLabel) {
    const gradeText = academicTerm.grade ? `${academicTerm.grade}学年 ` : "";

    el.subjectTermLabel.textContent =
      `${academicTerm.academicYear}年度 ` +
      `${gradeText}` +
      `${academicTerm.semester}`;
  }

  const termRecords = allRecords.filter(
    (item) =>
      item.attendanceNotificationTest !== true &&
      isDateInAcademicTerm(normalizeDate(item.date), academicTerm),
  );

  const subjects = enrolledSubjects.filter((subject) =>
    doesSubjectMatchTerm(subject, academicTerm),
  );

  if (!subjects.length) {
    el.subjectList.innerHTML = "";

    if (el.subjectEmpty) {
      el.subjectEmpty.hidden = false;
    } else {
      el.subjectList.innerHTML = `
                <div class="card setting-card">
                    表示できる履修科目がありません。
                </div>
            `;
    }

    updateTermAbsenceSummary([]);

    return;
  }

  if (el.subjectEmpty) {
    el.subjectEmpty.hidden = true;
  }

  const statistics = subjects.map((subject) =>
    calculateSubjectAttendance(subject, termRecords),
  );

  el.subjectList.innerHTML = statistics
    .map(renderSubjectAttendanceCard)
    .join("");

  updateTermAbsenceSummary(statistics);
}

function createSubjectsFromRecords(rows) {
  const subjects = new Map();

  for (const row of rows) {
    const name = normalizeText(row.subject || row.subjectKey || row.subjectId);

    if (!name) {
      continue;
    }

    const key = normalizeSubjectIdentity(name);

    if (!subjects.has(key)) {
      subjects.set(key, {
        id: row.subjectId || key,

        subjectId: row.subjectId || "",

        subjectKey: row.subjectKey || name,

        name,

        lectureCount: 0,

        isPractical: false,
      });
    }
  }

  return [...subjects.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "ja"),
  );
}

function calculateSubjectAttendance(subject, termRecords) {
  const subjectRecords = termRecords.filter((record) =>
    doesRecordMatchSubject(record, subject),
  );

  const plannedLectures = termLectures.filter((lecture) =>
    doesLectureMatchSubject(lecture, subject),
  );

  const sessions = createSubjectSessionRows(subjectRecords, plannedLectures);

  let present = 0;

  let late = 0;

  let early = 0;

  let directAbsent = 0;

  let timingAbsent = 0;

  let pending = 0;

  for (const session of sessions) {
    if (!session.record) {
      if (!isFutureAttendanceSession(session)) {
        pending++;
      }

      continue;
    }

    const result = session.result;

    if (result.status === ATTENDANCE_STATUS.PRESENT) {
      present++;

      continue;
    }

    if (result.status === ATTENDANCE_STATUS.LATE) {
      late++;

      continue;
    }

    if (result.status === ATTENDANCE_STATUS.EARLY_LEAVE) {
      early++;

      continue;
    }

    if (result.status === ATTENDANCE_STATUS.LATE_AND_EARLY_LEAVE) {
      late++;

      early++;

      continue;
    }

    if (result.status === ATTENDANCE_STATUS.ABSENT) {
      if (session.record.absenceTapped === true) {
        directAbsent++;
      } else {
        timingAbsent++;
      }

      continue;
    }

    pending++;
  }

  const lateEarlyTotal = late + early;

  const convertedAbsent = Math.floor(lateEarlyTotal / 3);

  const conversionRemainder = lateEarlyTotal % 3;

  const attendedBeforeConversion =
    present + countAttendedIrregularSessions(sessions);

  const attended = Math.max(0, attendedBeforeConversion - convertedAbsent);

  const totalLectures = sessions.filter(
    (session) => session.record || session.result,
  ).length;

  const totalAbsent = directAbsent + timingAbsent + convertedAbsent;

  const displayTotalLectures = sessions.length;

  const attendanceRate =
    totalLectures > 0
      ? Math.round((attended / totalLectures) * 1000) / 10
      : null;

  return {
    subject,

    sessions,

    present,

    possibleAbsentCount: calculatePossibleAbsentCount(
      totalLectures,
      attended,
      subject.isPractical,
    ),

    late,

    early,

    directAbsent,

    timingAbsent,

    convertedAbsent,

    conversionRemainder,

    lateEarlyTotal,

    totalAbsent,

    pending,

    attended,

    totalLectures: displayTotalLectures,

    calculationTotalLectures: totalLectures,

    attendanceRate,

    requiredRate: subject.isPractical ? 80 : 66.7,
  };
}

function countAttendedIrregularSessions(sessions) {
  return sessions.filter((session) => {
    const status = session.result?.status;

    return (
      status === ATTENDANCE_STATUS.LATE ||
      status === ATTENDANCE_STATUS.EARLY_LEAVE ||
      status === ATTENDANCE_STATUS.LATE_AND_EARLY_LEAVE
    );
  }).length;
}

function createSubjectSessionRows(subjectRecords, plannedLectures) {
  const sessions = new Map();

  for (const lecture of plannedLectures) {
    const date = normalizeDate(lecture.date);

    if (!date) {
      continue;
    }

    const period = normalizePeriod(lecture.period);

    const key = createSessionKey(date, period);

    sessions.set(key, {
      date,

      period,

      lecture,

      record: null,

      result: null,
    });
  }

  for (const record of subjectRecords) {
    const date = normalizeDate(record.date);

    if (!date) {
      continue;
    }

    const period = normalizePeriod(record.period);

    let key = createSessionKey(date, period);

    if (!sessions.has(key) && !period) {
      const dateKey = [...sessions.keys()].find((item) =>
        item.startsWith(`${date}|`),
      );

      if (dateKey) {
        key = dateKey;
      }
    }

    const existing = sessions.get(key) || {
      date,

      period,

      lecture: null,
    };

    sessions.set(key, {
      ...existing,

      record,

      result: resolveResult(record),
    });
  }

  return [...sessions.values()].sort(
    (left, right) =>
      right.date.localeCompare(left.date) ||
      Number(right.period || 0) - Number(left.period || 0),
  );
}

function isFutureAttendanceSession(session) {
  if (!session) {
    return false;
  }

  const date = normalizeDate(session.date);

  if (!date) {
    return false;
  }

  if (date > effectiveDate) {
    return true;
  }

  if (date < effectiveDate) {
    return false;
  }

  /*
   * 今日の講義なら
   * 開始打刻開始時刻より前は「予定」。
   */
  if (session.lecture) {
    try {
      const lecture = normalizeAttendanceLecture({
        ...session.lecture,

        date,

        period: session.period || session.lecture.period,
      });

      return (
        getAttendanceNow(lecture).getTime() <
        lecture.lectureWindow.startNotificationAt.getTime()
      );
    } catch {
      return false;
    }
  }

  return false;
}

function renderSubjectAttendanceCard(stats) {
  const rateText =
    stats.attendanceRate === null
      ? "--%"
      : `${formatRate(stats.attendanceRate)}%`;

  const thresholdWarning =
    stats.attendanceRate !== null && stats.attendanceRate < stats.requiredRate;

  const conversionText =
    stats.conversionRemainder === 0
      ? stats.lateEarlyTotal > 0
        ? "次の換算欠席まであと3回"
        : "遅刻・早退は3回で欠席1回分"
      : `次の換算欠席まであと${3 - stats.conversionRemainder}回`;

  return `
        <details
            class="card setting-card attendance-subject-card">

            <summary
                class="attendance-subject-summary">

                <div
                    class="attendance-subject-name-block">

                    ${
                      stats.possibleAbsentCount !== null
                        ? `

                    <p class="attendance-subject-limit">

                    あと
                    ${stats.possibleAbsentCount}
                    回欠席すると
                    評価資格なし

                    </p>

                    `
                        : ""
                    }

                    <strong>
                        ${escapeHtml(stats.subject.name)}
                    </strong>

                    <span>
                        遅刻 ${stats.late}回・
                        早退 ${stats.early}回
                    </span>

                    <span>
                        時間割登録
                        ${stats.totalLectures}回
                    </span>

                </div>


                <div
                    class="attendance-subject-rate-block ${
                      thresholdWarning ? "is-warning" : ""
                    }">

                    <strong>
                        ${stats.attended} / ${stats.calculationTotalLectures}
                    </strong>

                    <span>
                        ${rateText}
                    </span>

                </div>

            </summary>


            <div
                class="attendance-subject-detail">

                <div
                    class="attendance-subject-counts">

                    ${renderSubjectCount("出席", stats.attended)}

                    ${renderSubjectCount("遅刻", stats.late)}

                    ${renderSubjectCount("早退", stats.early)}

                    ${renderSubjectCount("欠席操作", stats.directAbsent)}

                    ${renderSubjectCount("打刻判定欠席", stats.timingAbsent)}

                    ${renderSubjectCount("換算欠席", stats.convertedAbsent)}

                    ${renderSubjectCount(
                      "欠席合計",
                      stats.totalAbsent,
                      "is-danger",
                    )}

                    ${renderSubjectCount("未打刻・判定待ち", stats.pending)}

                </div>


                <p
                    class="attendance-subject-conversion">

                    遅刻・早退合計
                    ${stats.lateEarlyTotal}回

                    ／

                    換算欠席
                    ${stats.convertedAbsent}回

                    <br>

                    ${escapeHtml(conversionText)}

                </p>


                ${
                  thresholdWarning
                    ? `
                            <p
                                class="attendance-subject-warning">

                                現在の出席率が、${
                                  stats.subject.isPractical
                                    ? "実習科目の目安80%"
                                    : "通常科目の目安66.7%"
                                }を下回っています。

                            </p>
                        `
                    : ""
                }


                <div
                    class="attendance-date-list">

                    ${
                      stats.sessions.length
                        ? stats.sessions.map(renderSubjectSessionRow).join("")
                        : `
                                <p class="empty-text">
                                    受講日の記録はまだありません。
                                </p>
                            `
                    }

                </div>

            </div>

        </details>
    `;
}

function renderSubjectCount(label, value, className = "") {
  return `
        <span class="${className}">

            <small>
                ${escapeHtml(label)}
            </small>

            <b>
                ${Number(value || 0)}回
            </b>

        </span>
    `;
}

function renderSubjectSessionRow(session) {
  const display = getSubjectSessionDisplay(session);

  const editLocked = !isAttendanceSessionEditable(session, display);

  return `
        <div
            class="attendance-date-row">

            <div>

                <time>
                    ${escapeHtml(formatAttendanceDate(session.date))}
                </time>

                ${
                  session.period
                    ? `
                            <small>
                                ${session.period}限
                                ${
                                  session.lecture?.startTime &&
                                  session.lecture?.endTime
                                    ? `・${escapeHtml(
                                        session.lecture.startTime,
                                      )}〜${escapeHtml(
                                        session.lecture.endTime,
                                      )}`
                                    : ""
                                }
                            </small>
                        `
                    : ""
                }

            </div>

            <button
                type="button"
                class="attendance-date-status ${display.className}"
                data-edit-attendance="${escapeHtml(session.date)}"
                data-period="${escapeHtml(session.period || "")}"
                data-subject="${escapeHtml(
                  session.lecture?.subject || session.record?.subject || "",
                )}"
                data-current-status="${escapeHtml(display.label)}"
                data-record-id="${escapeHtml(session.record?.id || "")}"
                data-edit-locked="${editLocked ? "true" : "false"}">

                ${escapeHtml(display.label)}

            </button>

        </div>
    `;
}

function isAttendanceSessionEditable(session, display) {
  /*
    未打刻・判定待ちは編集不可。
    */
  if (display?.className === "is-pending") {
    return false;
  }

  const sessionDate = normalizeDate(session?.date);

  if (!sessionDate) {
    return false;
  }

  const now = getAttendanceNow(session.lecture);

  const today = localDateKey(now);

  /*
    明日以降の講義は編集不可。
    */
  if (sessionDate > today) {
    return false;
  }

  /*
    過去の講義で、
    判定済みなら編集可能。
    */
  if (sessionDate < today) {
    return true;
  }

  /*
    今日の講義。

    まだ講義開始前なら
    編集不可。
    */
  if (session?.lecture) {
    try {
      const lecture = normalizeAttendanceLecture({
        ...session.lecture,

        date: sessionDate,

        period: session.period || session.lecture.period,
      });

      if (now < lecture.lectureWindow.lectureStart) {
        return false;
      }
    } catch (error) {
      console.warn("編集可否判定エラー:", error);

      return false;
    }
  }

  return true;
}

function getSubjectSessionDisplay(session) {
  if (!session.record) {
    if (isFutureAttendanceSession(session)) {
      return {
        label: "予定",

        className: "is-scheduled",
      };
    }

    return {
      label: "未打刻",

      className: "is-pending",
    };
  }

  const status = session.result?.status;

  if (status === ATTENDANCE_STATUS.PRESENT) {
    return {
      label: "出席",

      className: "is-present",
    };
  }

  if (status === ATTENDANCE_STATUS.LATE) {
    return {
      label: "遅刻",

      className: "is-late",
    };
  }

  if (status === ATTENDANCE_STATUS.EARLY_LEAVE) {
    return {
      label: "早退",

      className: "is-early",
    };
  }

  if (status === ATTENDANCE_STATUS.LATE_AND_EARLY_LEAVE) {
    return {
      label: "遅刻・早退",

      className: "is-late-early",
    };
  }

  if (status === ATTENDANCE_STATUS.ABSENT) {
    return {
      label:
        session.record.absenceTapped === true
          ? "欠席（欠席操作）"
          : "欠席（打刻判定）",

      className: "is-absent",
    };
  }

  return {
    label: session.result?.label || "判定待ち",

    className: "is-pending",
  };
}

function updateTermAbsenceSummary(statistics) {
  const converted = statistics.reduce(
    (total, item) => total + item.convertedAbsent,
    0,
  );

  const directAndTiming = statistics.reduce(
    (total, item) => total + item.directAbsent + item.timingAbsent,
    0,
  );

  if (el.convertedAbsent) {
    el.convertedAbsent.textContent = String(converted);
  }

  if (el.totalAbsent) {
    el.totalAbsent.textContent = String(converted + directAndTiming);
  }

  if (el.conversionText) {
    el.conversionText.textContent =
      "遅刻・早退は科目ごとに3回で欠席1回分として換算します。";
  }
}

function doesRecordMatchSubject(record, subject) {
  const recordKeys = createSubjectKeys([
    record.subjectId,

    record.subjectKey,

    record.subject,

    record.name,

    record.title,
  ]);

  const subjectKeys = createSubjectKeys([
    subject.id,

    subject.subjectId,

    subject.subjectKey,

    subject.name,
  ]);

  return [...recordKeys].some((key) => subjectKeys.has(key));
}

function doesLectureMatchSubject(lecture, subject) {
  return doesRecordMatchSubject(lecture, subject);
}

function createSubjectKeys(values) {
  return new Set(
    values

      .map(normalizeSubjectIdentity)

      .filter(Boolean),
  );
}

function normalizeSubjectIdentity(value) {
  return normalizeText(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　・･()（）【】\[\]「」『』]/g, "");
}

function createSessionKey(date, period) {
  return `${date}|` + `${Number(period || 0)}`;
}

function normalizeSemester(value) {
  const text = normalizeText(value);

  if (["前期", "1学期", "第一学期", "first", "spring"].includes(text)) {
    return "前期";
  }

  if (
    ["後期", "2学期", "第二学期", "second", "fall", "autumn"].includes(text)
  ) {
    return "後期";
  }

  if (["通年", "年間", "year"].includes(text)) {
    return "通年";
  }

  return text;
}

function normalizeGrade(value) {
  return normalizeText(value).replace("年", "");
}

function isDateInAcademicTerm(dateKey, term) {
  if (!dateKey) {
    return false;
  }

  /*
   * 学期の日付を
   * 4/1・10/1で固定しない。
   *
   * 表示対象の学期は
   * 履修登録データ側で判定するため、
   * ここでは同一年度内かだけ確認する。
   */
  const start = `${term.academicYear}-04-01`;

  const end = `${term.academicYear + 1}-03-31`;

  return dateKey >= start && dateKey <= end;
}

function formatAttendanceDate(dateKey) {
  if (!dateKey) {
    return "日付不明";
  }

  const date = createDate(dateKey);

  const weekday = "日月火水木金土"[date.getDay()];

  return (
    `${date.getFullYear()}/` +
    `${String(date.getMonth() + 1).padStart(2, "0")}/` +
    `${String(date.getDate()).padStart(2, "0")}` +
    `（${weekday}）`
  );
}

function formatRate(value) {
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(1);
}

/* ========================================
   判定表示
======================================== */

function resolveResult(record) {
  if (!record) {
    return {
      status: ATTENDANCE_STATUS.PENDING,

      label: "未打刻",

      finalized: false,
    };
  }

  /*
     手動編集された判定を最優先する。
     未打刻へは戻せないため、
     manualEditedがtrueなら必ず編集結果を使用する。
    */

  if (record.manualEdited === true && record.editedStatus) {
    return getManualAttendanceResult(record.editedStatus);
  }

  try {
    return recalculateAttendanceStatus(record);
  } catch (error) {
    console.error("出席再判定エラー:", error);

    return {
      status: record.status || ATTENDANCE_STATUS.PENDING,

      label: record.statusLabel || "判定待ち",

      finalized: record.statusFinalized === true,
    };
  }
}

function getManualAttendanceResult(status) {
  switch (status) {
    case "present":
      return {
        status: ATTENDANCE_STATUS.PRESENT,

        label: "出席",

        finalized: true,

        manuallyEdited: true,
      };

    case "late":
      return {
        status: ATTENDANCE_STATUS.LATE,

        label: "遅刻",

        finalized: true,

        manuallyEdited: true,
      };

    case "early_leave":
      return {
        status: ATTENDANCE_STATUS.EARLY_LEAVE,

        label: "早退",

        finalized: true,

        manuallyEdited: true,
      };

    case "absent":
      return {
        status: ATTENDANCE_STATUS.ABSENT,

        label: "欠席",

        finalized: true,

        manuallyEdited: true,
      };

    default:
      return {
        status: ATTENDANCE_STATUS.PENDING,

        label: "判定待ち",

        finalized: false,

        manuallyEdited: true,
      };
  }
}

function statusBadge(result) {
  const style = statusStyle(result.status);

  return `
        <span
            style="
                display:inline-flex;
                min-width:72px;
                justify-content:center;
                padding:6px 10px;
                border-radius:999px;
                font-size:12px;
                font-weight:900;
                background:${style.background};
                color:${style.color};
            ">

            ${escapeHtml(result.label)}

        </span>
    `;
}

function statusStyle(status) {
  if (status === ATTENDANCE_STATUS.PRESENT) {
    return {
      background: "#dcfce7",

      color: "#166534",
    };
  }

  if (status === ATTENDANCE_STATUS.LATE) {
    return {
      background: "#fef3c7",

      color: "#92400e",
    };
  }

  if (status === ATTENDANCE_STATUS.EARLY_LEAVE) {
    return {
      background: "#ffedd5",

      color: "#9a3412",
    };
  }

  if (status === ATTENDANCE_STATUS.LATE_AND_EARLY_LEAVE) {
    return {
      background: "#fce7f3",

      color: "#9d174d",
    };
  }

  if (status === ATTENDANCE_STATUS.ABSENT) {
    return {
      background: "#fee2e2",

      color: "#991b1b",
    };
  }

  return {
    background: "#e2e8f0",

    color: "#334155",
  };
}

function stampDetails(record) {
  return `
        <div
            style="
                margin-top:12px;
                padding:10px 12px;
                border-radius:10px;
                background:
                    var(
                        --card-bg,
                        #f4f6fa
                    );
                font-size:13px;
                line-height:1.7;
            ">

            開始：
            ${escapeHtml(formatTimestamp(record?.startStampedAt))}

            ${record?.startLabel ? `（${escapeHtml(record.startLabel)}）` : ""}

            <br>

            終了：
            ${escapeHtml(formatTimestamp(record?.endStampedAt))}

            ${record?.endLabel ? `（${escapeHtml(record.endLabel)}）` : ""}

        </div>
    `;
}

function guidance(normalized, record, result, state) {
  if (result.status === ATTENDANCE_STATUS.ABSENT) {
    return (
      "欠席として記録されています。" +
      "変更が必要な場合は管理者へ確認してください。"
    );
  }

  if (record?.endStampedAt || record?.endKind) {
    return "開始・終了打刻が完了しています。";
  }

  if (record?.startStampedAt || record?.startKind) {
    if (state.canEndStamp) {
      return "終了打刻が可能です。" + "講義終了後10分までに押してください。";
    }

    if (state.canTapEarlyLeave) {
      return "途中で退出する場合は早退を押してください。";
    }

    return "開始打刻済みです。" + "終了打刻の開始時刻までお待ちください。";
  }

  if (state.canStartStamp) {
    return classifyStartStamp({
      stampAt: getAttendanceNow(normalized),

      lecture: normalized.lectureWindow,
    }).message;
  }

  if (
    getAttendanceNow(normalized).getTime() <
    normalized.lectureWindow.startNotificationAt.getTime()
  ) {
    return (
      `開始打刻は` +
      `${formatTime(
        normalized.lectureWindow.startNotificationAt,
      )}から可能です。`
    );
  }

  return "打刻期限が終了しています。";
}

/* ========================================
   現在の講義
======================================== */

function updateCurrentLectureStatus() {
  if (!el.currentStatus) {
    return;
  }

  if (!lectures.length) {
    el.currentStatus.textContent = missingClasses.length
      ? "クラス選択が完了すると" + "打刻対象の講義が表示されます。"
      : "今日の履修済み講義はありません。";

    return;
  }

  const active = lectures.find((lecture) => {
    try {
      const normalizedLecture = normalizeAttendanceLecture(lecture);

      const now = getAttendanceNow(normalizedLecture);

      return (
        now >= normalizedLecture.lectureWindow.startNotificationAt &&
        now <= normalizedLecture.lectureWindow.endStampExpiresAt
      );
    } catch {
      return false;
    }
  });

  if (active) {
    el.currentStatus.textContent =
      `現在の打刻対象：` + `${active.period}限 ` + `${active.subject}`;

    return;
  }

  const next = lectures.find((lecture) => {
    try {
      const normalizedLecture = normalizeAttendanceLecture(lecture);

      return (
        getAttendanceNow(normalizedLecture) <
        normalizedLecture.lectureWindow.startNotificationAt
      );
    } catch {
      return false;
    }
  });

  el.currentStatus.textContent = next
    ? `次の講義：` + `${next.period}限 ` + `${next.subject}`
    : "今日の打刻可能な講義は終了しました。";
}

/* ========================================
   確認ポップアップ
======================================== */

function openConfirmation(action, lecture) {
  let normalized;

  try {
    normalized = normalizeAttendanceLecture(lecture);
  } catch {
    showToast("講義情報を確認できませんでした。");

    return;
  }

  const content = confirmationContent(action, normalized);

  if (!content) {
    return;
  }

  pendingAction = {
    action,

    lecture,
  };

  if (el.confirmIcon) {
    el.confirmIcon.textContent = content.icon;
  }

  if (el.confirmTitle) {
    el.confirmTitle.textContent = content.title;
  }

  if (el.confirmSubject) {
    el.confirmSubject.textContent =
      `${normalized.period}限 ` + `${normalized.subject}`;
  }

  if (el.confirmDetail) {
    el.confirmDetail.textContent = content.detail;
  }

  if (el.confirmButton) {
    el.confirmButton.textContent = content.button;
  }

  openOverlay(el.confirmOverlay);
}

function confirmationContent(action, normalized) {
  if (action === "start") {
    const result = classifyStartStamp({
      stampAt: getAttendanceNow(normalized),

      lecture: normalized.lectureWindow,
    });

    return {
      icon: "▶",

      title: "開始打刻しますか？",

      detail: `現在の時刻では「${result.label}」として記録されます。`,

      button: "開始打刻する",
    };
  }

  if (action === "end" || action === "early_leave") {
    const result = classifyEndStamp({
      stampAt: getAttendanceNow(normalized),

      lecture: normalized.lectureWindow,
    });

    return {
      icon: action === "early_leave" ? "↪" : "■",

      title:
        action === "early_leave"
          ? "退出を打刻しますか？"
          : "終了打刻しますか？",

      detail: `実際の打刻時刻により「${result.label}」として記録されます。`,

      button: action === "early_leave" ? "退出を打刻する" : "終了打刻する",
    };
  }

  if (action === "absent") {
    return {
      icon: "✕",

      title: "欠席として登録しますか？",

      detail: "欠席を押すと、この講義は欠席として確定します。",

      button: "欠席を確定する",
    };
  }

  return null;
}

/* ========================================
   打刻実行
======================================== */

async function executeAction() {
  if (!pendingAction || !el.confirmButton) {
    return;
  }

  const { action, lecture } = pendingAction;

  const original = el.confirmButton.textContent;

  el.confirmButton.disabled = true;

  el.confirmButton.textContent = "保存中...";

  try {
    const source = ATTENDANCE_STAMP_SOURCE.ATTENDANCE_PAGE;

    let result;

    if (action === "start") {
      result = await stampAttendanceStart({
        lecture,

        source,
      });
    }

    if (action === "end") {
      result = await stampAttendanceEnd({
        lecture,

        source,
      });
    }

    if (action === "early_leave") {
      result = await stampAttendanceEarlyLeave({
        lecture,

        source,
      });
    }

    if (action === "absent") {
      result = await markAttendanceAbsent({
        lecture,

        source,
      });
    }

    closeConfirmation();

    if (result?.ok) {
      await loadRecords();

      renderAll();
    }

    showResult(
      result?.ok === true,

      result || {
        message: "処理を完了できませんでした。",
      },
    );
  } catch (error) {
    console.error("出席操作エラー:", error);

    closeConfirmation();

    showResult(false, {
      message: "打刻を保存できませんでした。",
    });
  } finally {
    el.confirmButton.disabled = false;

    el.confirmButton.textContent = original || "打刻する";
  }
}

function closeConfirmation() {
  closeOverlay(el.confirmOverlay);

  pendingAction = null;
}

function showResult(success, result) {
  const label = result?.finalResult?.label || result?.judgement?.label || "";

  if (el.resultIcon) {
    el.resultIcon.textContent = success ? "✅" : "⚠️";
  }

  if (el.resultLabel) {
    el.resultLabel.textContent = success ? "打刻結果" : "打刻できませんでした";
  }

  if (el.resultTitle) {
    el.resultTitle.textContent = success
      ? "記録しました"
      : "操作を確認してください";
  }

  if (el.resultStatus) {
    el.resultStatus.textContent = label;
  }

  if (el.resultMessage) {
    el.resultMessage.textContent =
      result?.message || "処理を完了できませんでした。";
  }

  openOverlay(el.resultOverlay);
}

/* ========================================
   通知
======================================== */

function updateNotificationState() {
  if (!el.notificationState || !el.enableNotifications) {
    return;
  }

  if (!("Notification" in window)) {
    el.notificationState.textContent = "このブラウザは通知に対応していません。";

    el.enableNotifications.hidden = true;

    return;
  }

  if (Notification.permission === "granted") {
    el.notificationState.textContent = "出席通知は有効です。";

    el.enableNotifications.hidden = true;

    return;
  }

  if (Notification.permission === "denied") {
    el.notificationState.textContent =
      "通知が拒否されています。端末の設定から許可してください。";

    el.enableNotifications.hidden = true;

    return;
  }

  el.notificationState.textContent = "出席通知はまだ有効になっていません。";

  el.enableNotifications.hidden = false;
}

async function enableNotifications() {
  if (!el.enableNotifications) {
    return;
  }

  const original = el.enableNotifications.textContent;

  el.enableNotifications.disabled = true;

  el.enableNotifications.textContent = "設定中...";

  try {
    await setupAttendanceWebPush();

    updateNotificationState();

    showToast(
      Notification.permission === "granted"
        ? "出席通知を有効にしました。"
        : "通知の許可を完了できませんでした。",
    );
  } catch (error) {
    console.error("出席通知設定エラー:", error);

    showToast("出席通知を設定できませんでした。");
  } finally {
    el.enableNotifications.disabled = false;

    el.enableNotifications.textContent = original || "🔔 出席通知を有効にする";
  }
}

/* ========================================
   時計
======================================== */

function startClock() {
  if (!el.time) {
    return;
  }

  const update = () => {
    el.time.textContent = new Intl.DateTimeFormat("ja-JP", {
      hour: "2-digit",

      minute: "2-digit",

      second: "2-digit",

      hour12: false,
    }).format(new Date());
  };

  update();

  setInterval(update, 1000);
}

/* ========================================
   日付
======================================== */

function resolveEffectiveDate(data) {
  const test = data?.attendanceTestClock || {};

  const testDate = normalizeDate(test.date);

  if (
    test.enabled === true &&
    testDate &&
    Date.parse(test.expiresAt || "") > Date.now()
  ) {
    return testDate;
  }

  return localDateKey();
}

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  return [
    date.getFullYear(),

    String(date.getMonth() + 1).padStart(2, "0"),

    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function normalizeDate(value) {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return localDateKey(value);
  }

  const cleaned = String(value)
    .trim()

    .replace(/年|\.|\//g, "-")

    .replace(/月/g, "-")

    .replace(/日/g, "")

    .replace(/-+/g, "-");

  const full = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (full) {
    return (
      `${full[1]}-` +
      `${full[2].padStart(2, "0")}-` +
      `${full[3].padStart(2, "0")}`
    );
  }

  const short = cleaned.match(/^(\d{1,2})-(\d{1,2})$/);

  if (short) {
    return (
      `${new Date().getFullYear()}-` +
      `${short[1].padStart(2, "0")}-` +
      `${short[2].padStart(2, "0")}`
    );
  }

  return "";
}

function createDate(key) {
  const [year, month, day] = key

    .split("-")

    .map(Number);

  return new Date(
    year,

    month - 1,

    day,

    12,

    0,

    0,

    0,
  );
}

function normalizePeriod(value) {
  const period = Number(
    String(value ?? "")
      /*
       * 大学PDFは「１限」のように全角数字で
       * 保存される場合がある。
       */
      .normalize("NFKC")

      .replace("限", "")

      .trim(),
  );

  return Number.isInteger(period) ? period : 0;
}

/* ========================================
   時刻表示
======================================== */

function formatTimestamp(value) {
  if (value && typeof value.toDate === "function") {
    return formatTime(value.toDate());
  }

  if (
    value instanceof Date ||
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return formatTime(date);
    }
  }

  return "未打刻";
}

function formatTime(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return (
    `${String(date.getHours()).padStart(2, "0")}:` +
    `${String(date.getMinutes()).padStart(2, "0")}`
  );
}

/* ========================================
   UI共通
======================================== */

function openOverlay(overlay) {
  if (!overlay) {
    return;
  }

  overlay.hidden = false;

  overlay.classList.add("show");

  overlay.style.zIndex = "100000";
}

function closeOverlay(overlay) {
  if (!overlay) {
    return;
  }

  overlay.classList.remove("show");

  overlay.hidden = true;
}

function setRefreshState(refreshing) {
  if (!el.refresh) {
    return;
  }

  el.refresh.disabled = refreshing;

  el.refresh.textContent = refreshing ? "更新中..." : "更新";
}

function showToast(message) {
  if (!el.toast) {
    return;
  }

  el.toast.textContent = message;

  el.toast.hidden = false;

  el.toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    el.toast.classList.remove("show");

    el.toast.hidden = true;
  }, 2600);
}

function normalizeText(value) {
  return (
    String(value ?? "")
      /* 全角の学年・時限・英数字も同じ値として照合する */
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function toHalfWidth(value) {
  return String(value).replace(/[Ａ-Ｚ]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0xfee0),
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

function openAttendanceEditDialog(data) {
  if (!el.editOverlay) {
    showToast("編集画面を開けませんでした。");

    return;
  }

  pendingAttendanceEdit = {
    date: normalizeDate(data.date),

    period: normalizePeriod(data.period),

    subject: normalizeText(data.subject),

    currentStatus: normalizeText(data.currentStatus) || "未打刻",

    recordId: normalizeText(data.recordId),
  };

  if (el.editSubject) {
    el.editSubject.textContent = pendingAttendanceEdit.subject || "科目名なし";
  }

  if (el.editLectureInfo) {
    const periodText = pendingAttendanceEdit.period
      ? `${pendingAttendanceEdit.period}限`
      : "時限不明";

    el.editLectureInfo.textContent = `${formatAttendanceDate(
      pendingAttendanceEdit.date,
    )}・${periodText}`;
  }

  if (el.editCurrentStatus) {
    el.editCurrentStatus.textContent = pendingAttendanceEdit.currentStatus;
  }

  if (el.editReason) {
    el.editReason.value = "";
  }

  if (el.editError) {
    el.editError.hidden = true;

    el.editError.textContent = "";
  }

  document
    .querySelectorAll('input[name="attendanceEditStatus"]')
    .forEach((input) => {
      input.checked = false;
    });

  el.editOverlay.hidden = false;

  document.body.style.overflow = "hidden";
}

function closeAttendanceEditDialog() {
  if (el.editOverlay) {
    el.editOverlay.hidden = true;
  }

  document.body.style.overflow = "";

  pendingAttendanceEdit = null;

  if (el.editReason) {
    el.editReason.value = "";
  }

  if (el.editError) {
    el.editError.hidden = true;

    el.editError.textContent = "";
  }

  document
    .querySelectorAll('input[name="attendanceEditStatus"]')
    .forEach((input) => {
      input.checked = false;
    });
}

async function executeAttendanceEdit() {
  if (!pendingAttendanceEdit || !el.editSave) {
    return;
  }

  const selected = document.querySelector(
    'input[name="attendanceEditStatus"]:checked',
  );

  const status = selected?.value || "";

  const reason = normalizeText(el.editReason?.value);

  if (!status || !reason) {
    if (el.editError) {
      el.editError.textContent = "変更後の判定と編集理由を入力してください。";

      el.editError.hidden = false;
    }

    return;
  }

  const originalText = el.editSave.textContent;

  el.editSave.disabled = true;

  el.editSave.textContent = "保存中...";

  try {
    await saveAttendanceEdit({
      ...pendingAttendanceEdit,

      status,

      reason,
    });

    closeAttendanceEditDialog();

    showToast("出席記録を修正しました。");
  } catch (error) {
    console.error("出席記録編集エラー:", error);

    if (el.editError) {
      el.editError.textContent = "出席記録を保存できませんでした。";

      el.editError.hidden = false;
    }
  } finally {
    el.editSave.disabled = false;

    el.editSave.textContent = originalText || "保存する";
  }
}

async function saveAttendanceEdit(data) {
  const generatedId = createAttendanceRecordId({
    date: data.date,

    period: data.period,

    subject: data.subject,
  });

  const recordId = data.recordId || generatedId;

  const recordRef = doc(
    db,
    "users",
    studentNumber,
    "attendanceRecords",
    recordId,
  );

  /*
     既存の記録と編集履歴を取得する。
    */

  const currentSnap = await getDoc(recordRef);

  const currentData = currentSnap.exists() ? currentSnap.data() : {};

  const currentResult = resolveResult(
    currentSnap.exists() ? currentData : null,
  );

  const oldHistory = Array.isArray(currentData.editHistory)
    ? currentData.editHistory
    : [];

  const editedAt = new Date();

  const editHistory = [
    ...oldHistory,

    {
      previousStatus:
        currentData.editedStatus ||
        statusToEditValue(currentResult.status) ||
        "unmarked",

      previousLabel: currentResult.label || "未打刻",

      newStatus: data.status,

      newLabel: getManualAttendanceResult(data.status).label,

      reason: data.reason,

      editedAt,
    },
  ];

  await setDoc(
    recordRef,
    {
      /*
             講義を特定するための基本情報。
             未打刻から新規作成した場合にも必要。
            */

      date: data.date,

      period: Number(data.period || 0),

      subject: data.subject,

      /*
             手動編集判定
            */

      manualEdited: true,

      editedStatus: data.status,

      status: data.status,

      statusLabel: getManualAttendanceResult(data.status).label,

      statusFinalized: true,

      /*
             欠席操作として集計するための値。
             出席・遅刻・早退へ変更した場合はfalseに戻す。
            */

      absenceTapped: data.status === "absent",

      /*
             最新の編集情報
            */

      editReason: data.reason,

      editedAt,

      editedBy: studentNumber,

      /*
             過去の編集履歴。
             現在は画面表示しないがFirebaseには残す。
            */

      editHistory,
    },
    {
      merge: true,
    },
  );

  await refreshAttendance(true);
}

function statusToEditValue(status) {
  switch (status) {
    case ATTENDANCE_STATUS.PRESENT:
      return "present";

    case ATTENDANCE_STATUS.LATE:
      return "late";

    case ATTENDANCE_STATUS.EARLY_LEAVE:
      return "early_leave";

    case ATTENDANCE_STATUS.ABSENT:
      return "absent";

    default:
      return "";
  }
}

function calculatePossibleAbsentCount(
  totalLectures,
  attendedCount,
  isPractical,
) {
  if (!totalLectures || totalLectures <= 0) {
    return null;
  }

  const requiredRate = isPractical ? 0.8 : 2 / 3;

  let possible = 0;

  while (true) {
    const futureAttendance = attendedCount - possible;

    const rate = futureAttendance / totalLectures;

    if (rate < requiredRate) {
      break;
    }

    possible++;

    if (possible > totalLectures) {
      break;
    }
  }

  return Math.max(0, possible - 1);
}

document.addEventListener("click", (event) => {
  if (!el.helpPopup || !el.helpButton) {
    return;
  }

  if (el.helpPopup.hidden) {
    return;
  }

  if (el.helpPopup.contains(event.target)) {
    return;
  }

  if (el.helpButton.contains(event.target)) {
    return;
  }

  el.helpPopup.hidden = true;
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && el.helpPopup) {
    el.helpPopup.hidden = true;
  }
});
