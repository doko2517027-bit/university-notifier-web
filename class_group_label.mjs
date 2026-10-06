const TRAILING_CLASS_PATTERN = /\s*[（(]\s*([^()（）]{1,40}?(?:クラス|ｸﾗｽ))\s*[)）]\s*$/i;

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatClassGroupLabel(value) {
  let label = normalizeText(value)
    .replace(/^[（(]\s*/, "")
    .replace(/\s*[)）]$/, "")
    .replace(/ｸﾗｽ/gi, "クラス");

  if (!label) return "";

  // 保存済みデータが「Aクラス」でも「A」でも、表示は必ず1回だけ付ける。
  label = label.replace(/(?:クラス\s*)+$/g, "クラス");
  return /クラス$/i.test(label) ? label : `${label}クラス`;
}

export function extractClassGroupFromSubject(value) {
  const subject = normalizeText(value);
  const match = subject.match(TRAILING_CLASS_PATTERN);
  return match ? formatClassGroupLabel(match[1]) : "";
}

export function normalizeScheduleClassData(item = {}) {
  const rawSubject = normalizeText(item.subject || item.name || item.title);
  const match = rawSubject.match(TRAILING_CLASS_PATTERN);
  const classGroup = formatClassGroupLabel(
    item.classGroup || item.class || match?.[1] || "",
  );

  return {
    ...item,
    subject: match ? rawSubject.slice(0, match.index).trim() : rawSubject,
    classGroup,
  };
}

export function parenthesizedClassGroup(value) {
  const label = formatClassGroupLabel(value);
  return label ? `（${label}）` : "";
}
