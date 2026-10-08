function normalizeStudentNumber(value) {
  const normalized = String(value || "").trim();
  return /^\d{7}$/.test(normalized) ? normalized : "";
}

function normalizeGrade(value) {
  const matched = String(value || "").match(/[1-4]/);
  return matched ? matched[0] : "";
}

function normalizedList(values, normalizer = (value) => String(value || "").trim()) {
  return [...new Set((Array.isArray(values) ? values : []).map(normalizer).filter(Boolean))];
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value === "object" && Number.isFinite(value._seconds)) {
    return value._seconds * 1000;
  }
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function targetedSystemNewsMatchesStudent(news = {}, studentNumber, user = {}) {
  const normalizedStudentNumber = normalizeStudentNumber(studentNumber);
  if (!normalizedStudentNumber) return false;

  const targetStudentNumbers = normalizedList(
    news.targetStudentNumbers,
    normalizeStudentNumber,
  );
  const excludedStudentNumbers = new Set(
    normalizedList(news.excludedStudentNumbers, normalizeStudentNumber),
  );
  const targetGrades = normalizedList(news.targetGrades, normalizeGrade);
  const audienceMode = String(news.audienceMode || "").trim();

  if (audienceMode === "only" || targetStudentNumbers.length) {
    return targetStudentNumbers.includes(normalizedStudentNumber);
  }

  if (audienceMode === "grade" || targetGrades.length) {
    return targetGrades.includes(normalizeGrade(user.grade));
  }

  return !excludedStudentNumbers.has(normalizedStudentNumber);
}

// 登録前から存在していたCareMateのお知らせは、新規登録者の初回受信箱にも表示する。
function targetedSystemNewsPredatesRegistration(news = {}, user = {}) {
  const newsCreatedAt = timestampMillis(news.createdAt);
  const registeredAt = timestampMillis(
    user.studentPageVerifiedAt || user.registeredAt || user.createdAt,
  );
  return newsCreatedAt > 0 && registeredAt > 0 && newsCreatedAt <= registeredAt;
}

function targetedSystemNewsCopy(news = {}, newsId = "") {
  return {
    title: String(news.title || "CareMateからのお知らせ"),
    body: String(news.body || ""),
    bodyHtml: String(news.bodyHtml || ""),
    attachments: Array.isArray(news.attachments) ? news.attachments : [],
    author: String(news.author || ""),
    createdAt: news.createdAt || new Date(),
    updatedAt: news.updatedAt || null,
    updatedBy: news.updatedBy || null,
    important: news.important === true,
    format: news.format && typeof news.format === "object" ? news.format : {},
    sourceNewsId: String(newsId || ""),
  };
}

function targetedSystemNewsContentSignature(news = {}) {
  return JSON.stringify({
    title: String(news.title || ""),
    body: String(news.body || ""),
    bodyHtml: String(news.bodyHtml || ""),
    attachments: Array.isArray(news.attachments) ? news.attachments : [],
    important: news.important === true,
    format: news.format || {},
    audienceMode: String(news.audienceMode || ""),
    targetStudentNumbers: normalizedList(news.targetStudentNumbers, normalizeStudentNumber).sort(),
    excludedStudentNumbers: normalizedList(news.excludedStudentNumbers, normalizeStudentNumber).sort(),
    targetGrades: normalizedList(news.targetGrades, normalizeGrade).sort(),
  });
}

module.exports = {
  normalizeGrade,
  targetedSystemNewsMatchesStudent,
  targetedSystemNewsPredatesRegistration,
  targetedSystemNewsCopy,
  targetedSystemNewsContentSignature,
};
