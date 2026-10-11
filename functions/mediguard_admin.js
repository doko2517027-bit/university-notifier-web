const {
  DEFAULT_BANNER, PASSIVE_TYPES, SKILL_TYPES, RARITIES,
  loadMediguardConfig, sanitizeBanner, sanitizeCharacter,
  validateBanner, validateCharacter,
} = require("./mediguard_config");

function createMediguardAdminService({ db, HttpsError, requireAdmin }) {
  const settingsRef = () => db.collection("mediguardGameConfig").doc("settings");
  const bannerRef = (id) => db.collection("mediguardGachaBanners").doc(id);
  const characterRef = (id) => db.collection("mediguardCharacterConfigs").doc(id);

  async function dashboard(request) {
    await requireAdmin(request);
    const config = await loadMediguardConfig(db);
    const players = await db.collection("mediguardPlayers").count().get();
    return {
      ...config,
      options: { rarities: RARITIES, passiveTypes: PASSIVE_TYPES, skillTypes: SKILL_TYPES },
      summary: {
        playerCount: players.data().count,
        bannerCount: config.banners.length,
        characterCount: config.characters.filter((item) => item.enabled).length,
      },
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
