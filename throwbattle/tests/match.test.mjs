import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Match } from '../js/core/Match.js';
import { RULES } from '../js/data.js';

const character = JSON.parse(readFileSync(new URL('../assets/characters/training_dummy/character.json', import.meta.url)));
const haruto = JSON.parse(readFileSync(new URL('../assets/characters/haruto/character.json', import.meta.url)));
const create = () => new Match({ character, random: () => 0.5 });
const createHaruto = () => new Match({ character: haruto, random: () => 0.5 });

test('movement, jump and stage platform are 2D coordinates', () => {
  const m = create();
  m.player.y = 700; m.player.grounded = true;
  const before = m.player.x;
  m.updateFighter(m.player, { move: 1, jump: true }, 0.05);
  assert.ok(m.player.x > before);
  assert.ok(m.player.y < 700);
  assert.ok(m.player.vy < 0);
});

test('throwing creates an independent 2D projectile and obeys cooldown', () => {
  const m = create();
  m.throwWeapon(m.player, false);
  assert.equal(m.projectiles.length, 1);
  assert.equal(m.projectiles[0].owner, 'player');
  assert.ok(m.projectiles[0].x > m.player.x);
  m.updateFighter(m.player, { attack: true }, 0.02);
  assert.equal(m.projectiles.length, 1);
});

test('projectile crossing the opponent applies real match damage', () => {
  const m = create();
  m.cpu.x = m.player.x + 215;
  m.cpu.y = m.player.y;
  m.throwWeapon(m.player, false);
  for (let i = 0; i < 18 && m.cpu.hp === m.cpu.maxHp; i++) m.updateProjectiles(0.016);
  assert.ok(m.cpu.hp < m.cpu.maxHp);
  assert.ok(m.player.damageDone > 0);
});

test('hits reduce HP, apply fixed knockback and eventually consume one stock', () => {
  const m = create();
  const projectile = { owner: 'player', damage: 25, vx: 900, knockbackX: 310, knockbackY: 250 };
  assert.equal(m.hit(m.cpu, projectile), true);
  assert.equal(m.cpu.hp, 75);
  assert.equal(m.cpu.vx, 310);
  for (let i = 0; i < 3; i++) { m.cpu.invulnerable = 0; m.hit(m.cpu, projectile); }
  assert.equal(m.cpu.stocks, 2);
  assert.equal(m.cpu.alive, false);
  assert.equal(m.cpu.respawnLeft, RULES.respawnSeconds);
});

test('falling beyond the death line kills regardless of remaining HP', () => {
  const m = create();
  m.player.y = RULES.deathY + 1;
  m.updateFighter(m.player, {}, 0.016);
  assert.equal(m.player.hp, 0);
  assert.equal(m.player.stocks, 2);
});

test('respawn is after 10 seconds with full HP and 3 seconds invulnerability', () => {
  const m = create();
  m.kill(m.player, 'pit');
  m.player.respawnLeft = 0.01;
  m.updateFighter(m.player, {}, 0.02);
  assert.equal(m.player.alive, true);
  assert.equal(m.player.hp, m.player.maxHp);
  assert.equal(m.player.invulnerable, RULES.invincibleSeconds);
  assert.equal(m.hit(m.player, { owner: 'cpu', damage: 99, vx: -2, knockbackX: 0, knockbackY: 0 }), false);
});

test('losing all three stocks ends the match exactly once', () => {
  const m = create();
  m.kill(m.player, 'pit'); m.respawn(m.player);
  m.kill(m.player, 'pit'); m.respawn(m.player);
  m.kill(m.player, 'pit'); m.kill(m.player, 'pit');
  assert.equal(m.player.stocks, 0);
  assert.equal(m.finished, true);
  assert.equal(m.winner, 'cpu');
});

test('character collision size is separate from sprite display size', () => {
  assert.notEqual(character.hitbox.width, character.sprite.width);
  assert.notEqual(character.hitbox.height, character.sprite.height);
});

test('character attack multiplier and weight use data without changing the default fighter', () => {
  const heavy = { ...character, weight: 2, attackMultiplier: 1.5 };
  const m = new Match({ character: heavy, cpuCharacter: heavy });
  m.throwWeapon(m.player, false);
  assert.equal(m.projectiles[0].damage, 33);
  m.hit(m.cpu, { owner: 'player', damage: 10, vx: 1, knockbackX: 300, knockbackY: 200 });
  assert.equal(m.cpu.vx, 150);
  assert.equal(m.cpu.vy, -100);
});

test('a full CPU match reaches a result without the renderer', () => {
  const m = create();
  for (let i = 0; i < 4500 && !m.finished; i++) m.tick(0.05, {});
  assert.equal(m.finished, true);
  assert.ok(['player', 'cpu', null].includes(m.winner));
});

test('ハルトの投擲はアニメーションの3コマ目でノートパソコンを放つ', () => {
  const m = createHaruto();
  m.player.y = 700; m.player.grounded = true;
  m.updateFighter(m.player, { attack: true }, 0.016);
  assert.equal(m.player.pose, 'attack');
  assert.ok(m.player.pendingThrow);
  assert.equal(m.projectiles.length, 0);
  for (let i = 0; i < 10; i++) m.updateFighter(m.player, {}, 0.016);
  assert.equal(m.projectiles.length, 0);
  m.updateFighter(m.player, {}, 0.016);
  assert.equal(m.projectiles.length, 1);
  assert.equal(m.projectiles[0].weaponId, 'haruto_laptop');
});

test('パワースローは一定時間だけ投擲の威力と速度を上げ、再使用に待ち時間がある', () => {
  const m = createHaruto();
  m.player.y = 700; m.player.grounded = true;
  m.updateFighter(m.player, { skill: true }, 0.016);
  assert.ok(m.player.boostLeft > 3);
  assert.ok(m.player.skillLeft > 7);
  m.throwWeapon(m.player, false);
  const boosted = m.projectiles.at(-1);
  assert.ok(boosted.damage > 26);
  assert.ok(boosted.vx > 860);
  m.player.boostLeft = 0;
  m.throwWeapon(m.player, false);
  assert.ok(m.projectiles.at(-1).damage < boosted.damage);
});

test('死亡・復活・勝利の表示状態とHP/ストックを分離して管理する', () => {
  const m = createHaruto();
  m.kill(m.cpu, 'hp');
  assert.equal(m.cpu.pose, 'death');
  assert.ok(m.cpu.deathPoseLeft > 0);
  assert.equal(m.cpu.stocks, 2);
  m.cpu.respawnLeft = 0.01;
  m.updateFighter(m.cpu, {}, 0.02);
  assert.equal(m.cpu.pose, 'respawn');
  assert.equal(m.cpu.hp, m.cpu.maxHp);
  m.finish('player', 'hp');
  assert.equal(m.player.pose, 'victory');
  m.tick(0.05, {});
  assert.ok(m.player.poseTime > 0);
});
