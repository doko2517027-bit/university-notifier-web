import {
  db,
  studentNumber,
  showPage,
  setupTheme,
  loadProfileImage,
} from "./common.js";

import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  classifyStartStamp,
  classifyEndStamp,
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

/* ========================================
   URL
======================================== */

const params = new URLSearchParams(location.search);

const rawAction = params.get("action") || "arrival";

const notificationChoice = params.get("choice") || "";

const notificationSource = params.get("source") || "";

const subject = String(params.get("subject") || "授業名未設定").trim();

const date = normalizeDate(params.get("date")) || localDateKey();

const period = normalizePeriod(params.get("period"));

const scheduleId = String(params.get("scheduleId") || "").trim();

const classGroup = normalizeClassGroup(params.get("classGroup"));

const startTime = String(params.get("startTime") || "").trim();

const endTime = String(params.get("endTime") || "").trim();

const notificationTest = params.get("notificationTest") === "1";

const testId = String(params.get("testId") || "").trim();

/* ========================================
   DOM
======================================== */

const subjectName = document.getElementById("subjectName");

const attendanceMeta = document.getElementById("attendanceMeta");

const attendanceStatus = document.getElementById("attendanceStatus");

const personalRecordNotice = document.getElementById("personalRecordNotice");

const primaryButton = document.getElementById("attendanceButton");

const secondaryButton = document.getElementById("leaveButton");

const doneLink = document.getElementById("attendanceDoneLink");

const themeButton = document.getElementById("themeButton");

const profileButton = document.getElementById("profileButton");

const profileImage = document.getElementById("topProfileImage");

/* ========================================
   状態
======================================== */

let userData = {};

let effectiveClock = null;

let lecture = null;

let normalizedLecture = null;

let recordId = "";

let record = null;

/* ========================================
   初期表示
======================================== */

setupTheme(themeButton);

loadProfileImage(profileImage);

if (profileButton) {
  profileButton.onclick = () => {
    location.href = "profile.html";
  };
}

if (subjectName) {
  subjectName.textContent = classGroup
    ? `${subject}（${classGroup}クラス）`
    : subject;
}

if (attendanceMeta) {
  attendanceMeta.textContent =
    `${date}・${period}限 ` +
    `${startTime || "--:--"}〜` +
    `${endTime || "--:--"}`;
}

if (personalRecordNotice) {
  personalRecordNotice.textContent =
    "CareMate上の個人用出席記録です。" + "大学の公式出席記録ではありません。";
}

/* ========================================
   講義データ
======================================== */

function createLecture() {
  return {
    subject,

    subjectKey: subject,

    date,

    period,

    classGroup,

    selectedClassGroup: classGroup,

    startTime,

    endTime,

    scheduleDocumentId: scheduleId,

    attendanceNotificationTest: notificationTest,

    attendanceNotificationTestClock:
      notificationTest && effectiveClock ? effectiveClock.toISOString() : null,

    testId,
  };
}

/* ========================================
   初期化
======================================== */

