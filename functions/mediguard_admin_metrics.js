const TOKYO_TIME_ZONE = "Asia/Tokyo";

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return Number(value.toMillis()) || 0;
  if (typeof value.toDate === "function") return value.toDate().getTime() || 0;
  if (value instanceof Date) return value.getTime();
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) return number;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function tokyoDayKey(value) {
  const date = new Date(toMillis(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TOKYO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function studentNumberFromEntry(entry) {
  if (/^\d{7}$/.test(String(entry?.studentNumber || ""))) return String(entry.studentNumber);
  const match = String(entry?.path || "").match(/^mediguardPlayers\/(\d{7})(?:\/|$)/);
  return match?.[1] || "";
}

function activityTime(entry) {
  return Math.max(
    toMillis(entry?.updatedAt),
    toMillis(entry?.finishedAt),
    toMillis(entry?.startedAt),
    toMillis(entry?.createdAt),
  );
}

function buildMediguardAdminMetrics({ players = [], runs = [], operations = [], characters = [], errors = [], presence = {}, catalog = [], now = Date.now() } = {}) {
  const nowMs = toMillis(now) || Date.now();
  const todayKey = tokyoDayKey(nowMs);
  const recentThreshold = nowMs - (5 * 60 * 1000);
  const activeToday = new Set();

  [...players, ...runs, ...operations].forEach((entry) => {
    const studentNumber = studentNumberFromEntry(entry);
    if (studentNumber && tokyoDayKey(activityTime(entry)) === todayKey) activeToday.add(studentNumber);
  });

  const onlineStudents = new Set();
  Object.entries(presence || {}).forEach(([studentNumber, devices]) => {
    if (!/^\d{7}$/.test(studentNumber) || !devices || typeof devices !== "object") return;
    if (Object.values(devices).some((device) => device?.state === "online" && device?.page === "mediguard.html")) onlineStudents.add(studentNumber);
  });

  const gachaOperations = operations.filter((entry) => entry?.type === "gacha");
  const rarityCounts = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0, LR: 0 };
  let gachaResults = 0;
  gachaOperations.forEach((entry) => {
    const results = Array.isArray(entry?.result?.results) ? entry.result.results : [];
    gachaResults += results.length;
    results.forEach((item) => {
      if (Object.hasOwn(rarityCounts, item?.rarity)) rarityCounts[item.rarity] += 1;
    });
  });

  const wonRuns = runs.filter((entry) => entry?.result?.reward?.won === true || entry?.summary?.won === true).length;
  const catalogNames = Object.fromEntries(catalog.map((item) => [item.id, item.name]));
  const characterCounts = {};
  characters.forEach((entry) => {
    const id = String(entry?.characterId || "");
    if (id) characterCounts[id] = (characterCounts[id] || 0) + 1;
  });
  const popularCharacters = Object.entries(characterCounts)
    .map(([id, count]) => ({ id, name: catalogNames[id] || id, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"))
    .slice(0, 5);

  const dayKeys = Array.from({ length: 7 }, (_, index) => {
    const milliseconds = nowMs - ((6 - index) * 24 * 60 * 60 * 1000);
    return { key: tokyoDayKey(milliseconds), label: tokyoDayKey(milliseconds).slice(5).replace("-", "/"), battles: 0, gacha: 0 };
  });
  const dayMap = new Map(dayKeys.map((entry) => [entry.key, entry]));
  runs.forEach((entry) => { const day = dayMap.get(tokyoDayKey(activityTime(entry))); if (day) day.battles += 1; });
  gachaOperations.forEach((entry) => { const day = dayMap.get(tokyoDayKey(activityTime(entry))); if (day) day.gacha += 1; });

  return {
    totalPlayers: players.length,
    todayPlayers: activeToday.size,
    onlinePlayers: onlineStudents.size,
    battleCount: runs.length,
    wins: wonRuns,
    winRate: runs.length ? Math.round((wonRuns / runs.length) * 1000) / 10 : 0,
    gachaExecutions: gachaOperations.length,
    gachaResults,
    errorCount24h: errors.filter((entry) => activityTime(entry) >= nowMs - (24 * 60 * 60 * 1000)).length,
    rarityCounts,
    popularCharacters,
    activity: dayKeys,
    generatedAt: nowMs,
  };
}

module.exports = { buildMediguardAdminMetrics, toMillis, tokyoDayKey };
