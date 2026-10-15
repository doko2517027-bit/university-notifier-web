import test from 'node:test';
import assert from 'node:assert/strict';
import { DarumaMatch } from '../js/simulation.js';
import { RULES } from '../js/config.js';

function advance(match, seconds, input = { x: 0, z: 0 }) {
  for (let t = 0; t < seconds; t += .05) match.tick(.05, input);
}

test('CPU match starts with 4–10 players and one oni', () => {
  for (const count of [4, 10]) {
    const match = new DarumaMatch({ playerCount: count, role: 'oni' });
    assert.equal(match.actors.length, count);
    assert.equal(match.oniId, 'player');
    assert.equal(match.runners.length, count - 1);
    assert.equal(match.oniLives, 3);
  }
});

test('oni turns voluntarily, returns automatically within 5 seconds, or lowers early', () => {
  const match = new DarumaMatch({ role: 'oni' });
  advance(match, 1.05);
  assert.equal(match.turnOni(), true);
  advance(match, 2);
  assert.equal(match.looking, true);
  assert.equal(match.lowerOni(), true);
  assert.equal(match.looking, false);
  advance(match, 1.3);
  assert.equal(match.turnOni(), true);
  advance(match, 5.05);
  assert.equal(match.looking, false);
});

test('accusation uses actual movement at the instant, not movement history', () => {
  const match = new DarumaMatch({ role: 'oni' });
  const target = match.runners[0];
  advance(match, 1.05);
  match.turnOni();
  target.x = 16; target.z = 20;
  target.speed = 2;
  assert.equal(match.accuse(target.id).correct, true);
  assert.equal(target.eliminated, true);
  const second = match.runners[1];
  second.x = 16; second.z = 19; second.speed = 2;
  second.speed = 0; // The runner stopped just before the click.
  const result = match.accuse(second.id);
  assert.equal(result.correct, false);
  assert.equal(match.oniLives, 2);
});

test('wall cover prevents accusation despite moving', () => {
  const match = new DarumaMatch({ role: 'oni' });
  const target = match.runners[0];
  target.x = -7.4; target.z = -17; target.speed = 3;
  advance(match, 1.05);
  match.turnOni();
  assert.equal(match.visible(target), false);
  assert.equal(match.accuse(target.id).accepted, false);
  assert.equal(match.oniLives, RULES.oniLives);
});

test('moving floor counts as actual movement without key input', () => {
  const match = new DarumaMatch({ role: 'runner' });
  const actor = match.player;
  actor.x = 12; actor.z = 4;
  match.move(actor, { x: 0, z: 0 }, .05);
  assert.ok(actor.speed > RULES.movementThreshold);
});

test('camera-only change does not change movement state', () => {
  const match = new DarumaMatch({ role: 'runner' });
  const actor = match.player;
  match.move(actor, { x: 0, z: 0 }, .05);
  assert.equal(actor.speed, 0);
});

test('incorrect accusations end after three; next round resets elimination and lives', () => {
  const match = new DarumaMatch({ role: 'oni', random: () => .4 });
  advance(match, 1.05);
  match.turnOni();
  const target = match.runners[0];
  target.x = 16; target.z = 20; target.speed = 0;
  for (let i = 0; i < 3; i++) assert.equal(match.accuse(target.id).correct, false);
  assert.equal(match.status, 'ended');
  assert.equal(match.winner, 'runners');
  match.nextRound(false);
  assert.equal(match.status, 'playing');
  assert.equal(match.oniLives, 3);
  assert.ok(match.actors.every((a) => !a.eliminated));
});

test('touch requires close range and ends the round', () => {
  const match = new DarumaMatch({ role: 'runner' });
  assert.equal(match.touch('player'), false);
  match.player.x = match.oni.x;
  match.player.z = match.oni.z + 1;
  assert.equal(match.touch('player'), true);
  assert.equal(match.winner, 'runners');
});
