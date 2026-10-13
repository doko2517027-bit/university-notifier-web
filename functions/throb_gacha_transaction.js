const crypto = require('node:crypto');
const { validGachaRequest, rollRarities } = require('./throb_gacha_policy');
const { SHOP_OFFERS, catalogItem } = require('./throb_gacha_catalog');
const { RARITY_IDS, configRef, configFromSnapshot, getThrobConfig } = require('./throb_game_config');

const PILOT_STUDENT = '2510044';
const PILOT_INITIAL_POINTS = 500;

function validOperationId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validWallet(data) {
  return Number.isSafeInteger(data?.balance) && data.balance >= 0 &&
    Number.isSafeInteger(data?.spent) && data.spent >= 0 && data.version === 1;
}

function walletView(data) {
  return { balance: data.balance, spent: data.spent,
    equippedItems: data.equippedItems || {}, testCurrency: true };
}

function accountRef(db, studentNumber) {
  return db.collection('throbGachaAccounts').doc(studentNumber);
}

async function getPilotGachaState(db, studentNumber) {
  if (studentNumber !== PILOT_STUDENT) throw new Error('pilot-only');
  const ref = accountRef(db, studentNumber);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (snapshot.exists) {
      if (!validWallet(snapshot.data())) throw new Error('invalid-wallet');
      return;
    }
    tx.create(ref, { version: 1, balance: PILOT_INITIAL_POINTS, spent: 0,
      initialTestGrant: PILOT_INITIAL_POINTS, createdAt: new Date() });
  });
  const [wallet, recent, inventory, config] = await Promise.all([
    ref.get(), ref.collection('operations').orderBy('createdAt', 'desc').limit(10).get(),
    ref.collection('items').orderBy('obtainedAt', 'desc').limit(100).get(),
    getThrobConfig(db),
  ]);
  if (!validWallet(wallet.data())) throw new Error('invalid-wallet');
  const recentItems = inventory.docs.map((doc) => ({ id: doc.id, data: () => doc.data() }));
  const seen = new Set(recentItems.map((doc) => doc.id));
  const olderEquippedIds = Object.values(wallet.data().equippedItems || {}).filter((id) =>
    typeof id === 'string' && !seen.has(id));
  const olderEquipped = await Promise.all(olderEquippedIds.map(async (id) => ({
    id, snapshot: await ref.collection('items').doc(id).get(),
  })));
  for (const { id, snapshot } of olderEquipped) {
    if (snapshot.exists) recentItems.push({ id, data: () => snapshot.data() });
  }
  return { ...walletView(wallet.data()), gachaPrices: config.gachaPrices,
    rarityBasisPoints: config.rarityBasisPoints,
    shopOffers: Object.values(SHOP_OFFERS).map((offer) => ({ ...offer,
      price: config.shopPrices[offer.rarity] })), inventory: recentItems.map((doc) => ({
    itemId: doc.id, catalogId: doc.data().catalogId, category: doc.data().category,
    rarity: doc.data().rarity, name: doc.data().name, level: doc.data().level,
    equipped: doc.data().equipped === true,
  })), recent: recent.docs.map((doc) => ({
    operationId: doc.id, type: doc.data().type || 'gacha', category: doc.data().category, count: doc.data().count,
    results: doc.data().results,
  })) };
}

async function drawPilotGacha(db, studentNumber, { category, count, operationId }) {
  if (studentNumber !== PILOT_STUDENT) throw new Error('pilot-only');
  if (!validGachaRequest(category, count) || !validOperationId(operationId)) throw new Error('invalid-request');
  const ref = accountRef(db, studentNumber);
  const operationRef = ref.collection('operations').doc(operationId);
  return db.runTransaction(async (tx) => {
    const [existing, walletSnapshot, settingsSnapshot] = await Promise.all([
      tx.get(operationRef), tx.get(ref), tx.get(configRef(db)),
    ]);
    if (existing.exists) {
      const previous = existing.data();
      if ((previous.type && previous.type !== 'gacha') || previous.category !== category || previous.count !== count) throw new Error('operation-mismatch');
      return { ...previous.response, repeated: true };
    }
    const wallet = walletSnapshot.exists ? walletSnapshot.data() :
      { version: 1, balance: PILOT_INITIAL_POINTS, spent: 0, initialTestGrant: PILOT_INITIAL_POINTS };
    if (!validWallet(wallet)) throw new Error('invalid-wallet');
    const config = configFromSnapshot(settingsSnapshot);
    const price = config.gachaPrices[category][count];
    if (wallet.balance < price) throw new Error('insufficient-points');
    const now = new Date();
    const rates = RARITY_IDS.map((id) => ({ id, basisPoints: config.rarityBasisPoints[id] }));
    const results = rollRarities(category, count, crypto.randomInt, rates).map((rarity) => ({
      itemId: crypto.randomUUID(), ...catalogItem(category, rarity),
    }));
    const next = { ...wallet, balance: wallet.balance - price, spent: wallet.spent + price,
      updatedAt: now };
    if (walletSnapshot.exists) tx.update(ref, { balance: next.balance, spent: next.spent, updatedAt: now });
    else tx.create(ref, { ...next, createdAt: now });
    for (const item of results) {
      tx.create(ref.collection('items').doc(item.itemId), { ...item, level: 1,
        equipped: false, obtainedAt: now, sourceOperationId: operationId });
    }
    const response = { ...walletView(next), cost: price, results, operationId };
    tx.create(operationRef, { type: 'gacha', category, count, price, results, response, createdAt: now });
    return response;
  });
}

