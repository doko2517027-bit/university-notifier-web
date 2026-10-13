// Throb Phase 7: server-side-only draw policy. Never import this into the browser.
const RARITIES = Object.freeze([
  { id: 'N', basisPoints: 4000 },
  { id: 'R', basisPoints: 3000 },
  { id: 'SR', basisPoints: 1800 },
  { id: 'SSR', basisPoints: 900 },
  { id: 'UR', basisPoints: 250 },
  { id: 'LR', basisPoints: 50 },
]);

const GACHA_PRICES = Object.freeze({
  character: Object.freeze({ 1: 50, 10: 500 }),
  gear: Object.freeze({ 1: 30, 10: 300 }),
  accessory: Object.freeze({ 1: 20, 10: 200 }),
  skill: Object.freeze({ 1: 50, 10: 500 }),
});

const HIGH_RARITIES = Object.freeze(RARITIES.slice(2));

function selectWeighted(rows, drawInt) {
  const total = rows.reduce((sum, row) => sum + row.basisPoints, 0);
  const value = drawInt(total);
  if (!Number.isSafeInteger(value) || value < 0 || value >= total) {
    throw new TypeError('Invalid random draw');
  }
  let remaining = value;
  for (const row of rows) {
    remaining -= row.basisPoints;
    if (remaining < 0) return row.id;
  }
  throw new Error('Invalid rarity table');
}

function validGachaRequest(category, count) {
  return Object.hasOwn(GACHA_PRICES, category) && (count === 1 || count === 10);
}

function rollRarities(category, count, drawInt, rates = RARITIES) {
  if (!validGachaRequest(category, count)) throw new TypeError('Invalid gacha request');
  const results = Array.from({ length: count }, () => selectWeighted(rates, drawInt));
  if (count === 10 && results.every((rarity) => rarity === 'N' || rarity === 'R')) {
    results[9] = selectWeighted(rates === RARITIES ? HIGH_RARITIES : rates.slice(2), drawInt);
  }
  return results;
}

module.exports = { RARITIES, GACHA_PRICES, validGachaRequest, rollRarities };
