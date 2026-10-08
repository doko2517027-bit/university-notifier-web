export function normalizeAcademicGrade(value) {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .replace(/[\s　年生]/g, "")
    .trim();
  return /^[1-4]$/.test(normalized) ? normalized : "";
}

export function formatAcademicGrade(value, fallback = "学年未設定") {
  const grade = normalizeAcademicGrade(value);
  return grade ? `${grade}年` : fallback;
}
