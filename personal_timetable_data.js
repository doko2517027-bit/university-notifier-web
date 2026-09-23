import { db, studentNumber } from "./common.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { PERIOD_TIMES } from "./attendance_policy.js";

export function normalizeCourseName(value) {
  const normalized = String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[（(]含?日本国憲法[)）]/g, "")
    .replace(/[（(]対面[)）]/g, "")
    .replace(/[（(][ab]クラス[)）]/g, "")
    .replace(/[（(](精神|母子)[)）]/g, "")
    .replace(/[\s　・･]/g, "")
    .replace(/[()（）「」『』]/g, "");

  return normalized.replace(
    /(x|ix|viii|vii|vi|v|iv|iii|ii|i)$/,
    (roman) =>
      ({ i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" })[
        roman
      ] || roman,
  );
}

export function findEnrolledCourseForScheduleItem(item, aliasToCourse) {
  if (!aliasToCourse || typeof aliasToCourse.has !== "function") {
    return null;
  }

  for (const value of [
    item?.subject,
    item?.scheduleSubject,
    item?.subjectKey,
    item?.subjectId,
    item?.id,
  ]) {
    const key = normalizeCourseName(value);
    const course = key ? aliasToCourse.get(key) : null;
    if (course) return course;
  }
  return null;
}

// ホーム・出席管理で共通に使う、履修済み科目との照合。
export function isEnrolledScheduleItem(item, aliasToCourse) {
  return Boolean(findEnrolledCourseForScheduleItem(item, aliasToCourse));
}

// 履修登録の対象外でも、全員へ表示する大学共通の予定だけを判定する。
export function isCommonScheduleEvent(item) {
  if (
    item?.displayForAll === true ||
    item?.isCommonEvent === true ||
    item?.isGuidance === true
  ) {
    return true;
  }

  const label = [item?.type, item?.category, item?.subject, item?.title]
    .filter(Boolean)
    .join(" ");
  return /ガイダンス|オリエンテーション|説明会|健康診断|入学式|卒業式|ホームルーム|国家試験対策|国試対策|模擬試験|模試|特別講義|講演会?|セミナー|研修会?|学内行事|就職支援|キャリア支援|防災訓練|避難訓練/.test(
    label,
  );
}

function scheduleDocumentId(user) {
  if (String(user.department || "").trim() === "看護学科") return "ns_yamate";
  if (String(user.major || "").includes("理学療法")) return "pt";
  if (String(user.major || "").includes("作業療法")) return "ot";
  return "";
}

