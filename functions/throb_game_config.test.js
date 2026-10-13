const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_CONFIG, validThrobConfig, getThrobConfig, saveThrobConfig } = require('./throb_game_config');

function fakeDb() {
  let stored = null;
  return { collection(name) {
    assert.equal(name, 'throbGameSettings');
    return { doc(id) {
      assert.equal(id, 'current');
      return {
        async get() { return { exists: !!stored, data: () => stored }; },
        async set(value) { stored = value; },
      };
    } };
  } };
}

test('admin configuration validates a complete probability table and prices', () => {
  assert.equal(validThrobConfig(DEFAULT_CONFIG), true);
  const noHigh = structuredClone(DEFAULT_CONFIG);
  noHigh.rarityBasisPoints = { N: 10000, R: 0, SR: 0, SSR: 0, UR: 0, LR: 0 };
  assert.equal(validThrobConfig(noHigh), false);
  const wrongTotal = structuredClone(DEFAULT_CONFIG);
  wrongTotal.rarityBasisPoints.LR = 51;
  assert.equal(validThrobConfig(wrongTotal), false);
  const badPrice = structuredClone(DEFAULT_CONFIG);
  badPrice.gachaPrices.skill[1] = -1;
  assert.equal(validThrobConfig(badPrice), false);
  const extraField = { ...structuredClone(DEFAULT_CONFIG), overrideOwner: '2510001' };
  assert.equal(validThrobConfig(extraField), false);
});

test('only primary pilot admin saves config; absent config uses defaults', async () => {
  const db = fakeDb();
  assert.deepEqual(await getThrobConfig(db), DEFAULT_CONFIG);
  await assert.rejects(saveThrobConfig(db, DEFAULT_CONFIG, '2510001'), /pilot-admin-only/);
  const custom = structuredClone(DEFAULT_CONFIG);
  custom.gachaPrices.character[1] = 75;
  custom.shopPrices.R = 150;
  await saveThrobConfig(db, custom, '2510044');
  const saved = await getThrobConfig(db);
  assert.equal(saved.gachaPrices.character[1], 75);
  assert.equal(saved.shopPrices.R, 150);
});
