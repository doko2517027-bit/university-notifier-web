const crypto = require("node:crypto");
const {
  SCHEMA_VERSION, INITIAL_GOLD, INITIAL_LEVEL_CAP, RESPEC_COST, MAX_ENHANCEMENT,
  GACHA_COSTS, RARITY_WEIGHTS, EXCHANGE_POINTS, EQUIPMENT_SLOTS, SKILL_BRANCHES,
  SKILLS, ITEMS, EQUIPMENT_SKILLS, ENEMIES, isAmamonTester, gachaCost, rarityFromRoll,
  itemsForRarity, normalizeName, totalStats, skillsForState, growthForm, applyExperience,
  validSkillAllocation, lossPenalty, validAction, xpNeededForLevel,
} = require("./amamon_policy.js");

function createAmamonService({ db, requireStudent, HttpsError }) {
  const stateRef = (studentNumber) => db.collection("armorMonsters").doc(studentNumber);
  const inventoryRef = (studentNumber, itemId) => stateRef(studentNumber).collection("inventory").doc(itemId);
  const operationRef = (studentNumber, requestId) => stateRef(studentNumber).collection("operations").doc(requestId);
  const cpuBattleRef = (studentNumber, battleId) => stateRef(studentNumber).collection("cpuBattles").doc(battleId);
  const pvpInviteRef = (inviteId) => db.collection("armorMonsterPvpInvites").doc(inviteId);
  const pvpBattleRef = (battleId) => db.collection("armorMonsterPvpBattles").doc(battleId);

  function requireTester(request) {
    const studentNumber = requireStudent(request);
    if (!isAmamonTester(studentNumber)) throw new HttpsError("permission-denied", "あまもんのテスト対象ではありません。");
    return studentNumber;
  }
  function validRequestId(value) {
    const id = String(value || "").trim();
    if (!/^[a-zA-Z0-9_-]{16,80}$/.test(id)) throw new HttpsError("invalid-argument", "操作IDを確認してください。");
    return id;
  }
  function defaultState(studentNumber, totalPoints, now) {
    return {
      studentNumber, schemaVersion: SCHEMA_VERSION, companion: null,
      level: 1, xp: 0, overflowXp: 0, totalXp: 0, levelCap: INITIAL_LEVEL_CAP,
      gold: INITIAL_GOLD, gachaPoints: Math.max(0, Number(totalPoints || 0)),
      pointMigration: { migratedAt: now, sourceTotalPoints: Math.max(0, Number(totalPoints || 0)), highWatermark: Math.max(0, Number(totalPoints || 0)) },
      skillPoints: 0, skillAllocation: Object.fromEntries(SKILL_BRANCHES.map((key) => [key, 0])),
      permanentBoosts: {}, equipment: {}, unlockedEnemies: ["moss_blob"], defeatedEnemies: [], limitBreaks: [],
      records: { cpuWins: 0, cpuLosses: 0, pvpWins: 0, pvpLosses: 0, currentStreak: 0, bestStreak: 0, gachaDraws: 0 },
      createdAt: now, updatedAt: now,
    };
  }
  async function ensureState(studentNumber) {
    const reference = stateRef(studentNumber);
    await db.runTransaction(async (transaction) => {
      const [stateSnapshot, rankingSnapshot] = await Promise.all([
        transaction.get(reference), transaction.get(db.collection("totalRanking").doc(studentNumber)),
      ]);
      if (stateSnapshot.exists && stateSnapshot.data()?.pointMigration?.migratedAt) return;
      const now = new Date();
      const totalPoints = Math.max(0, Number(rankingSnapshot.data()?.point || 0));
      if (!stateSnapshot.exists) transaction.create(reference, defaultState(studentNumber, totalPoints, now));
      else transaction.set(reference, { gachaPoints: totalPoints, pointMigration: { migratedAt: now, sourceTotalPoints: totalPoints, highWatermark: totalPoints }, updatedAt: now }, { merge: true });
    });
  }
  async function inventoryFor(studentNumber) {
    const snapshot = await stateRef(studentNumber).collection("inventory").get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }
  function publicState(data = {}, inventory = []) {
    const stats = totalStats(data, inventory);
    const skills = skillsForState(data, inventory);
    return {
      schemaVersion: Number(data.schemaVersion || SCHEMA_VERSION), companion: data.companion || null,
      level: Math.max(1, Number(data.level || 1)), xp: Math.max(0, Number(data.xp || 0)), overflowXp: Math.max(0, Number(data.overflowXp || 0)),
      xpNeeded: xpNeededForLevel(Math.max(1, Number(data.level || 1))),
      totalXp: Math.max(0, Number(data.totalXp || 0)), levelCap: Math.max(INITIAL_LEVEL_CAP, Number(data.levelCap || INITIAL_LEVEL_CAP)),
      gold: Math.max(0, Number(data.gold || 0)), gachaPoints: Math.max(0, Number(data.gachaPoints || 0)),
      skillPoints: Math.max(0, Number(data.skillPoints || 0)), skillAllocation: Object.fromEntries(SKILL_BRANCHES.map((key) => [key, Math.max(0, Number(data.skillAllocation?.[key] || 0))])),
      permanentBoosts: data.permanentBoosts || {}, equipment: data.equipment || {}, stats, skills, growth: growthForm(data),
      unlockedEnemies: Array.isArray(data.unlockedEnemies) ? data.unlockedEnemies : ["moss_blob"], defeatedEnemies: Array.isArray(data.defeatedEnemies) ? data.defeatedEnemies : [],
      limitBreaks: Array.isArray(data.limitBreaks) ? data.limitBreaks : [], records: data.records || {}, migrated: Boolean(data.pointMigration?.migratedAt),
    };
  }
  async function getDashboard(request) {
    const studentNumber = requireTester(request); await ensureState(studentNumber);
    const [snapshot, inventory, battles, gachaHistory, invites] = await Promise.all([
      stateRef(studentNumber).get(), inventoryFor(studentNumber),
      stateRef(studentNumber).collection("battleHistory").orderBy("createdAt", "desc").limit(20).get(),
      stateRef(studentNumber).collection("gachaHistory").orderBy("createdAt", "desc").limit(20).get(),
      db.collection("armorMonsterPvpInvites").where("participants", "array-contains", studentNumber).limit(20).get(),
    ]);
    return {
      state: publicState(snapshot.data(), inventory), inventory: inventory.sort((a, b) => (b.rarityRank || 0) - (a.rarityRank || 0)),
      catalog: ITEMS, rates: RARITY_WEIGHTS, costs: GACHA_COSTS, exchangePoints: EXCHANGE_POINTS, maxEnhancement: MAX_ENHANCEMENT,
      skillCatalog: [...SKILLS, ...EQUIPMENT_SKILLS], enemies: ENEMIES, battleHistory: battles.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: doc.data()?.createdAt?.toMillis?.() || 0 })),
      gachaHistory: gachaHistory.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: doc.data()?.createdAt?.toMillis?.() || 0 })),
      pvpInvites: invites.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: doc.data()?.createdAt?.toMillis?.() || 0 })),
    };
  }
  async function createCompanion(request) {
    const studentNumber = requireTester(request); const name = normalizeName(request.data?.name); await ensureState(studentNumber);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(stateRef(studentNumber)); const state = snapshot.data() || {};
      if (state.companion?.id) return { companion: state.companion };
      const now = new Date(); const companion = { id: crypto.randomUUID(), name, species: "amarl", createdAt: now };
      transaction.update(snapshot.ref, { companion, updatedAt: now });
      transaction.set(inventoryRef(studentNumber, "bronze_sword"), { ...ITEMS.find((item) => item.id === "bronze_sword"), quantity: 1, enhancementLevel: 0, rarityRank: 0, firstObtainedAt: now, updatedAt: now });
      transaction.update(snapshot.ref, { "equipment.weapon": "bronze_sword" });
      return { companion };
    });
  }
  function drawSelection(count) { return Array.from({ length: count }, () => { const rarity = rarityFromRoll(crypto.randomInt(0, 1000)); const candidates = itemsForRarity(rarity); return candidates[crypto.randomInt(0, candidates.length)]; }); }
  async function drawGacha(request) {
    const studentNumber = requireTester(request); const count = Number(request.data?.count); const cost = gachaCost(count); const requestId = validRequestId(request.data?.requestId);
    if (!cost) throw new HttpsError("invalid-argument", "ガチャ回数を確認してください。"); await ensureState(studentNumber);
    const selection = drawSelection(count); const grouped = selection.reduce((result, item) => { result[item.id] = { item, count: (result[item.id]?.count || 0) + 1 }; return result; }, {});
    return db.runTransaction(async (transaction) => {
      const operation = operationRef(studentNumber, requestId); const operationSnapshot = await transaction.get(operation); if (operationSnapshot.exists) return operationSnapshot.data().result;
      const stateSnapshot = await transaction.get(stateRef(studentNumber)); const state = stateSnapshot.data() || {};
      if (Number(state.gachaPoints || 0) < cost) throw new HttpsError("failed-precondition", "ガチャポイントが不足しています。");
      const inventorySnapshots = {}; for (const id of Object.keys(grouped)) inventorySnapshots[id] = await transaction.get(inventoryRef(studentNumber, id));
      const now = new Date(); const results = selection.map((item) => ({ ...item, duplicate: inventorySnapshots[item.id].exists || grouped[item.id].count > 1 }));
      transaction.update(stateSnapshot.ref, { gachaPoints: Number(state.gachaPoints || 0) - cost, "records.gachaDraws": Number(state.records?.gachaDraws || 0) + count, updatedAt: now });
      for (const { item, count: quantity } of Object.values(grouped)) { const existing = inventorySnapshots[item.id]; transaction.set(inventoryRef(studentNumber, item.id), { ...item, quantity: Number(existing.data()?.quantity || 0) + quantity, enhancementLevel: Number(existing.data()?.enhancementLevel || 0), rarityRank: ["N","R","SR","SSR","UR","LR"].indexOf(item.rarity), firstObtainedAt: existing.data()?.firstObtainedAt || now, updatedAt: now }, { merge: true }); }
      const history = stateRef(studentNumber).collection("gachaHistory").doc(requestId); transaction.create(history, { count, cost, results: results.map(({ id, name, rarity, duplicate }) => ({ id, name, rarity, duplicate })), createdAt: now });
      const result = { results, remainingPoints: Number(state.gachaPoints || 0) - cost }; transaction.create(operation, { type: "gacha", createdAt: now, result }); return result;
    });
  }
  async function resolveDuplicate(request) {
    const studentNumber = requireTester(request); const requestId = validRequestId(request.data?.requestId); const itemId = String(request.data?.itemId || ""); const mode = request.data?.mode === "exchange" ? "exchange" : "enhance";
    const catalogItem = ITEMS.find((item) => item.id === itemId); if (!catalogItem) throw new HttpsError("invalid-argument", "アイテムを確認してください。"); await ensureState(studentNumber);
    return db.runTransaction(async (transaction) => {
      const operation = operationRef(studentNumber, requestId); const [op, stateSnapshot, itemSnapshot] = await Promise.all([transaction.get(operation), transaction.get(stateRef(studentNumber)), transaction.get(inventoryRef(studentNumber, itemId))]); if (op.exists) return op.data().result;
      const item = itemSnapshot.data() || {}; if (!itemSnapshot.exists || Number(item.quantity || 0) <= 1) throw new HttpsError("failed-precondition", "最後の1個は使用できません。"); const now = new Date();
      if (mode === "enhance") { if (catalogItem.kind !== "equipment") throw new HttpsError("failed-precondition", "装備だけを強化できます。"); if (Number(item.enhancementLevel || 0) >= Number(catalogItem.maxEnhancement || MAX_ENHANCEMENT)) throw new HttpsError("failed-precondition", "強化上限です。"); transaction.update(itemSnapshot.ref, { quantity: Number(item.quantity) - 1, enhancementLevel: Number(item.enhancementLevel || 0) + 1, updatedAt: now }); }
      else { const points = EXCHANGE_POINTS[catalogItem.rarity] || 0; transaction.update(itemSnapshot.ref, { quantity: Number(item.quantity) - 1, updatedAt: now }); transaction.update(stateSnapshot.ref, { gachaPoints: Number(stateSnapshot.data()?.gachaPoints || 0) + points, updatedAt: now }); }
      const result = { resolved: true, mode }; transaction.create(operation, { type: "duplicate", itemId, mode, result, createdAt: now }); return result;
    });
  }
  async function saveEquipment(request) {
    const studentNumber = requireTester(request); const equipment = Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, String(request.data?.equipment?.[slot] || "")]).filter(([, id]) => id)); await ensureState(studentNumber);
    return db.runTransaction(async (transaction) => {
      const stateSnapshot = await transaction.get(stateRef(studentNumber)); const snapshots = {};
      for (const [slot, id] of Object.entries(equipment)) { snapshots[id] = await transaction.get(inventoryRef(studentNumber, id)); const item = snapshots[id].data(); if (!snapshots[id].exists || item.kind !== "equipment" || item.slot !== slot) throw new HttpsError("permission-denied", "未所持または異なる部位の装備です。"); }
      transaction.update(stateSnapshot.ref, { equipment, updatedAt: new Date() }); return { saved: true, equipment };
    });
  }
  async function allocateSkills(request) {
    const studentNumber = requireTester(request); await ensureState(studentNumber);
    return db.runTransaction(async (transaction) => { const snapshot = await transaction.get(stateRef(studentNumber)); const state = snapshot.data() || {}; const result = validSkillAllocation(state.skillAllocation, request.data?.allocation, state.skillPoints); if (!result) throw new HttpsError("invalid-argument", "スキルポイントの配分を確認してください。"); transaction.update(snapshot.ref, { skillAllocation: result.allocation, skillPoints: Number(state.skillPoints || 0) - result.spent, updatedAt: new Date() }); return { saved: true, allocation: result.allocation, skillPoints: Number(state.skillPoints || 0) - result.spent }; });
  }
  async function respecSkills(request) {
    const studentNumber = requireTester(request); const requestId = validRequestId(request.data?.requestId); await ensureState(studentNumber);
    return db.runTransaction(async (transaction) => { const operation = operationRef(studentNumber, requestId); const [op, snapshot] = await Promise.all([transaction.get(operation), transaction.get(stateRef(studentNumber))]); if (op.exists) return op.data().result; const state = snapshot.data() || {}; if (Number(state.gachaPoints || 0) < RESPEC_COST) throw new HttpsError("failed-precondition", "ガチャポイントが不足しています。"); const refundable = Object.values(state.skillAllocation || {}).reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0); const allocation = Object.fromEntries(SKILL_BRANCHES.map((key) => [key, 0])); const result = { reset: true, skillPoints: Number(state.skillPoints || 0) + refundable, remainingPoints: Number(state.gachaPoints || 0) - RESPEC_COST }; transaction.update(snapshot.ref, { gachaPoints: result.remainingPoints, skillPoints: result.skillPoints, skillAllocation: allocation, updatedAt: new Date() }); transaction.create(operation, { type: "respec", result, createdAt: new Date() }); return result; });
  }
  async function usePermanentItem(request) {
    const studentNumber = requireTester(request); const itemId = String(request.data?.itemId || ""); const requestId = validRequestId(request.data?.requestId); const catalogItem = ITEMS.find((item) => item.id === itemId && item.kind === "permanent"); if (!catalogItem) throw new HttpsError("invalid-argument", "永久強化アイテムではありません。");
    return db.runTransaction(async (transaction) => { const operation = operationRef(studentNumber, requestId); const [op, stateSnapshot, itemSnapshot] = await Promise.all([transaction.get(operation), transaction.get(stateRef(studentNumber)), transaction.get(inventoryRef(studentNumber, itemId))]); if (op.exists) return op.data().result; const item = itemSnapshot.data() || {}; if (Number(item.quantity || 0) < 1) throw new HttpsError("failed-precondition", "アイテムを所持していません。"); const current = Number(stateSnapshot.data()?.permanentBoosts?.[catalogItem.stat] || 0); if (current >= catalogItem.cap) throw new HttpsError("failed-precondition", "この能力の永久強化は上限です。"); const next = Math.min(catalogItem.cap, current + catalogItem.amount); transaction.update(itemSnapshot.ref, { quantity: Number(item.quantity) - 1, updatedAt: new Date() }); transaction.update(stateSnapshot.ref, { [`permanentBoosts.${catalogItem.stat}`]: next, updatedAt: new Date() }); const result = { used: true, stat: catalogItem.stat, value: next }; transaction.create(operation, { type: "permanentItem", itemId, result, createdAt: new Date() }); return result; });
  }
  function skillById(id) { return [...SKILLS, ...EQUIPMENT_SKILLS].find((skill) => skill.id === id); }
  function computeDamage(attacker, defender, skill, guard = false) {
    const power = Number(skill?.power || 24); const magic = Boolean(skill?.magic); const offense = Number(magic ? attacker.magic : attacker.attack); const defense = Number(magic ? defender.resistance : defender.defense); const variance = .9 + crypto.randomInt(0, 21) / 100; const critical = crypto.randomInt(0, 100) < 8; const raw = Math.max(1, ((offense * power) / Math.max(22, defense + 18)) * variance); return { damage: Math.max(1, Math.round(raw * (critical ? 1.55 : 1) * (guard ? .5 : 1))), critical };
  }
  function chooseEnemyAction(enemy, battle) { if (enemy.ai === "defensive" && battle.enemyHp < enemy.stats.maxHp * .45 && crypto.randomInt(0, 100) < 45) return { type: "guard", id: "" }; const choices = enemy.skills || ["attack"]; const id = choices[crypto.randomInt(0, choices.length)]; return id === "attack" ? { type: "attack", id: "" } : id === "guard" ? { type: "guard", id: "" } : { type: skillById(id)?.type || "skill", id }; }
  function actionSpeed(stats, action) { const skill = skillById(action.id); return Number(stats.speed || 0) + Number(skill?.priority || 0) * 100 + (action.type === "guard" ? 250 : 0); }
  function applyCombatAction(actor, target, action, actorSkills, actorInventory, logs) {
    if (actor.hp <= 0) return; if (action.type === "guard") { actor.guard = true; logs.push(`${actor.name}は身を守った！`); return; }
    if (action.type === "equipment") {
      const item = actorInventory.find((entry) => entry.id === action.id && entry.kind === "equipment" && Number(entry.quantity || 0) > 0);
      if (!item || !action.nextStats) { logs.push("そうびを変更できなかった。"); return; }
      actor.stats = action.nextStats;
      actor.hp = Math.min(actor.hp, actor.stats.maxHp);
      actor.mp = Math.min(actor.mp, actor.stats.maxMp);
      actor.equipmentChange = { slot: item.slot, itemId: item.id };
      logs.push(`${actor.name}は${item.name}をそうびした！`);
      return;
    }
    if (action.type === "item") { const item = actorInventory.find((entry) => entry.id === action.id && entry.kind === "consumable" && Number(entry.quantity || 0) > 0); if (!item) { logs.push("どうぐを使えなかった。"); return; } if (item.effect?.healHp) actor.hp = Math.min(actor.stats.maxHp, actor.hp + Number(item.effect.healHp)); if (item.effect?.healMp) actor.mp = Math.min(actor.stats.maxMp, actor.mp + Number(item.effect.healMp)); if (item.effect?.attackUp) actor.stats.attack = Math.round(actor.stats.attack * Number(item.effect.attackUp)); if (item.effect?.defenseUp) actor.stats.defense = Math.round(actor.stats.defense * Number(item.effect.defenseUp)); if (item.effect?.cureStatus) actor.status = {}; actor.usedItem = item.id; logs.push(`${actor.name}は${item.name}を使った！`); return; }
    const skill = action.type === "attack" ? { id: "attack", name: "こうげき", power: 24, mp: 0, accuracy: 100 } : actorSkills.find((entry) => entry.id === action.id);
    if (!skill || actor.mp < Number(skill.mp || 0)) { logs.push(`${actor.name}は行動できなかった。`); return; } actor.mp -= Number(skill.mp || 0);
    if (crypto.randomInt(0, 100) >= Number(skill.accuracy || 100)) { logs.push(`${actor.name}の${skill.name}は外れた！`); return; }
    if (skill.heal) { const healed = Math.round(Number(skill.heal) + actor.stats.magic * .6); actor.hp = Math.min(actor.stats.maxHp, actor.hp + healed); logs.push(`${actor.name}はHPを${healed}回復した！`); return; }
    if (skill.effect === "guardPlus" || skill.effect === "fortress") actor.guard = true;
    if (skill.effect === "defenseDown") target.stats.defense = Math.max(1, Math.round(target.stats.defense * .78));
    if (skill.effect === "attackDown") { target.stats.attack = Math.max(1, Math.round(target.stats.attack * .82)); target.stats.magic = Math.max(1, Math.round(target.stats.magic * .82)); }
    if (skill.effect === "poison") target.status = { ...(target.status || {}), poison: 3 };
    if (Number(skill.power || 0) > 0) { const hit = computeDamage(actor.stats, target.stats, skill, target.guard); target.hp = Math.max(0, target.hp - hit.damage); logs.push(`${actor.name}の${skill.name}！ ${target.name}に${hit.damage}ダメージ${hit.critical ? "！ クリティカル" : ""}`); }
  }
  function applyEndTurnStatus(combatant, logs) {
    const turns = Number(combatant.status?.poison || 0);
    if (turns <= 0 || combatant.hp <= 0) return;
    const damage = Math.max(1, Math.round(Number(combatant.stats.maxHp || 1) * .06));
    combatant.hp = Math.max(0, combatant.hp - damage);
    combatant.status = { ...(combatant.status || {}), poison: Math.max(0, turns - 1) };
    logs.push(`${combatant.name}はどくで${damage}ダメージを受けた。`);
  }
  async function startCpuBattle(request) {
    const studentNumber = requireTester(request); const enemyId = String(request.data?.enemyId || ""); const requestId = validRequestId(request.data?.requestId); const enemy = ENEMIES.find((item) => item.id === enemyId); if (!enemy) throw new HttpsError("not-found", "対戦相手が見つかりません。"); await ensureState(studentNumber); const inventory = await inventoryFor(studentNumber);
    return db.runTransaction(async (transaction) => { const operation = operationRef(studentNumber, requestId); const op = await transaction.get(operation); if (op.exists) return op.data().result; const snapshot = await transaction.get(stateRef(studentNumber)); const state = snapshot.data() || {}; if (!state.companion?.id) throw new HttpsError("failed-precondition", "先に相棒を作成してください。"); const unlocked = new Set(state.unlockedEnemies || []); const canLimit = enemy.limitBoss && Number(state.level || 1) >= Number(state.levelCap || INITIAL_LEVEL_CAP) && Number(state.levelCap || INITIAL_LEVEL_CAP) === enemy.stage; if (!unlocked.has(enemyId) && !canLimit) throw new HttpsError("permission-denied", "まだ解放されていない相手です。"); const stats = totalStats(state, inventory); const battleId = crypto.randomUUID(); const now = new Date(); const battle = { battleId, enemyId, enemyName: enemy.name, enemyStage: enemy.stage, enemySprite: enemy.sprite, limitBoss: Boolean(enemy.limitBoss), status: "active", turn: 1, player: { name: state.companion.name, hp: stats.maxHp, mp: stats.maxMp, stats, growth: growthForm(state), guard: false }, enemy: { name: enemy.name, hp: enemy.stats.maxHp, mp: enemy.stats.maxMp, stats: enemy.stats, guard: false }, log: [`${enemy.name}があらわれた！`], createdAt: now, updatedAt: now }; transaction.create(cpuBattleRef(studentNumber, battleId), battle); const result = { battle }; transaction.create(operation, { type: "startCpu", result, createdAt: now }); return result; });
  }
  async function submitCpuAction(request) {
    const studentNumber = requireTester(request); const battleId = String(request.data?.battleId || ""); const action = validAction(request.data?.action); const requestId = validRequestId(request.data?.requestId); if (!action) throw new HttpsError("invalid-argument", "行動を確認してください。"); const inventory = await inventoryFor(studentNumber);
    return db.runTransaction(async (transaction) => { const operation = operationRef(studentNumber, requestId); const [op, stateSnapshot, battleSnapshot] = await Promise.all([transaction.get(operation), transaction.get(stateRef(studentNumber)), transaction.get(cpuBattleRef(studentNumber, battleId))]); if (op.exists) return op.data().result; if (!battleSnapshot.exists || battleSnapshot.data()?.status !== "active") throw new HttpsError("failed-precondition", "この戦闘は終了しています。"); const state = stateSnapshot.data() || {}; const enemy = ENEMIES.find((item) => item.id === battleSnapshot.data().enemyId); if (!enemy) throw new HttpsError("not-found", "対戦相手が見つかりません。");
      const actionItemSnapshot = action.type === "item" ? await transaction.get(inventoryRef(studentNumber, action.id)) : null;
      if (action.type === "item" && (!actionItemSnapshot?.exists || actionItemSnapshot.data()?.kind !== "consumable" || Number(actionItemSnapshot.data()?.quantity || 0) < 1)) throw new HttpsError("failed-precondition", "そのどうぐは所持していません。");
      const dropCatalog = enemy.reward?.drop ? ITEMS.find((item) => item.id === enemy.reward.drop) : null;
      const dropSnapshot = dropCatalog ? await transaction.get(inventoryRef(studentNumber, dropCatalog.id)) : null;
      const rawBattle = battleSnapshot.data();
      const battle = { ...rawBattle, player: { ...rawBattle.player, stats: { ...rawBattle.player.stats } }, enemy: { ...rawBattle.enemy, stats: { ...rawBattle.enemy.stats } }, log: [...(rawBattle.log || [])] };
      const player = battle.player; const cpu = battle.enemy; player.guard = false; cpu.guard = false;
      let resolvedAction = action;
      if (action.type === "equipment") {
        const item = inventory.find((entry) => entry.id === action.id && entry.kind === "equipment" && Number(entry.quantity || 0) > 0);
        if (!item) throw new HttpsError("failed-precondition", "その装備は所持していません。");
        const nextEquipment = { ...(state.equipment || {}), [item.slot]: item.id };
        resolvedAction = { ...action, nextStats: totalStats({ ...state, equipment: nextEquipment }, inventory), nextEquipment };
      }
      const enemyAction = chooseEnemyAction(enemy, { enemyHp: cpu.hp }); const playerSkills = skillsForState(state, inventory); const enemySkills = (enemy.skills || []).map(skillById).filter(Boolean); const logs = []; const order = actionSpeed(player.stats, resolvedAction) >= actionSpeed(cpu.stats, enemyAction) ? [[player,cpu,resolvedAction,playerSkills,inventory],[cpu,player,enemyAction,enemySkills,[]]] : [[cpu,player,enemyAction,enemySkills,[]],[player,cpu,resolvedAction,playerSkills,inventory]]; for (const args of order) applyCombatAction(...args, logs); applyEndTurnStatus(player, logs); applyEndTurnStatus(cpu, logs); battle.turn += 1; battle.log = [...(battle.log || []).slice(-10), ...logs]; battle.updatedAt = new Date(); let reward = null;
      if (player.usedItem) { if (Number(actionItemSnapshot?.data()?.quantity || 0) > 0) transaction.update(actionItemSnapshot.ref, { quantity: Number(actionItemSnapshot.data().quantity) - 1, updatedAt: new Date() }); delete player.usedItem; }
      if (player.equipmentChange) { transaction.update(stateSnapshot.ref, { [`equipment.${player.equipmentChange.slot}`]: player.equipmentChange.itemId, updatedAt: new Date() }); delete player.equipmentChange; }
      if (cpu.hp <= 0 || player.hp <= 0) { const won = cpu.hp <= 0; battle.status = won ? "won" : "lost"; battle.finishedAt = new Date(); const enemyReward = enemy.reward || {}; const xp = won ? Number(enemyReward.xp || 0) : Math.max(10, Math.round(Number(enemyReward.xp || 0) * .12)); const growth = applyExperience(state, xp); const goldDelta = won ? Number(enemyReward.gold || 0) : -Math.min(Number(state.gold || 0), lossPenalty(enemy.stage, enemy.limitBoss)); const defeated = [...new Set([...(state.defeatedEnemies || []), ...(won ? [enemy.id] : [])])]; const unlocked = [...new Set([...(state.unlockedEnemies || ["moss_blob"]), ...(won && !enemy.limitBoss ? [ENEMIES.filter((item) => !item.limitBoss).find((item) => item.stage === enemy.stage + 1)?.id].filter(Boolean) : [])])]; const levelCap = won && enemy.limitBoss ? Math.max(Number(state.levelCap || INITIAL_LEVEL_CAP), Number(enemy.unlockCap || INITIAL_LEVEL_CAP)) : Number(state.levelCap || INITIAL_LEVEL_CAP); const skillPoints = Number(state.skillPoints || 0) + growth.levelsGained * 3; const records = { ...(state.records || {}), cpuWins: Number(state.records?.cpuWins || 0) + (won ? 1 : 0), cpuLosses: Number(state.records?.cpuLosses || 0) + (won ? 0 : 1) }; reward = { won, xp, goldDelta, level: growth.level, levelsGained: growth.levelsGained, levelCap, drop: null };
        const updates = { level: growth.level, xp: growth.xp, overflowXp: growth.overflowXp, totalXp: growth.totalXp, levelCap, skillPoints, gold: Math.max(0, Number(state.gold || 0) + goldDelta), defeatedEnemies: defeated, unlockedEnemies: unlocked, records, updatedAt: new Date() };
        if (won && enemy.limitBoss) updates.limitBreaks = [...new Set([...(state.limitBreaks || []), enemy.id])]; transaction.update(stateSnapshot.ref, updates);
        if (won && dropCatalog && dropSnapshot && crypto.randomInt(0,100) < Number(enemyReward.dropRate || 0)) { transaction.set(dropSnapshot.ref, { ...dropCatalog, quantity: Number(dropSnapshot.data()?.quantity || 0) + 1, enhancementLevel: Number(dropSnapshot.data()?.enhancementLevel || 0), rarityRank: ["N","R","SR","SSR","UR","LR"].indexOf(dropCatalog.rarity), firstObtainedAt: dropSnapshot.data()?.firstObtainedAt || new Date(), updatedAt: new Date() }, { merge: true }); reward.drop = { id: dropCatalog.id, name: dropCatalog.name }; }
        transaction.create(stateRef(studentNumber).collection("battleHistory").doc(battleId), { mode: "cpu", enemyId: enemy.id, enemyName: enemy.name, won, turns: battle.turn, reward, createdAt: new Date() });
      }
      transaction.update(battleSnapshot.ref, battle); const result = { battle, reward }; transaction.create(operation, { type: "cpuAction", battleId, result, createdAt: new Date() }); return result;
    });
  }
  async function listOpponents(request) { const studentNumber = requireTester(request); const snapshot = await db.collection("armorMonsters").limit(50).get(); return { opponents: snapshot.docs.filter((doc) => doc.id !== studentNumber && isAmamonTester(doc.id) && doc.data()?.companion?.id).map((doc) => ({ studentNumber: doc.id, companionName: doc.data().companion.name, level: Number(doc.data().level || 1) })) }; }
  async function sendPvpInvite(request) { const studentNumber = requireTester(request); const target = String(request.data?.targetStudentNumber || ""); const requestId = validRequestId(request.data?.requestId); if (target === studentNumber || !isAmamonTester(target)) throw new HttpsError("invalid-argument", "対戦相手を確認してください。"); const targetState = await stateRef(target).get(); if (!targetState.data()?.companion?.id) throw new HttpsError("not-found", "相手はまだあまもんを開始していません。"); const inviteId = crypto.createHash("sha256").update(`${studentNumber}:${target}:${requestId}`).digest("hex").slice(0,32); await pvpInviteRef(inviteId).create({ from: studentNumber, to: target, participants: [studentNumber,target], status: "pending", createdAt: new Date(), expiresAt: new Date(Date.now()+15*60_000) }).catch((error) => { if (error.code !== 6) throw error; }); return { inviteId };
  }
  async function respondPvpInvite(request) { const studentNumber = requireTester(request); const inviteId = String(request.data?.inviteId || ""); const accept = Boolean(request.data?.accept); const invite = await pvpInviteRef(inviteId).get(); const expiresAt = invite.data()?.expiresAt?.toMillis?.() || new Date(invite.data()?.expiresAt || 0).getTime(); if (!invite.exists || invite.data()?.to !== studentNumber || invite.data()?.status !== "pending" || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new HttpsError("failed-precondition", "招待を確認できないか、有効期限が切れています。"); if (!accept) { await invite.ref.update({ status: "rejected", respondedAt: new Date() }); return { accepted: false }; } const [fromState, toState, fromInventory, toInventory] = await Promise.all([stateRef(invite.data().from).get(), stateRef(studentNumber).get(), inventoryFor(invite.data().from), inventoryFor(studentNumber)]); const battleId = crypto.randomUUID(); const players = {}; for (const [number,snapshot,inventory] of [[invite.data().from,fromState,fromInventory],[studentNumber,toState,toInventory]]) { const state=snapshot.data(); const stats=totalStats(state,inventory); players[number]={name:state.companion.name,level:Number(state.level||1),hp:stats.maxHp,mp:stats.maxMp,stats,growth:growthForm(state),guard:false}; } await db.runTransaction(async (transaction) => { const fresh=await transaction.get(invite.ref); const freshExpiresAt=fresh.data()?.expiresAt?.toMillis?.()||new Date(fresh.data()?.expiresAt||0).getTime(); if (fresh.data()?.status!=="pending"||!Number.isFinite(freshExpiresAt)||freshExpiresAt<=Date.now()) throw new HttpsError("aborted","招待は処理済みか期限切れです。"); transaction.update(invite.ref,{status:"accepted",battleId,respondedAt:new Date()}); transaction.create(pvpBattleRef(battleId),{battleId,participants:invite.data().participants,players,status:"active",turn:1,pendingActions:{},log:["対戦開始！"],createdAt:new Date(),updatedAt:new Date()}); }); return { accepted:true,battleId };
  }
  async function getPvpBattle(request) { const studentNumber=requireTester(request); const battleId=String(request.data?.battleId||""); const snapshot=await pvpBattleRef(battleId).get(); if(!snapshot.exists||!snapshot.data()?.participants?.includes(studentNumber)) throw new HttpsError("permission-denied","対戦を表示できません。"); return {battle:snapshot.data()}; }
  async function submitPvpAction(request) {
    const studentNumber = requireTester(request);
    const battleId = String(request.data?.battleId || "");
    const action = validAction(request.data?.action);
    const requestId = validRequestId(request.data?.requestId);
    if (!action) throw new HttpsError("invalid-argument", "行動を確認してください。");

    const initialBattle = await pvpBattleRef(battleId).get();
    if (!initialBattle.exists || !initialBattle.data()?.participants?.includes(studentNumber)) throw new HttpsError("permission-denied", "この対戦へ参加できません。");
    const inventories = {};
    for (const participant of initialBattle.data().participants) inventories[participant] = await inventoryFor(participant);

    return db.runTransaction(async (transaction) => {
      const battleSnapshot = await transaction.get(pvpBattleRef(battleId));
      const rawBattle = battleSnapshot.data() || {};
      if (!battleSnapshot.exists || rawBattle.status !== "active" || !rawBattle.participants?.includes(studentNumber)) throw new HttpsError("permission-denied", "この対戦へ参加できません。");
      if ((rawBattle.processedRequestIds || []).includes(requestId)) return { battle: rawBattle, resolved: false, duplicate: true };
      if (rawBattle.pendingActions?.[studentNumber]) throw new HttpsError("already-exists", "このターンの行動は確定済みです。");

      const battle = {
        ...rawBattle,
        players: Object.fromEntries(rawBattle.participants.map((number) => [number, { ...rawBattle.players[number], stats: { ...rawBattle.players[number].stats } }])),
        pendingActions: { ...(rawBattle.pendingActions || {}), [studentNumber]: { action, requestId } },
        log: [...(rawBattle.log || [])],
        processedRequestIds: [...(rawBattle.processedRequestIds || [])],
      };
      let resolved = false;

      if (battle.participants.every((number) => battle.pendingActions[number])) {
        const [a, b] = battle.participants;
        const [aState, bState] = await Promise.all([transaction.get(stateRef(a)), transaction.get(stateRef(b))]);
        const stateSnapshots = { [a]: aState, [b]: bState };
        const states = { [a]: aState.data() || {}, [b]: bState.data() || {} };
        const actions = { [a]: { ...battle.pendingActions[a].action }, [b]: { ...battle.pendingActions[b].action } };
        const itemSnapshots = {};

        for (const number of [a, b]) {
          if (actions[number].type === "item") {
            itemSnapshots[number] = await transaction.get(inventoryRef(number, actions[number].id));
            if (!itemSnapshots[number].exists || itemSnapshots[number].data()?.kind !== "consumable" || Number(itemSnapshots[number].data()?.quantity || 0) < 1) throw new HttpsError("failed-precondition", "そのどうぐは所持していません。");
          }
          if (actions[number].type === "equipment") {
            const item = inventories[number].find((entry) => entry.id === actions[number].id && entry.kind === "equipment" && Number(entry.quantity || 0) > 0);
            if (!item) throw new HttpsError("failed-precondition", "その装備は所持していません。");
            const nextEquipment = { ...(states[number].equipment || {}), [item.slot]: item.id };
            actions[number] = { ...actions[number], nextStats: totalStats({ ...states[number], equipment: nextEquipment }, inventories[number]), nextEquipment };
          }
        }

        battle.players[a].guard = false;
        battle.players[b].guard = false;
        const logs = [];
        const order = actionSpeed(battle.players[a].stats, actions[a]) >= actionSpeed(battle.players[b].stats, actions[b]) ? [a, b] : [b, a];
        for (const number of order) {
          const target = number === a ? b : a;
          applyCombatAction(battle.players[number], battle.players[target], actions[number], skillsForState(states[number], inventories[number]), inventories[number], logs);
        }
        applyEndTurnStatus(battle.players[a], logs);
        applyEndTurnStatus(battle.players[b], logs);

        for (const number of [a, b]) {
          if (battle.players[number].usedItem) {
            const snapshot = itemSnapshots[number];
            if (snapshot?.exists && Number(snapshot.data()?.quantity || 0) > 0) transaction.update(snapshot.ref, { quantity: Number(snapshot.data().quantity) - 1, updatedAt: new Date() });
            delete battle.players[number].usedItem;
          }
          if (battle.players[number].equipmentChange) {
            const change = battle.players[number].equipmentChange;
            transaction.update(stateSnapshots[number].ref, { [`equipment.${change.slot}`]: change.itemId, updatedAt: new Date() });
            delete battle.players[number].equipmentChange;
          }
        }

        battle.log = [...battle.log.slice(-10), ...logs];
        battle.processedRequestIds = [...new Set([...battle.processedRequestIds, ...Object.values(battle.pendingActions).map((entry) => entry.requestId)])].slice(-40);
        battle.pendingActions = {};
        battle.turn += 1;
        resolved = true;

        const loser = [a, b].find((number) => battle.players[number].hp <= 0);
        if (loser) {
          const winner = loser === a ? b : a;
          const rewardDate = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
          battle.status = "finished";
          battle.winner = winner;
          battle.finishedAt = new Date();
          for (const [number, opponent] of [[a, b], [b, a]]) {
            const state = states[number];
            const won = number === winner;
            const previousRewardCount = Number(state.pvpRewardLedger?.[rewardDate]?.[opponent] || 0);
            const rewardXp = previousRewardCount < 5 ? (won ? 80 : 45) : 0;
            const growth = applyExperience(state, rewardXp);
            const records = {
              ...(state.records || {}),
              pvpWins: Number(state.records?.pvpWins || 0) + (won ? 1 : 0),
              pvpLosses: Number(state.records?.pvpLosses || 0) + (won ? 0 : 1),
              currentStreak: won ? Number(state.records?.currentStreak || 0) + 1 : 0,
              bestStreak: won ? Math.max(Number(state.records?.bestStreak || 0), Number(state.records?.currentStreak || 0) + 1) : Number(state.records?.bestStreak || 0),
            };
            transaction.update(stateSnapshots[number].ref, {
              level: growth.level, xp: growth.xp, overflowXp: growth.overflowXp, totalXp: growth.totalXp,
              skillPoints: Number(state.skillPoints || 0) + growth.levelsGained * 3, records,
              pvpRewardLedger: { ...(state.pvpRewardLedger || {}), [rewardDate]: { ...(state.pvpRewardLedger?.[rewardDate] || {}), [opponent]: previousRewardCount + 1 } },
              updatedAt: new Date(),
            });
            transaction.create(stateRef(number).collection("battleHistory").doc(battleId), { mode: "pvp", opponent, won, turns: battle.turn, reward: { xp: rewardXp, limited: rewardXp === 0 }, createdAt: new Date() });
          }
        }
      } else {
        battle.processedRequestIds = [...new Set([...battle.processedRequestIds, requestId])].slice(-40);
      }

      battle.updatedAt = new Date();
      transaction.update(battleSnapshot.ref, battle);
      return { battle, resolved };
    });
  }
  async function forfeitPvp(request) {
    const studentNumber = requireTester(request);
    const battleId = String(request.data?.battleId || "");
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(pvpBattleRef(battleId));
      const battle = snapshot.data() || {};
      if (!snapshot.exists || battle.status !== "active" || !battle.participants?.includes(studentNumber)) throw new HttpsError("failed-precondition", "対戦を終了できません。");
      const winner = battle.participants.find((number) => number !== studentNumber);
      const stateSnapshots = {};
      for (const participant of battle.participants) stateSnapshots[participant] = await transaction.get(stateRef(participant));
      const rewardDate = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
      for (const participant of battle.participants) {
        const opponent = battle.participants.find((number) => number !== participant);
        const stateSnapshot = stateSnapshots[participant];
        const state = stateSnapshot.data() || {};
        const won = participant === winner;
        const previousRewardCount = Number(state.pvpRewardLedger?.[rewardDate]?.[opponent] || 0);
        const rewardXp = previousRewardCount < 5 ? (won ? 80 : 45) : 0;
        const growth = applyExperience(state, rewardXp);
        const records = {
          ...(state.records || {}),
          pvpWins: Number(state.records?.pvpWins || 0) + (won ? 1 : 0),
          pvpLosses: Number(state.records?.pvpLosses || 0) + (won ? 0 : 1),
          currentStreak: won ? Number(state.records?.currentStreak || 0) + 1 : 0,
          bestStreak: won ? Math.max(Number(state.records?.bestStreak || 0), Number(state.records?.currentStreak || 0) + 1) : Number(state.records?.bestStreak || 0),
        };
        transaction.update(stateSnapshot.ref, {
          level: growth.level, xp: growth.xp, overflowXp: growth.overflowXp, totalXp: growth.totalXp,
          skillPoints: Number(state.skillPoints || 0) + growth.levelsGained * 3, records,
          pvpRewardLedger: { ...(state.pvpRewardLedger || {}), [rewardDate]: { ...(state.pvpRewardLedger?.[rewardDate] || {}), [opponent]: previousRewardCount + 1 } },
          updatedAt: new Date(),
        });
        transaction.create(stateRef(participant).collection("battleHistory").doc(battleId), { mode: "pvp", opponent, won, forfeited: true, turns: Number(battle.turn || 1), reward: { xp: rewardXp, limited: rewardXp === 0 }, createdAt: new Date() });
      }
      transaction.update(snapshot.ref, { status: "finished", winner, forfeitedBy: studentNumber, finishedAt: new Date(), updatedAt: new Date() });
      return { forfeited: true, winner };
    });
  }
  async function syncLearningPoints(studentNumber) { if(!isAmamonTester(studentNumber)) return; const reference=stateRef(studentNumber); await db.runTransaction(async(transaction)=>{const [stateSnapshot,rankingSnapshot]=await Promise.all([transaction.get(reference),transaction.get(db.collection("totalRanking").doc(studentNumber))]); if(!stateSnapshot.exists||!stateSnapshot.data()?.pointMigration?.migratedAt||!rankingSnapshot.exists)return; const state=stateSnapshot.data()||{}; const current=Math.max(0,Number(rankingSnapshot.data()?.point||0)); const high=Math.max(0,Number(state.pointMigration?.highWatermark||0)); if(current<=high)return; transaction.update(reference,{gachaPoints:Number(state.gachaPoints||0)+(current-high),"pointMigration.highWatermark":current,"pointMigration.lastSyncedAt":new Date(),updatedAt:new Date()});}); }

  return { getDashboard, createCompanion, drawGacha, resolveDuplicate, saveEquipment, allocateSkills, respecSkills, usePermanentItem, startCpuBattle, submitCpuAction, listOpponents, sendPvpInvite, respondPvpInvite, getPvpBattle, submitPvpAction, forfeitPvp, syncLearningPoints };
}

module.exports = { createAmamonService };
