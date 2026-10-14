import assert from 'node:assert/strict';
import test from 'node:test';
import { opponentRows, rankedMatchPlayers } from './onlineHud.js';

test('opponent HUD lists every rival and excludes the local fighter', () => {
  const rows = opponentRows([
    { id: 'a', name: '自分', hp: 100, maxHp: 100, lives: 3 },
    { id: 'b', name: '端末2', hp: 47, maxHp: 100, lives: 2 },
    { id: 'c', name: '端末3', hp: 0, maxHp: 100, lives: 1, respawnSeconds: 4 },
  ], 'a');
  assert.deepEqual(rows.map((row) => row.name), ['端末2', '端末3']);
  assert.equal(rows[0].hpPercent, 47);
  assert.equal(rows[1].status, '復活まで4秒');
});

test('opponent HUD distinguishes reconnection and elimination', () => {
  const rows = opponentRows([
    { id: 'b', hp: 70, maxHp: 100, lives: 1, connected: false },
    { id: 'c', hp: 0, maxHp: 100, lives: 0, connected: false },
  ], 'a');
  assert.equal(rows[0].status, '再接続待ち');
  assert.equal(rows[1].status, '脱落');
});

test('result board keeps the server winner first and departed fighters last', () => {
  const rows = rankedMatchPlayers({ winner: 'b', players: [
    { id: 'a', name: '端末1', kills: 8, lives: 0, forfeited: true },
    { id: 'b', name: '端末2', kills: 2, lives: 1 },
    { id: 'c', name: '端末3', kills: 1, lives: 2 },
  ] });
  assert.deepEqual(rows.map((row) => [row.id, row.rank, row.outcome]),
    [['b', 1, '勝利'], ['c', 2, '敗北'], ['a', 3, '退出']]);
});

test('a drawn top score shares first place while a lower score loses', () => {
  const rows = rankedMatchPlayers({ winner: null, players: [
    { id: 'a', kills: 2, lives: 1, damage: 50 },
    { id: 'b', kills: 2, lives: 1, damage: 50 },
    { id: 'c', kills: 0, lives: 1, damage: 10 },
  ] });
  assert.deepEqual(rows.map((row) => [row.rank, row.outcome]),
    [[1, '引き分け'], [1, '引き分け'], [3, '敗北']]);
});
