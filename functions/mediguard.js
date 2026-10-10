const crypto = require("node:crypto");
const {
  SCHEMA_VERSION, INITIAL_LEVEL_CAP, GACHA_COSTS, RARITY_WEIGHTS, EXCHANGE_POINTS,
  MAPS, CHARACTERS, isMediguardTester, gachaCost, rarityFromRoll, charactersForRarity,
  applyExperience, runReward, isPlausibleRun,
} = require("./mediguard_policy");

function createMediguardService({ db, HttpsError, requireStudent }) {
  const playerRef = (id) => db.collection("mediguardPlayers").doc(id);
  const characterRef = (id, instanceId) => playerRef(id).collection("characters").doc(instanceId);
  const runRef = (id, runId) => playerRef(id).collection("runs").doc(runId);
  const operationRef = (id, requestId) => playerRef(id).collection("operations").doc(requestId);

  function requireTester(request) {
    const studentNumber = requireStudent(request);
    if (!isMediguardTester(studentNumber)) throw new HttpsError("permission-denied", "メディガードのテスト対象ではありません。");
    return studentNumber;
  }
  function operationId(value) {
    const id = String(value || "").trim();
    if (!/^[a-zA-Z0-9_-]{16,96}$/.test(id)) throw new HttpsError("invalid-argument", "操作IDを確認してください。");
    return id;
  }
  function instanceId(value) {
    const id = String(value || "").trim();
    if (!/^[a-zA-Z0-9_-]{8,96}$/.test(id)) throw new HttpsError("invalid-argument", "キャラクターIDを確認してください。");
    return id;
  }
  function catalog(id) { return CHARACTERS.find((item) => item.id === id); }
  function publicCharacter(doc) {
    const data = doc.data ? doc.data() : doc;
    const base = catalog(data.characterId) || CHARACTERS[0];
    return {
      instanceId: doc.id || data.instanceId, characterId: base.id, name: base.name,
      rarity: base.rarity, sprite: base.sprite, attack: base.attack, speed: base.speed,
      range: base.range, charge: base.charge, passive: base.passive, skill: base.skill,
      cooldown: base.cooldown, level: Math.max(1, Number(data.level || 1)), xp: Math.max(0, Number(data.xp || 0)),
      levelCap: Math.max(INITIAL_LEVEL_CAP, Number(data.levelCap || INITIAL_LEVEL_CAP)),
      dupeLevel: Math.max(0, Number(data.dupeLevel || 0)), favorite: data.favorite === true,
    };
  }
  async function ensurePlayer(studentNumber) {
    const reference = playerRef(studentNumber);
    const starterId = `starter_${studentNumber}`;
    await db.runTransaction(async (transaction) => {
      const [player, ranking, starter] = await Promise.all([
        transaction.get(reference), transaction.get(db.collection("totalRanking").doc(studentNumber)),
        transaction.get(characterRef(studentNumber, starterId)),
      ]);
      const total = Math.max(0, Number(ranking.data()?.point || 0));
      const now = new Date();
      if (!player.exists) {
        transaction.create(reference, {
          studentNumber, schemaVersion: SCHEMA_VERSION, selectedCharacterId: starterId,
          gachaPoints: total, pointMigration: { migratedAt: now, highWatermark: total },
          firstClears: [], records: { plays: 0, wins: 0, totalKills: 0, bestWave: 0 },
          createdAt: now, updatedAt: now,
        });
      } else {
        const high = Math.max(0, Number(player.data()?.pointMigration?.highWatermark || 0));
        if (total > high) transaction.update(reference, {
          gachaPoints: Math.max(0, Number(player.data()?.gachaPoints || 0)) + (total - high),
          "pointMigration.highWatermark": total, "pointMigration.lastSyncedAt": now, updatedAt: now,
        });
      }
      if (!starter.exists) transaction.create(characterRef(studentNumber, starterId), {
        characterId: "cell_maru", level: 1, xp: 0, levelCap: INITIAL_LEVEL_CAP,
        dupeLevel: 0, favorite: true, acquiredAt: now, source: "starter",
      });
    });
  }
  async function dashboard(request) {
    const studentNumber = requireTester(request); await ensurePlayer(studentNumber);
    const [player, characters, history] = await Promise.all([
      playerRef(studentNumber).get(), playerRef(studentNumber).collection("characters").orderBy("acquiredAt", "asc").get(),
      playerRef(studentNumber).collection("runs").where("status", "==", "finished").limit(15).get(),
    ]);
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...publicPlayer } = player.data() || {};
    return {
      player: publicPlayer,
      characters: characters.docs.map(publicCharacter), catalog: CHARACTERS, maps: MAPS,
      rates: RARITY_WEIGHTS, costs: GACHA_COSTS, exchangePoints: EXCHANGE_POINTS,
      history: history.docs.map((doc) => ({ id: doc.id, ...doc.data(), startedAt: doc.data()?.startedAt?.toMillis?.() || 0 })).sort((a, b) => b.startedAt - a.startedAt),
    };
  }
  async function draw(request) {
    const studentNumber = requireTester(request); const count = Number(request.data?.count); const cost = gachaCost(count);
    if (!cost) throw new HttpsError("invalid-argument", "ガチャ回数を確認してください。");
    const requestId = operationId(request.data?.requestId); await ensurePlayer(studentNumber);
    return db.runTransaction(async (transaction) => {
      const opRef = operationRef(studentNumber, requestId); const stateRef = playerRef(studentNumber);
      const [op, state] = await Promise.all([transaction.get(opRef), transaction.get(stateRef)]);
      if (op.exists) return op.data().result;
      const points = Math.max(0, Number(state.data()?.gachaPoints || 0));
      if (points < cost) throw new HttpsError("failed-precondition", "ガチャポイントが不足しています。");
      const results = [];
      for (let index = 0; index < count; index += 1) {
        const rarity = rarityFromRoll(crypto.randomInt(0, 1000)); const pool = charactersForRarity(rarity);
        const item = pool[crypto.randomInt(0, pool.length)]; const instanceId = crypto.randomUUID().replaceAll("-", "");
        transaction.create(characterRef(studentNumber, instanceId), {
          characterId: item.id, level: 1, xp: 0, levelCap: INITIAL_LEVEL_CAP,
          dupeLevel: 0, favorite: false, acquiredAt: new Date(), source: "gacha",
        });
        results.push({ instanceId, characterId: item.id, name: item.name, rarity: item.rarity, sprite: item.sprite, passive: item.passive, skill: item.skill });
      }
      const result = { results, remainingPoints: points - cost };
      transaction.update(stateRef, { gachaPoints: result.remainingPoints, updatedAt: new Date() });
      transaction.create(opRef, { type: "gacha", result, createdAt: new Date() });
      return result;
    });
  }
  async function selectCharacter(request) {
    const studentNumber = requireTester(request); const selectedInstanceId = instanceId(request.data?.instanceId);
    const snapshot = await characterRef(studentNumber, selectedInstanceId).get();
    if (!snapshot.exists) throw new HttpsError("not-found", "キャラクターが見つかりません。");
    await playerRef(studentNumber).set({ selectedCharacterId: selectedInstanceId, updatedAt: new Date() }, { merge: true });
    return { selected: selectedInstanceId };
  }
  async function favoriteCharacter(request) {
    const studentNumber = requireTester(request); const selectedInstanceId = instanceId(request.data?.instanceId);
    const snapshot = await characterRef(studentNumber, selectedInstanceId).get();
    if (!snapshot.exists) throw new HttpsError("not-found", "キャラクターが見つかりません。");
    await snapshot.ref.update({ favorite: request.data?.favorite === true, updatedAt: new Date() });
    return { favorite: request.data?.favorite === true };
  }
  async function resolveDuplicate(request) {
    const studentNumber = requireTester(request); const sourceId = instanceId(request.data?.sourceInstanceId);
    const mode = String(request.data?.mode || "keep"); const targetId = mode === "strengthen" ? instanceId(request.data?.targetInstanceId) : "";
    const requestId = operationId(request.data?.requestId);
    if (!["keep", "strengthen", "exchange"].includes(mode)) throw new HttpsError("invalid-argument", "処理方法を確認してください。");
    if (mode === "keep") return { kept: true };
    return db.runTransaction(async (transaction) => {
      const opRef = operationRef(studentNumber, requestId); const sourceRef = characterRef(studentNumber, sourceId);
      const refs = [transaction.get(opRef), transaction.get(sourceRef), transaction.get(playerRef(studentNumber))];
      if (mode === "strengthen") refs.push(transaction.get(characterRef(studentNumber, targetId)));
      const [op, source, player, target] = await Promise.all(refs); if (op.exists) return op.data().result;
      if (!source.exists || source.data()?.favorite === true || player.data()?.selectedCharacterId === sourceId) throw new HttpsError("failed-precondition", "使用できない個体です。お気に入りや出撃設定を確認してください。");
      const item = catalog(source.data()?.characterId); if (!item) throw new HttpsError("not-found", "キャラクター情報が見つかりません。");
      let result;
      if (mode === "strengthen") {
        if (!target?.exists || target.id === sourceId || target.data()?.characterId !== source.data()?.characterId) throw new HttpsError("invalid-argument", "同じ種類の別個体を選んでください。");
        const next = Math.min(5, Number(target.data()?.dupeLevel || 0) + 1);
        if (next === Number(target.data()?.dupeLevel || 0)) throw new HttpsError("failed-precondition", "強化上限です。");
        transaction.update(target.ref, { dupeLevel: next, updatedAt: new Date() }); result = { strengthened: target.id, dupeLevel: next };
      } else {
        const points = EXCHANGE_POINTS[item.rarity] || 0; transaction.update(player.ref, { gachaPoints: Number(player.data()?.gachaPoints || 0) + points, updatedAt: new Date() }); result = { exchanged: sourceId, points };
      }
      transaction.delete(source.ref); transaction.create(opRef, { type: `duplicate_${mode}`, result, createdAt: new Date() }); return result;
    });
  }
  async function startRun(request) {
    const studentNumber = requireTester(request); const requestId = operationId(request.data?.requestId); await ensurePlayer(studentNumber);
    return db.runTransaction(async (transaction) => {
      const stateRef = playerRef(studentNumber); const opRef = operationRef(studentNumber, requestId);
      const [state, op] = await Promise.all([transaction.get(stateRef), transaction.get(opRef)]); if (op.exists) return op.data().result;
      const selected = String(state.data()?.selectedCharacterId || ""); const character = await transaction.get(characterRef(studentNumber, selected));
      if (!character.exists) throw new HttpsError("failed-precondition", "出撃キャラクターを選択してください。");
      const map = MAPS[crypto.randomInt(0, MAPS.length)]; const runId = crypto.randomUUID().replaceAll("-", "");
      const result = { runId, map, character: publicCharacter({ id: selected, data: () => character.data() }), seed: crypto.randomInt(1, 2 ** 30), waves: 3, timeLimitSeconds: 100 };
      transaction.create(runRef(studentNumber, runId), { runId, mapId: map.id, characterInstanceId: selected, seed: result.seed, status: "active", startedAt: new Date(), createdAtMs: Date.now() });
      transaction.create(opRef, { type: "start_run", result, createdAt: new Date() }); return result;
    });
  }
  async function finishRun(request) {
    const studentNumber = requireTester(request); const runId = operationId(request.data?.runId); const summary = request.data?.summary || {};
    const requestId = operationId(request.data?.requestId);
    return db.runTransaction(async (transaction) => {
      const run = await transaction.get(runRef(studentNumber, runId)); if (!run.exists) throw new HttpsError("not-found", "戦闘記録が見つかりません。");
      if (run.data()?.status === "finished") return run.data().result;
      if (run.data()?.status !== "active" || !isPlausibleRun(summary, run.data()?.createdAtMs)) throw new HttpsError("failed-precondition", "戦闘結果を確認できませんでした。");
      const map = MAPS.find((item) => item.id === run.data()?.mapId); const stateRef = playerRef(studentNumber);
      const [state, character, operation] = await Promise.all([
        transaction.get(stateRef), transaction.get(characterRef(studentNumber, run.data()?.characterInstanceId)), transaction.get(operationRef(studentNumber, requestId)),
      ]);
      if (operation.exists) return operation.data().result;
      const firstClears = Array.isArray(state.data()?.firstClears) ? state.data().firstClears : [];
      const firstClear = !firstClears.includes(map.id); const reward = runReward(summary, map, firstClear);
      const advanced = applyExperience({ ...character.data(), levelCap: Number(character.data()?.levelCap || INITIAL_LEVEL_CAP) }, reward.xp);
      const result = { reward, firstClear: reward.won && firstClear, map, character: publicCharacter({ id: character.id, data: () => advanced.character }) };
      transaction.update(character.ref, { level: advanced.character.level, xp: advanced.character.xp, updatedAt: new Date() });
      transaction.update(stateRef, {
        gachaPoints: Number(state.data()?.gachaPoints || 0) + reward.gachaPoints,
        firstClears: result.firstClear ? [...firstClears, map.id] : firstClears,
        "records.plays": Number(state.data()?.records?.plays || 0) + 1,
        "records.wins": Number(state.data()?.records?.wins || 0) + (reward.won ? 1 : 0),
        "records.totalKills": Number(state.data()?.records?.totalKills || 0) + Math.max(0, Number(summary.kills || 0)),
        "records.bestWave": Math.max(Number(state.data()?.records?.bestWave || 0), Math.max(0, Number(summary.wave || 0))), updatedAt: new Date(),
      });
      transaction.update(run.ref, { status: "finished", summary, result, finishedAt: new Date() });
      transaction.create(operationRef(studentNumber, requestId), { type: "finish_run", result, createdAt: new Date() }); return result;
    });
  }
  async function dispatch(request) {
    const action = String(request.data?.action || "dashboard");
    if (action === "dashboard") return dashboard(request);
    if (action === "draw") return draw(request);
    if (action === "select") return selectCharacter(request);
    if (action === "favorite") return favoriteCharacter(request);
    if (action === "duplicate") return resolveDuplicate(request);
    if (action === "startRun") return startRun(request);
    if (action === "finishRun") return finishRun(request);
    throw new HttpsError("invalid-argument", "操作を確認してください。");
  }
  return { dispatch };
}

module.exports = { createMediguardService };
