export function resolveAttendanceCourseSemester(enrollment, master, currentAcademicYear) {
  const enrollmentYear = Number(enrollment?.academicYear || 0);
  const masterSemester = String(master?.semester || "");

  // 当年度の科目設定を直した場合は、古い個人別履修スナップショットより優先する。
  if (enrollmentYear === Number(currentAcademicYear) &&
      ["前期", "後期", "通期", "通年"].includes(masterSemester)) {
    return masterSemester;
  }

  return enrollment?.registeredSemester || enrollment?.semester || "";
}

export function publishedScheduleSemesterForDate(timetable, dateKey) {
  const semester = String(timetable?.scheduleTerm || "");
  if (!["前期", "後期"].includes(semester)) return "";
  return timetable?.allDays?.some((day) => day.date === dateKey) ? semester : "";
}
