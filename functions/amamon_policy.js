const AMAMON_TESTERS = Object.freeze(["2510044"]);
const SCHEMA_VERSION = 1;
const INITIAL_GOLD = 3000;
const INITIAL_LEVEL_CAP = 50;
const ABSOLUTE_LEVEL_CAP = 100;
const RESPEC_COST = 300;
const MAX_ENHANCEMENT = 5;
const GACHA_COSTS = Object.freeze({ 1: 10, 10: 100 });
const RARITY_WEIGHTS = Object.freeze({ N: 550, R: 250, SR: 120, SSR: 60, UR: 18, LR: 2 });
const EXCHANGE_POINTS = Object.freeze({ N: 1, R: 3, SR: 5, SSR: 15, UR: 40, LR: 100 });
const EQUIPMENT_SLOTS = Object.freeze(["weapon", "head", "body", "shield", "accessory"]);
const SKILL_BRANCHES = Object.freeze(["sword", "fist", "magic", "healing", "guard"]);

const BASE_STATS = Object.freeze({ maxHp: 110, maxMp: 45, attack: 18, defense: 16, speed: 14, magic: 15, resistance: 14 });
const LEVEL_GROWTH = Object.freeze({ maxHp: 7, maxMp: 3, attack: 2, defense: 2, speed: 1, magic: 2, resistance: 2 });

const SKILLS = Object.freeze([
  { id: "slash", name: "ブロンズスラッシュ", branch: "sword", points: 0, type: "skill", mp: 0, power: 26, accuracy: 100, priority: 0 },
  { id: "twin_slash", name: "ツインエッジ", branch: "sword", points: 5, type: "skill", mp: 6, power: 43, accuracy: 94, priority: 0 },
  { id: "armor_break", name: "アーマーブレイク", branch: "sword", points: 15, type: "skill", mp: 10, power: 55, accuracy: 90, effect: "defenseDown" },
  { id: "meteor_blade", name: "メテオブレード", branch: "sword", points: 30, type: "skill", mp: 18, power: 88, accuracy: 88 },
  { id: "rush_punch", name: "ラッシュパンチ", branch: "fist", points: 5, type: "skill", mp: 5, power: 39, accuracy: 98, priority: 1 },
  { id: "counter_stance", name: "カウンター構え", branch: "fist", points: 15, type: "skill", mp: 9, power: 48, accuracy: 100, effect: "counter" },
  { id: "burst_knuckle", name: "バーストナックル", branch: "fist", points: 30, type: "skill", mp: 17, power: 84, accuracy: 90 },
  { id: "spark", name: "スパーク", branch: "magic", points: 0, type: "spell", mp: 5, power: 31, accuracy: 100, magic: true },
  { id: "aqua_orb", name: "アクアオーブ", branch: "magic", points: 5, type: "spell", mp: 8, power: 44, accuracy: 96, magic: true },
  { id: "storm_burst", name: "ストームバースト", branch: "magic", points: 15, type: "spell", mp: 13, power: 61, accuracy: 92, magic: true },
  { id: "nova", name: "アストラノヴァ", branch: "magic", points: 30, type: "spell", mp: 22, power: 96, accuracy: 88, magic: true },
  { id: "mini_heal", name: "ミニヒール", branch: "healing", points: 5, type: "spell", mp: 7, heal: 34, accuracy: 100 },
  { id: "heal", name: "リカバリー", branch: "healing", points: 15, type: "spell", mp: 13, heal: 68, accuracy: 100 },
  { id: "renew", name: "リニュー", branch: "healing", points: 30, type: "spell", mp: 20, heal: 110, accuracy: 100, effect: "cleanse" },
  { id: "iron_guard", name: "アイアンガード", branch: "guard", points: 5, type: "skill", mp: 5, power: 0, accuracy: 100, effect: "guardPlus" },
  { id: "fortress", name: "フォートレス", branch: "guard", points: 15, type: "skill", mp: 10, power: 0, accuracy: 100, effect: "fortress" },
  { id: "guardian_roar", name: "ガーディアンロア", branch: "guard", points: 30, type: "skill", mp: 16, power: 50, accuracy: 95, effect: "attackDown" },
]);