async function init() {
  if (!studentNumber) {
    throw new Error("ログイン情報がありません。");
  }

  if (!subject || subject === "授業名未設定") {
    throw new Error("科目情報を確認できません。");
  }

  if (!period) {
    throw new Error("時限情報を確認できません。");
  }

  if (!startTime || !endTime) {
    throw new Error("講義時間を確認できません。");
  }

  const userSnap = await getDoc(doc(db, "users", studentNumber));

  if (!userSnap.exists()) {
    throw new Error("ユーザー情報が見つかりません。");
  }

  userData = userSnap.data() || {};

  /*
    テスト時計。

    Firebase Functions側の
    attendanceTestClockと同じ時刻で
    出席判定を行う。
    */

  const testClock = userData.attendanceTestClock || {};

  const testClockActive =
    testClock.enabled === true &&
    normalizeDate(testClock.date) === date &&
    /^\d{2}:\d{2}$/.test(testClock.time || "") &&
    Date.parse(testClock.expiresAt || "") > Date.now();

  if (testClockActive) {
    effectiveClock = new Date(`${date}T${testClock.time}:00`);

    if (attendanceMeta) {
      attendanceMeta.textContent += `（テスト時刻 ${testClock.time}）`;
    }
  }

  /*
    classGroupがある通知について、
    Firestoreの選択結果も確認する。

    classGroupなし講義は
    クラス選択不要。
    */

  if (classGroup) {
    validateClassSelection();
  }

  lecture = createLecture();

  try {
    normalizedLecture = normalizeAttendanceLecture(lecture);
  } catch (error) {
    console.error("講義情報変換エラー:", error, lecture);

    throw new Error("講義情報を確認できません。");
  }

  /*
    attendance.jsと同じID生成方法。
    */

  recordId = createAttendanceRecordId(normalizedLecture);

  await loadRecord();

  renderActionButtons();

  /*
    Push通知内の

    開始打刻
    欠席
    終了打刻

    を直接押した場合は、
    画面表示後その操作を実行する。
    */

  const directAction = resolveChoiceAction(notificationChoice);

  if (directAction && canAutomaticallyExecute(directAction)) {
    await executeAttendanceAction(directAction);
  }
}

/* ========================================
   クラス確認
======================================== */

function validateClassSelection() {
  const selections =
    userData.classSelections && typeof userData.classSelections === "object"
      ? userData.classSelections
      : {};

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

  const key = keys.find((item) =>
    Object.prototype.hasOwnProperty.call(selections, item),
  );

  if (!key) {
    throw new Error(
      "この講義のクラス選択が完了していません。ホームでクラスを選択してください。",
    );
  }

  const selected = normalizeSavedClass(selections[key]);

  if (selected === "__NONE__") {
    throw new Error("この講義は「クラスなし」が選択されています。");
  }

  if (selected && selected !== classGroup) {
    throw new Error(`選択済みクラスは${selected}クラスです。`);
  }
}

/* ========================================
   記録取得
======================================== */

async function loadRecord() {
  const ref = doc(db, "users", studentNumber, "attendanceRecords", recordId);

  const snap = await getDoc(ref);

  record = snap.exists()
    ? {
        id: snap.id,

        ...snap.data(),
      }
    : null;

  renderCurrentStatus();
}

/* ========================================
   現在状態
======================================== */

function renderCurrentStatus() {
  if (!attendanceStatus) {
    return;
  }

  if (!record) {
    attendanceStatus.textContent = "未打刻";

    return;
  }

  try {
    const result = recalculateAttendanceStatus(record);

    attendanceStatus.textContent = `現在の判定：${result.label}`;
  } catch (error) {
    console.error("出席再判定エラー:", error);

    attendanceStatus.textContent = record.statusLabel || "記録済み";
  }
}

/* ========================================
   ボタン
======================================== */

function renderActionButtons() {
  const action = normalizeNotificationAction(rawAction);

  if (action === "end") {
    primaryButton.textContent = "🚪 終了打刻";

    secondaryButton.textContent = "⏱ 早退";

    primaryButton.onclick = () => executeAttendanceAction("end");

    secondaryButton.onclick = () => executeAttendanceAction("early_leave");

    return;
  }

  primaryButton.textContent = "✅ 開始打刻";

  secondaryButton.textContent = "❌ 欠席";

  primaryButton.onclick = () => executeAttendanceAction("start");

  secondaryButton.onclick = () => executeAttendanceAction("absent");
}

/* ========================================
   打刻
======================================== */

