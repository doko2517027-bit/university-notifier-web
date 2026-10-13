const TIERS = Object.freeze({ N: 1, R: 2, SR: 3, SSR: 4, UR: 5, LR: 6 });

// Small prototype battle modifiers. The server verifies the selected item IDs;
// CPU results and these client-side effects are never official point evidence.
export function pilotBonuses(gachaState) {
  const selected = gachaState?.equippedItems || {};
  const inventory = Array.isArray(gachaState?.inventory) ? gachaState.inventory : [];
  const tier = (category) => {
    const item = inventory.find((entry) => entry.itemId === selected[category] && entry.category === category);
    return TIERS[item?.rarity] || 0;
  };
  return {
    maxHp: tier('character') * 3,
    attack: tier('gear') * 0.5,
    walkSpeed: tier('accessory') * 0.03,
    skillCooldownFactor: 1 - tier('skill') * 0.02,
  };
}
