import { CHARACTERS, WEAPONS } from '../data/config.js';
import { ARMOR, PROGRESSION, SKILLS } from '../data/progression.js';

export const PROFILE_KEY = 'throb:standalone-profile:v1';
const STAT_KEYS = Object.keys(PROGRESSION.stats);
const clone = (value) => JSON.parse(JSON.stringify(value));

export function createProfile() {
  return {
    version: 1,
    character: { id: 'student', level: 1, xp: 0, cap: 50, points: 0,
      allocated: { hp: 0, attack: 0, defense: 0, speed: 0, strength: 0 } },
    inventory: {
      weapons: WEAPONS.map((item) => item.id),
      weaponLevels: Object.fromEntries(WEAPONS.map((item) => [item.id, 1])),
      armor: Object.keys(ARMOR),
      skills: Object.keys(SKILLS),
      trainingParts: 0,
    },
    equipped: {
      weapons: WEAPONS.map((item) => item.id),
      armor: { head: null, body: null },
      skills: ['bandage', 'guard'],
    },
    record: { matches: 0, wins: 0, history: [] },
  };
}

export function validProfile(value) {
  if (!value || value.version !== 1 || value.character?.id !== 'student') return false;
  const { character, inventory, equipped, record } = value;
  if (![character.level, character.xp, character.cap, character.points, record?.matches, record?.wins]
    .every((number) => Number.isSafeInteger(number) && number >= 0)) return false;
  if (character.level < 1 || character.level > 150 || ![50, 100, 150].includes(character.cap)) return false;
  if (character.level > character.cap || record.wins > record.matches) return false;
  if (!STAT_KEYS.every((key) => Number.isSafeInteger(character.allocated?.[key]) && character.allocated[key] >= 0)) return false;
  if (!Array.isArray(inventory?.weapons) || !Array.isArray(inventory.armor) || !Array.isArray(inventory.skills)) return false;
  if (inventory.weapons.some((id) => !WEAPONS.some((item) => item.id === id)) || inventory.armor.some((id) => !ARMOR[id]) || inventory.skills.some((id) => !SKILLS[id])) return false;
  if (!Number.isSafeInteger(inventory.trainingParts) || inventory.trainingParts < 0) return false;
  if (inventory.weapons.some((id) => !Number.isSafeInteger(inventory.weaponLevels?.[id])
    || inventory.weaponLevels[id] < 1 || inventory.weaponLevels[id] > PROGRESSION.weaponUpgrade.maxLevel)) return false;
  if (!Array.isArray(equipped?.weapons) || equipped.weapons.length !== 3 || new Set(equipped.weapons).size !== 3) return false;
  if (equipped.weapons.some((id) => !inventory.weapons.includes(id))) return false;
  if (!['head', 'body'].every((slot) => equipped.armor?.[slot] == null || inventory.armor.includes(equipped.armor[slot]) && ARMOR[equipped.armor[slot]].slot === slot)) return false;
  if (!Array.isArray(equipped.skills) || equipped.skills.length !== 2 || new Set(equipped.skills).size !== 2 || equipped.skills.some((id) => !inventory.skills.includes(id))) return false;
  return Array.isArray(record.history) && record.history.length <= 50;
}

export function loadProfile(storage) {
  try {
    const raw = (storage || globalThis.localStorage).getItem(PROFILE_KEY);
    if (!raw) return { profile: createProfile(), recovered: false };
    const parsed = JSON.parse(raw);
    // Older Phase 5 saves did not have upgrade materials; preserve all their
    // existing XP, armor and match history while adding the new fields.
    if (parsed?.version === 1 && parsed.inventory) {
      parsed.inventory.weaponLevels ||= Object.fromEntries(WEAPONS.map((item) => [item.id, 1]));
      parsed.inventory.trainingParts ??= 0;
    }
    if (!validProfile(parsed)) return { profile: createProfile(), recovered: true };
    return { profile: parsed, recovered: false };
  } catch {
    return { profile: createProfile(), recovered: true };
  }
}

export function saveProfile(profile, storage) {
  if (!validProfile(profile)) return false;
  try { (storage || globalThis.localStorage).setItem(PROFILE_KEY, JSON.stringify(profile)); return true; }
  catch { return false; }
}

export function deriveStats(profile) {
  const base = CHARACTERS.student;
  const allocated = profile.character.allocated;
  const gear = Object.values(profile.equipped.armor).map((id) => ARMOR[id]).filter(Boolean);
  const armorHp = gear.reduce((sum, item) => sum + item.maxHp, 0);
  const armorDefense = gear.reduce((sum, item) => sum + item.defense, 0);
  return {
    maxHp: base.hp + allocated.hp * PROGRESSION.stats.hp.perPoint + armorHp,
    attack: Math.round(allocated.attack * PROGRESSION.stats.attack.perPoint * 10) / 10,
    defense: Math.round((allocated.defense * PROGRESSION.stats.defense.perPoint + armorDefense) * 10) / 10,
    walkSpeed: base.walkSpeed + Math.min(PROGRESSION.stats.speed.cap, allocated.speed * PROGRESSION.stats.speed.perPoint),
    throwPower: 1 + Math.min(PROGRESSION.stats.strength.cap, allocated.strength * PROGRESSION.stats.strength.perPoint),
  };
}

