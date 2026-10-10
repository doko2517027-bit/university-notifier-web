const MEDIGUARD_TESTERS = Object.freeze(["2510044"]);
const SCHEMA_VERSION = 1;
const INITIAL_LEVEL_CAP = 50;
const GACHA_COSTS = Object.freeze({ 1: 30, 10: 300 });
const RARITY_WEIGHTS = Object.freeze({ N: 550, R: 250, SR: 120, SSR: 60, UR: 18, LR: 2 });
const EXCHANGE_POINTS = Object.freeze({ N: 5, R: 10, SR: 25, SSR: 60, UR: 150, LR: 500 });
const MAPS = Object.freeze([
  { id: "lung", name: "肺胞エリア", pathogen: "ウイルス様粒子", weapon: "抗ウイルス薬モチーフ弾", firstClearPoints: 60 },
  { id: "airway", name: "気道エリア", pathogen: "細菌様粒子", weapon: "抗菌薬モチーフ弾", firstClearPoints: 60 },
  { id: "intestine", name: "腸管エリア", pathogen: "細菌様粒子", weapon: "抗菌薬モチーフ弾", firstClearPoints: 70 },
  { id: "urinary", name: "膀胱・尿路エリア", pathogen: "細菌様粒子", weapon: "抗菌薬モチーフ弾", firstClearPoints: 70 },
  { id: "vessel", name: "血管エリア", pathogen: "真菌様粒子", weapon: "抗真菌薬モチーフ弾", firstClearPoints: 80 },
  { id: "skin", name: "皮膚エリア", pathogen: "真菌様粒子", weapon: "抗真菌薬モチーフ弾", firstClearPoints: 80 },
]);
const CHARACTERS = Object.freeze([
  { id: "cell_maru", name: "セルマル", rarity: "N", sprite: 0, attack: 10, speed: 100, range: 105, charge: 100, passive: "射程が10%長い", skill: "浄化リング：周囲へ一斉攻撃", cooldown: 18 },
  { id: "medic_fox", name: "メディコ", rarity: "N", sprite: 1, attack: 10, speed: 108, range: 100, charge: 105, passive: "移動速度が8%速い", skill: "クイック処方：8秒間連射速度アップ", cooldown: 20 },
  { id: "spark_chick", name: "ボルピヨ", rarity: "R", sprite: 2, attack: 11, speed: 104, range: 102, charge: 118, passive: "チャージが18%速い", skill: "スパークライン：貫通する薬剤弾", cooldown: 17 },
  { id: "aqua_cat", name: "アクニャ", rarity: "R", sprite: 3, attack: 11, speed: 103, range: 112, charge: 108, passive: "弾速と射程が12%高い", skill: "アクアバースト：前方3方向攻撃", cooldown: 16 },
  { id: "guard_bear", name: "ガードン", rarity: "SR", sprite: 4, attack: 11, speed: 92, range: 100, charge: 100, passive: "各残機の被弾上限が1増える", skill: "無菌シールド：5秒間無敵", cooldown: 24 },
  { id: "mint_dragon", name: "ミントラ", rarity: "SR", sprite: 5, attack: 13, speed: 100, range: 104, charge: 105, passive: "攻撃力が13%高い", skill: "リカバリーミスト：被弾を1回回復", cooldown: 25 },
  { id: "rapid_rabbit", name: "ラピット", rarity: "SSR", sprite: 6, attack: 12, speed: 118, range: 106, charge: 112, passive: "移動速度が18%速い", skill: "トリプルショット：3方向へ強力射撃", cooldown: 14 },
  { id: "star_sheep", name: "ステラーム", rarity: "SSR", sprite: 7, attack: 14, speed: 98, range: 115, charge: 115, passive: "スキル再使用が20%早い", skill: "星雲消毒：広範囲へ継続ダメージ", cooldown: 18 },
  { id: "chemist_tanuki", name: "ケミポン", rarity: "UR", sprite: 8, attack: 15, speed: 106, range: 115, charge: 122, passive: "戦闘ごとに最初の死亡を無効化", skill: "メディシンレイン：全方向へ連続射撃", cooldown: 16 },
  { id: "celestial_guard", name: "ルミナス", rarity: "LR", sprite: 9, attack: 18, speed: 112, range: 122, charge: 128, passive: "全基礎能力が12%上昇", skill: "ゴールデンタイム：敵を止めて連続攻撃", cooldown: 14 },
]);

function isMediguardTester(value) { return MEDIGUARD_TESTERS.includes(String(value || "")); }
function gachaCost(count) { return GACHA_COSTS[Number(count)] || 0; }
function rarityFromRoll(value) {
  let cursor = 0;
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    cursor += weight;
    if (value < cursor) return rarity;
  }
  return "N";
}
function charactersForRarity(rarity) { return CHARACTERS.filter((item) => item.rarity === rarity); }
function xpNeeded(level) { return 120 + Math.max(0, Number(level || 1) - 1) * 45; }
function applyExperience(character, earned) {
  const result = { ...character, xp: Math.max(0, Number(character.xp || 0)) + Math.max(0, Number(earned || 0)) };
  let gained = 0;
  while (result.level < result.levelCap && result.xp >= xpNeeded(result.level)) {
    result.xp -= xpNeeded(result.level);
    result.level += 1;
    gained += 1;
  }
  return { character: result, levelsGained: gained };
}
function runReward(summary, map, firstClear) {
  const kills = Math.max(0, Math.floor(Number(summary.kills || 0)));
  const wave = Math.max(0, Math.min(3, Math.floor(Number(summary.wave || 0))));
  const won = summary.won === true && wave === 3;
  return {
    xp: Math.min(800, kills * 7 + wave * 35 + (won ? 120 : 0)),
    gachaPoints: won && firstClear ? Number(map.firstClearPoints || 0) : 0,
    won,
  };
}
function isPlausibleRun(summary, startedAt, now = Date.now()) {
  const duration = Math.max(0, Number(summary.durationMs || 0));
  const elapsed = Math.max(0, now - Number(startedAt || 0));
  const kills = Math.max(0, Number(summary.kills || 0));
  const shots = Math.max(0, Number(summary.shots || 0));
  return duration >= 3000 && duration <= 180000 && duration <= elapsed + 8000 && kills <= 90 && shots <= 500 && kills <= shots * 4 + 12;
}

module.exports = {
  MEDIGUARD_TESTERS, SCHEMA_VERSION, INITIAL_LEVEL_CAP, GACHA_COSTS, RARITY_WEIGHTS,
  EXCHANGE_POINTS, MAPS, CHARACTERS, isMediguardTester, gachaCost, rarityFromRoll,
  charactersForRarity, xpNeeded, applyExperience, runReward, isPlausibleRun,
};
