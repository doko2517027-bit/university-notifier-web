const test = require("node:test");
const assert = require("node:assert/strict");
const { buildMediguardAdminMetrics, tokyoDayKey } = require("./mediguard_admin_metrics");

const now = new Date("2026-10-12T03:00:00.000Z").getTime();
const stamp = (milliseconds) => ({ toMillis: () => milliseconds });

test("日本時間の日付で利用者・出撃・ガチャを集計する", () => {
  const metrics = buildMediguardAdminMetrics({
    now,
    players: [
      { studentNumber: "2510044", updatedAt: stamp(now - 60_000) },
      { studentNumber: "2510055", updatedAt: stamp(now - (2 * 86400_000)) },
    ],
    runs: [
      { path: "mediguardPlayers/2510044/runs/run1", finishedAt: stamp(now - 30_000), result: { reward: { won: true } } },
      { path: "mediguardPlayers/2510055/runs/run2", finishedAt: stamp(now - 86400_000), result: { reward: { won: false } } },
    ],
    operations: [{ path: "mediguardPlayers/2510044/operations/op1", type: "gacha", createdAt: stamp(now - 20_000), result: { results: [{ rarity: "SSR" }, { rarity: "N" }] } }],
    characters: [{ characterId: "cell_maru" }, { characterId: "cell_maru" }, { characterId: "cell_kiri" }],
    catalog: [{ id: "cell_maru", name: "マル" }, { id: "cell_kiri", name: "キリ" }],
    presence: { "2510044": { device1: { state: "online", page: "mediguard.html" } }, "2510055": { device2: { state: "online", page: "index.html" } } },
  });
  assert.equal(tokyoDayKey(now), "2026-10-12");
  assert.equal(metrics.totalPlayers, 2);
  assert.equal(metrics.todayPlayers, 1);
  assert.equal(metrics.onlinePlayers, 1);
  assert.equal(metrics.battleCount, 2);
  assert.equal(metrics.wins, 1);
  assert.equal(metrics.winRate, 50);
  assert.equal(metrics.gachaExecutions, 1);
  assert.equal(metrics.gachaResults, 2);
  assert.equal(metrics.rarityCounts.SSR, 1);
  assert.deepEqual(metrics.popularCharacters[0], { id: "cell_maru", name: "マル", count: 2 });
});

test("データがない初回状態も0件のダッシュボードを返す", () => {
  const metrics = buildMediguardAdminMetrics({ now });
  assert.equal(metrics.totalPlayers, 0);
  assert.equal(metrics.winRate, 0);
  assert.equal(metrics.activity.length, 7);
  assert.deepEqual(metrics.rarityCounts, { N: 0, R: 0, SR: 0, SSR: 0, UR: 0, LR: 0 });
});
