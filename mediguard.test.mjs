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
  assert.match(common, /<span>メディガ<\/span>/);
  assert.match(client, /isMediguardTestStudent\(studentNumber\)/);
  assert.match(client, /auth\.authStateReady/);
  assert.match(client, /auth\.currentUser\?\.uid !== `caremate-\$\{studentNumber\}`/);
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
  const [css, page] = await Promise.all([read("./mediguard.css"), read("./mediguard.html")]);
  assert.match(css, /html,body\{[^}]*overflow:hidden/);
  assert.match(css, /@media\(orientation:landscape\) and \(max-height:600px\)/);
  assert.match(css, /@media\(orientation:landscape\) and \(max-height:430px\)/);
  assert.match(css, /@media\(min-width:900px\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /\.game-shell\{inset:0\}/);
  assert.doesNotMatch(page, /class="bottom-nav game-bottom-nav"/);
});

test("メディガ内だけ文字選択・長押しコピー・画像ドラッグを無効にする", async () => {
  const css = await read("./mediguard.css");
  assert.match(css, /\.mediguard-body\{[^}]*-webkit-user-select:none;user-select:none/);
  assert.match(css, /\.mediguard-body \*\{[^}]*-webkit-user-select:none;user-select:none/);
  assert.match(css, /\.mediguard-body img,\.mediguard-body canvas\{[^}]*-webkit-user-drag:none/);
});

