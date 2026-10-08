import {
  formatAcademicGrade,
  normalizeAcademicGrade,
} from "./grade_display.mjs";

const STORAGE_KEY = "careMateAdminScope";

export function getAdminScope() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

    return {
      department: String(stored.department || ""),
      major: String(stored.major || ""),
      grade: normalizeAcademicGrade(stored.grade),
    };
  } catch {
    return {
      department: "",
      major: "",
      grade: "",
    };
  }
}

export function saveAdminScope(scope) {
  const normalized = {
    department: String(scope?.department || ""),
    major: String(scope?.major || ""),
    grade: normalizeAcademicGrade(scope?.grade),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));

  return normalized;
}

export function scopeLabel(scope = getAdminScope()) {
  const parts = [
    scope.department,
    scope.major,
    scope.grade ? formatAcademicGrade(scope.grade, "") : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" / ") : "全学科・全学年";
}

export function withAdminScope(path, scope = getAdminScope()) {
  const url = new URL(path, location.href);

  if (scope.department) {
    url.searchParams.set("department", scope.department);
  }

  if (scope.major) {
    url.searchParams.set("major", scope.major);
  }

  if (scope.grade) {
    url.searchParams.set("grade", scope.grade);
  }

  return url.pathname.split("/").pop() + url.search;
}

export function readAdminScopeFromUrl() {
  const parameters = new URLSearchParams(location.search);

  const fromUrl = {
    department: parameters.get("department") || "",
    major: parameters.get("major") || "",
    grade: parameters.get("grade") || "",
  };

  if (fromUrl.department || fromUrl.major || fromUrl.grade) {
    return saveAdminScope(fromUrl);
  }

  return getAdminScope();
}

export function matchesAdminScope(user, scope = getAdminScope()) {
  const department = String(user?.department || "").trim();
  const major = String(user?.major || "").trim();
  const grade = normalizeAcademicGrade(user?.grade);

  const matchesDepartment =
    !scope.department ||
    department === scope.department ||
    (scope.department === "リハビリテーション学科" &&
      ["理学療法学専攻", "作業療法学専攻"].includes(major));

  return (
    matchesDepartment &&
    (!scope.major || major === scope.major) &&
    (!scope.grade || grade === normalizeAcademicGrade(scope.grade))
  );
}
