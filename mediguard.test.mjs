import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("2510044だけリクエストタブをメディガードへ差し替える", async () => {
  const [common, client, rules, server] = await Promise.all([
    read("./common.js"), read("./mediguard.js"), read("./firestore.rules"), read("./functions/mediguard.js"),
  ]);
  assert.match(common, /MEDIGUARD_TEST_STUDENT_NUMBERS = Object\.freeze\(\["2510044"\]\)/);
  assert.match(common, /a\[href="requests\.html"\]/);
  assert.match(common, /link\.href = "mediguard\.html"/);
  assert.match(client, /isMediguardTestStudent\(studentNumber\)/);
  assert.match(rules, /match \/mediguardPlayers\/\{studentId\}/);
  assert.match(rules, /studentId == '2510044'/);
  assert.match(server, /requireTester/);
  assert.match(server, /collection\("mediguardPlayers"\)/);
});

test("ソロ戦闘は見下ろしマップ・ウェーブ・攻撃・チャージ・スキル・残機を実装する", async () => {
  const [page, client] = await Promise.all([read("./mediguard.html"), read("./mediguard.js")]);
  for (const id of ["battleCanvas", "joystick", "attackButton", "skillButton", "lifeText", "waveText", "infectionBox"]) {
    assert.match(page, new RegExp(`id="${id}"`));
  }
  assert.match(client, /const WORLD = \{ width: 1800, height: 1200 \}/);
  assert.match(client, /function spawnWave\(/);
  assert.match(client, /function beginCharge\(/);
  assert.match(client, /function releaseCharge\(/);
  assert.match(client, /function takeHit\(/);
  assert.match(client, /p\.lives -= 1/);
  assert.match(client, /p\.respawn = 5/);
  assert.match(client, /KeyW/);
});

test("キャラクター個体・30/300GPガチャ・重複3択を安全なサーバー処理で管理する", async () => {
  const [page, server, policy] = await Promise.all([
    read("./mediguard.html"), read("./functions/mediguard.js"), read("./functions/mediguard_policy.js"),
  ]);
  assert.match(page, /data-draw="1"/);
  assert.match(page, /data-draw="10"/);
  assert.match(policy, /GACHA_COSTS = Object\.freeze\(\{ 1: 30, 10: 300 \}\)/);
  assert.match(policy, /N: 550, R: 250, SR: 120, SSR: 60, UR: 18, LR: 2/);
  assert.match(server, /crypto\.randomInt\(0, 1000\)/);
  assert.match(server, /transaction\.create\(characterRef/);
  assert.match(server, /\["keep", "strengthen", "exchange"\]/);
  assert.match(server, /pointMigration/);
  assert.doesNotMatch(server, /transaction\.update\([^)]*totalRanking/);
});

test("6臓器マップ・臓器別初回報酬・個体別経験値を保存する", async () => {
  const [policy, server] = await Promise.all([read("./functions/mediguard_policy.js"), read("./functions/mediguard.js")]);
  for (const map of ["lung", "airway", "intestine", "urinary", "vessel", "skin"]) {
    assert.match(policy, new RegExp(`id: "${map}"`));
  }
  assert.match(server, /firstClears/);
  assert.match(server, /applyExperience/);
  assert.match(server, /collection\("runs"\)/);
  assert.match(server, /operationRef\(studentNumber, requestId\)/);
});

test("スマホ縦横・タブレット・PCでゲーム全体は画面外へスクロールしない", async () => {
  const css = await read("./mediguard.css");
  assert.match(css, /html,body\{[^}]*overflow:hidden/);
  assert.match(css, /@media\(orientation:landscape\) and \(max-height:600px\)/);
  assert.match(css, /@media\(min-width:900px\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

test("オリジナルのキャラクター・病原体・タブ画像を実際に使用する", async () => {
  const [css, client, page] = await Promise.all([read("./mediguard.css"), read("./mediguard.js"), read("./mediguard.html")]);
  assert.match(css, /mediguard-characters\.png/);
  assert.match(client, /mediguard-pathogens\.png/);
  assert.match(page, /images\/mediguard-tab\.svg/);
  await Promise.all([
    access(new URL("./images/mediguard-characters.png", import.meta.url)),
    access(new URL("./images/mediguard-pathogens.png", import.meta.url)),
    access(new URL("./images/mediguard-tab.svg", import.meta.url)),
  ]);
});

test("未完成の協力プレイは実装済みと誤認させず次段階として明示する", async () => {
  const page = await read("./mediguard.html");
  assert.match(page, /協力プレイ/);
  assert.match(page, /次段階で実装/);
  assert.match(page, /class="soon" disabled/);
});
