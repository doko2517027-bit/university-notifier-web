import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, loadProfile, saveProfile, deriveStats, allocateStat, equip, upgradeWeapon, applyBattleResult, battleLoadout } from './profile.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
const result = (winner = 'player') => ({ winner, reason: 'eliminated', player: { kills: 3, damage: 220 } });

test('new player persists without touching CareMate data', () => {
  const storage = memoryStorage();
  storage.setItem('caremate:points', '1563');
  const profile = createProfile();
  assert.equal(saveProfile(profile, storage), true);
  assert.deepEqual(loadProfile(storage).profile, profile);
  assert.equal(storage.getItem('caremate:points'), '1563');
});

test('result awards XP once and level grants allocatable points', () => {
  const first = applyBattleResult(createProfile(), result(), 'match-1');
  assert.equal(first.xp, 40);
  assert.equal(first.profile.record.matches, 1);
  assert.equal(first.profile.character.xp, 40);
  assert.equal(first.profile.inventory.trainingParts, 3);
  const second = applyBattleResult(first.profile, result(), 'match-2');
  assert.equal(second.profile.character.level, 2);
  assert.equal(second.profile.character.points, 3);
  const repeated = applyBattleResult(second.profile, result(), 'match-2');
  assert.equal(repeated.duplicate, true);
  assert.equal(repeated.profile.record.matches, 2);
});

test('stats, armor and weapon/skill slots affect only the chosen loadout', () => {
  const original = createProfile();
  original.character.points = 2;
  const trained = allocateStat(original, 'hp');
  assert.equal(deriveStats(trained).maxHp, 105);
  assert.equal(original.character.allocated.hp, 0);
  const protectedPlayer = equip(trained, 'armor', 'head', 'trainingCap');
  assert.equal(deriveStats(protectedPlayer).maxHp, 115);
  const reordered = equip(protectedPlayer, 'weapons', 0, 'knife');
  assert.deepEqual(reordered.equipped.weapons, ['knife', 'laptop', 'bed']);
  const skilled = equip(reordered, 'skills', 0, 'quickstep');
  assert.deepEqual(skilled.equipped.skills, ['quickstep', 'guard']);
  assert.equal(battleLoadout(skilled).skills[0].effect, 'speed');
  assert.equal(equip(skilled, 'armor', 'head', 'trainingVest'), null);
});

test('level caps require both threshold level and number of matches', () => {
  const profile = createProfile();
  profile.character.level = 50;
  profile.character.xp = 2000;
  profile.record.matches = 28;
  const locked = applyBattleResult(profile, result(), 'm29');
  assert.equal(locked.profile.character.level, 50);
  assert.equal(locked.profile.character.cap, 50);
  const unlocked = applyBattleResult(locked.profile, result(), 'm30');
  assert.equal(unlocked.profile.character.cap, 100);
  assert.ok(unlocked.profile.character.level > 50);
});

test('corrupt local save is rejected safely', () => {
  const storage = memoryStorage();
  storage.setItem('throb:standalone-profile:v1', '{bad');
  const loaded = loadProfile(storage);
  assert.equal(loaded.recovered, true);
  assert.equal(loaded.profile.character.level, 1);
});

test('weapon strengthening spends earned parts and changes battle damage', () => {
  const earned = applyBattleResult(createProfile(), result(), 'earned').profile;
  const upgraded = upgradeWeapon(earned, 'laptop');
  assert.equal(upgraded.inventory.trainingParts, 1);
  assert.equal(upgraded.inventory.weaponLevels.laptop, 2);
  assert.equal(battleLoadout(upgraded).weapons[0].damage, 22);
  assert.equal(upgradeWeapon(upgraded, 'laptop'), null, 'insufficient materials blocks a second upgrade');
});

test('older local Phase 5 saves gain upgrade fields without losing progress', () => {
  const storage = memoryStorage();
  const previous = createProfile();
  previous.character.xp = 25;
  previous.record.matches = 2;
  delete previous.inventory.trainingParts;
  delete previous.inventory.weaponLevels;
  storage.setItem('throb:standalone-profile:v1', JSON.stringify(previous));
  const loaded = loadProfile(storage);
  assert.equal(loaded.recovered, false);
  assert.equal(loaded.profile.character.xp, 25);
  assert.equal(loaded.profile.record.matches, 2);
  assert.equal(loaded.profile.inventory.trainingParts, 0);
  assert.equal(loaded.profile.inventory.weaponLevels.laptop, 1);
});