const ITEMS = Object.freeze([
  { id: "bronze_sword", name: "ブロンズソード", rarity: "N", kind: "equipment", slot: "weapon", stats: { attack: 4 }, maxEnhancement: 5 },
  { id: "cloth_cap", name: "旅立ちの帽子", rarity: "N", kind: "equipment", slot: "head", stats: { defense: 2, maxHp: 5 }, maxEnhancement: 5 },
  { id: "mini_potion", name: "ミニポーション", rarity: "N", kind: "consumable", use: "battle", effect: { healHp: 35 } },
  { id: "antidote_drop", name: "クリアドロップ", rarity: "N", kind: "consumable", use: "battle", effect: { cureStatus: true } },
  { id: "bronze_mail", name: "ブロンズメイル", rarity: "R", kind: "equipment", slot: "body", stats: { defense: 7, maxHp: 12 }, maxEnhancement: 5 },
  { id: "round_shield", name: "ラウンドシールド", rarity: "R", kind: "equipment", slot: "shield", stats: { defense: 6, resistance: 3 }, maxEnhancement: 5 },
  { id: "mana_drop", name: "マナドロップ", rarity: "R", kind: "consumable", use: "battle", effect: { healMp: 24 } },
  { id: "power_tonic", name: "パワートニック", rarity: "R", kind: "consumable", use: "battle", effect: { attackUp: 1.25 } },
  { id: "swift_blade", name: "疾風の剣", rarity: "SR", kind: "equipment", slot: "weapon", stats: { attack: 12, speed: 6 }, specialSkill: "gale_cut", maxEnhancement: 5 },
  { id: "sage_charm", name: "賢者のチャーム", rarity: "SR", kind: "equipment", slot: "accessory", stats: { magic: 10, maxMp: 12 }, maxEnhancement: 5 },
  { id: "power_seed", name: "ちからの結晶", rarity: "SR", kind: "permanent", stat: "attack", amount: 1, cap: 30 },
  { id: "knight_armor", name: "騎士団の鎧", rarity: "SSR", kind: "equipment", slot: "body", stats: { defense: 18, maxHp: 32, resistance: 8 }, maxEnhancement: 5 },
  { id: "aegis_shield", name: "イージスシールド", rarity: "SSR", kind: "equipment", slot: "shield", stats: { defense: 15, resistance: 15 }, specialSkill: "aegis_wall", maxEnhancement: 5 },
  { id: "life_seed", name: "生命の結晶", rarity: "SSR", kind: "permanent", stat: "maxHp", amount: 3, cap: 90 },
  { id: "arcane_staff", name: "星詠みの杖", rarity: "UR", kind: "equipment", slot: "weapon", stats: { magic: 28, maxMp: 24 }, specialSkill: "star_fall", maxEnhancement: 5 },
  { id: "phoenix_crown", name: "不死鳥の冠", rarity: "UR", kind: "equipment", slot: "head", stats: { maxHp: 40, magic: 15, resistance: 18 }, maxEnhancement: 5 },
  { id: "celestial_armor", name: "天穹の鎧", rarity: "LR", kind: "equipment", slot: "body", stats: { maxHp: 80, defense: 35, resistance: 35 }, specialSkill: "celestial_guard", maxEnhancement: 5 },
]);

const EQUIPMENT_SKILLS = Object.freeze([
  { id: "gale_cut", name: "ゲイルカット", type: "skill", mp: 12, power: 70, accuracy: 96, priority: 1 },
  { id: "aegis_wall", name: "イージスウォール", type: "skill", mp: 14, power: 0, accuracy: 100, effect: "fortress" },
  { id: "star_fall", name: "スターフォール", type: "spell", mp: 24, power: 105, accuracy: 90, magic: true },
  { id: "celestial_guard", name: "セレスティアルガード", type: "skill", mp: 20, power: 55, accuracy: 100, effect: "fortress" },
  { id: "toxic_spore", name: "どくの胞子", type: "skill", mp: 4, power: 18, accuracy: 92, effect: "poison" },
]);

