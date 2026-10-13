// Server-owned pilot catalog. IDs and names are deliberately independent of 3D assets.
// These are collectibles only until the equipment/character integration is verified.
const NAMES = Object.freeze({
  character: Object.freeze({ N: 'ルーキー・ミント', R: 'ルーキー・コーラル', SR: 'ルーキー・スカイ', SSR: 'ルーキー・ノヴァ', UR: 'ルーキー・オーロラ', LR: 'ルーキー・プリズム' }),
  gear: Object.freeze({ N: '投擲グローブ', R: '軽量ヘルメット', SR: '反発シールド', SSR: '精密スローアー', UR: '流星アーマー', LR: '黄金の投擲具' }),
  accessory: Object.freeze({ N: '星のバッジ', R: '風のブローチ', SR: '虹のチャーム', SSR: '彗星ペンダント', UR: '極光のリング', LR: '王冠のチャーム' }),
  skill: Object.freeze({ N: 'クイックステップ', R: 'ガードスロー', SR: 'ダブルスロー', SSR: 'リカバリー', UR: 'ストームスロー', LR: 'プリズムバースト' }),
});

function catalogItem(category, rarity) {
  const name = NAMES[category]?.[rarity];
  if (!name) throw new TypeError('Unknown Throb catalog item');
  return { catalogId: `${category}-${rarity.toLowerCase()}`, category, rarity, name };
}

module.exports = { NAMES, catalogItem };
