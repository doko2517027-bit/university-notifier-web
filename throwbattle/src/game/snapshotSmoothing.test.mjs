import assert from 'node:assert/strict';
import test from 'node:test';
import { SnapshotSmoother, interpolateBattleState } from './snapshotSmoothing.js';

const state = (x, yaw = 0) => ({ matchId: 'pilot', countdown: 0, remaining: 200,
  players: [{ id: 'a', x, y: 0, z: 0, yaw, hp: 100 }], projectiles: [{ id: 'shot', x, y: 1, z: 0 }] });

test('remote positions and aim are interpolated without inventing HP', () => {
  const middle = interpolateBattleState(state(0, Math.PI - .1), { ...state(10, -Math.PI + .1), players: [{ ...state(10).players[0], yaw: -Math.PI + .1, hp: 90 }] }, .5);
  assert.equal(middle.players[0].x, 5);
  assert.equal(middle.projectiles[0].x, 5);
  assert.ok(Math.abs(Math.abs(middle.players[0].yaw) - Math.PI) < .001);
  assert.equal(middle.players[0].hp, 90);
});

test('jitter buffer samples between arrivals and resets for a new match', () => {
  const smoother = new SnapshotSmoother({ delayMs: 100 });
  smoother.push(state(0), 1000);
  smoother.push(state(10), 1100);
  assert.equal(smoother.sample(1150).players[0].x, 5);
  smoother.push({ ...state(50), matchId: 'new' }, 1200);
  assert.equal(smoother.sample(1300).players[0].x, 50);
});