const ENEMIES = Object.freeze([
  { id: "moss_blob", stage: 1, name: "モスプルン", sprite: 0, level: 1, stats: { maxHp: 82, maxMp: 20, attack: 13, defense: 9, speed: 8, magic: 8, resistance: 8 }, skills: ["attack", "toxic_spore"], reward: { xp: 55, gold: 85, drop: "mini_potion", dropRate: 25 } },
  { id: "shell_beetle", stage: 2, name: "シェルビート", sprite: 1, level: 5, stats: { maxHp: 145, maxMp: 25, attack: 21, defense: 24, speed: 9, magic: 8, resistance: 15 }, skills: ["attack", "guard"], ai: "defensive", reward: { xp: 95, gold: 130, drop: "round_shield", dropRate: 8 } },
  { id: "ember_fox", stage: 3, name: "ヒノコル", sprite: 2, level: 10, stats: { maxHp: 190, maxMp: 55, attack: 28, defense: 18, speed: 31, magic: 30, resistance: 19 }, skills: ["attack", "spark"], ai: "aggressive", reward: { xp: 150, gold: 190, drop: "mana_drop", dropRate: 22 } },
  { id: "iron_golem", stage: 4, name: "ギアゴーレム", sprite: 3, level: 18, stats: { maxHp: 310, maxMp: 40, attack: 40, defense: 48, speed: 12, magic: 12, resistance: 35 }, skills: ["attack", "guard", "armor_break"], ai: "defensive", reward: { xp: 240, gold: 300, drop: "bronze_mail", dropRate: 12 } },
  { id: "storm_wisp", stage: 5, name: "テンペスト", sprite: 4, level: 28, stats: { maxHp: 360, maxMp: 130, attack: 28, defense: 30, speed: 55, magic: 58, resistance: 48 }, skills: ["spark", "aqua_orb", "storm_burst"], ai: "caster", reward: { xp: 390, gold: 480, drop: "sage_charm", dropRate: 7 } },
  { id: "royal_beast", stage: 6, name: "獣王グランヴァ", sprite: 5, level: 40, stats: { maxHp: 620, maxMp: 120, attack: 72, defense: 60, speed: 46, magic: 45, resistance: 54 }, skills: ["attack", "rush_punch", "guardian_roar"], ai: "boss", reward: { xp: 700, gold: 900, drop: "knight_armor", dropRate: 6 } },
  { id: "limit_50", stage: 50, name: "限界守護獣・銅", sprite: 5, level: 50, limitBoss: true, unlockCap: 60, stats: { maxHp: 900, maxMp: 160, attack: 88, defense: 78, speed: 58, magic: 70, resistance: 72 }, skills: ["attack", "armor_break", "fortress"], ai: "boss", reward: { xp: 1000, gold: 1500 } },
  { id: "limit_60", stage: 60, name: "限界守護獣・銀", sprite: 5, level: 60, limitBoss: true, unlockCap: 70, stats: { maxHp: 1250, maxMp: 210, attack: 112, defense: 98, speed: 75, magic: 95, resistance: 94 }, skills: ["attack", "storm_burst", "fortress"], ai: "boss", reward: { xp: 1400, gold: 1900 } },
  { id: "limit_70", stage: 70, name: "限界守護獣・金", sprite: 5, level: 70, limitBoss: true, unlockCap: 80, stats: { maxHp: 1650, maxMp: 260, attack: 142, defense: 122, speed: 92, magic: 120, resistance: 118 }, skills: ["meteor_blade", "nova", "fortress"], ai: "boss", reward: { xp: 1900, gold: 2400 } },
  { id: "limit_80", stage: 80, name: "限界守護獣・虹", sprite: 5, level: 80, limitBoss: true, unlockCap: 90, stats: { maxHp: 2100, maxMp: 320, attack: 175, defense: 150, speed: 110, magic: 150, resistance: 145 }, skills: ["meteor_blade", "nova", "guardian_roar"], ai: "boss", reward: { xp: 2500, gold: 3000 } },
  { id: "limit_90", stage: 90, name: "真・限界守護獣", sprite: 5, level: 90, limitBoss: true, unlockCap: 100, stats: { maxHp: 2700, maxMp: 400, attack: 215, defense: 185, speed: 132, magic: 185, resistance: 180 }, skills: ["meteor_blade", "nova", "celestial_guard"], ai: "boss", reward: { xp: 3200, gold: 4000 } },
]);

const LOSS_PENALTIES = Object.freeze([
  { max: 5, gold: 50 }, { max: 10, gold: 100 }, { max: 15, gold: 200 }, { max: 20, gold: 300 },
  { max: 30, gold: 500 }, { max: 40, gold: 800 }, { max: 50, gold: 1000 },
]);

