const test = require('node:test');
const assert = require('node:assert/strict');
const { PILOT_INITIAL_POINTS, validOperationId, drawPilotGacha, getPilotGachaState, buyPilotShopItem, equipPilotItem } = require('./throb_gacha_transaction');
const { DEFAULT_CONFIG } = require('./throb_game_config');

function fakeStore() {
  const docs = new Map();
  const ref = (path) => ({
    path,
    collection(name) { return col(`${path}/${name}`); },
    async get() { return snap(path); },
  });
  const col = (path) => ({
    doc(id) { return ref(`${path}/${id}`); },
    orderBy() { return { limit() { return { async get() { return { docs: [...docs.entries()]
      .filter(([key]) => key.startsWith(`${path}/`)).map(([key, value]) => ({ id: key.split('/').at(-1), data: () => value })) }; } }; } }; },
  });
  const snap = (path) => ({ exists: docs.has(path), data: () => docs.get(path) });
  return { docs, collection: col, async runTransaction(callback) {
    const writes = [];
    const result = await callback({
      get: async (target) => snap(target.path),
      create: (target, value) => writes.push(() => { if (docs.has(target.path)) throw new Error('already-exists'); docs.set(target.path, value); }),
      update: (target, value) => writes.push(() => docs.set(target.path, { ...docs.get(target.path), ...value })),
    });
    writes.forEach((write) => write());
    return result;
  } };
}

test('pilot receives test currency exactly once and no official ranking write', async () => {
  const db = fakeStore();
  const first = await getPilotGachaState(db, '2510044');
  const second = await getPilotGachaState(db, '2510044');
  assert.equal(first.balance, PILOT_INITIAL_POINTS);
  assert.equal(second.balance, PILOT_INITIAL_POINTS);
  assert.equal([...db.docs.keys()].filter((key) => key.includes('totalRanking')).length, 0);
  await assert.rejects(getPilotGachaState(db, '2510001'), /pilot-only/);
});

test('one confirmed draw debits once and a retry returns the original grant', async () => {
  const db = fakeStore();
  const request = { category: 'gear', count: 10, operationId: '3a25857c-5d29-48fb-9c78-a26f22b032a4' };
  const first = await drawPilotGacha(db, '2510044', request);
  const repeated = await drawPilotGacha(db, '2510044', request);
  assert.equal(first.balance, 200);
  assert.equal(repeated.balance, 200);
  assert.equal(repeated.repeated, true);
  assert.deepEqual(repeated.results, first.results);
  assert.equal((await getPilotGachaState(db, '2510044')).inventory.length, 10);
  assert.equal(first.results.some((item) => ['SR', 'SSR', 'UR', 'LR'].includes(item.rarity)), true);
});

test('rejects invalid requests, mismatched retry, non-pilot, and insufficient balance', async () => {
  const db = fakeStore();
  const request = { category: 'character', count: 10, operationId: '3a25857c-5d29-48fb-9c78-a26f22b032a4' };
  assert.equal(validOperationId(request.operationId), true);
  await assert.rejects(drawPilotGacha(db, '2510001', request), /pilot-only/);
  await assert.rejects(drawPilotGacha(db, '2510044', { ...request, operationId: 'guess' }), /invalid-request/);
  await drawPilotGacha(db, '2510044', request);
  await assert.rejects(drawPilotGacha(db, '2510044', { ...request, count: 1 }), /operation-mismatch/);
  await assert.rejects(drawPilotGacha(db, '2510044', { ...request, operationId: 'af6f537a-59fc-4b45-a26b-c70d5dc6c0ed' }), /insufficient-points/);
});

test('pilot shop purchase grants one N/R item once, with server-owned price', async () => {
  const db = fakeStore();
  const initial = await getPilotGachaState(db, '2510044');
  assert.equal(initial.shopOffers.length, 8);
  const request = { offerId: 'gear-n', operationId: 'de5749a1-958c-44ab-80d6-2dbbdcc07714', price: -999 };
  const first = await buyPilotShopItem(db, '2510044', request);
  const repeated = await buyPilotShopItem(db, '2510044', request);
  assert.equal(first.cost, 60);
  assert.equal(first.balance, 440);
  assert.equal(repeated.balance, 440);
  assert.equal(repeated.repeated, true);
  assert.deepEqual(repeated.results, first.results);
  assert.equal((await getPilotGachaState(db, '2510044')).inventory.length, 1);
  await assert.rejects(buyPilotShopItem(db, '2510001', request), /pilot-only/);
  await assert.rejects(buyPilotShopItem(db, '2510044', { ...request, offerId: 'gear-ur' }), /invalid-request/);
  await assert.rejects(buyPilotShopItem(db, '2510044', { ...request, offerId: 'skill-n' }), /operation-mismatch/);
  await assert.rejects(drawPilotGacha(db, '2510044', { category: 'gear', count: 1,
    operationId: request.operationId }), /operation-mismatch/);
});

test('updated admin prices are applied inside the purchase transaction', async () => {
  const db = fakeStore();
  const config = structuredClone(DEFAULT_CONFIG);
  config.shopPrices.N = 73;
  config.gachaPrices.accessory[1] = 37;
  db.docs.set('throbGameSettings/current', { version: 1, config });
  const offer = await buyPilotShopItem(db, '2510044', {
    offerId: 'gear-n', operationId: '46da5968-1d06-4c37-8bdf-c6553a5cb79d',
  });
  assert.equal(offer.cost, 73);
  const draw = await drawPilotGacha(db, '2510044', {
    category: 'accessory', count: 1, operationId: '78f89434-545f-4448-b62b-cc9ef79c90e1',
  });
  assert.equal(draw.cost, 37);
  const state = await getPilotGachaState(db, '2510044');
  assert.equal(state.shopOffers.find((item) => item.offerId === 'gear-n').price, 73);
  assert.equal(state.gachaPrices.accessory[1], 37);
});

test('only owned items can be equipped and changing the slot clears the previous item', async () => {
  const db = fakeStore();
  const first = await buyPilotShopItem(db, '2510044', {
    offerId: 'gear-n', operationId: '07887ae8-42bb-4331-a629-f3654bdd32fd',
  });
  const second = await buyPilotShopItem(db, '2510044', {
    offerId: 'gear-r', operationId: '58859aa1-cfad-4b45-ad82-b2355aff3565',
  });
  const firstId = first.results[0].itemId;
  const secondId = second.results[0].itemId;
  await assert.rejects(equipPilotItem(db, '2510001', { itemId: firstId, equip: true }), /pilot-only/);
  await assert.rejects(equipPilotItem(db, '2510044', {
    itemId: '46da5968-1d06-4c37-8bdf-c6553a5cb79d', equip: true,
  }), /item-not-owned/);
  await equipPilotItem(db, '2510044', { itemId: firstId, equip: true });
  await equipPilotItem(db, '2510044', { itemId: secondId, equip: true });
  let state = await getPilotGachaState(db, '2510044');
  assert.equal(state.equippedItems.gear, secondId);
  assert.equal(state.inventory.find((item) => item.itemId === firstId).equipped, false);
  assert.equal(state.inventory.find((item) => item.itemId === secondId).equipped, true);
  await equipPilotItem(db, '2510044', { itemId: secondId, equip: false });
  state = await getPilotGachaState(db, '2510044');
  assert.equal(state.equippedItems.gear, undefined);
  assert.equal(state.inventory.find((item) => item.itemId === secondId).equipped, false);
});
