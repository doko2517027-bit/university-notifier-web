const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const {
  PET_SPECIES,
  PET_CARE_ACTIONS,
  PET_FOOD_CATALOG,
  PET_SHOP_DEFAULT_ITEMS,
  PET_PREFERENCE_LABELS,
  petChoices,
  makePetProfile,
  applyPetCare,
  advancePetClock,
} = require("./pet_care_policy");

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION_OPTIONS = { region: "asia-northeast1", memory: "256MiB" };

function requireStudent(request) {
  const studentNumber = String(request.auth?.token?.studentNumber || "");
  if (!/^\d{7}$/.test(studentNumber) || request.auth?.uid !== `caremate-${studentNumber}`) {
    throw new HttpsError("unauthenticated", "ログインが必要です。");
  }
  return studentNumber;
}

function requirePilot(studentNumber) {
  if (studentNumber !== "2510044") throw new HttpsError("permission-denied", "現在はテスト利用者のみ利用できます。");
}

function clampPoints(value) { return Math.max(0, Math.floor(Number(value) || 0)); }

exports.getPetGameStateV2 = onCall(REGION_OPTIONS, async (request) => {
  const studentNumber = requireStudent(request);
  requirePilot(studentNumber);
  const accountRef = db.collection("referralAccounts").doc(studentNumber);
  const profileRef = db.collection("petProfiles").doc(studentNumber);
  const rankingRef = db.collection("totalRanking").doc(studentNumber);
  const [accountSnapshot, rankingSnapshot] = await Promise.all([accountRef.get(), rankingRef.get()]);
  let profile = null;
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(profileRef);
    if (!snapshot.exists) return;
    const original = snapshot.data();
    profile = advancePetClock(original, new Date());
    const changed = original.petCoins != null || Number(original.schemaVersion || 1) < 2 ||
      original.fullness == null || !original.inventory || !original.affinityAwards ||
      !original.lastMeterAt || !original.lastAffinityDecayAt || !original.lastInteractionAt ||
      original.fullness !== profile.fullness || original.friendship !== profile.friendship ||
      original.isSleeping !== profile.isSleeping;
    if (changed) transaction.set(profileRef, { ...profile, petCoins: FieldValue.delete() }, { merge: true });
  });
  const catalogSnapshot = await db.collection("petShopCatalog").get();
  const custom = new Map(catalogSnapshot.docs.map((item) => [item.id, { id: item.id, ...item.data() }]));
  const catalog = PET_SHOP_DEFAULT_ITEMS.map((item) => ({ ...item, ...(custom.get(item.id) || {}) }));
  for (const item of custom.values()) if (!catalog.some((base) => base.id === item.id) && item.enabled !== false) catalog.push(item);
  const rank = rankingSnapshot.data() || {};
  return {
    eligible: true,
    pilot: true,
    choices: petChoices(studentNumber),
    species: PET_SPECIES,
    careActions: PET_CARE_ACTIONS,
    profile,
    learningPointBalance: clampPoints(rank.availablePointBalance ?? rank.point),
    catalog: catalog.filter((item) => item.enabled !== false),
  };
});

