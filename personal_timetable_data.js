import { db, studentNumber } from "./common.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { PERIOD_TIMES } from "./attendance_policy.js";

export function normalizeCourseName(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[（(]含?日本国憲法[)）]/g, "")
    .replace(/[（(]対面[)）]/g, "")
    .replace(/[（(][ab]クラス[)）]/g, "")
    .replace(/[\s　・･]/g, "")
    .replace(/[()（）「」『』]/g, "");
}

// ホーム・出席管理で共通に使う、履修済み科目との照合。
export function isEnrolledScheduleItem(item, aliasToCourse) {
  if (!aliasToCourse || typeof aliasToCourse.has !== "function") {
    return false;
  }

  return [
    item?.subject,
    item?.scheduleSubject,
    item?.subjectKey,
    item?.subjectId,
    item?.id,
  ].some((value) => {
    const key = normalizeCourseName(value);
    return key && aliasToCourse.has(key);
  });
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
    for (const item of Array.isArray(day.schedules) ? day.schedules : []) {
      const itemGrade = String(item.grade || "")
        .normalize("NFKC")
        .replace("年", "")
        .trim();

      if (grade && itemGrade && itemGrade !== grade) {
        continue;
      }

      const course = aliasToCourse.get(normalizeCourseName(item.subject));

      if (!course) {
        continue;
      }

      const period = Number.parseInt(item.period, 10) || 0;

      entries.push({
        entryId: `${scheduleId}_${day.date || day.title || "day"}_${item.period || "0"}_${course.id}`,

        sourceScheduleDocumentId: scheduleId,

        date: day.date || "",

        dayTitle: day.title || day.label || "講義日",

        dayLabel: day.label || "",

        period,

        startTime: item.startTime || PERIOD_TIMES[period]?.startTime || "",

        endTime: item.endTime || PERIOD_TIMES[period]?.endTime || "",

        subjectId: course.subjectId || course.id,

        subjectKey: course.subjectKey || course.name || course.id,

        subject: course.name || item.subject,

        scheduleSubject: item.subject || "",

        classGroup: item.classGroup || "",

        teacher: item.teacher || "",

        building: item.building || "",

        room: item.room || "",

        isPractical: course.isPractical === true,

        isRetake:
          course.isRetake === true || course.creditStatus === "not_earned",

        lectureCount: Number(course.lectureCount || 0),

        credits: Number(course.credits || 0),
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
