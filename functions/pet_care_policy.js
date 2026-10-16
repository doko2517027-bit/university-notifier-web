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
const PET_CARE_ACTIONS = Object.freeze(["feed", "play", "pet"]);
const PET_FOOD_IDS = Object.freeze(["komatsuna", "pumpkin", "cricket"]);
const PET_FOOD_CATALOG = Object.freeze({
  komatsuna: { id: "komatsuna", name: "小松菜", imagePath: "assets/pets/food/bok-choy.png", preference: "好物", satisfaction: 22, fullnessGain: 24, infinite: true },
  pumpkin: { id: "pumpkin", name: "カボチャ", imagePath: "assets/pets/food/pumpkin.png", preference: "普通", satisfaction: 14, fullnessGain: 18, infinite: true },
  cricket: { id: "cricket", name: "コオロギ", imagePath: "assets/pets/food/cricket.png", preference: "大好物", satisfaction: 32, fullnessGain: 36, infinite: true },
});
const PET_SHOP_DEFAULT_ITEMS = Object.freeze([
  ...Object.values(PET_FOOD_CATALOG).map((food) => ({ ...food, kind: "food", price: 0, shopAvailable: true })),
  { id: "leaf-toy", kind: "toy", name: "葉っぱのおもちゃ", imagePath: "assets/pets/toys/leaf-toy.png", price: 30, shopAvailable: true, infinite: false },
]);
const PET_PREFERENCE_LABELS = Object.freeze(["大好物", "好物", "普通", "嫌い", "食べたくない"]);
const PET_AFFINITY_REWARD = Object.freeze({ pet: { amount: 1, cooldownMs: 6 * 60 * 60 * 1000 }, play: { amount: 1, cooldownMs: 2 * 60 * 60 * 1000 }, feed: { amount: 1, cooldownMs: 4 * 60 * 60 * 1000 } });
const PET_NIGHT_START_HOUR = 22;
const PET_NIGHT_END_HOUR = 6;
const PET_AFFINITY_DECAY_MS = 90 * 60 * 1000;
const PET_FULLNESS_DECAY_MS = 60 * 60 * 1000;

function isPetNight(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "2-digit", hourCycle: "h23" }).format(now));
  return hour >= PET_NIGHT_START_HOUR || hour < PET_NIGHT_END_HOUR;
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
function timestampMillis(value) {
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value && typeof value.toDate === "function") return value.toDate().getTime();
  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : 0;
}

function advancePetClock(profile, now = new Date()) {
  const next = { ...profile };
  // Keep affection and identity, but start the new fullness system hungry once.
  if (Number(next.schemaVersion || 1) < 2) {
    next.fullness = 8;
    next.schemaVersion = 2;
  } else if (next.fullness == null) next.fullness = 8;
  if (next.petCoins == null) next.petCoins = 100;
  if (!next.inventory || typeof next.inventory !== "object") next.inventory = {};
  if (!next.lastMeterAt) next.lastMeterAt = now;
  if (!next.lastAffinityDecayAt) next.lastAffinityDecayAt = now;
  if (!next.lastInteractionAt) next.lastInteractionAt = next.lastAffinityDecayAt || now;
  if (!next.affinityAwards || typeof next.affinityAwards !== "object") next.affinityAwards = {};
  const meterBase = timestampMillis(next.lastMeterAt) || now.getTime();
  const meterElapsed = Math.max(0, now.getTime() - meterBase);
  const meterTicks = Math.floor(meterElapsed / PET_FULLNESS_DECAY_MS);
  if (meterTicks) {
    next.fullness = clamp(next.fullness - meterTicks * 4, 0, 100);
    next.lastMeterAt = new Date(meterBase + meterTicks * PET_FULLNESS_DECAY_MS);
  }
  // Friendship decays only while the pet has been left alone, not merely because
  // a 90-minute wall-clock bucket elapsed during active care.
  const decayBase = timestampMillis(next.lastInteractionAt) || now.getTime();
  const decayElapsed = Math.max(0, now.getTime() - decayBase);
  const decayTicks = Math.floor(decayElapsed / PET_AFFINITY_DECAY_MS);
  if (decayTicks) {
    next.friendship = clamp(next.friendship - decayTicks, 0, 999999);
    next.lastInteractionAt = new Date(decayBase + decayTicks * PET_AFFINITY_DECAY_MS);
  }
  next.isSleeping = isPetNight(now);
  return next;
}

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
    schemaVersion: 2,
    species,
    name,
    createdAt: now,
    friendship: 0,
    fullness: 8,
    petCoins: 100,
    inventory: {},
    activeToyId: "",
    affinityAwards: {},
    lastMeterAt: now,
    lastAffinityDecayAt: now,
    lastInteractionAt: now,
    totalCareCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastCareDate: "",
    dailyCare: { date: jstDateKey(now), actions: {} },
    lastAction: "",
  };
}

