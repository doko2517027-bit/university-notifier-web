import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("管理メニューからメディガ管理へ移動できる", async () => {
  const [admin, page] = await Promise.all([read("./admin.html"), read("./mediguard_admin.html")]);
  assert.match(admin, /mediguard_admin\.html/);
  assert.match(admin, />メディガ管理</);
  assert.match(page, /data-admin-tab="operation"/);
  assert.match(page, /data-admin-tab="dashboard"/);
  assert.match(page, /data-admin-tab="gacha"/);
  assert.match(page, /data-admin-tab="characters"/);
});

test("期間・料金・排出率・対象キャラを編集できる", async () => {
  const [page, client] = await Promise.all([read("./mediguard_admin.html"), read("./mediguard_admin.js")]);
  for (const field of ["startsAt", "endsAt", "singleCost", "tenCost", "limited"]) assert.match(page, new RegExp(`name="${field}"`));
  assert.match(page, /id="rateInputs"/);
  assert.match(page, /id="bannerCharacterChoices"/);
  assert.match(client, /saveBanner/);
  assert.match(client, /deleteBanner/);
});

test("キャラクター能力と実装済み効果を編集できる", async () => {
  const [page, client, server] = await Promise.all([read("./mediguard_admin.html"), read("./mediguard_admin.js"), read("./functions/mediguard_admin.js")]);
  for (const field of ["attack", "speed", "range", "charge", "passiveType", "passiveValue", "skillType", "skillValue", "cooldown"]) assert.match(page, new RegExp(`name="${field}"`));
  assert.match(client, /PASSIVE_LABELS/);
  assert.match(client, /SKILL_LABELS/);
  assert.match(server, /requireAdmin/);
  assert.match(server, /saveCharacter/);
});

test("設定は直接Firestoreへ公開せずCloud Functionsだけが扱う", async () => {
  const [rules, index, game] = await Promise.all([read("./firestore.rules"), read("./functions/index.js"), read("./functions/mediguard.js")]);
  assert.match(rules, /match \/mediguardGachaBanners\/\{document=\*\*\}[\s\S]*allow read, write: if false/);
  assert.match(rules, /match \/mediguardCharacterConfigs\/\{document=\*\*\}[\s\S]*allow read, write: if false/);
  assert.match(index, /exports\.mediguardAdmin = onCall/);
  assert.match(game, /loadMediguardConfig/);
  assert.match(game, /bannerId/);
});

test("管理画面がPC・スマホの縦横で枠内に収まる", async () => {
  const [page, css] = await Promise.all([read("./mediguard_admin.html"), read("./mediguard_admin.css")]);
  assert.match(page, /mediguard_admin\.css\?v=20261012-3/);
  assert.match(css, /overflow-x:hidden/);
  assert.match(css, /overflow-wrap:anywhere/);
  assert.match(css, /grid-template-columns:minmax\(230px,320px\) minmax\(0,1fr\)/);
  assert.match(css, /@media\(max-width:520px\)/);
  assert.match(css, /@media\(orientation:landscape\) and \(max-height:600px\)/);
  assert.match(css, /@media\(orientation:landscape\) and \(min-width:761px\) and \(max-height:600px\)/);
});

test("実データの運営状況を管理ダッシュボードへ表示する", async () => {
  const [page, client, server, metrics] = await Promise.all([read("./mediguard_admin.html"), read("./mediguard_admin.js"), read("./functions/mediguard_admin.js"), read("./functions/mediguard_admin_metrics.js")]);
  for (const id of ["metricsCards", "activityChart", "rarityChart", "popularCharacters", "systemHealth"]) assert.match(page, new RegExp(`id="${id}"`));
  assert.match(client, /refreshMetrics/);
  assert.match(client, /setInterval/);
  assert.match(server, /collectionGroup\("runs"\)/);
  assert.match(server, /collectionGroup\("operations"\)/);
  assert.match(server, /realtimeDb\?\.ref\("status"\)/);
  assert.match(metrics, /buildMediguardAdminMetrics/);
});
