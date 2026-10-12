// Phase 5 balance is intentionally isolated from rendering and local storage.
export const PROGRESSION = Object.freeze({
  initialLevel: 1,
  initialCap: 50,
  capUnlocks: [
    { atLevel: 50, matches: 30, cap: 100 },
    { atLevel: 100, matches: 100, cap: 150 },
  ],
  pointsPerLevel: 3,
  xpWin: 40,
  xpLoss: 15,
  xpDraw: 20,
  xpForNextLevel: (level) => 50 + level * 25,
  weaponUpgrade: {
    maxLevel: 10,
    damagePerLevel: 2,
    costForNext: (level) => level * 2,
    partsWin: 3,
    partsLoss: 1,
    partsDraw: 2,
  },
  stats: {
    hp: { label: '最大HP', perPoint: 5 },
    attack: { label: '攻撃力', perPoint: 0.6 },
    defense: { label: '防御力', perPoint: 0.35 },
    speed: { label: '移動速度', perPoint: 0.035, cap: 2 },
    strength: { label: '腕力', perPoint: 0.012, cap: 0.35 },
  },
});

export const ARMOR = Object.freeze({
  trainingCap: { id: 'trainingCap', name: '練習用ヘルメット', slot: 'head', maxHp: 10, defense: 0 },
  trainingVest: { id: 'trainingVest', name: '練習用ベスト', slot: 'body', maxHp: 0, defense: 3 },
});

export const SKILLS = Object.freeze({
  bandage: { id: 'bandage', name: '応急手当', description: 'HPを25回復', cooldown: 20, effect: 'heal', amount: 25 },
  guard: { id: 'guard', name: '防壁', description: '2秒間ダメージを防ぐ', cooldown: 25, effect: 'guard', duration: 2 },
  quickstep: { id: 'quickstep', name: 'クイックステップ', description: '5秒間、移動速度が上昇', cooldown: 25, effect: 'speed', duration: 5 },
});
