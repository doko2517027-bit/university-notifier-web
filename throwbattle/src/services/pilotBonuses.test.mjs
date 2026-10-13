import test from 'node:test';
import assert from 'node:assert/strict';
import { pilotBonuses } from './pilotBonuses.js';
import { createProfile, battleLoadout } from './profile.js';

test('only server-selected owned items contribute small pilot battle modifiers', () => {
  const inventory = [
    { itemId: 'char', category: 'character', rarity: 'R' },
    { itemId: 'gear', category: 'gear', rarity: 'SR' },
    { itemId: 'accessory', category: 'accessory', rarity: 'N' },
    { itemId: 'skill', category: 'skill', rarity: 'LR' },
  ];
  const selected = { character: 'char', gear: 'gear', accessory: 'accessory', skill: 'skill' };
  const bonus = pilotBonuses({ inventory, equippedItems: selected });
  assert.deepEqual(bonus, { maxHp: 6, attack: 1.5, walkSpeed: 0.03, skillCooldownFactor: 0.88 });
  const normal = battleLoadout(createProfile());
  const equipped = battleLoadout(createProfile(), bonus);
  assert.equal(equipped.stats.maxHp, normal.stats.maxHp + 6);
  assert.equal(equipped.stats.walkSpeed, normal.stats.walkSpeed + 0.03);
  assert.equal(equipped.weapons[0].damage, normal.weapons[0].damage + 1.5);
  assert.equal(equipped.skills[0].cooldown, normal.skills[0].cooldown * 0.88);
  assert.equal(pilotBonuses({ inventory, equippedItems: { gear: 'not-owned' } }).attack, 0);
});
