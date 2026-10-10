const test = require("node:test");
const assert = require("node:assert/strict");
const policy = require("./mediguard_policy");

test("2510044だけを限定テスターにする", () => {
  assert.equal(policy.isMediguardTester("2510044"), true);
  assert.equal(policy.isMediguardTester("2510045"), false);
});
test("ガチャ確率は指定値どおり合計100%で料金は30・300pt", () => {
  assert.equal(Object.values(policy.RARITY_WEIGHTS).reduce((a, b) => a + b, 0), 1000);
  assert.equal(policy.gachaCost(1), 30);
  assert.equal(policy.gachaCost(10), 300);
  assert.equal(policy.rarityFromRoll(999), "LR");
});
test("10キャラは2つの固有要素を持つ", () => {
  assert.equal(policy.CHARACTERS.length, 10);
  assert.ok(policy.CHARACTERS.every((item) => item.passive && item.skill));
});
test("勝利時だけ臓器別初回ポイントを付ける", () => {
  const map = policy.MAPS[0];
  assert.equal(policy.runReward({ kills: 20, wave: 3, won: true }, map, true).gachaPoints, 60);
  assert.equal(policy.runReward({ kills: 20, wave: 3, won: true }, map, false).gachaPoints, 0);
  assert.equal(policy.runReward({ kills: 5, wave: 1, won: false }, map, true).gachaPoints, 0);
});
test("極端に短い戦闘や不可能な撃破数を拒否する", () => {
  assert.equal(policy.isPlausibleRun({ durationMs: 1000, kills: 1, shots: 2 }, Date.now() - 2000), false);
  assert.equal(policy.isPlausibleRun({ durationMs: 20000, kills: 20, shots: 30 }, Date.now() - 21000), true);
  assert.equal(policy.isPlausibleRun({ durationMs: 20000, kills: 100, shots: 2 }, Date.now() - 21000), false);
});
