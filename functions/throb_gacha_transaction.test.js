const test = require('node:test');
const assert = require('node:assert/strict');
const { PILOT_INITIAL_POINTS, validOperationId, drawPilotGacha, getPilotGachaState } = require('./throb_gacha_transaction');

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