async function executeAttendanceAction(action) {
  if (!lecture || !normalizedLecture) {
    throw new Error("講義情報を確認できません。");
  }

  disableButtons(true);

  try {
    const now = effectiveClock || new Date();

    const source = resolveSource(action);

    /*
        現在時刻でどの判定になるか
        先に表示。
        */

    renderPendingJudgement(action, now);

    let result;

    if (action === "start") {
      result = await stampAttendanceStart({
        lecture,

        now,

        source,
      });
    } else if (action === "end") {
      result = await stampAttendanceEnd({
        lecture,

        now,

        action: "end",

        source,
      });
    } else if (action === "early_leave") {
      result = await stampAttendanceEarlyLeave({
        lecture,

        now,

        source,
      });
    } else if (action === "absent") {
      result = await markAttendanceAbsent({
        lecture,

        now,

        source,
      });
    } else {
      throw new Error("未対応の出席操作です。");
    }

    if (!result || result.ok !== true) {
      throw new Error(result?.message || "打刻できませんでした。");
    }

    await loadRecord();

    renderResult(result, action);

    await closeRelatedNotifications();

    /*
        欠席または終了まで完了したら
        操作終了。
        */

    if (action === "absent" || action === "end" || action === "early_leave") {
      primaryButton.hidden = true;

      secondaryButton.hidden = true;

      if (doneLink) {
        doneLink.hidden = false;
      }
    } else {
      /*
            開始打刻後は終了待ち。
            */

      primaryButton.disabled = true;

      secondaryButton.disabled = true;

      primaryButton.textContent = "✅ 開始打刻済み";

      secondaryButton.textContent = "終了時刻までお待ちください";

      if (doneLink) {
        doneLink.hidden = false;
      }
    }

    return result;
  } catch (error) {
    showError(error);

    return {
      ok: false,

      message: error.message || "打刻できませんでした。",
    };
  } finally {
    /*
        完了処理でdisabledにしたものは
        戻さない。
        */

    if (
      !primaryButton.hidden &&
      primaryButton.textContent !== "✅ 開始打刻済み"
    ) {
      disableButtons(false);
    }
  }
}

/* ========================================
   判定予告
======================================== */

function renderPendingJudgement(action, now) {
  if (!attendanceStatus) {
    return;
  }

  try {
    if (action === "start") {
      const result = classifyStartStamp({
        stampAt: now,

        lecture: normalizedLecture.lectureWindow,
      });

      attendanceStatus.textContent = `判定予定：${result.label}`;

      return;
    }

    if (action === "end" || action === "early_leave") {
      const result = classifyEndStamp({
        stampAt: now,

        lecture: normalizedLecture.lectureWindow,
      });

      attendanceStatus.textContent = `判定予定：${result.label}`;

      return;
    }

    if (action === "absent") {
      attendanceStatus.textContent = "判定予定：欠席";
    }
  } catch (error) {
    console.error("判定予告エラー:", error);
  }
}

/* ========================================
   保存結果
======================================== */

function renderResult(result, action) {
  const final = result.finalResult || null;

  const judgement = result.judgement || null;

  const label = final?.label || judgement?.label || actionLabel(action);

  const message = result.message || "出席記録を保存しました。";

  if (attendanceStatus) {
    attendanceStatus.textContent = `✅ ${label}：${message}`;
  }
}

/* ========================================
   自動操作
======================================== */

function resolveChoiceAction(value) {
  const choice = String(value || "")
    .trim()
    .toLowerCase();

  const aliases = {
    arrival: "start",

    start: "start",

    attendance: "start",

    present: "start",

    absence: "absent",

    absent: "absent",

    departure: "end",

    end: "end",

    finish: "end",

    early: "early_leave",

    early_leave: "early_leave",
  };

  return aliases[choice] || "";
}

function canAutomaticallyExecute(action) {
  if (!record) {
    return action === "start" || action === "absent";
  }

  const hasStart = Boolean(record.startStampedAt || record.startKind);

  const hasEnd = Boolean(record.endStampedAt || record.endKind);

  const absent = record.absenceTapped === true;

  if (action === "start" || action === "absent") {
    return !hasStart && !hasEnd && !absent;
  }

  if (action === "end" || action === "early_leave") {
    return hasStart && !hasEnd && !absent;
  }

  return false;
}

/* ========================================
   通知source
======================================== */

