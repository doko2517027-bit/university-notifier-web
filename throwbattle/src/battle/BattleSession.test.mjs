import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleSession } from './BattleSession.js';

test('damage, three lives, respawn, and result remain consistent', () => {
  const match = new BattleSession();
  assert.equal(match.hit('cpu', 110).kind, 'down');
  assert.equal(match.cpu.lives, 2);
  assert.equal(match.hit('cpu', 110), null);
  for (let i = 0; i < 101; i++) match.tick(0.1);
  assert.equal(match.cpu.hp, 100);
  assert.equal(match.hit('cpu', 110), null, 'respawn immunity protects against a second hit');
  for (let i = 0; i < 32; i++) match.tick(0.1);
  assert.equal(match.hit('cpu', 110).kind, 'down');
  for (let i = 0; i < 131; i++) match.tick(0.1);
  assert.equal(match.hit('cpu', 110).kind, 'eliminated');
  assert.equal(match.result.winner, 'player');
  assert.equal(match.player.kills, 3);
  assert.equal(match.hit('cpu', 110), null);
});

test('time up decides by lives and a tie enters sudden death', () => {
  const match = new BattleSession();
  match.hit('cpu', 110);
  for (let i = 0; i < 3001; i++) match.tick(0.1);
  assert.equal(match.result.winner, 'player');
  const tied = new BattleSession({ rule: 'kills' });
  for (let i = 0; i < 3001; i++) tied.tick(0.1);
  assert.equal(tied.suddenDeath, true);
  assert.equal(tied.finished, false);
  assert.equal(tied.hit('player', 110).kind, 'eliminated');
  assert.equal(tied.result.winner, 'cpu');
});

test('pause is controlled by caller and healing cannot exceed maximum', () => {
  const match = new BattleSession();
  match.hit('player', 40);
  assert.equal(match.heal('player', 25), 25);
  assert.equal(match.heal('player', 60), 15);
  assert.equal(match.player.hp, 100);
  assert.equal(match.remaining, 300);
});
