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

test('pilot devices on one verified account are separate room participants', () => {
  const registry = new RoomRegistry({ randomCode: () => '123456' });
  const first = { ...player('2510044'), id: 'session-a', name: '端末1' };
  const second = { ...player('2510044'), id: 'session-b', name: '端末2' };
  registry.create(first);
  const joined = registry.join('123456', second);
  assert.equal(joined.players.length, 2);
  assert.equal(joined.hostId, 'session-a');
  assert.equal(registry.ready('session-b', true).players[1].ready, true);
  assert.equal(registry.leave('session-a').hostId, 'session-b');
  assert.equal(registry.get('123456').players.length, 1);
  assert.equal(registry.leave('session-b'), null);
});

test('a dropped participant keeps the same room slot during reconnect grace', () => {
  const registry = new RoomRegistry({ randomCode: () => '123456' });
  registry.create({ ...player('2510044'), id: 'session-a' });
  registry.join('123456', { ...player('2510044'), id: 'session-b' });
  assert.equal(registry.setConnected('session-a', false).players[0].connected, false);
  assert.equal(registry.get('123456').players.length, 2);
  registry.ready('session-a', true);
  registry.ready('session-b', true);
  assert.throws(() => registry.start('session-a'), /not-all-ready/);
  assert.equal(registry.setConnected('session-a', true).players[0].connected, true);
  assert.equal(registry.start('session-a').status, 'playing');
});

test('only ready host can start a room and finished rooms reset readiness', () => {
  const registry = new RoomRegistry({ randomCode: () => '123456' });
  registry.create(player('1'));
  registry.join('123456', player('2'));
  assert.throws(() => registry.start('caremate-1'), /not-all-ready/);
  registry.ready('caremate-1', true);
  registry.ready('caremate-2', true);
  assert.throws(() => registry.start('caremate-2'), /host-only/);
  assert.equal(registry.start('caremate-1').status, 'playing');
  assert.throws(() => registry.join('123456', player('3')), /room-unavailable/);
  assert.equal(registry.finish('123456').players.every((entry) => !entry.ready), true);
});