exports.updatePetGameStateV2 = onCall(REGION_OPTIONS, async (request) => {
  const studentNumber = requireStudent(request);
  requirePilot(studentNumber);
  const action = String(request.data?.action || "");
  const profileRef = db.collection("petProfiles").doc(studentNumber);
  const accountRef = db.collection("referralAccounts").doc(studentNumber);
  const now = new Date();

  if (action === "choose") {
    const species = String(request.data?.species || "");
    const name = String(request.data?.name || "").trim();
    if (!petChoices(studentNumber).includes(species) || !PET_SPECIES[species]) throw new HttpsError("invalid-argument", "選べないペットです。");
    if (!name || name.length > 12 || /[\u0000-\u001f<>]/.test(name)) throw new HttpsError("invalid-argument", "名前は1〜12文字で入力してください。");
    return db.runTransaction(async (transaction) => {
      const existing = await transaction.get(profileRef);
      if (existing.exists) return { profile: existing.data(), alreadyChosen: true };
      const profile = makePetProfile({ species, name, now });
      transaction.create(profileRef, profile);
      return { profile, alreadyChosen: false };
    });
  }

  if (action === "care") {
    const careAction = String(request.data?.careAction || "");
    const foodId = String(request.data?.foodId || "");
    if (!PET_CARE_ACTIONS.includes(careAction)) throw new HttpsError("invalid-argument", "お世話の種類を確認してください。");
    return db.runTransaction(async (transaction) => {
      const [account, snapshot] = await Promise.all([transaction.get(accountRef), transaction.get(profileRef)]);
      const foodSnapshot = foodId ? await transaction.get(db.collection("petShopCatalog").doc(foodId)) : null;
      if (!snapshot.exists) throw new HttpsError("failed-precondition", "先に一緒に暮らすペットを選んでください。");
      if (foodId && foodSnapshot?.exists && (foodSnapshot.data().kind !== "food" || foodSnapshot.data().enabled === false)) throw new HttpsError("invalid-argument", "選んだごはんは現在利用できません。");
      let profile;
      try {
        const custom = foodSnapshot?.exists ? { id: foodSnapshot.id, ...foodSnapshot.data() } : PET_FOOD_CATALOG[foodId];
        profile = applyPetCare(snapshot.data(), careAction, now, { foodId, food: custom });
      } catch (error) {
        if (error.message === "sleep-time") throw new HttpsError("failed-precondition", "夜はぐっすり眠っています。朝までそっとしておきましょう。");
        if (error.message === "too-full") throw new HttpsError("failed-precondition", "まだおなかがいっぱいです。少し時間をおいてね。");
        if (error.message === "out-of-stock") throw new HttpsError("failed-precondition", "そのごはんの在庫がありません。");
        throw new HttpsError("invalid-argument", "お世話を記録できませんでした。");
      }
      transaction.set(profileRef, profile);
      return { profile };
    });
  }

  if (action === "buy") {
    const itemId = String(request.data?.itemId || "");
    if (!/^[a-z0-9-]{2,40}$/.test(itemId)) throw new HttpsError("invalid-argument", "商品を確認してください。");
    const itemRef = db.collection("petShopCatalog").doc(itemId);
    const rankingRef = db.collection("totalRanking").doc(studentNumber);
    return db.runTransaction(async (transaction) => {
      const [account, snapshot, itemSnapshot, rankingSnapshot] = await Promise.all([
        transaction.get(accountRef), transaction.get(profileRef), transaction.get(itemRef), transaction.get(rankingRef),
      ]);
      if (!snapshot.exists) throw new HttpsError("failed-precondition", "先にペットをお迎えしてください。");
      const item = itemSnapshot.exists ? { id: itemId, ...itemSnapshot.data() } : PET_SHOP_DEFAULT_ITEMS.find((candidate) => candidate.id === itemId);
      if (!item || item.enabled === false || item.shopAvailable === false || item.infinite === true) throw new HttpsError("failed-precondition", "この商品は購入できません。");
      const price = clampPoints(item.price);
      const ranking = rankingSnapshot.data() || {};
      const balance = clampPoints(ranking.availablePointBalance ?? ranking.point);
      if (balance < price) throw new HttpsError("failed-precondition", "学習ポイントが足りません。");
      const profile = advancePetClock(snapshot.data(), now);
      const inventory = { ...(profile.inventory || {}), [itemId]: Number(profile.inventory?.[itemId] || 0) + 1 };
      const next = { ...profile, inventory, updatedAt: now };
      transaction.set(profileRef, { ...next, petCoins: FieldValue.delete() }, { merge: true });
      transaction.set(rankingRef, { availablePointBalance: balance - price, updatedAt: now }, { merge: true });
      return { profile: next, learningPointBalance: balance - price };
    });
  }

  if (action === "set-toy") {
    const itemId = String(request.data?.itemId || "");
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(profileRef);
      if (!snapshot.exists) throw new HttpsError("failed-precondition", "先にペットをお迎えしてください。");
      const profile = snapshot.data();
      const owned = Number(profile.inventory?.[itemId] || 0) > 0;
      if (itemId && !owned) throw new HttpsError("permission-denied", "持っていないおもちゃです。");
      const next = { ...profile, activeToyId: itemId, updatedAt: now };
      transaction.set(profileRef, next, { merge: true });
      return { profile: next };
    });
  }

  throw new HttpsError("invalid-argument", "操作内容が正しくありません。");
});