export function battleLoadout(profile, pilot = {}) {
  const stats = deriveStats(profile);
  stats.maxHp += Number(pilot.maxHp) || 0;
  stats.walkSpeed += Number(pilot.walkSpeed) || 0;
  return {
    stats,
    weapons: profile.equipped.weapons.map((id) => {
      const weapon = WEAPONS.find((item) => item.id === id);
      return { ...weapon, damage: weapon.damage + (profile.inventory.weaponLevels[id] - 1) * PROGRESSION.weaponUpgrade.damagePerLevel + (Number(pilot.attack) || 0) };
    }),
    skills: profile.equipped.skills.map((id) => ({ ...SKILLS[id],
      cooldown: SKILLS[id].cooldown * (Number(pilot.skillCooldownFactor) || 1) })),
  };
}

export function upgradeWeapon(profile, id) {
  if (!profile.inventory.weapons.includes(id)) return null;
  const level = profile.inventory.weaponLevels[id];
  if (level >= PROGRESSION.weaponUpgrade.maxLevel) return null;
  const cost = PROGRESSION.weaponUpgrade.costForNext(level);
  if (profile.inventory.trainingParts < cost) return null;
  const next = clone(profile);
  next.inventory.trainingParts -= cost;
  next.inventory.weaponLevels[id]++;
  return next;
}

export function allocateStat(profile, key) {
  if (!STAT_KEYS.includes(key) || profile.character.points < 1) return null;
  const next = clone(profile);
  next.character.points--;
  next.character.allocated[key]++;
  return next;
}

export function equip(profile, category, slot, id) {
  const next = clone(profile);
  if (category === 'weapons') {
    if (!Number.isInteger(slot) || slot < 0 || slot > 2 || !next.inventory.weapons.includes(id)) return null;
    const other = next.equipped.weapons.indexOf(id);
    if (other !== -1) next.equipped.weapons[other] = next.equipped.weapons[slot];
    next.equipped.weapons[slot] = id;
  } else if (category === 'armor') {
    if (!['head', 'body'].includes(slot) || id !== null && (!next.inventory.armor.includes(id) || ARMOR[id].slot !== slot)) return null;
    next.equipped.armor[slot] = id;
  } else if (category === 'skills') {
    if (!Number.isInteger(slot) || slot < 0 || slot > 1 || !next.inventory.skills.includes(id)) return null;
    const other = next.equipped.skills.indexOf(id);
    if (other !== -1) next.equipped.skills[other] = next.equipped.skills[slot];
    next.equipped.skills[slot] = id;
  } else return null;
  return next;
}

export function applyBattleResult(profile, result, matchId) {
  if (!matchId || profile.record.history.some((match) => match.id === matchId)) return { profile, xp: 0, levels: 0, duplicate: true };
  const next = clone(profile);
  const xp = result.reason === 'left' ? 0 : result.winner === 'player' ? PROGRESSION.xpWin : result.winner === 'cpu' ? PROGRESSION.xpLoss : PROGRESSION.xpDraw;
  const parts = result.reason === 'left' ? 0 : result.winner === 'player'
    ? PROGRESSION.weaponUpgrade.partsWin : result.winner === 'cpu'
      ? PROGRESSION.weaponUpgrade.partsLoss : PROGRESSION.weaponUpgrade.partsDraw;
  if (result.reason !== 'left') {
    next.record.matches++;
    if (result.winner === 'player') next.record.wins++;
  }
  next.record.history.unshift({ id: matchId, at: Date.now(), winner: result.winner, reason: result.reason, xp, parts,
    kills: result.player.kills, damage: result.player.damage });
  next.record.history = next.record.history.slice(0, 50);
  next.character.xp += xp;
  next.inventory.trainingParts += parts;
  let levels = 0;
  for (;;) {
    const unlock = PROGRESSION.capUnlocks.find((rule) => rule.atLevel === next.character.level && next.record.matches >= rule.matches);
    if (unlock && unlock.cap > next.character.cap) next.character.cap = unlock.cap;
    if (next.character.level >= next.character.cap) break;
    const needed = PROGRESSION.xpForNextLevel(next.character.level);
    if (next.character.xp < needed) break;
    next.character.xp -= needed;
    next.character.level++;
    next.character.points += PROGRESSION.pointsPerLevel;
    levels++;
  }
  return { profile: next, xp, parts, levels, duplicate: false };
}
