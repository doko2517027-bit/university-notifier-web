const {
  DEFAULT_BANNER, PASSIVE_TYPES, SKILL_TYPES, RARITIES,
  loadMediguardConfig, sanitizeBanner, sanitizeCharacter,
  validateBanner, validateCharacter,
} = require("./mediguard_config");
const { buildMediguardAdminMetrics } = require("./mediguard_admin_metrics");

function createMediguardAdminService({ db, realtimeDb, HttpsError, requireAdmin }) {
  const settingsRef = () => db.collection("mediguardGameConfig").doc("settings");
  const bannerRef = (id) => db.collection("mediguardGachaBanners").doc(id);
  const characterRef = (id) => db.collection("mediguardCharacterConfigs").doc(id);

  async function collectMetrics(config) {
    const safeDocs = async (query, prefix = "") => {
      try {
        const snapshot = await query.get();
        return snapshot.docs
          .filter((doc) => !prefix || String(doc.ref?.path || "").startsWith(prefix))
          .map((doc) => ({ id: doc.id, path: doc.ref?.path || "", ...doc.data() }));
      } catch (error) {
        console.error("メディガ管理集計を読み込めませんでした:", error);
        return [];
      }
    };
    const safePresence = async () => {
      try { return (await realtimeDb?.ref("status").get())?.val?.() || {}; } catch (error) { console.error("メディガ接続状況を読み込めませんでした:", error); return {}; }
    };
    const [players, runs, operations, characters, errors, presence] = await Promise.all([
      safeDocs(db.collection("mediguardPlayers")),
      safeDocs(db.collectionGroup("runs").where("status", "==", "finished").limit(3000), "mediguardPlayers/"),
      safeDocs(db.collectionGroup("operations").where("type", "==", "gacha").limit(3000), "mediguardPlayers/"),
      safeDocs(db.collectionGroup("characters").limit(3000), "mediguardPlayers/"),
      safeDocs(db.collection("mediguardErrors").limit(300)),
      safePresence(),
    ]);
    return buildMediguardAdminMetrics({ players, runs, operations, characters, errors, presence, catalog: config.characters });
  }

  async function metrics(request) {
    await requireAdmin(request);
    const config = await loadMediguardConfig(db);
    return { metrics: await collectMetrics(config) };
  }

  async function dashboard(request) {
    await requireAdmin(request);
    const config = await loadMediguardConfig(db);
    const metrics = await collectMetrics(config);
    return {
      ...config,
      options: { rarities: RARITIES, passiveTypes: PASSIVE_TYPES, skillTypes: SKILL_TYPES },
      summary: {
        playerCount: metrics.totalPlayers,
        bannerCount: config.banners.length,
        characterCount: config.characters.filter((item) => item.enabled).length,
      },
      metrics,
    };
  }

  async function saveBanner(request) {
    const adminStudentNumber = await requireAdmin(request);
    const config = await loadMediguardConfig(db);
    const banner = sanitizeBanner(request.data?.banner);
    const message = validateBanner(banner, config.characters);
    if (message) throw new HttpsError("invalid-argument", message);
    await bannerRef(banner.id).set({
      ...banner,
      updatedAt: new Date(),
      updatedBy: adminStudentNumber,
    }, { merge: false });
    return { saved: true, banner };
  }

  async function deleteBanner(request) {
    const adminStudentNumber = await requireAdmin(request);
    const id = sanitizeBanner({ id: request.data?.bannerId }).id;
    const config = await loadMediguardConfig(db);
    const existing = config.banners.find((item) => item.id === id);
    if (!existing) throw new HttpsError("not-found", "対象のガチャが見つかりません。");
    if (id === DEFAULT_BANNER.id) throw new HttpsError("failed-precondition", "標準ガチャは削除できません。非公開への変更はできます。");
    if (config.banners.length <= 1) throw new HttpsError("failed-precondition", "最後のガチャは削除できません。");
    if (config.settings.activeBannerId === id) throw new HttpsError("failed-precondition", "公開中のガチャは、別のガチャへ切り替えてから削除してください。");
    await bannerRef(id).delete();
    await db.collection("mediguardAdminAudit").add({ action: "deleteBanner", bannerId: id, adminStudentNumber, createdAt: new Date() });
    return { deleted: true, bannerId: id };
  }

  async function saveCharacter(request) {
    const adminStudentNumber = await requireAdmin(request);
    const config = await loadMediguardConfig(db);
    const previous = config.characters.find((item) => item.id === request.data?.character?.id) || {};
    const character = sanitizeCharacter(request.data?.character, previous);
    const message = validateCharacter(character);
    if (message) throw new HttpsError("invalid-argument", message);
    const nextCharacters = config.characters.filter((item) => item.id !== character.id).concat(character);
    for (const banner of config.banners.filter((item) => item.characterIds.includes(character.id))) {
      const bannerMessage = validateBanner(banner, nextCharacters);
      if (bannerMessage) throw new HttpsError("failed-precondition", `「${banner.name}」を確認してください。${bannerMessage}`);
    }
    await characterRef(character.id).set({
      ...character,
      updatedAt: new Date(),
      updatedBy: adminStudentNumber,
    }, { merge: false });
    return { saved: true, character };
  }

  async function saveSettings(request) {
    const adminStudentNumber = await requireAdmin(request);
    const config = await loadMediguardConfig(db);
    const activeBannerId = sanitizeBanner({ id: request.data?.activeBannerId }).id;
    if (!config.banners.some((item) => item.id === activeBannerId)) throw new HttpsError("invalid-argument", "公開するガチャを選択してください。");
    const settings = {
      activeBannerId,
      gameEnabled: request.data?.gameEnabled !== false,
      notice: String(request.data?.notice || "").trim().slice(0, 160),
      updatedAt: new Date(),
      updatedBy: adminStudentNumber,
    };
    await settingsRef().set(settings, { merge: true });
    return { saved: true, settings };
  }

  async function initializeDefaults(request) {
    const adminStudentNumber = await requireAdmin(request);
    const snapshot = await bannerRef(DEFAULT_BANNER.id).get();
    if (!snapshot.exists) await bannerRef(DEFAULT_BANNER.id).set({ ...DEFAULT_BANNER, createdAt: new Date(), updatedAt: new Date(), updatedBy: adminStudentNumber });
    await settingsRef().set({ activeBannerId: DEFAULT_BANNER.id, gameEnabled: true, updatedAt: new Date(), updatedBy: adminStudentNumber }, { merge: true });
    return { initialized: true };
  }

  async function dispatch(request) {
    const action = String(request.data?.action || "dashboard");
    if (action === "dashboard") return dashboard(request);
    if (action === "metrics") return metrics(request);
    if (action === "saveBanner") return saveBanner(request);
    if (action === "deleteBanner") return deleteBanner(request);
    if (action === "saveCharacter") return saveCharacter(request);
    if (action === "saveSettings") return saveSettings(request);
    if (action === "initializeDefaults") return initializeDefaults(request);
    throw new HttpsError("invalid-argument", "操作を確認してください。");
  }
  return { dispatch };
}

module.exports = { createMediguardAdminService };