function resolveSource(action) {
  if (Object.values(ATTENDANCE_STAMP_SOURCE).includes(notificationSource)) {
    return notificationSource;
  }

  if (action === "start" || action === "absent") {
    return ATTENDANCE_STAMP_SOURCE.START_NOTIFICATION;
  }

  if (action === "end" || action === "early_leave") {
    return ATTENDANCE_STAMP_SOURCE.END_NOTIFICATION;
  }

  return ATTENDANCE_STAMP_SOURCE.ATTENDANCE_PAGE;
}

/* ========================================
   通知を閉じる
======================================== */

async function closeRelatedNotifications() {
  if (!navigator.serviceWorker?.ready) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    const notices = await registration.getNotifications();

    for (const notice of notices) {
      const tag = String(notice.tag || "");

      const target = String(notice.data?.url || "");

      let matches = false;

      if (tag.includes(encodeURIComponent(subject))) {
        matches = true;
      }

      if (target) {
        try {
          const url = new URL(target, location.origin);

          const sameSubject = url.searchParams.get("subject") === subject;

          const sameDate = url.searchParams.get("date") === date;

          const samePeriod =
            normalizePeriod(url.searchParams.get("period")) === period;

          if (sameSubject && sameDate && samePeriod) {
            matches = true;
          }
        } catch {
          // 無視
        }
      }

      if (matches) {
        notice.close();
      }
    }
  } catch (error) {
    console.warn("通知クローズ失敗:", error);
  }
}

/* ========================================
   ボタン状態
======================================== */

function disableButtons(disabled) {
  if (primaryButton) {
    primaryButton.disabled = disabled;
  }

  if (secondaryButton) {
    secondaryButton.disabled = disabled;
  }
}

/* ========================================
   エラー
======================================== */

function showError(error) {
  console.error("出席確認エラー:", error);

  const message = error?.message || "処理に失敗しました。";

  if (attendanceStatus) {
    attendanceStatus.textContent = `⚠️ ${message}`;
  }

  alert(message);
}

/* ========================================
   表示用
======================================== */

function actionLabel(action) {
  if (action === "start") {
    return "開始打刻";
  }

  if (action === "end") {
    return "終了打刻";
  }

  if (action === "early_leave") {
    return "早退";
  }

  if (action === "absent") {
    return "欠席";
  }

  return "記録完了";
}

/* ========================================
   action変換
======================================== */

function normalizeNotificationAction(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();

  if (["arrival", "start", "attendance", "present"].includes(raw)) {
    return "start";
  }

  if (["departure", "end", "finish"].includes(raw)) {
    return "end";
  }

  return "start";
}

/* ========================================
   クラス値
======================================== */

function normalizeSavedClass(value) {
  if (value && typeof value === "object") {
    return normalizeSavedClass(value.classGroup || value.class || value.value);
  }

  const raw = String(value || "").trim();

  if (raw === "__NONE__") {
    return "__NONE__";
  }

  return normalizeClassGroup(raw);
}

function normalizeClassGroup(value) {
  const raw = String(value || "")
    .replace(/[Ａ-Ｚａ-ｚ]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0xfee0),
    )
    .toUpperCase()
    .replaceAll("クラス", "")
    .replaceAll("組", "")
    .replaceAll("班", "")
    .trim();

  return raw.match(/[A-Z]/)?.[0] || "";
}

/* ========================================
   日付・時限
======================================== */

function normalizePeriod(value) {
  const match = String(value || "").match(/\d+/);

  return match ? Number(match[0]) : 0;
}

function normalizeDate(value) {
  const text = String(value || "").trim();

  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);

  if (!match) {
    return "";
  }

  return (
    `${match[1]}-` +
    `${match[2].padStart(2, "0")}-` +
    `${match[3].padStart(2, "0")}`
  );
}

function localDateKey(value = new Date()) {
  return [
    value.getFullYear(),

    String(value.getMonth() + 1).padStart(2, "0"),

    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

/* ========================================
   戻る
======================================== */

document.getElementById("backButton")?.addEventListener("click", () => {
  location.href = "attendance.html";
});

/* ========================================
   開始
======================================== */

init()
  .catch((error) => {
    showError(error);

    disableButtons(true);
  })
  .finally(() => {
    showPage();
  });