test("ホームでは小さな効果説明を表示せず戦闘能力だけ維持する", async () => {
  const [page, client] = await Promise.all([read("./mediguard.html"), read("./mediguard.js")]);
  assert.doesNotMatch(page, /id="selectedPassive"/);
  assert.doesNotMatch(page, /id="selectedSkill"/);
  assert.match(client, /function charStats\(/);
  assert.match(client, /function useSkill\(/);
});

test("タクティカル表示と操作不能の危険警告を戦闘へ追加する", async () => {
  const [page, client, css] = await Promise.all([read("./mediguard.html"), read("./mediguard.js"), read("./mediguard.css")]);
  assert.match(page, /id="threatFlash"/);
  assert.match(page, />危険</);
  assert.match(page, /<button data-view="characters"><span>🧬<\/span><b>キャラクター<\/b><\/button>/);
  assert.match(client, /alertLock: 0/);
  assert.match(client, /battle\.alertLock = 1\.25/);
  assert.match(client, /function drawBattleScenery\(/);
  assert.match(css, /\.threat-flash/);
});

test("ガチャ結果確定後にレア度別演出を再生し、スキップでも結果を変えない", async () => {
  const [page, client, css, server] = await Promise.all([read("./mediguard.html"), read("./mediguard.js"), read("./mediguard.css"), read("./functions/mediguard.js")]);
  assert.match(page, /id="gachaCinematic"/);
  assert.match(page, /id="gachaSkipButton"/);
  assert.match(client, /const result = await api\("draw"/);
  assert.match(client, /await playGachaCinematic\(result\.results, banner\); await refresh\(\)/);
  assert.match(client, /finishGachaCinematic\?\.\(\)/);
  assert.match(css, /\.gacha-cinematic\.rarity-LR/);
  assert.match(css, /\.gacha-cinematic\.effect-guaranteed/);
  assert.match(css, /\.gacha-cinematic\.effect-surprise/);
  assert.match(server, /transaction\.create\(opRef, \{ type: "gacha", result/);
});

test("個体ごとのレベル上限到達後だけ限界突破ボスへ挑戦して上限を10解放する", async () => {
  const [page, client, server] = await Promise.all([read("./mediguard.html"), read("./mediguard.js"), read("./functions/mediguard.js")]);
  assert.match(page, /id="limitBreakView"/);
  assert.match(page, /id="limitBreakChallenge"/);
  assert.match(client, /startBattle\("startLimitBreak"\)/);
  assert.match(client, /battle\.run\.limitBreak/);
  assert.match(server, /async function startLimitBreak/);
  assert.match(server, /current\.level < current\.levelCap/);
  assert.match(server, /Math\.min\(100, current\.levelCap \+ 10\)/);
  assert.match(server, /levelCap: unlockedCap/);
  assert.match(server, /action === "startLimitBreak"/);
});

test("ゲーム操作は追従スティック・大型ボタン・即応スキルを使用する", async () => {
  const [css, client, page] = await Promise.all([read("./mediguard.css"), read("./mediguard.js"), read("./mediguard.html")]);
  assert.match(page, /id="gameExitButton"/);
  assert.doesNotMatch(page, /id="homeButton"/);
  assert.doesNotMatch(page, /class="title-back"/);
  assert.match(client, /window\.location\.href = "index\.html"/);
  assert.match(client, /stick\.baseX \+=/);
  assert.match(client, /screen\.setPointerCapture/);
  assert.match(client, /skillButton"\)\.addEventListener\("pointerdown"/);
  assert.match(client, /スキル再使用まで/);
  assert.doesNotMatch(client, /ctx\.lineTo\(battle\.player\.x \+ d\.x \* 48/);
  assert.match(css, /\.joystick\{[^}]*width:124px/);
  assert.match(css, /\.battle-action\.attack\{[^}]*width:102px/);
  assert.match(css, /\.battle-action\.skill\{[^}]*width:78px/);
});

test("味方・敵キャラは固定マスではなく輪郭透過PNGを実際に使用する", async () => {
  const [css, client, page] = await Promise.all([read("./mediguard.css"), read("./mediguard.js"), read("./mediguard.html")]);
  assert.match(css, /mediguard-sprites\/character-0\.png/);
  assert.match(css, /background-size:contain/);
  assert.match(client, /loadSpriteSet\("character", 10\)/);
  assert.match(client, /loadSpriteSet\("pathogen", 12\)/);
  assert.match(client, /function drawCutout\(/);
  assert.doesNotMatch(client, /function drawAtlas\(/);
  assert.doesNotMatch(page, /class="bottom-nav game-bottom-nav"/);
  const sprites = [
    ...Array.from({ length: 10 }, (_, index) => `./images/mediguard-sprites/character-${index}.png`),
    ...Array.from({ length: 12 }, (_, index) => `./images/mediguard-sprites/pathogen-${index}.png`),
    "./images/mediguard-tab.svg",
  ];
  await Promise.all(sprites.map((path) => access(new URL(path, import.meta.url))));
});

test("未完成の協力プレイは実装済みと誤認させず次段階として明示する", async () => {
  const page = await read("./mediguard.html");
  assert.match(page, /協力プレイ/);
  assert.match(page, /class="soon" disabled/);
});

test("初期十字キーと任意スティックを選べ、設定を端末へ保存する", async () => {
  const [page, client, css] = await Promise.all([read("./mediguard.html"), read("./mediguard.js"), read("./mediguard.css")]);
  assert.match(page, /id="directionPad"/);
  for (const direction of ["up", "down", "left", "right"]) assert.match(page, new RegExp(`data-direction="${direction}"`));
  assert.match(page, /data-control-mode="dpad"/);
  assert.match(page, /data-control-mode="joystick"/);
  assert.match(client, /let controlMode = localStorage\.getItem\(CONTROL_STORAGE_KEY\) === "joystick" \? "joystick" : "dpad"/);
  assert.match(client, /localStorage\.setItem\(CONTROL_STORAGE_KEY, controlMode\)/);
  assert.match(client, /Number\(dpad\.right\) - Number\(dpad\.left\)/);
  assert.match(css, /\.direction-pad/);
});

test("臓器別の遮蔽物は通行と薬剤弾を遮り、身を隠せる地形として動作する", async () => {
  const client = await read("./mediguard.js");
  assert.match(client, /const OBSTACLE_LAYOUTS = Object\.freeze/);
  for (const map of ["lung", "airway", "intestine", "urinary", "vessel", "skin"]) assert.match(client, new RegExp(`${map}: \\[`));
  assert.match(client, /function moveAroundObstacles\(/);
  assert.match(client, /function segmentHitsObstacle\(/);
  assert.match(client, /if \(segmentHitsObstacle\(beforeX, beforeY, shot\.x, shot\.y\)\) shot\.life = 0/);
  assert.match(client, /drawBattleObstacles\(ctx, battle\.run\.map\.id\)/);
});

test("出撃読み込み画面とオリジナルBGM・効果音を全ゲーム画面へ備える", async () => {
  const [page, client, audio, sw] = await Promise.all([read("./mediguard.html"), read("./mediguard.js"), read("./mediguard_audio.js"), read("./sw.js")]);
  assert.match(page, /class="loading-scene"/);
  assert.match(page, /id="bgmToggle"/);
  assert.match(page, /id="sfxToggle"/);
  assert.match(client, /mediguardAudio\.playMusic\("battle"\)/);
  assert.match(client, /mediguardAudio\.sfx\("gacha"\)/);
  assert.match(client, /\$\("loadingScreen"\)\.hidden = false;\n  try/);
  assert.match(audio, /class MediguardAudio/);
  assert.match(audio, /AudioContext/);
  assert.match(audio, /playMusic\(theme = "home"\)/);
  assert.match(sw, /mediguard_audio\.js\?v=20261012-1/);
});
