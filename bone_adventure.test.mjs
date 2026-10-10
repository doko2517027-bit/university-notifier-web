import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("2510044だけリクエストタブをあまもんへ差し替える", async () => {
  const common = await read("./common.js");
  assert.match(common, /AMAMON_TEST_STUDENT_NUMBERS = Object\.freeze\(\["2510044"\]\)/);
  assert.match(common, /a\[href="requests\.html"\]/);
  assert.match(common, /link\.href = "amamon\.html"/);
  assert.match(common, /if \(!isAmamonTestStudent\(\)\) return/);
});

test("URL直打ちは本人認証とCloud Functionsの両方で拒否する", async () => {
  const [page, client, rules, functions] = await Promise.all([
    read("./bonad.html"),
    read("./bonad.js"),
    read("./firestore.rules"),
    read("./functions/index.js"),
  ]);
  assert.match(page, /studentNumber"\) !== "2510044"/);
  assert.match(client, /auth\.currentUser\?\.uid !== `caremate-\$\{studentNumber\}`/);
  assert.match(rules, /match \/boneAdventure\/\{studentId\}/);
  assert.match(rules, /studentId == '2510044'/);
  assert.match(rules, /allow create, update, delete: if false/);
  assert.match(functions, /getBoneAdventureState/);
  assert.match(functions, /syncBoneAdventureLearningPoints/);
});

test("ガチャ・育成・装備・通常ステージ・エンドレスが独立画面で接続される", async () => {
  const [page, client, server] = await Promise.all([
    read("./bonad.html"),
    read("./bonad.js"),
    read("./functions/bone_adventure.js"),
  ]);
  for (const view of ["room", "gacha", "training", "equipment", "stages", "endless"]) {
    assert.match(page, new RegExp(`data-bonad-(?:view|panel)="${view}"`));
  }
  assert.match(client, /drawBoneAdventureGacha/);
  assert.match(client, /BoneAdventureRunner/);
  assert.match(server, /transaction\.create\(operation/);
  assert.match(server, /最後の1個は使用できません/);
  assert.match(server, /RESPEC_COST/);
  assert.match(server, /validRequestId/);
  assert.match(server, /operationRef\(studentNumber, requestId\)/);
});

test("3D骸骨は外部モデルなしで生成し回転・ピンチ・臓器選択に対応する", async () => {
  const viewer = await read("./bone_adventure_3d.js");
  assert.match(viewer, /コード生成モデル/);
  assert.match(viewer, /character\.rotation\.y/);
  assert.match(viewer, /activePointers\.size === 2/);
  assert.match(viewer, /raycaster\.intersectObjects/);
  assert.match(viewer, /sessionStorage\.setItem\("bonadCharacterView"/);
});

test("累計ポイントを減らさず初回移行と増加分だけを同期する", async () => {
  const server = await read("./functions/bone_adventure.js");
  assert.match(server, /sourceTotalPoints: totalPoints/);
  assert.match(server, /highWatermark: totalPoints/);
  assert.match(server, /if \(currentTotal <= highWatermark\) return/);
  assert.doesNotMatch(server, /totalRanking[\s\S]{0,160}gachaPoints[\s\S]{0,80}transaction\.update\(ranking/);
});

test("スマホ縦横とPCで横にはみ出さず専用レイアウトへ切り替える", async () => {
  const css = await read("./bonad.css");
  assert.match(css, /\.bonad-body \{ width: 100%; max-width: none;/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(orientation: landscape\) and \(max-height: 560px\)/);
  assert.match(css, /\.bonad-game-shell \{ grid-template-columns:/);
  assert.doesNotMatch(css, /var\(--background\)/);
});

test("起動確認は利用者に見せず、読み込み完了まで全画面で覆う", async () => {
  const [page, css] = await Promise.all([read("./bonad.html"), read("./bonad.css")]);
  assert.match(page, /ゲームを起動中…/);
  assert.doesNotMatch(page, /本人認証とゲームデータを確認しています/);
  assert.match(css, /\.bonad-access-gate \{ position: fixed; z-index: 10000; inset: 0;/);
});

test("スクロールなしのアイコンメニューとページ送りで各機能を開く", async () => {
  const [page, client, css] = await Promise.all([read("./bonad.html"), read("./bonad.js"), read("./bonad.css")]);
  assert.match(page, /id="bonadHub"/);
  assert.match(page, /class="bonad-launch-grid"/);
  assert.match(client, /function goHub\(\)/);
  assert.match(client, /renderPager\("bonadInventoryPager"/);
  assert.match(client, /renderPager\("bonadEquipmentPager"/);
  assert.match(css, /\.bonad-body[^}]+overflow: hidden/);
  assert.doesNotMatch(css, /overflow:\s*auto/);
});
