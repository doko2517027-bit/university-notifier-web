export function normalizeCourseLinkName(value) {
  const normalized = String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[（(]含?日本国憲法[)）]/g, "")
    .replace(/[（(]対面[)）]/g, "")
    .replace(/[（(][a-z](?:\s*[,、・/／&＆〜～-]\s*[a-z])*\s*クラス[)）]/g, "")
    .replace(/\s*(?:[（(]\s*)?[a-z](?:\s*[,、・/／&＆〜～-]\s*[a-z])*\s*クラス\s*[)）]?\s*$/g, "")
    .replace(/[（(](精神|母子)[)）]/g, "")
    .replace(/[\s　・･]/g, "")
    .replace(/[()（）「」『』]/g, "");

  return normalized.replace(
    /(x|ix|viii|vii|vi|v|iv|iii|ii|i)$/,
    (roman) =>
      ({
        i: "1",
        ii: "2",
        iii: "3",
        iv: "4",
        v: "5",
        vi: "6",
        vii: "7",
        viii: "8",
        ix: "9",
        x: "10",
      })[roman] || roman,
  );
}

export function resolveCourseLink(courses, subject) {
  if (!courses || typeof courses !== "object") return "";
  const exact = courses[String(subject || "")];
  if (typeof exact === "string" && exact) return exact;

  const targetName = normalizeCourseLinkName(subject);
  if (!targetName) return "";
  for (const [courseName, url] of Object.entries(courses)) {
    if (
      typeof url === "string" &&
      url &&
      normalizeCourseLinkName(courseName) === targetName
    ) {
      return url;
    }
  }
  return "";
}
