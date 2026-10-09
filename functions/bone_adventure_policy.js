const BONE_ADVENTURE_TESTERS = Object.freeze(["2510044"]);

const GACHA_COSTS = Object.freeze({ 1: 10, 5: 50, 10: 100 });
const RARITY_WEIGHTS = Object.freeze({ N: 550, R: 250, SR: 120, SSR: 60, UR: 18, LR: 2 });
const EXCHANGE_POINTS = Object.freeze({ N: 1, R: 3, SR: 5, SSR: 15, UR: 40, LR: 100 });
const MAX_LEVEL = 50;
const MAX_ENHANCEMENT = 5;
const RESPEC_COST = 300;

const ITEMS = Object.freeze([
  { id: "bone_polish", name: "ボーンポリッシュ", rarity: "N", kind: "material", ability: "獲得経験値 +1%" },
  { id: "lab_sticker", name: "研究室ステッカー", rarity: "N", kind: "decoration", ability: "見た目用アイテム" },
  { id: "cotton_bandage", name: "コットン包帯", rarity: "N", kind: "ability", ability: "被ダメージを少し軽減" },
  { id: "pulse_charm", name: "パルスチャーム", rarity: "R", kind: "ability", ability: "スコア倍率 +3%" },
  { id: "scan_goggles", name: "スキャンゴーグル", rarity: "R", kind: "decoration", ability: "障害物を見やすくする" },
  { id: "antivirus_capsule", name: "抗菌カプセル", rarity: "R", kind: "ability", ability: "菌への接触を1回防ぐ" },
  { id: "heart", name: "ハートコア", rarity: "SR", kind: "organ", organ: "heart", ability: "最大体力 +8" },
  { id: "lungs", name: "エアロラング", rarity: "SR", kind: "organ", organ: "lungs", ability: "ジャンプ持続 +6%" },
  { id: "eyes", name: "クリアアイ", rarity: "SR", kind: "organ", organ: "eyes", ability: "アイテム発見率 +5%" },
  { id: "muscle", name: "ランナーマッスル", rarity: "SSR", kind: "organ", organ: "muscle", ability: "走行速度 +8%" },
  { id: "skin", name: "バリアスキン", rarity: "SSR", kind: "organ", organ: "skin", ability: "最大体力 +15" },
  { id: "kidney", name: "リカバリーキドニー", rarity: "SSR", kind: "organ", organ: "kidney", ability: "回復効果 +12%" },
  { id: "brain", name: "ニューロブレイン", rarity: "UR", kind: "organ", organ: "brain", ability: "特殊能力の再使用 -15%" },
  { id: "plasma_heart", name: "プラズマハート", rarity: "UR", kind: "organ", organ: "heart", ability: "最大体力 +24" },
  { id: "golden_heart", name: "黄金の心臓", rarity: "LR", kind: "organ", organ: "heart", ability: "体力・スコア倍率を大幅強化" },
]);

function isBoneAdventureTester(studentNumber) {
  return BONE_ADVENTURE_TESTERS.includes(String(studentNumber || ""));
}

function gachaCost(count) {
  return GACHA_COSTS[Number(count)] || 0;
}

function rarityFromRoll(roll) {
  let cursor = 0;
  for (const rarity of ["N", "R", "SR", "SSR", "UR", "LR"]) {
    cursor += RARITY_WEIGHTS[rarity];
    if (roll < cursor) return rarity;
  }
  return "N";
}

function itemsForRarity(rarity) {
  return ITEMS.filter((item) => item.rarity === rarity);
}

function xpNeededForLevel(level) {
  return Math.max(100, Math.round(100 * Math.pow(Math.max(1, Number(level)), 1.35)));
}

function applyExperience(level, xp, gained) {
  let nextLevel = Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1));
  let nextXp = Math.max(0, Number(xp) || 0) + Math.max(0, Number(gained) || 0);
  let levelsGained = 0;
  while (nextLevel < MAX_LEVEL && nextXp >= xpNeededForLevel(nextLevel)) {
    nextXp -= xpNeededForLevel(nextLevel);
    nextLevel += 1;
    levelsGained += 1;
  }
  if (nextLevel >= MAX_LEVEL) nextXp = 0;
  return { level: nextLevel, xp: nextXp, levelsGained };
}

function equipmentSlotsForProgress(level, completedStages = []) {
  const stageBonus = [2, 5, 8].filter((stage) => completedStages.includes(stage)).length;
  return Math.min(5, 2 + (Number(level) >= 15 ? 1 : 0) + stageBonus);
}

function validStatAllocation(current = {}, next = {}, unspent = 0) {
  const keys = ["vitality", "agility", "power"];
  const normalized = {};
  let spent = 0;
  for (const key of keys) {
    const value = Number(next[key] || 0);
    const previous = Number(current[key] || 0);
    if (!Number.isInteger(value) || value < previous || value > 500) return null;
    normalized[key] = value;
    spent += value - previous;
  }
  return spent <= Number(unspent || 0) ? { stats: normalized, spent } : null;
}

function sanitizeRunResult(input = {}) {
  const mode = input.mode === "endless" ? "endless" : "stage";
  const durationMs = Math.max(0, Math.min(15 * 60_000, Math.round(Number(input.durationMs) || 0)));
  const distance = Math.max(0, Math.min(50_000, Math.round(Number(input.distance) || 0)));
  const score = Math.max(0, Math.min(1_000_000, Math.round(Number(input.score) || 0)));
  const stage = Math.max(1, Math.min(20, Math.round(Number(input.stage) || 1)));
  const completed = Boolean(input.completed);
  if (durationMs < 2_000 || distance > durationMs * 0.08 + 500 || score > distance * 25 + 5_000) return null;
  return { mode, durationMs, distance, score, stage, completed };
}

module.exports = {
  BONE_ADVENTURE_TESTERS,
  GACHA_COSTS,
  RARITY_WEIGHTS,
  EXCHANGE_POINTS,
  MAX_LEVEL,
  MAX_ENHANCEMENT,
  RESPEC_COST,
  ITEMS,
  isBoneAdventureTester,
  gachaCost,
  rarityFromRoll,
  itemsForRarity,
  xpNeededForLevel,
  applyExperience,
  equipmentSlotsForProgress,
  validStatAllocation,
  sanitizeRunResult,
};
