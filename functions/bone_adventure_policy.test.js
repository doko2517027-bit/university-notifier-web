const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RARITY_WEIGHTS,
  isBoneAdventureTester,
  gachaCost,
  rarityFromRoll,
  applyExperience,
  equipmentSlotsForProgress,
  validStatAllocation,
  sanitizeRunResult,
} = require("./bone_adventure_policy.js");

test("テスト対象は2510044だけで将来追加可能な配列管理にする", () => {
  assert.equal(isBoneAdventureTester("2510044"), true);
  assert.equal(isBoneAdventureTester("2510167"), false);
});

test("ガチャ確率は合計100%で境界どおりに分類する", () => {
  assert.equal(Object.values(RARITY_WEIGHTS).reduce((sum, value) => sum + value, 0), 1000);
  assert.equal(rarityFromRoll(0), "N");
  assert.equal(rarityFromRoll(549), "N");
  assert.equal(rarityFromRoll(550), "R");
  assert.equal(rarityFromRoll(999), "LR");
  assert.equal(gachaCost(10), 100);
});

test("経験値と装備枠は上限を超えない", () => {
  const result = applyExperience(1, 90, 250);
  assert.ok(result.level > 1);
  assert.equal(equipmentSlotsForProgress(50, [2, 5, 8]), 5);
});

test("能力振り分けは未使用ポイント内の加算だけを許可する", () => {
  assert.deepEqual(validStatAllocation({ vitality: 1 }, { vitality: 2, agility: 1, power: 0 }, 2), {
    stats: { vitality: 2, agility: 1, power: 0 },
    spent: 2,
  });
  assert.equal(validStatAllocation({ vitality: 2 }, { vitality: 1 }, 10), null);
});

test("ゲーム結果は時間に対して不可能な距離や得点を拒否する", () => {
  assert.ok(sanitizeRunResult({ durationMs: 30_000, distance: 1_000, score: 5_000, stage: 1, completed: true }));
  assert.equal(sanitizeRunResult({ durationMs: 2_000, distance: 50_000, score: 999_999 }), null);
});