function applyPetCare(profile, action, now = new Date(), options = {}) {
  if (!PET_CARE_ACTIONS.includes(action)) throw new Error("invalid-action");
  const advanced = advancePetClock(profile, now);
  if (advanced.isSleeping) throw new Error("sleep-time");
  const foodId = action === "feed" ? String(options.foodId || "cricket") : "";
  const food = action === "feed" ? (options.food || PET_FOOD_CATALOG[foodId]) : null;
  if (action === "feed" && (!food || !food.id || !food.imagePath)) throw new Error("invalid-food");
  if (action === "feed" && advanced.fullness >= 95) throw new Error("too-full");
  const date = jstDateKey(now);
  const sameDay = advanced.dailyCare?.date === date;
  const actions = sameDay ? { ...(advanced.dailyCare?.actions || {}) } : {};
  const firstCareToday = !sameDay || Object.keys(actions).length === 0;
  actions[action] = true;
  const reward = PET_AFFINITY_REWARD[action];
  const lastAwardAt = advanced.affinityAwards?.[action] ? timestampMillis(advanced.affinityAwards[action]) : 0;
  const canEarnAffinity = !lastAwardAt || now.getTime() - lastAwardAt >= reward.cooldownMs;
  const friendship = clamp(advanced.friendship + (canEarnAffinity ? reward.amount : 0), 0, 999999);
  const affinityAwards = { ...advanced.affinityAwards, ...(canEarnAffinity ? { [action]: now } : {}) };
  const fullness = action === "feed" ? clamp(advanced.fullness + clamp(food.fullnessGain, 0, 100), 0, 100) : advanced.fullness;
  const inventory = { ...(advanced.inventory || {}) };
  if (action === "feed" && food.infinite !== true) {
    const stock = Number(inventory[foodId] || 0);
    if (stock <= 0) throw new Error("out-of-stock");
    inventory[foodId] = stock - 1;
  }
  const coins = Number(advanced.petCoins || 0) + (canEarnAffinity ? 5 : 0);

  const previousCareDate = String(advanced.lastCareDate || "");
  let currentStreak = Number(advanced.currentStreak || 0);
  if (firstCareToday) {
    currentStreak = !previousCareDate ? 1 : previousCareDate === date ? currentStreak : isNextCalendarDay(previousCareDate, date) ? currentStreak + 1 : 1;
  }
  const bestStreak = Math.max(Number(advanced.bestStreak || 0), currentStreak);

  return {
    ...advanced,
    friendship,
    fullness,
    petCoins: coins,
    inventory,
    affinityAwards,
    lastAffinityDecayAt: canEarnAffinity ? now : advanced.lastAffinityDecayAt,
    lastMeterAt: action === "feed" ? now : advanced.lastMeterAt,
    lastInteractionAt: now,
    totalCareCount: Number(advanced.totalCareCount || 0) + 1,
    currentStreak,
    bestStreak,
    lastCareDate: date,
    dailyCare: { date, actions },
    lastAction: action,
    ...(foodId ? { lastFoodId: foodId, lastMeal: { foodId, satisfaction: clamp(food.satisfaction, 0, 100), preference: PET_PREFERENCE_LABELS.includes(food.preference) ? food.preference : "普通", ateAt: now } } : {}),
    updatedAt: now,
  };
}

module.exports = { PET_SPECIES, PET_EARLY_CHOICE_IDS, PET_CARE_ACTIONS, PET_FOOD_IDS, PET_FOOD_CATALOG, PET_SHOP_DEFAULT_ITEMS, PET_PREFERENCE_LABELS, PET_AFFINITY_REWARD, PET_AFFINITY_DECAY_MS, PET_FULLNESS_DECAY_MS, isPetNight, advancePetClock, petEligible, petChoices, jstDateKey, isNextCalendarDay, makePetProfile, applyPetCare };
