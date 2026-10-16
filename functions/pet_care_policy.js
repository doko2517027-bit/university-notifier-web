const PET_SPECIES = Object.freeze({
  dog: { name: "いぬ", emoji: "🐶" },
  cat: { name: "ねこ", emoji: "🐱" },
  lizard: { name: "トカゲ", emoji: "🦎" },
  fox: { name: "きつね", emoji: "🦊" },
  rabbit: { name: "うさぎ", emoji: "🐰" },
});

// Only the lizard has usable artwork in this release. Keep the other species
// visible as silhouettes in the UI, but unavailable until their assets exist.
const PET_EARLY_CHOICE_IDS = Object.freeze(["lizard"]);
const PET_CARE_ACTIONS = Object.freeze(["feed", "play", "pet", "sleep"]);

function petEligible(studentNumber, referralAccount = {}) {
  return String(studentNumber) === "2510044";
}

function petChoices(studentNumber) {
  return [...PET_EARLY_CHOICE_IDS];
}

function jstDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isNextCalendarDay(previous, current) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(previous || "")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(current || ""))) return false;
  const a = Date.parse(`${previous}T00:00:00+09:00`);
  const b = Date.parse(`${current}T00:00:00+09:00`);
  return b - a === 86_400_000;
}

function makePetProfile({ species, name, now = new Date() }) {
  return {
    schemaVersion: 1,
    species,
    name,
    createdAt: now,
    friendship: 0,
    totalCareCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastCareDate: "",
    dailyCare: { date: jstDateKey(now), actions: {} },
    lastAction: "",
  };
}

function applyPetCare(profile, action, now = new Date()) {
  if (!PET_CARE_ACTIONS.includes(action)) throw new Error("invalid-action");
  const date = jstDateKey(now);
  const sameDay = profile.dailyCare?.date === date;
  const actions = sameDay ? { ...(profile.dailyCare?.actions || {}) } : {};
  if (actions[action]) throw new Error("already-cared");
  actions[action] = true;

  const firstToday = !sameDay || Object.keys(profile.dailyCare?.actions || {}).length === 0;
  let currentStreak = Number(profile.currentStreak || 0);
  if (firstToday) {
    currentStreak = profile.lastCareDate === date
      ? Math.max(currentStreak, 1)
      : isNextCalendarDay(profile.lastCareDate, date)
        ? currentStreak + 1
        : 1;
  }

  return {
    ...profile,
    friendship: Number(profile.friendship || 0) + 1,
    totalCareCount: Number(profile.totalCareCount || 0) + 1,
    currentStreak,
    bestStreak: Math.max(Number(profile.bestStreak || 0), currentStreak),
    lastCareDate: date,
    dailyCare: { date, actions },
    lastAction: action,
    updatedAt: now,
  };
}

module.exports = { PET_SPECIES, PET_EARLY_CHOICE_IDS, PET_CARE_ACTIONS, petEligible, petChoices, jstDateKey, isNextCalendarDay, makePetProfile, applyPetCare };
