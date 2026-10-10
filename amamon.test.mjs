import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("2510044だけがあまもん画面と専用Firestore領域へアクセスできる", async () => {
  const [page, client, rules, server] = await Promise.all([read("./amamon.html"), read("./amamon.js"), read("./firestore.rules"), read("./functions/amamon.js")]);
  assert.match(page, /studentNumber"\) !== "2510044"/);
  assert.match(client, /auth\.currentUser\?\.uid !== `caremate-\$\{studentNumber\}`/);
  assert.match(rules, /match \/armorMonsters\/\{studentId\}/);
  assert.match(rules, /studentId == '2510044'/);
  assert.match(server, /requireTester/);
  assert.match(server, /collection\("armorMonsters"\)/);
  assert.match(server, /有効期限が切れています/);
  assert.match(server, /forfeited:\s*true/);
  assert.match(server, /kind !== "consumable"/);
});

test("6コマンドと下部だけ切り替わる戦闘画面を備える", async () => {
  const [page, css, client] = await Promise.all([read("./amamon.html"), read("./amamon.css"), read("./amamon.js")]);
  for (const command of ["attack", "skill", "spell", "item", "guard", "equipment"]) assert.match(page, new RegExp(`data-command="${command}"`));
  assert.match(css, /grid-template-rows:75dvh 25dvh/);
  assert.match(client, /commandEntries\.slice\(commandPage \* 4/);
  assert.match(client, /submitAmamonCpuAction/);
});

test("相棒作成・育成・ガチャ・装備・どうぐ・記録を実処理へ接続する", async () => {
  const [page, client, server] = await Promise.all([read("./amamon.html"), read("./amamon.js"), read("./functions/amamon.js")]);
  for (const view of ["battle", "training", "gacha", "equipment", "items", "records"]) assert.match(page, new RegExp(`data-view="${view}"`));
  for (const callable of ["createAmamonCompanion", "drawAmamonGacha", "saveAmamonEquipment", "allocateAmamonSkills", "useAmamonPermanentItem"]) assert.match(client, new RegExp(callable));
  assert.match(server, /transaction\.create\(operation/);
  assert.match(server, /最後の1個は使用できません/);
  assert.match(server, /applyExperience/);
});

test("ゲーム画面全体はスクロールせずスマホ縦横・PCに対応する", async () => {
  const css = await read("./amamon.css");
  assert.match(css, /body\.amamon-body\{[^}]*overflow:hidden/);
  assert.match(css, /@media \(orientation:landscape\) and \(max-height:620px\)/);
  assert.match(css, /@media \(min-width:1000px\) and \(orientation:landscape\)/);
  assert.match(css, /max-width:1180px/);
});

test("オリジナル画像素材を実際の相棒と敵表示に使用する", async () => {
  const [css, page] = await Promise.all([read("./amamon.css"), read("./amamon.html")]);
  assert.match(css, /amamon-companion-sprites\.png/);
  assert.match(css, /amamon-enemy-effects\.png/);
  assert.match(css, /amamon-evolutions\.png/);
  assert.match(css, /amamon-evolutions-back\.png/);
  assert.match(css, /evolution-sword/);
  assert.match(page, /amamonVisualEquipment/);
  assert.match(page, /images\/amamon-tab\.svg/);
});