export async function loadPersonalTimetableData({
  userData = null,
  buildEntries = true,
  includeCommonEvents = false,
} = {}) {
  if (!studentNumber) {
    return {
      entries: [],
      enrolled: [],
      aliasToCourse: new Map(),
      scheduleDocumentId: "",
      scheduleData: null,
      reason: "not_logged_in",
    };
  }

  let user = userData;

  /*
    呼び出し元ですでにuserを取得済みなら
    Firestoreをもう一度読まない。
    */
  if (!user) {
    const userSnap = await getDoc(doc(db, "users", studentNumber));

    user = userSnap.exists() ? userSnap.data() : {};
  }

  const scheduleId = scheduleDocumentId(user);

  /*
    履修科目と大学時間割を
    同時取得。
    */
  const [enrollmentSnap, scheduleSnap] = await Promise.all([
    getDocs(collection(db, "users", studentNumber, "enrolledSubjects")),

    scheduleId
      ? getDoc(doc(db, "schedule", scheduleId))
      : Promise.resolve(null),
  ]);

  const enrolled = enrollmentSnap.docs

    .map((item) => ({
      id: item.id,

      ...item.data(),
    }))

    .filter((item) => item.status !== "removed");

  const aliasToCourse = new Map();

  for (const course of enrolled) {
    for (const alias of [
      course.name,
      course.subjectKey,
      course.subjectId,
      course.id,
    ]) {
      const normalized = normalizeCourseName(alias);

      if (normalized) {
        aliasToCourse.set(normalized, course);
      }
    }
  }

  if (!scheduleId) {
    return {
      entries: [],
      enrolled,
      aliasToCourse,
      scheduleDocumentId: "",
      scheduleData: null,
      reason: "schedule_not_configured",
    };
  }

  if (!scheduleSnap || !scheduleSnap.exists()) {
    return {
      entries: [],
      enrolled,
      aliasToCourse,
      scheduleDocumentId: scheduleId,
      scheduleData: null,
      reason: "schedule_missing",
    };
  }

  const data = scheduleSnap.data();

  /*
    ホームではentriesを作る必要がない。

    aliasToCourseとscheduleDataだけ
    必要なので重い全日程ループを省略。
    */
  if (!buildEntries) {
    return {
      entries: [],
      enrolled,
      aliasToCourse,
      scheduleDocumentId: scheduleId,
      scheduleData: data,
      reason: "ok",
    };
  }

  const days =
    Array.isArray(data.allDays) && data.allDays.length
      ? data.allDays
      : Array.isArray(data.days) && data.days.length
        ? data.days
        : [
            {
              date: "",
              title: data.todayTitle || "今日",
              label: data.todayLabel || "",
              schedules: data.today || [],
            },

            {
              date: "",
              title: data.nextTitle || "次回",
              label: data.nextLabel || "",
              schedules: data.next || [],
            },
          ];

  const grade = String(user.grade || localStorage.getItem("grade") || "")
    .normalize("NFKC")
    .replace("年", "")
    .trim();

  const entries = [];

  for (const day of days) {
    for (const [itemIndex, item] of Array.isArray(day.schedules)
      ? day.schedules.entries()
      : []) {
      const itemGrade = String(item.grade || "")
        .normalize("NFKC")
        .replace("年", "")
        .trim();

      const commonEvent = isCommonScheduleEvent(item);

      // ガイダンス等の共通予定は、PDF上の行に記載された学年にかかわらず
      // 全学年へ表示する。通常科目だけ従来どおり学年で絞り込む。
      if (
        grade &&
        itemGrade &&
        itemGrade !== grade &&
        !(includeCommonEvents && commonEvent)
      ) {
        continue;
      }

      const course = findEnrolledCourseForScheduleItem(item, aliasToCourse);

      if (!course && !(includeCommonEvents && commonEvent)) {
        continue;
      }

      const period = Number.parseInt(item.period, 10) || 0;
      const scheduleItemKey =
        course?.id ||
        item.id ||
        item.subjectId ||
        item.subjectKey ||
        item.subject ||
        `schedule-${itemIndex + 1}`;

      entries.push({
        entryId: `${scheduleId}_${day.date || day.title || "day"}_${item.period || "0"}_${scheduleItemKey}_${item.classGroup || itemIndex}`,

        sourceScheduleDocumentId: scheduleId,

        date: day.date || "",

        dayTitle: day.title || day.label || "講義日",

        dayLabel: day.label || "",

        period,

        startTime: item.startTime || PERIOD_TIMES[period]?.startTime || "",

        endTime: item.endTime || PERIOD_TIMES[period]?.endTime || "",

        subjectId: course?.subjectId || course?.id || item.subjectId || item.id || "",

        subjectKey:
          course?.subjectKey ||
          course?.name ||
          course?.id ||
          item.subjectKey ||
          item.subject ||
          "",

        subject: course?.name || item.subject || "科目名なし",

        scheduleSubject: item.subject || "",

        classGroup: item.classGroup || "",

        teacher: item.teacher || "",

        building: item.building || "",

        room: item.room || "",

        isPractical: course?.isPractical === true || item.isPractical === true,

        isRetake:
          course?.isRetake === true || course?.creditStatus === "not_earned",

        isCommonScheduleEvent: !course && commonEvent,

        lectureCount: Number(course?.lectureCount || 0),

        credits: Number(course?.credits || 0),
      });
    }
  }

  entries.sort(
    (a, b) => (a.date || "").localeCompare(b.date || "") || a.period - b.period,
  );

  return {
    entries,

    enrolled,

    aliasToCourse,

    scheduleDocumentId: scheduleId,

    scheduleData: data,

    reason: entries.length ? "ok" : "no_matches",
  };
}