function isAmamonTester(studentNumber) { return AMAMON_TESTERS.includes(String(studentNumber || "")); }
function gachaCost(count) { return GACHA_COSTS[Number(count)] || 0; }
function rarityFromRoll(roll) { let cursor = 0; for (const rarity of ["N", "R", "SR", "SSR", "UR", "LR"]) { cursor += RARITY_WEIGHTS[rarity]; if (roll < cursor) return rarity; } return "N"; }
function itemsForRarity(rarity) { return ITEMS.filter((item) => item.rarity === rarity); }
function xpNeededForLevel(level) { return Math.max(100, Math.round(105 * Math.pow(Math.max(1, Number(level)), 1.32))); }
function normalizeName(value) { const name = String(value || "").replace(/[<>]/g, "").trim().slice(0, 12); return name || "アマル"; }
function baseStatsForLevel(level) { const result = {}; for (const key of Object.keys(BASE_STATS)) result[key] = BASE_STATS[key] + LEVEL_GROWTH[key] * Math.max(0, Number(level) - 1); return result; }
function itemStats(item, enhancement = 0) { const multiplier = 1 + Math.min(MAX_ENHANCEMENT, Math.max(0, Number(enhancement))) * .12; return Object.fromEntries(Object.entries(item?.stats || {}).map(([key, value]) => [key, Math.round(value * multiplier)])); }
function totalStats(state = {}, inventory = []) {
  const result = baseStatsForLevel(state.level || 1);
  for (const [key, value] of Object.entries(state.permanentBoosts || {})) result[key] = (result[key] || 0) + Math.max(0, Number(value || 0));
  const equipped = new Set(Object.values(state.equipment || {}).filter(Boolean));
  for (const inventoryItem of inventory.filter((entry) => equipped.has(entry.id))) for (const [key, value] of Object.entries(itemStats(inventoryItem, inventoryItem.enhancementLevel))) result[key] = (result[key] || 0) + value;
  return result;
}
function skillsForState(state = {}, inventory = []) {
  const allocation = state.skillAllocation || {};
  const learned = SKILLS.filter((skill) => Number(allocation[skill.branch] || 0) >= skill.points);
  const equippedIds = new Set(Object.values(state.equipment || {}).filter(Boolean));
  const itemSkills = inventory.filter((item) => equippedIds.has(item.id) && item.specialSkill).map((item) => EQUIPMENT_SKILLS.find((skill) => skill.id === item.specialSkill)).filter(Boolean);
  return [...new Map([...learned, ...itemSkills].map((skill) => [skill.id, skill])).values()];
}
function growthForm(state = {}) {
  const level = Number(state.level || 1);
  const allocation = state.skillAllocation || {};
  const branch = SKILL_BRANCHES.reduce((best, key) => Number(allocation[key] || 0) > Number(allocation[best] || 0) ? key : best, "sword");
  const stage = level >= 40 ? 3 : level >= 20 ? 2 : level >= 10 ? 1 : 0;
  return { stage, branch: stage ? branch : "baby", key: stage ? `${branch}_${stage}` : "baby" };
}
function applyExperience(state, gained) {
  let level = Math.max(1, Number(state.level || 1));
  const cap = Math.max(INITIAL_LEVEL_CAP, Math.min(ABSOLUTE_LEVEL_CAP, Number(state.levelCap || INITIAL_LEVEL_CAP)));
  let xp = Math.max(0, Number(state.xp || 0)) + Math.max(0, Number(gained || 0)) + Math.max(0, Number(state.overflowXp || 0));
  let levelsGained = 0;
  while (level < cap && xp >= xpNeededForLevel(level)) { xp -= xpNeededForLevel(level); level += 1; levelsGained += 1; }
  const overflowXp = level >= cap ? xp : 0;
  if (level >= cap) xp = 0;
  return { level, xp, overflowXp, levelsGained, totalXp: Number(state.totalXp || 0) + Math.max(0, Number(gained || 0)) };
}
function validSkillAllocation(current = {}, next = {}, unspent = 0) {
  const normalized = {}; let spent = 0;
  for (const key of SKILL_BRANCHES) { const value = Number(next[key] || 0); const previous = Number(current[key] || 0); if (!Number.isInteger(value) || value < previous || value > 999) return null; normalized[key] = value; spent += value - previous; }
  return spent <= Number(unspent || 0) ? { allocation: normalized, spent } : null;
}
function lossPenalty(stage, limitBoss = false) { if (limitBoss) return 1500; return LOSS_PENALTIES.find((row) => Number(stage) <= row.max)?.gold || 1000; }
function validAction(action = {}) {
  const type = String(action.type || "");
  if (!["attack", "skill", "spell", "item", "guard", "equipment"].includes(type)) return null;
  const id = String(action.id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
  return { type, id };
}

module.exports = {
  AMAMON_TESTERS, SCHEMA_VERSION, INITIAL_GOLD, INITIAL_LEVEL_CAP, ABSOLUTE_LEVEL_CAP, RESPEC_COST, MAX_ENHANCEMENT,
  GACHA_COSTS, RARITY_WEIGHTS, EXCHANGE_POINTS, EQUIPMENT_SLOTS, SKILL_BRANCHES, BASE_STATS, SKILLS, ITEMS, EQUIPMENT_SKILLS, ENEMIES,
  isAmamonTester, gachaCost, rarityFromRoll, itemsForRarity, xpNeededForLevel, normalizeName, baseStatsForLevel, itemStats, totalStats,
  skillsForState, growthForm, applyExperience, validSkillAllocation, lossPenalty, validAction,
};
