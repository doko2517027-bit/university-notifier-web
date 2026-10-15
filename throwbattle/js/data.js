export const RULES = Object.freeze({
  gravity: 1750,
  stocks: 3,
  respawnSeconds: 10,
  invincibleSeconds: 3,
  hitInvincibleSeconds: 0.42,
  matchSeconds: 180,
  stageWidth: 1600,
  stageHeight: 900,
  deathY: 980,
  dodgeSeconds: 0.22,
  dodgeCooldown: 1.6,
  skillCooldown: 8,
});

export const STAGE = Object.freeze({
  id: 'practice_arena',
  name: 'トレーニングアリーナ',
  platforms: [
    { x: 85, y: 700, width: 625, height: 40, type: 'solid' },
    { x: 890, y: 700, width: 625, height: 40, type: 'solid' },
    { x: 305, y: 505, width: 245, height: 22, type: 'oneway' },
    { x: 1050, y: 505, width: 245, height: 22, type: 'oneway' },
    { x: 705, y: 420, width: 190, height: 22, type: 'moving', range: 110, speed: 0.8 },
  ],
  spawn: { player: { x: 340, y: 680 }, cpu: { x: 1260, y: 680 } },
});

export const WEAPONS = Object.freeze({
  training_disc: {
    id: 'training_disc', name: '仮ディスク', image: 'assets/weapons/training_disc.svg',
    damage: 22, speed: 930, gravity: 300, cooldown: 0.52,
    knockbackX: 360, knockbackY: 295, hitbox: { width: 45, height: 45 }, spin: 8,
  },
  haruto_laptop: {
    id: 'haruto_laptop', name: 'ハルトのノートパソコン', image: 'assets/weapons/haruto_laptop.png',
    damage: 25, speed: 860, gravity: 340, cooldown: 0.62,
    knockbackX: 390, knockbackY: 300, hitbox: { width: 52, height: 42 }, spin: 8,
    displaySize: 58,
  },
});

export const SKILLS = Object.freeze({
  power_throw: { id: 'power_throw', name: 'パワースロー', cooldown: 8, duration: 3.2, damageMultiplier: 1.4, speedMultiplier: 1.18 },
});

export const ARMORS = Object.freeze({
  training_helmet: {
    id: 'training_helmet', name: '仮ヘルメット', image: 'assets/armor/training_helmet.svg',
    anchor: 'head', layer: 'front', width: 75, height: 39, defense: 0,
  },
});

export const CPU_LEVELS = Object.freeze({
  easy: { reaction: 0.75, accuracy: 0.52, aggression: 0.46 },
  normal: { reaction: 0.35, accuracy: 0.72, aggression: 0.7 },
  hard: { reaction: 0.18, accuracy: 0.9, aggression: 0.92 },
});

export async function loadCharacters() {
  const manifest = await fetch('assets/characters/manifest.json').then((r) => {
    if (!r.ok) throw new Error('キャラクター一覧を読み込めません');
    return r.json();
  });
  const characters = await Promise.all(manifest.characters.map(async (path) => {
    const response = await fetch(`assets/characters/${path}`);
    if (!response.ok) throw new Error(`キャラクター設定を読み込めません: ${path}`);
    const data = await response.json();
    const idle = data.sprite?.animations?.idle;
    if (!data.id || !(idle?.frames?.length || idle?.sheet?.indices?.length)) throw new Error(`キャラクター設定が不正です: ${path}`);
    const directory = path.slice(0, path.lastIndexOf('/') + 1);
    return { ...data, assetBase: `assets/characters/${directory}` };
  }));
  return characters;
}

export async function loadSystemFighter() {
  const response = await fetch('assets/characters/training_dummy/character.json');
  if (!response.ok) throw new Error('システム試験用データを読み込めません');
  const data = await response.json();
  if (data.id !== 'training_dummy' || data.systemOnly !== true) throw new Error('システム試験用データが不正です');
  return { ...data, assetBase: 'assets/characters/training_dummy/' };
}
