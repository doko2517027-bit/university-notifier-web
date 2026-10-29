export function parseEditableLines(value) {
  return String(value ?? "")
    .split("\n")
    .map((text) => text.trim())
    .filter((text) => text !== "");
}

export function buildContentSectionPatch(field, value) {
  if (field !== "summary" && field !== "important_points") {
    throw new Error("保存対象が正しくありません。");
  }

  const items = parseEditableLines(value);

  return {
    [field]: items,
    [`manual_${field}`]: items,
    hasManualContent: true,
  };
}
