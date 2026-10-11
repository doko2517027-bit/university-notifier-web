const { CHARACTERS, GACHA_COSTS, RARITY_WEIGHTS } = require("./mediguard_policy");

const RARITIES = Object.freeze(["N", "R", "SR", "SSR", "UR", "LR"]);
const PASSIVE_TYPES = Object.freeze([
  "rangeBoost", "speedBoost", "chargeBoost", "attackBoost",
  "extraHit", "cooldownBoost", "revive", "allBoost",
]);
const SKILL_TYPES = Object.freeze([
  "radial", "rapid", "pierce", "triple", "shield",
  "area", "healBurst", "freezeBurst",
]);

const DEFAULT_BANNER = Object.freeze({
  id: "standard",
  name: "スタンダードスキャン",
  subtitle: "すべての基本キャラクターが登場",
  enabled: true,
  limited: false,
  startsAt: null,
  endsAt: null,
  singleCost: GACHA_COSTS[1],
  tenCost: GACHA_COSTS[10],
  rates: RARITY_WEIGHTS,
  characterIds: CHARACTERS.map((item) => item.id),
  accent: "#efb34d",
  sortOrder: 0,
});

function text(value, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}
function number(value, min, max, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}
function identifier(value, fallback = "") {
  const result = text(value, 48).toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return result || fallback;
}
function isoDate(value) {
  if (!value) return null;
  const date = value?.toDate?.() || new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function sanitizeRates(value = {}) {
  return Object.fromEntries(RARITIES.map((rarity) => [
    rarity,
    Math.round(number(value[rarity], 0, 1000, RARITY_WEIGHTS[rarity])),
  ]));
}
function sanitizeCharacter(value = {}, fallback = {}) {
  const passiveType = PASSIVE_TYPES.includes(value.passiveType) ? value.passiveType : fallback.passiveType || "rangeBoost";
  const skillType = SKILL_TYPES.includes(value.skillType) ? value.skillType : fallback.skillType || "radial";
  return {
    id: identifier(value.id, fallback.id),
    name: text(value.name || fallback.name, 30),
    rarity: RARITIES.includes(value.rarity) ? value.rarity : fallback.rarity || "N",
    sprite: Math.round(number(value.sprite, 0, 9, fallback.sprite || 0)),
    attack: number(value.attack, 1, 50, fallback.attack || 10),
    speed: number(value.speed, 50, 180, fallback.speed || 100),
    range: number(value.range, 50, 180, fallback.range || 100),
    charge: number(value.charge, 50, 180, fallback.charge || 100),
    passive: text(value.passive || fallback.passive, 100),
    passiveType,
    passiveValue: number(value.passiveValue, 0, 100, fallback.passiveValue || 0),
    skill: text(value.skill || fallback.skill, 100),
    skillType,
    skillValue: number(value.skillValue, 0, 100, fallback.skillValue || 0),
    cooldown: number(value.cooldown, 3, 120, fallback.cooldown || 18),
    enabled: value.enabled !== false,
  };
}
function sanitizeBanner(value = {}) {
  const rates = sanitizeRates(value.rates);
  const startsAt = isoDate(value.startsAt);
  const endsAt = isoDate(value.endsAt);
  return {
    id: identifier(value.id, "standard"),
    name: text(value.name, 40) || "名称未設定ガチャ",
    subtitle: text(value.subtitle, 100),
    enabled: value.enabled !== false,
    limited: value.limited === true,
    startsAt,
    endsAt,
    singleCost: Math.round(number(value.singleCost, 1, 9999, 30)),
    tenCost: Math.round(number(value.tenCost, 1, 99999, 300)),
    rates,
    characterIds: [...new Set((Array.isArray(value.characterIds) ? value.characterIds : []).map((id) => identifier(id)).filter(Boolean))].slice(0, 100),
    accent: /^#[0-9a-f]{6}$/i.test(String(value.accent || "")) ? String(value.accent) : "#efb34d",
    sortOrder: Math.round(number(value.sortOrder, -999, 999, 0)),
  };
}
function validateCharacter(character) {
  if (!character.id || !character.name || !character.passive || !character.skill) return "ID・名前・パッシブ・スキルは必須です。";
  return "";
}
function validateBanner(banner, characters) {
  if (!banner.id || !banner.name) return "ガチャIDと表示名は必須です。";
  if (Object.values(banner.rates).reduce((sum, value) => sum + value, 0) !== 1000) return "排出率の合計を100.0%にしてください。";
  if (!banner.characterIds.length) return "排出キャラクターを1体以上選択してください。";
  const catalog = new Map(characters.map((item) => [item.id, item]));
  for (const rarity of RARITIES) {
    if (banner.rates[rarity] > 0 && !banner.characterIds.some((id) => catalog.get(id)?.rarity === rarity && catalog.get(id)?.enabled !== false)) {
      return `${rarity}の排出率がありますが、対象キャラクターがいません。`;
    }
  }
  if (banner.startsAt && banner.endsAt && new Date(banner.startsAt) >= new Date(banner.endsAt)) return "終了日時は開始日時より後にしてください。";
  return "";
}
function isBannerAvailable(banner, now = Date.now()) {
  if (!banner.enabled) return false;
  if (banner.startsAt && now < new Date(banner.startsAt).getTime()) return false;
  if (banner.endsAt && now >= new Date(banner.endsAt).getTime()) return false;
  return true;
}
function rarityFromWeights(value, rates) {
  let cursor = 0;
  for (const rarity of RARITIES) {
    cursor += Number(rates[rarity] || 0);
    if (value < cursor) return rarity;
  }
  return "N";
}
async function loadMediguardConfig(db) {
  const [settingsSnapshot, bannerSnapshot, characterSnapshot] = await Promise.all([
    db.collection("mediguardGameConfig").doc("settings").get(),
    db.collection("mediguardGachaBanners").get(),
    db.collection("mediguardCharacterConfigs").get(),
  ]);
  const overrides = new Map(characterSnapshot.docs.map((doc) => [doc.id, doc.data()]));
  const characters = CHARACTERS.map((item) => sanitizeCharacter({ ...item, ...(overrides.get(item.id) || {}), id: item.id }, item));
  for (const doc of characterSnapshot.docs) {
    if (!characters.some((item) => item.id === doc.id)) characters.push(sanitizeCharacter({ ...doc.data(), id: doc.id }));
  }
  const storedBanners = bannerSnapshot.docs.map((doc) => sanitizeBanner({ ...doc.data(), id: doc.id }));
  const standardOverride = storedBanners.find((item) => item.id === DEFAULT_BANNER.id);
  const banners = [
    standardOverride ? sanitizeBanner({ ...DEFAULT_BANNER, ...standardOverride }) : { ...DEFAULT_BANNER },
    ...storedBanners.filter((item) => item.id !== DEFAULT_BANNER.id),
  ].sort((a, b) => a.sortOrder - b.sortOrder);
  const settings = {
    activeBannerId: identifier(settingsSnapshot.data()?.activeBannerId, banners[0]?.id || DEFAULT_BANNER.id),
    gameEnabled: settingsSnapshot.data()?.gameEnabled !== false,
    notice: text(settingsSnapshot.data()?.notice, 160),
  };
  return { settings, banners, characters };
}

module.exports = {
  RARITIES, PASSIVE_TYPES, SKILL_TYPES, DEFAULT_BANNER,
  sanitizeRates, sanitizeCharacter, sanitizeBanner, validateCharacter,
  validateBanner, isBannerAvailable, rarityFromWeights, loadMediguardConfig,
};
