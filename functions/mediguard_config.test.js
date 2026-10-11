const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_BANNER, sanitizeBanner, sanitizeCharacter, validateBanner,
  validateCharacter, isBannerAvailable, rarityFromWeights,
} = require("./mediguard_config");
const { CHARACTERS } = require("./mediguard_policy");

test("標準ガチャは30/300GP・100%で全キャラを対象にする", () => {
  assert.equal(DEFAULT_BANNER.singleCost, 30);
  assert.equal(DEFAULT_BANNER.tenCost, 300);
  assert.equal(Object.values(DEFAULT_BANNER.rates).reduce((sum, value) => sum + value, 0), 1000);
  assert.equal(DEFAULT_BANNER.characterIds.length, CHARACTERS.length);
});

test("期間限定ガチャは開始前・終了後に利用できない", () => {
  const banner = sanitizeBanner({
    ...DEFAULT_BANNER,
    id: "limited",
    startsAt: "2026-10-10T00:00:00.000Z",
    endsAt: "2026-10-20T00:00:00.000Z",
  });
  assert.equal(isBannerAvailable(banner, Date.parse("2026-10-09T23:59:59Z")), false);
  assert.equal(isBannerAvailable(banner, Date.parse("2026-10-15T00:00:00Z")), true);
  assert.equal(isBannerAvailable(banner, Date.parse("2026-10-20T00:00:00Z")), false);
});

test("排出率と対象キャラクターの不整合を拒否する", () => {
  const onlyNormal = sanitizeBanner({ ...DEFAULT_BANNER, characterIds: ["cell_maru"] });
  assert.match(validateBanner(onlyNormal, CHARACTERS), /Rの排出率/);
  const wrongTotal = sanitizeBanner({ ...DEFAULT_BANNER, rates: { N: 500, R: 200, SR: 100, SSR: 50, UR: 10, LR: 1 } });
  assert.match(validateBanner(wrongTotal, CHARACTERS), /100\.0%/);
});

test("管理画面の効果タイプは実装済みの種類だけ保存する", () => {
  const base = CHARACTERS[0];
  const item = sanitizeCharacter({ ...base, passiveType: "invalid", skillType: "invalid" }, base);
  assert.equal(item.passiveType, base.passiveType);
  assert.equal(item.skillType, base.skillType);
  assert.equal(validateCharacter(item), "");
});

test("任意の排出率から境界値を正しく抽選する", () => {
  const rates = { N: 500, R: 300, SR: 100, SSR: 60, UR: 30, LR: 10 };
  assert.equal(rarityFromWeights(499, rates), "N");
  assert.equal(rarityFromWeights(500, rates), "R");
  assert.equal(rarityFromWeights(999, rates), "LR");
});
