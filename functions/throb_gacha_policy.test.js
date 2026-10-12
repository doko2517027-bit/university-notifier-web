const test = require('node:test');
const assert = require('node:assert/strict');
const { RARITIES, GACHA_PRICES, validGachaRequest, rollRarities } = require('./throb_gacha_policy');

test('Throb rates total 100% and prices match the four published types', () => {
  assert.equal(RARITIES.reduce((sum, row) => sum + row.basisPoints, 0), 10000);
  assert.deepEqual(GACHA_PRICES.character, { 1: 50, 10: 500 });
  assert.deepEqual(GACHA_PRICES.gear, { 1: 30, 10: 300 });
  assert.deepEqual(GACHA_PRICES.accessory, { 1: 20, 10: 200 });
  assert.deepEqual(GACHA_PRICES.skill, { 1: 50, 10: 500 });
});

test('invalid draw requests and out-of-range random values fail closed', () => {
  assert.equal(validGachaRequest('character', 10), true);
  assert.equal(validGachaRequest('character', 2), false);
  assert.equal(validGachaRequest('__proto__', 1), false);
  assert.throws(() => rollRarities('skill', 2, () => 0));
  assert.throws(() => rollRarities('skill', 1, () => 10000));
});

test('ten draws guarantee SR or higher only when all ten normal rolls miss', () => {
  const allNormal = rollRarities('gear', 10, () => 0);
  assert.deepEqual(allNormal.slice(0, 9), Array(9).fill('N'));
  assert.equal(allNormal[9], 'SR');
  let index = 0;
  const alreadyHigh = rollRarities('gear', 10, () => index++ === 0 ? 9999 : 0);
  assert.equal(alreadyHigh[0], 'LR');
  assert.equal(alreadyHigh[9], 'N');
  assert.equal(index, 10);
});
