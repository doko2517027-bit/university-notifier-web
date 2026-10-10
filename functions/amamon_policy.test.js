const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RARITY_WEIGHTS, ITEMS, ENEMIES, isAmamonTester, gachaCost, rarityFromRoll,
  applyExperience, validSkillAllocation, lossPenalty, validAction, totalStats,
} = require("./amamon_policy.js");

test("テスト対象は2510044だけで許可配列から判定する", () => {
  assert.equal(isAmamonTester("2510044"), true);
  assert.equal(isAmamonTester("2510045"), false);
});

test("指定されたガチャ確率は合計100%で単発と10連だけを許可する", () => {
  assert.equal(Object.values(RARITY_WEIGHTS).reduce((sum, value) => sum + value, 0), 1000);
  assert.equal(rarityFromRoll(0), "N");
  assert.equal(rarityFromRoll(549), "N");
  assert.equal(rarityFromRoll(550), "R");
  assert.equal(rarityFromRoll(997), "UR");
  assert.equal(rarityFromRoll(998), "LR");
  assert.equal(gachaCost(1), 10);
  assert.equal(gachaCost(10), 100);
  assert.equal(gachaCost(5), 0);
  assert.ok(["N", "R", "SR", "SSR", "UR", "LR"].every((rarity) => ITEMS.some((item) => item.rarity === rarity)));
});

test("レベル上限では経験値を蓄積し突破後に利用できる", () => {
  const capped = applyExperience({ level: 50, levelCap: 50, xp: 0, overflowXp: 0, totalXp: 1000 }, 500);
  assert.equal(capped.level, 50);
  assert.equal(capped.overflowXp, 500);
  const released = applyExperience({ level: 50, levelCap: 60, xp: 0, overflowXp: 500, totalXp: 1500 }, 0);
  assert.ok(released.level >= 50);
  assert.ok(released.overflowXp < 500);
});

test("スキル配分は確定済みを減らせず未使用ポイントを超えない", () => {
  assert.deepEqual(validSkillAllocation({ sword: 1 }, { sword: 2, fist: 1 }, 2)?.spent, 2);
  assert.equal(validSkillAllocation({ sword: 2 }, { sword: 1 }, 20), null);
  assert.equal(validSkillAllocation({ sword: 0 }, { sword: 99 }, 2), null);
});

test("敗北時のG減少と行動種別が仕様どおり", () => {
  assert.equal(lossPenalty(1), 50);
  assert.equal(lossPenalty(12), 200);
  assert.equal(lossPenalty(39), 800);
  assert.equal(lossPenalty(50, true), 1500);
  assert.deepEqual(validAction({ type: "equipment", id: "bronze_sword" }), { type: "equipment", id: "bronze_sword" });
  assert.equal(validAction({ type: "hack" }), null);
  assert.ok(ENEMIES.some((enemy) => enemy.limitBoss && enemy.unlockCap === 100));
});

test("装備強化値を含めた能力値をサーバー側で再計算する", () => {
  const stats = totalStats({ level: 1, equipment: { weapon: "bronze_sword" } }, [{ ...ITEMS.find((item) => item.id === "bronze_sword"), enhancementLevel: 2 }]);
  assert.ok(stats.attack > 18);
});
