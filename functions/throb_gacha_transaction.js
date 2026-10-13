const crypto = require('node:crypto');
const { GACHA_PRICES, validGachaRequest, rollRarities } = require('./throb_gacha_policy');
const { catalogItem } = require('./throb_gacha_catalog');

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
  return { balance: data.balance, spent: data.spent, testCurrency: true };
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
  const [wallet, recent, inventory] = await Promise.all([
    ref.get(), ref.collection('operations').orderBy('createdAt', 'desc').limit(10).get(),
    ref.collection('items').orderBy('obtainedAt', 'desc').limit(100).get(),
  ]);
  if (!validWallet(wallet.data())) throw new Error('invalid-wallet');
  return { ...walletView(wallet.data()), inventory: inventory.docs.map((doc) => ({
    itemId: doc.id, catalogId: doc.data().catalogId, category: doc.data().category,
    rarity: doc.data().rarity, name: doc.data().name, level: doc.data().level,
  })), recent: recent.docs.map((doc) => ({
    operationId: doc.id, category: doc.data().category, count: doc.data().count,
    results: doc.data().results,
  })) };
}

async function drawPilotGacha(db, studentNumber, { category, count, operationId }) {
  if (studentNumber !== PILOT_STUDENT) throw new Error('pilot-only');
  if (!validGachaRequest(category, count) || !validOperationId(operationId)) throw new Error('invalid-request');
  const price = GACHA_PRICES[category][count];
  const ref = accountRef(db, studentNumber);
  const operationRef = ref.collection('operations').doc(operationId);
  return db.runTransaction(async (tx) => {
    const [existing, walletSnapshot] = await Promise.all([tx.get(operationRef), tx.get(ref)]);
    if (existing.exists) {
      const previous = existing.data();
      if (previous.category !== category || previous.count !== count) throw new Error('operation-mismatch');
      return { ...previous.response, repeated: true };
    }
    const wallet = walletSnapshot.exists ? walletSnapshot.data() :
      { version: 1, balance: PILOT_INITIAL_POINTS, spent: 0, initialTestGrant: PILOT_INITIAL_POINTS };
    if (!validWallet(wallet)) throw new Error('invalid-wallet');
    if (wallet.balance < price) throw new Error('insufficient-points');
    const now = new Date();
    const results = rollRarities(category, count, crypto.randomInt).map((rarity) => ({
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
    tx.create(operationRef, { category, count, price, results, response, createdAt: now });
    return response;
  });
}

module.exports = { PILOT_STUDENT, PILOT_INITIAL_POINTS, validOperationId, getPilotGachaState, drawPilotGacha };
