export function isSubjectInMode(subject, mode) {
  return (subject?.mode || "exam") === mode;
}

export function getModeCategories(categories, mode) {
  return (Array.isArray(categories) ? categories : [])
    .filter((item) => item && typeof item.id === "string" && item.id &&
      typeof item.name === "string" && item.name &&
      (item.mode || "exam") === mode);
}

export function groupCatalogItems(items, categories, groupIdOf) {
  const groups = categories.map((category) => ({
    id: category.id,
    name: category.name,
    items: [],
  }));
  const byId = new Map(groups.map((group) => [group.id, group]));
  const unclassified = { id: "unclassified", name: "未分類", items: [] };
  for (const item of items) {
    const id = String(groupIdOf(item) || "");
    (byId.get(id) || unclassified).items.push(item);
  }
  if (unclassified.items.length) groups.push(unclassified);
  return groups.filter((group) => group.items.length);
}

export function parseExamSchedule(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [date = "", subject = "", time = "", room = ""] = line
        .split(/[|｜]/)
        .map((value) => value.trim());
      return { date, subject, time, room };
    });
}
