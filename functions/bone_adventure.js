const crypto = require("node:crypto");
const {
  GACHA_COSTS,
  RARITY_WEIGHTS,
  EXCHANGE_POINTS,
  MAX_LEVEL,
  MAX_ENHANCEMENT,
  RESPEC_COST,
  ITEMS,
  isBoneAdventureTester,
  gachaCost,
  rarityFromRoll,
  itemsForRarity,
  xpNeededForLevel,
  applyExperience,
  equipmentSlotsForProgress,
  validStatAllocation,
  sanitizeRunResult,
} = require("./bone_adventure_policy.js");

function createBoneAdventureService({ db, FieldValue, HttpsError, requireStudent }) {
  const stateRef = (studentNumber) => db.collection("boneAdventure").doc(studentNumber);
  const inventoryRef = (studentNumber, itemId) => stateRef(studentNumber).collection("inventory").doc(itemId);
  const operationRef = (studentNumber, requestId) => stateRef(studentNumber).collection("operations").doc(requestId);

  function requireTester(request) {
    const studentNumber = requireStudent(request);
    if (!isBoneAdventureTester(studentNumber)) {
      throw new HttpsError("permission-denied", "ボンアドのテスト対象ではありません。");
    }
    return studentNumber;
  }

  function validRequestId(value) {
    const normalized = String(value || "").trim();
    if (!/^[a-zA-Z0-9_-]{16,80}$/.test(normalized)) {
      throw new HttpsError("invalid-argument", "操作IDを確認してください。");
    }
    return normalized;
  }

  function defaultState(studentNumber, totalPoints, now) {
    return {
      studentNumber,
      schemaVersion: 1,
      gachaPoints: Math.max(0, Number(totalPoints || 0)),
      pointMigration: {
        migratedAt: now,
        sourceTotalPoints: Math.max(0, Number(totalPoints || 0)),
        highWatermark: Math.max(0, Number(totalPoints || 0)),
      },
      level: 1,
      xp: 0,
      unspentStatPoints: 0,
      allocatedStats: { vitality: 0, agility: 0, power: 0 },
      visualEquipped: {},
      abilityEquipped: [],
      unlockedStage: 1,
      completedStages: [],
      equipmentSlots: 2,
      endlessBestDistance: 0,
      endlessBestScore: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  async function ensureState(studentNumber) {
    const reference = stateRef(studentNumber);
    await db.runTransaction(async (transaction) => {
      const [stateSnapshot, rankingSnapshot] = await Promise.all([
        transaction.get(reference),
        transaction.get(db.collection("totalRanking").doc(studentNumber)),
      ]);
      if (stateSnapshot.exists && stateSnapshot.data()?.pointMigration?.migratedAt) return;
      const now = new Date();
      const totalPoints = Math.max(0, Number(rankingSnapshot.data()?.point || 0));
      if (!stateSnapshot.exists) {
        transaction.create(reference, defaultState(studentNumber, totalPoints, now));
        return;
      }
      transaction.set(reference, {
        gachaPoints: totalPoints,
        pointMigration: { migratedAt: now, sourceTotalPoints: totalPoints, highWatermark: totalPoints },
        updatedAt: now,
      }, { merge: true });
    });
  }

  function publicState(data = {}) {
    const completedStages = Array.isArray(data.completedStages) ? data.completedStages.map(Number).filter(Number.isFinite) : [];
    const level = Math.max(1, Math.min(MAX_LEVEL, Number(data.level || 1)));
    return {
      gachaPoints: Math.max(0, Number(data.gachaPoints || 0)),
      level,
      xp: Math.max(0, Number(data.xp || 0)),
      xpNeeded: level >= MAX_LEVEL ? 0 : xpNeededForLevel(level),
      maxLevel: MAX_LEVEL,
      unspentStatPoints: Math.max(0, Number(data.unspentStatPoints || 0)),
      allocatedStats: {
        vitality: Math.max(0, Number(data.allocatedStats?.vitality || 0)),
        agility: Math.max(0, Number(data.allocatedStats?.agility || 0)),
        power: Math.max(0, Number(data.allocatedStats?.power || 0)),
      },
      visualEquipped: data.visualEquipped || {},
      abilityEquipped: Array.isArray(data.abilityEquipped) ? data.abilityEquipped : [],
      unlockedStage: Math.max(1, Number(data.unlockedStage || 1)),
      completedStages,
      equipmentSlots: equipmentSlotsForProgress(level, completedStages),
      endlessBestDistance: Math.max(0, Number(data.endlessBestDistance || 0)),
      endlessBestScore: Math.max(0, Number(data.endlessBestScore || 0)),
      migrated: Boolean(data.pointMigration?.migratedAt),
    };
  }

  async function getDashboard(request) {
    const studentNumber = requireTester(request);
    await ensureState(studentNumber);
    const [stateSnapshot, inventorySnapshot] = await Promise.all([
      stateRef(studentNumber).get(),
      stateRef(studentNumber).collection("inventory").get(),
    ]);
    return {
      state: publicState(stateSnapshot.data()),
      inventory: inventorySnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data(), firstObtainedAt: snapshot.data()?.firstObtainedAt?.toMillis?.() || 0 })).sort((left, right) => (right.rarityRank || 0) - (left.rarityRank || 0) || left.name.localeCompare(right.name, "ja")),
      catalog: ITEMS,
      rates: RARITY_WEIGHTS,
      costs: GACHA_COSTS,
      exchangePoints: EXCHANGE_POINTS,
      maxEnhancement: MAX_ENHANCEMENT,
      respecCost: RESPEC_COST,
    };
  }

  function drawSelection(count) {
    return Array.from({ length: count }, () => {
      const rarity = rarityFromRoll(crypto.randomInt(0, 1000));
      const candidates = itemsForRarity(rarity);
      return candidates[crypto.randomInt(0, candidates.length)];
    });
  }

  async function drawGacha(request) {
    const studentNumber = requireTester(request);
    const count = Number(request.data?.count);
    const cost = gachaCost(count);
    if (!cost) throw new HttpsError("invalid-argument", "ガチャ回数を確認してください。");
    const requestId = validRequestId(request.data?.requestId);
    await ensureState(studentNumber);
    const selection = drawSelection(count);
    const grouped = selection.reduce((result, item) => {
      result[item.id] = { item, count: (result[item.id]?.count || 0) + 1 };
      return result;
    }, {});
    const result = await db.runTransaction(async (transaction) => {
      const operation = operationRef(studentNumber, requestId);
      const operationSnapshot = await transaction.get(operation);
      if (operationSnapshot.exists) return operationSnapshot.data()?.result;
      const reference = stateRef(studentNumber);
      const stateSnapshot = await transaction.get(reference);
      const state = stateSnapshot.data() || {};
      if (Number(state.gachaPoints || 0) < cost) {
        throw new HttpsError("failed-precondition", "ガチャポイントが不足しています。");
      }
      const inventorySnapshots = {};
      for (const itemId of Object.keys(grouped)) {
        inventorySnapshots[itemId] = await transaction.get(inventoryRef(studentNumber, itemId));
      }
      const now = new Date();
      const results = selection.map((item) => ({ ...item, duplicate: inventorySnapshots[item.id].exists || grouped[item.id].count > 1 }));
      transaction.update(reference, { gachaPoints: Number(state.gachaPoints || 0) - cost, updatedAt: now });
      for (const { item, count: quantity } of Object.values(grouped)) {
        const itemReference = inventoryRef(studentNumber, item.id);
        const existing = inventorySnapshots[item.id];
        transaction.set(itemReference, {
          ...item,
          quantity: Number(existing.data()?.quantity || 0) + quantity,
          enhancementLevel: Number(existing.data()?.enhancementLevel || 0),
          rarityRank: ["N", "R", "SR", "SSR", "UR", "LR"].indexOf(item.rarity),
          firstObtainedAt: existing.data()?.firstObtainedAt || now,
          updatedAt: now,
        }, { merge: true });
      }
      const payload = { results, remainingPoints: Number(state.gachaPoints || 0) - cost };
      transaction.create(operation, { type: "gacha", createdAt: now, result: payload });
      return payload;
    });
    return result;
  }

  async function resolveDuplicate(request) {
    const studentNumber = requireTester(request);
    const requestId = validRequestId(request.data?.requestId);
    const itemId = String(request.data?.itemId || "");
    const mode = request.data?.mode === "exchange" ? "exchange" : "enhance";
    const item = ITEMS.find((candidate) => candidate.id === itemId);
    if (!item) throw new HttpsError("invalid-argument", "アイテムを確認してください。");
    await ensureState(studentNumber);
    return db.runTransaction(async (transaction) => {
      const operation = operationRef(studentNumber, requestId);
      const [operationSnapshot, stateSnapshot, itemSnapshot] = await Promise.all([
        transaction.get(operation),
        transaction.get(stateRef(studentNumber)),
        transaction.get(inventoryRef(studentNumber, itemId)),
      ]);
      if (operationSnapshot.exists) return operationSnapshot.data()?.result;
      const inventory = itemSnapshot.data() || {};
      if (!itemSnapshot.exists || Number(inventory.quantity || 0) <= 1) {
        throw new HttpsError("failed-precondition", "最後の1個は使用できません。");
      }
      const now = new Date();
      if (mode === "enhance") {
        const currentLevel = Number(inventory.enhancementLevel || 0);
        if (currentLevel >= MAX_ENHANCEMENT) throw new HttpsError("failed-precondition", "強化上限です。");
        transaction.update(itemSnapshot.ref, { quantity: Number(inventory.quantity) - 1, enhancementLevel: currentLevel + 1, updatedAt: now });
      } else {
        const points = EXCHANGE_POINTS[item.rarity] || 0;
        transaction.update(itemSnapshot.ref, { quantity: Number(inventory.quantity) - 1, updatedAt: now });
        transaction.update(stateSnapshot.ref, { gachaPoints: Number(stateSnapshot.data()?.gachaPoints || 0) + points, updatedAt: now });
      }
      const result = { resolved: true, mode };
      transaction.create(operation, { type: "duplicate", itemId, mode, createdAt: now, result });
      return result;
    });
  }

  async function saveLoadout(request) {
    const studentNumber = requireTester(request);
    const visualItemIds = Array.isArray(request.data?.visualItemIds)
      ? [...new Set(request.data.visualItemIds.map(String).filter(Boolean))]
      : [String(request.data?.visualItemId || "")].filter(Boolean);
    const abilityItemIds = Array.isArray(request.data?.abilityItemIds) ? [...new Set(request.data.abilityItemIds.map(String))] : [];
    await ensureState(studentNumber);
    return db.runTransaction(async (transaction) => {
      const stateSnapshot = await transaction.get(stateRef(studentNumber));
      const state = stateSnapshot.data() || {};
      const completedStages = Array.isArray(state.completedStages) ? state.completedStages : [];
      const slots = equipmentSlotsForProgress(Number(state.level || 1), completedStages);
      if (abilityItemIds.length > slots) throw new HttpsError("failed-precondition", "装備枠を超えています。");
      const allIds = [...new Set([...visualItemIds, ...abilityItemIds])];
      const snapshots = {};
      for (const id of allIds) snapshots[id] = await transaction.get(inventoryRef(studentNumber, id));
      if (allIds.some((id) => !snapshots[id]?.exists)) throw new HttpsError("permission-denied", "未所持のアイテムは装備できません。");
      if (abilityItemIds.some((id) => !["ability", "organ", "material"].includes(snapshots[id].data()?.kind))) {
        throw new HttpsError("invalid-argument", "能力装備に使用できないアイテムです。");
      }
      const visualEquipped = {};
      for (const visualItemId of visualItemIds) {
        const visual = snapshots[visualItemId].data();
        if (!["organ", "decoration"].includes(visual.kind)) throw new HttpsError("invalid-argument", "見た目に装着できないアイテムです。");
        visualEquipped[visual.organ || visual.kind] = visualItemId;
      }
      transaction.update(stateSnapshot.ref, { visualEquipped, abilityEquipped: abilityItemIds, equipmentSlots: slots, updatedAt: new Date() });
      return { saved: true, visualEquipped, abilityEquipped: abilityItemIds, equipmentSlots: slots };
    });
  }

  async function allocateStats(request) {
    const studentNumber = requireTester(request);
    await ensureState(studentNumber);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(stateRef(studentNumber));
      const state = snapshot.data() || {};
      const allocation = validStatAllocation(state.allocatedStats, request.data?.stats, state.unspentStatPoints);
      if (!allocation) throw new HttpsError("invalid-argument", "能力ポイントの振り分けを確認してください。");
      transaction.update(snapshot.ref, { allocatedStats: allocation.stats, unspentStatPoints: Number(state.unspentStatPoints || 0) - allocation.spent, updatedAt: new Date() });
      return { saved: true, allocatedStats: allocation.stats, unspentStatPoints: Number(state.unspentStatPoints || 0) - allocation.spent };
    });
  }

  async function respecStats(request) {
    const studentNumber = requireTester(request);
    const requestId = validRequestId(request.data?.requestId);
    await ensureState(studentNumber);
    return db.runTransaction(async (transaction) => {
      const operation = operationRef(studentNumber, requestId);
      const [operationSnapshot, snapshot] = await Promise.all([
        transaction.get(operation),
        transaction.get(stateRef(studentNumber)),
      ]);
      if (operationSnapshot.exists) return operationSnapshot.data()?.result;
      const state = snapshot.data() || {};
      if (Number(state.gachaPoints || 0) < RESPEC_COST) throw new HttpsError("failed-precondition", "ガチャポイントが不足しています。");
      const refundable = Object.values(state.allocatedStats || {}).reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0);
      const result = { reset: true, remainingPoints: Number(state.gachaPoints || 0) - RESPEC_COST, unspentStatPoints: Number(state.unspentStatPoints || 0) + refundable };
      transaction.update(snapshot.ref, {
        gachaPoints: Number(state.gachaPoints || 0) - RESPEC_COST,
        allocatedStats: { vitality: 0, agility: 0, power: 0 },
        unspentStatPoints: Number(state.unspentStatPoints || 0) + refundable,
        updatedAt: new Date(),
      });
      transaction.create(operation, { type: "respec", createdAt: new Date(), result });
      return result;
    });
  }

  async function saveRun(request) {
    const studentNumber = requireTester(request);
    const requestId = validRequestId(request.data?.requestId);
    const run = sanitizeRunResult(request.data);
    if (!run) throw new HttpsError("invalid-argument", "ゲーム結果を確認できませんでした。");
    await ensureState(studentNumber);
    return db.runTransaction(async (transaction) => {
      const operation = operationRef(studentNumber, requestId);
      const operationSnapshot = await transaction.get(operation);
      if (operationSnapshot.exists) return operationSnapshot.data()?.result;
      const snapshot = await transaction.get(stateRef(studentNumber));
      const state = snapshot.data() || {};
      if (run.mode === "stage" && run.stage > Number(state.unlockedStage || 1)) throw new HttpsError("permission-denied", "未解放のステージです。");
      const completedStages = [...new Set([...(state.completedStages || []).map(Number), ...(run.mode === "stage" && run.completed ? [run.stage] : [])])].sort((a, b) => a - b);
      const unlockedStage = run.mode === "stage" && run.completed ? Math.max(Number(state.unlockedStage || 1), Math.min(20, run.stage + 1)) : Number(state.unlockedStage || 1);
      const experience = run.mode === "endless" ? Math.min(500, Math.floor(run.distance / 45)) : run.completed ? 90 + run.stage * 35 : Math.min(45, Math.floor(run.distance / 30));
      const growth = applyExperience(state.level, state.xp, experience);
      const unspentStatPoints = Number(state.unspentStatPoints || 0) + growth.levelsGained * 3;
      const equipmentSlots = equipmentSlotsForProgress(growth.level, completedStages);
      const endlessBestDistance = run.mode === "endless" ? Math.max(Number(state.endlessBestDistance || 0), run.distance) : Number(state.endlessBestDistance || 0);
      const endlessBestScore = run.mode === "endless" ? Math.max(Number(state.endlessBestScore || 0), run.score) : Number(state.endlessBestScore || 0);
      const now = new Date();
      const result = { saved: true, experience, ...growth, unspentStatPoints, unlockedStage, equipmentSlots, endlessBestDistance, endlessBestScore };
      transaction.update(snapshot.ref, { level: growth.level, xp: growth.xp, unspentStatPoints, completedStages, unlockedStage, equipmentSlots, endlessBestDistance, endlessBestScore, updatedAt: now });
      transaction.create(operation, { type: "run", run, createdAt: now, result });
      return result;
    });
  }

  async function syncLearningPoints(studentNumber) {
    if (!isBoneAdventureTester(studentNumber)) return;
    const reference = stateRef(studentNumber);
    await db.runTransaction(async (transaction) => {
      const [stateSnapshot, rankingSnapshot] = await Promise.all([
        transaction.get(reference),
        transaction.get(db.collection("totalRanking").doc(studentNumber)),
      ]);
      if (!stateSnapshot.exists || !stateSnapshot.data()?.pointMigration?.migratedAt || !rankingSnapshot.exists) return;
      const state = stateSnapshot.data() || {};
      const currentTotal = Math.max(0, Number(rankingSnapshot.data()?.point || 0));
      const highWatermark = Math.max(0, Number(state.pointMigration?.highWatermark || 0));
      if (currentTotal <= highWatermark) return;
      transaction.update(reference, {
        gachaPoints: Number(state.gachaPoints || 0) + (currentTotal - highWatermark),
        "pointMigration.highWatermark": currentTotal,
        "pointMigration.lastSyncedAt": new Date(),
        updatedAt: new Date(),
      });
    });
  }

  return { getDashboard, drawGacha, resolveDuplicate, saveLoadout, allocateStats, respecStats, saveRun, syncLearningPoints };
}

module.exports = { createBoneAdventureService };