async function buyPilotShopItem(db, studentNumber, { offerId, operationId }) {
  if (studentNumber !== PILOT_STUDENT) throw new Error('pilot-only');
  if (!validOperationId(operationId) || typeof offerId !== 'string' || !Object.hasOwn(SHOP_OFFERS, offerId)) {
    throw new Error('invalid-request');
  }
  const offer = SHOP_OFFERS[offerId];
  const ref = accountRef(db, studentNumber);
  const operationRef = ref.collection('operations').doc(operationId);
  return db.runTransaction(async (tx) => {
    const [existing, walletSnapshot, settingsSnapshot] = await Promise.all([
      tx.get(operationRef), tx.get(ref), tx.get(configRef(db)),
    ]);
    if (existing.exists) {
      const previous = existing.data();
      if (previous.type !== 'shop' || previous.offerId !== offerId) throw new Error('operation-mismatch');
      return { ...previous.response, repeated: true };
    }
    const wallet = walletSnapshot.exists ? walletSnapshot.data() :
      { version: 1, balance: PILOT_INITIAL_POINTS, spent: 0, initialTestGrant: PILOT_INITIAL_POINTS };
    if (!validWallet(wallet)) throw new Error('invalid-wallet');
    const config = configFromSnapshot(settingsSnapshot);
    const price = config.shopPrices[offer.rarity];
    if (wallet.balance < price) throw new Error('insufficient-points');
    const now = new Date();
    const item = { itemId: crypto.randomUUID(), catalogId: offer.catalogId, category: offer.category,
      rarity: offer.rarity, name: offer.name };
    const next = { ...wallet, balance: wallet.balance - price, spent: wallet.spent + price,
      updatedAt: now };
    if (walletSnapshot.exists) tx.update(ref, { balance: next.balance, spent: next.spent, updatedAt: now });
    else tx.create(ref, { ...next, createdAt: now });
    tx.create(ref.collection('items').doc(item.itemId), { ...item, level: 1,
      equipped: false, obtainedAt: now, sourceOperationId: operationId });
    const response = { ...walletView(next), cost: price, results: [item], operationId };
    tx.create(operationRef, { type: 'shop', offerId, category: offer.category, count: 1,
      price, results: [item], response, createdAt: now });
    return response;
  });
}

async function equipPilotItem(db, studentNumber, { itemId, equip }) {
  if (studentNumber !== PILOT_STUDENT) throw new Error('pilot-only');
  if (!validOperationId(itemId) || typeof equip !== 'boolean') throw new Error('invalid-request');
  const ref = accountRef(db, studentNumber);
  const itemRef = ref.collection('items').doc(itemId);
  return db.runTransaction(async (tx) => {
    const [walletSnapshot, itemSnapshot] = await Promise.all([tx.get(ref), tx.get(itemRef)]);
    if (!walletSnapshot.exists || !validWallet(walletSnapshot.data()) || !itemSnapshot.exists) {
      throw new Error('item-not-owned');
    }
    const wallet = walletSnapshot.data();
    const category = itemSnapshot.data().category;
    if (!['character', 'gear', 'accessory', 'skill'].includes(category)) throw new Error('invalid-item');
    const current = wallet.equippedItems || {};
    const previousId = current[category];
    if (equip && previousId === itemId || !equip && previousId !== itemId) {
      return { equippedItems: current, itemId, equipped: equip && previousId === itemId };
    }
    const previousRef = previousId && previousId !== itemId
      ? ref.collection('items').doc(previousId) : null;
    const previousSnapshot = previousRef ? await tx.get(previousRef) : null;
    if (previousRef && !previousSnapshot.exists) throw new Error('invalid-item');
    const next = { ...current };
    if (equip) next[category] = itemId;
    else delete next[category];
    tx.update(ref, { equippedItems: next, updatedAt: new Date() });
    tx.update(itemRef, { equipped: equip });
    if (previousRef) tx.update(previousRef, { equipped: false });
    return { equippedItems: next, itemId, equipped: equip };
  });
}

module.exports = { PILOT_STUDENT, PILOT_INITIAL_POINTS, validOperationId,
  getPilotGachaState, drawPilotGacha, buyPilotShopItem, equipPilotItem };
