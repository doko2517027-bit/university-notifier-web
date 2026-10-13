const { RARITIES, GACHA_PRICES } = require('./throb_gacha_policy');

const CATEGORIES = Object.freeze(['character', 'gear', 'accessory', 'skill']);
const RARITY_IDS = Object.freeze(RARITIES.map((entry) => entry.id));
const DEFAULT_CONFIG = Object.freeze({
  rarityBasisPoints: Object.freeze(Object.fromEntries(RARITIES.map(({ id, basisPoints }) => [id, basisPoints]))),
  gachaPrices: GACHA_PRICES,
  shopPrices: Object.freeze({ N: 60, R: 120 }),
});

function sameKeys(object, keys) {
  return object && typeof object === 'object' && !Array.isArray(object) &&
    Object.keys(object).length === keys.length && keys.every((key) => Object.hasOwn(object, key));
}

function validThrobConfig(value) {
  if (!sameKeys(value, ['rarityBasisPoints', 'gachaPrices', 'shopPrices'])) return false;
  const rates = value.rarityBasisPoints;
  if (!sameKeys(rates, RARITY_IDS) || !RARITY_IDS.every((id) => Number.isSafeInteger(rates[id]) && rates[id] >= 0)) return false;
  if (RARITY_IDS.reduce((sum, id) => sum + rates[id], 0) !== 10000) return false;
  if (RARITY_IDS.slice(2).reduce((sum, id) => sum + rates[id], 0) <= 0) return false;
  if (!sameKeys(value.gachaPrices, CATEGORIES)) return false;
  for (const category of CATEGORIES) {
    const prices = value.gachaPrices[category];
    if (!sameKeys(prices, ['1', '10']) || ![1, 10].every((count) =>
      Number.isSafeInteger(prices[count]) && prices[count] >= 1 && prices[count] <= 100000)) return false;
  }
  if (!sameKeys(value.shopPrices, ['N', 'R']) || !['N', 'R'].every((id) =>
    Number.isSafeInteger(value.shopPrices[id]) && value.shopPrices[id] >= 1 && value.shopPrices[id] <= 100000)) return false;
  return true;
}

function configRef(db) {
  return db.collection('throbGameSettings').doc('current');
}

function configFromSnapshot(snapshot) {
  if (!snapshot.exists) return DEFAULT_CONFIG;
  const doc = snapshot.data();
  if (doc.version !== 1 || !validThrobConfig(doc.config)) throw new Error('invalid-game-config');
  return doc.config;
}

async function getThrobConfig(db) {
  return configFromSnapshot(await configRef(db).get());
}

async function saveThrobConfig(db, input, adminStudentNumber) {
  if (adminStudentNumber !== '2510044') throw new Error('pilot-admin-only');
  if (!validThrobConfig(input)) throw new Error('invalid-game-config');
  const config = {
    rarityBasisPoints: Object.fromEntries(RARITY_IDS.map((id) => [id, input.rarityBasisPoints[id]])),
    gachaPrices: Object.fromEntries(CATEGORIES.map((category) => [category, {
      1: input.gachaPrices[category][1], 10: input.gachaPrices[category][10],
    }])),
    shopPrices: { N: input.shopPrices.N, R: input.shopPrices.R },
  };
  await configRef(db).set({ version: 1, config, updatedBy: adminStudentNumber, updatedAt: new Date() });
  return config;
}

module.exports = { CATEGORIES, RARITY_IDS, DEFAULT_CONFIG, validThrobConfig,
  configRef, configFromSnapshot, getThrobConfig, saveThrobConfig };
