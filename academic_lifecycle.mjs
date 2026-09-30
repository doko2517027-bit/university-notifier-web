export function academicYearAt(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric" }).formatToParts(value);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return year - (month < 4 ? 1 : 0);
}

export function admissionYearFromStudentNumber(studentNumber) {
  const value = String(studentNumber || "").trim();
  if (!/^\d{7}$/.test(value)) return null;
  return 2000 + Number(value.slice(0, 2));
}

// 入学年度は新規登録時の初期学年にだけ使う。留年・休学後の学年は保存済みプロフィールを優先する。
export function initialGradeForStudent(studentNumber, academicYear = academicYearAt()) {
  const admissionYear = admissionYearFromStudentNumber(studentNumber);
  if (!admissionYear || !Number.isInteger(academicYear)) return null;
  const grade = academicYear - admissionYear + 1;
  return grade >= 1 && grade <= 4 ? grade : null;
}

export function daysAfterDate(dateString, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateString || ""))) return null;
  const date = new Date(`${dateString}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return null;
  const roundTrip = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
  if (roundTrip !== dateString) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function isLeaveActive(user, now = new Date()) {
  if (user?.academicStatus !== "leave") return false;
  if (!user.leaveSince) return true;
  const start = new Date(user.leaveSince);
  return Number.isNaN(start.getTime()) || now.getTime() >= start.getTime();
}

export function canReviseAnnualResponse(transition, user) {
  const targetYear = Number(transition?.academicYear);
  return transition?.enabled === true && Number.isInteger(targetYear) &&
    user?.annualTransitionResponse?.decisionVersion === 2 &&
    Number(user.annualTransitionResponse.academicYear) === targetYear &&
    Number(user.annualProgression?.academicYear) !== targetYear &&
    !["graduated", "withdrawn"].includes(user.academicStatus);
}

export function assessProgression({ department, grade, records = [], complete = false }) {
  const currentGrade = Number(grade);
  if (!Number.isInteger(currentGrade) || currentGrade < 1 || currentGrade > 4) {
    return { status: "unknown", reason: "現在の学年を確認できません。" };
  }
  if (currentGrade === 4) {
    return { status: "review", reason: "卒業要件は取得単位と大学の正式な判定を確認してください。" };
  }
  if (department !== "看護学科") {
    return { status: "eligible", reason: "リハビリテーション学科は単位修得状況による進級判定を行いません。実習の先修要件は別途確認してください。" };
  }
  if (!complete) {
    return { status: "unknown", reason: "必修科目の修得状況がそろっていないため、自動判定できません。" };
  }
  const missing = records.filter((record) => record.required === true && Number(record.grade) <= currentGrade && record.status !== "earned");
  const missingCredits = missing.reduce((total, record) => total + Number(record.credits || 0), 0);
  if (missing.some((record) => !Number.isFinite(Number(record.credits)) || Number(record.credits) <= 0)) {
    return { status: "unknown", reason: "未修得の必修科目に単位数未設定があるため、自動判定できません。", missingCount: missing.length };
  }
  const eligible = currentGrade === 2
    ? missing.length === 0
    : currentGrade === 1
      ? missing.length <= 2 && missingCredits <= 3
      : missing.length <= 2 && missingCredits <= 4;
  return {
    status: eligible ? "eligible" : "ineligible",
    reason: eligible ? "学生便覧の進級要件を満たす見込みです。" : `未修得の必修科目が${missing.length}科目・${missingCredits}単位あり、学生便覧の進級要件を満たしません。`,
    missingCount: missing.length,
    missingCredits,
  };
}
