export const CONFIG = Object.freeze({
  version: 1,
  maxHealth: 100,
  lives: 3,
  matchSeconds: 300,
  respawnSeconds: 10,
  invincibleSeconds: 3,
  suddenDeathSeconds: 90,
  walkSpeed: 5,
  dashMultiplier: 1.5,
  jumpVelocity: 6.5,
  gravity: 15,
  headshotMultiplier: 1.5,
  weakAimAssist: 0.05,
  cameraSensitivity: 0.0035,
  cpu: {
    easy: { speed: 3.3, accuracy: 0.44, fireDelay: 1.6 },
    normal: { speed: 4.1, accuracy: 0.68, fireDelay: 1.15 },
    hard: { speed: 4.8, accuracy: 0.82, fireDelay: 0.85 },
  },
});

export const ASSETS = Object.freeze({
  character: { model: null, animations: {} },
  weapons: { laptop: null, knife: null, bed: null },
  stages: { classroom: null },
  ui: { logo: null, buttons: { primary: null }, backgrounds: { title: null, menu: null } },
  audio: { bgm: null, click: null, throw: null, impact: null, hit: null },
});

// Appearance, battle values and future ownership data stay independent. Replacing
// a GLB or a cosmetic preset must never change the character's battle values.
export const CHARACTER_APPEARANCES = Object.freeze({
  student: { model: ASSETS.character.model, color: 0x3c6fd5, animationSet: ASSETS.character.animations },
});
export const CHARACTER_STATS = Object.freeze({
  student: { hp: 100, walkSpeed: CONFIG.walkSpeed, attack: 10, defense: 10, strength: 10 },
});
export const CHARACTER_PROGRESSION = Object.freeze({
  student: { initialLevel: 1, initialCap: 50, laterCaps: [100, 150] },
});
export const CHARACTER_COSMETICS = Object.freeze({
  student: { clothing: null, hair: null, face: null, color: null, accessory: null },
});
export const CHARACTERS = Object.freeze({
  student: {
    id: 'student', name: 'ルーキー',
    ...CHARACTER_APPEARANCES.student,
    ...CHARACTER_STATS.student,
    progression: CHARACTER_PROGRESSION.student,
    cosmetics: CHARACTER_COSMETICS.student,
  },
});

export const WEAPONS = Object.freeze([
  { id: 'laptop', name: 'パソコン', model: ASSETS.weapons.laptop, damage: 20, projectileSpeed: 19, cooldown: 0.68, weight: 0.7, range: 30, color: 0x263443, size: [0.42, 0.29, 0.12] },
  { id: 'knife', name: 'ナイフ', model: ASSETS.weapons.knife, damage: 15, projectileSpeed: 28, cooldown: 0.40, weight: 0.35, range: 34, color: 0xbfcad6, size: [0.11, 0.12, 0.62] },
  { id: 'bed', name: 'ベッド', model: ASSETS.weapons.bed, damage: 44, projectileSpeed: 13, cooldown: 1.15, weight: 1.2, range: 22, color: 0xa27b5a, size: [0.62, 0.32, 0.95] },
]);

export const STAGES = Object.freeze({
  classroom: {
    id: 'classroom', name: '放課後の教室', model: ASSETS.stages.classroom,
    width: 34, depth: 28,
    spawns: [{ x: -11, z: 9 }, { x: 11, z: -9 }],
    cover: [
      { x: -5, z: 4, w: 3.4, d: 1.5, h: 1.8, kind: 'desk' },
      { x: 5, z: -4, w: 3.4, d: 1.5, h: 1.8, kind: 'desk' },
      { x: -4, z: -5, w: 2.2, d: 2.2, h: 2.5, kind: 'cabinet' },
      { x: 4, z: 5, w: 2.2, d: 2.2, h: 2.5, kind: 'cabinet' },
      { x: 0, z: 0, w: 2.4, d: 2.4, h: 1, kind: 'platform' },
    ],
    jumpPads: [{ x: -8, z: -3 }, { x: 8, z: 3 }],
    healSpawns: [{ x: 0, z: -9 }, { x: 0, z: 9 }],
  },
});

export const MENU_ITEMS = Object.freeze([
  ['キャラクター', 'キャラ変更・育成'], ['武器', '装備・強化'], ['倉庫', '所持アイテム'],
  ['ガチャ', '4種類のガチャ'], ['ショップ', 'アイテム購入'], ['ランキング', 'フレンド限定'],
  ['フレンド', '招待・管理'], ['設定', '操作・音量'],
]);
