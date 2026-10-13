import assert from 'node:assert/strict';
import test from 'node:test';
import { RoomRegistry } from './rooms.js';

const player = (number) => ({ uid: `caremate-${number}`, name: number });

test('a room is private, uniquely coded, and capped at eight people', () => {
  const registry = new RoomRegistry({ randomCode: (() => {
    const codes = ['123456', '123456', '654321'];
    return () => codes.shift();
  })() });
  assert.equal(registry.create(player('1')).code, '123456');
  assert.equal(registry.create(player('2')).code, '654321');
  for (let n = 3; n <= 9; n++) registry.join('123456', player(String(n)));
  assert.throws(() => registry.join('123456', player('10')), /room-full/);
  assert.throws(() => registry.join('000000', player('10')), /room-unavailable/);
  assert.throws(() => registry.join('123456', player('1')), /already-in-room/);
});

test('readiness and host transfer are server owned', () => {
  const registry = new RoomRegistry({ randomCode: () => '123456' });
  registry.create(player('1'));
  registry.join('123456', player('2'));
  assert.equal(registry.ready('caremate-2', true).players[1].ready, true);
  assert.equal(registry.leave('caremate-1').hostUid, 'caremate-2');
  assert.equal(registry.leave('caremate-2'), null);
  assert.equal(registry.get('123456'), null);
});

test('old rooms expire without awarding anything', () => {
  let time = 100;
  const registry = new RoomRegistry({ now: () => time, randomCode: () => '123456' });
  registry.create(player('1'));
  time += 31 * 60 * 1000;
  assert.deepEqual(registry.sweep(), ['123456']);
  assert.equal(registry.get('123456'), null);
});
