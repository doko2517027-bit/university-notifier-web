import assert from 'node:assert/strict';
import test from 'node:test';
import { PilotBattle, sanitizeBattleInput } from './pilotBattle.js';

const players = [{ id: 'device-a', name: '端末1' }, { id: 'device-b', name: '端末2' }];
const readyBattle = () => { const battle = new PilotBattle(players, { now: () => 1000, id: 'test-match' }); for (let i = 0; i < 31; i++) battle.tick(.1); return battle; };

test('untrusted movement, aim and weapon values are bounded', () => {
  const input = sanitizeBattleInput({ forward: 999, right: -999, yaw: Infinity, pitch: 999, weapon: 999, damage: 99999, fire: 1 });
  assert.ok(Math.hypot(input.forward, input.right) <= 1);
  assert.equal(input.yaw, 0);
  assert.equal(input.pitch, 1.1);
  assert.equal(input.weapon, 2);
  assert.equal(input.fire, false);
  assert.equal('damage' in input, false);
});

test('only server time moves fighters, and cover blocks motion', () => {
  const battle = readyBattle();
  const first = battle.players.get('device-a');
  first.x = -5; first.z = 5.5; first.y = 0;
  battle.setInput('device-a', { forward: 1, yaw: 0, dash: true });
  battle.tick(.1);
  assert.equal(first.z, 5.5); // Desk is directly ahead.
  first.x = -11; first.z = 9;
  battle.setInput('device-a', { forward: 1, yaw: 0 });
  battle.tick(.1);
  assert.equal(first.z, 8.5);
  assert.equal(battle.setInput('unknown', { forward: 1 }), false);
});

test('a brief jump press survives a newer input packet before the next server tick', () => {
  const battle = readyBattle();
  const first = battle.players.get('device-a');
  battle.setInput('device-a', { jump: true });
  battle.setInput('device-a', { jump: false });
  battle.tick(.05);
  assert.ok(first.y > 0);
  assert.equal(first.jumpQueued, false);
});

test('a disconnected fighter immediately stops moving and firing', () => {
  const battle = readyBattle();
  const first = battle.players.get('device-a');
  battle.setInput('device-a', { forward: 1, fire: true });
  battle.stopInput('device-a');
  const before = { x: first.x, z: first.z };
  battle.tick(.05);
  assert.deepEqual({ x: first.x, z: first.z }, before);
  assert.equal(battle.projectiles.length, 0);
});

test('server snapshot reports connection loss and recovery without losing the fighter', () => {
  const battle = readyBattle();
  battle.setInput('device-a', { forward: 1, fire: true });
  battle.setConnected('device-a', false);
  assert.equal(battle.snapshot().players[0].connected, false);
  assert.equal(battle.players.get('device-a').input.fire, false);
  battle.setConnected('device-a', true);
  assert.equal(battle.snapshot().players[0].connected, true);
  assert.equal(battle.result, null);
});

test('server-owned projectiles determine HP and never accept client damage', () => {
  const battle = readyBattle();
  const first = battle.players.get('device-a');
  const second = battle.players.get('device-b');
  first.x = -11; first.z = 9; second.x = -11; second.z = 5;
  battle.setInput('device-a', { yaw: 0, fire: true, damage: 100000 });
  for (let i = 0; i < 10; i++) battle.tick(.1);
  assert.ok(second.hp < 100 && second.hp > 0);
  assert.ok(first.damage > 0);
  assert.equal(first.hp, 100);
});

test('a disconnect ends pilot match once without awarding game currency', () => {
  const battle = readyBattle();
  battle.forfeit('device-a');
  battle.forfeit('device-a');
  assert.equal(battle.result.winner, 'device-b');
  assert.equal(battle.result.reason, 'disconnected');
  assert.equal('reward' in battle.result, false);
  assert.equal('points' in battle.result, false);
});

test('one departure does not end a three-player match', () => {
  const battle = new PilotBattle([...players, { id: 'device-c', name: '端末3' }], { now: () => 1000 });
  battle.forfeit('device-a');
  assert.equal(battle.result, null);
  assert.equal(battle.snapshot().players[0].lives, 0);
  battle.forfeit('device-b');
  assert.equal(battle.result.winner, 'device-c');
  assert.equal(battle.result.reason, 'disconnected');
});

test('a departed fighter cannot win a three-player time limit by prior kills', () => {
  const battle = new PilotBattle([...players, { id: 'device-c', name: '端末3' }], { now: () => 1000 });
  for (let i = 0; i < 31; i++) battle.tick(.1);
  battle.players.get('device-a').kills = 8;
  battle.players.get('device-b').kills = 2;
  battle.forfeit('device-a');
  battle.remaining = .01;
  battle.tick(.05);
  assert.equal(battle.result.winner, 'device-b');
  assert.equal(battle.result.players.find((player) => player.id === 'device-a').forfeited, true);
});
