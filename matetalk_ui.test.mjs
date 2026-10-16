import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, client, common, rules, functions, styles] = await Promise.all([
  readFile(new URL("./matetalk.html", import.meta.url), "utf8"),
  readFile(new URL("./matetalk.js", import.meta.url), "utf8"),
  readFile(new URL("./common.js", import.meta.url), "utf8"),
  readFile(new URL("./firestore.rules", import.meta.url), "utf8"),
  readFile(new URL("./functions/index.js", import.meta.url), "utf8"),
  readFile(new URL("./matetalk.css", import.meta.url), "utf8"),
]);

test("全学生の下部タブをメイトークへ統一する", () => {
  assert.match(common, /chat\.href = "matetalk\.html"/);
  assert.match(common, /a\[href="daruma\/"\]/);
  assert.doesNotMatch(common, /game\.href = "daruma\/"/);
});

test("管理者切替・予定共有・写真動画準備中を表示する", () => {
  assert.match(html, /data-mode="admin"/);
  assert.match(html, /予定共有/);
  assert.match(html, /COMING SOON/);
  assert.match(styles, /\.matetalk-page\{width:100%;max-width:none;padding:0\}/);
  assert.match(styles, /@media\(max-width:760px\)/);
});

test("トーク未選択画面と管理者切替のhidden属性をCSSが上書きしない", () => {
  assert.match(html, /id="mateConversation"[^>]*hidden/);
  assert.match(html, /id="mateModeSwitch"[^>]*hidden/);
  assert.match(styles, /\.matetalk-page \[hidden\]\{display:none!important\}/);
  assert.match(client, /\$\("mateEmptyState"\)\.hidden = true/);
  assert.match(client, /\$\("mateConversation"\)\.hidden = false/);
});

test("管理者初回表示で既存学生の管理者ルームを不足分だけ作る", () => {
  assert.match(functions, /ensureAllMateTalkAdminRooms/);
  assert.match(functions, /if \(snapshot\.exists\) return/);
  assert.match(functions, /request\.auth\?\.token\?\.admin === true/);
});

test("学生には管理者ルームを必ず一覧に出し、管理者本人には自己ルームを作らない", () => {
  assert.match(client, /studentNumber === ADMIN_ID \? "" : `admin_\$\{studentNumber\}`/);
  assert.match(client, /guaranteedAdminRoom && !rooms\.some/);
  assert.match(client, /rooms\.unshift\(guaranteedAdminRoom\)/);
});

test("送信はCallableで参加者を検証し新着通知を送る", () => {
  assert.match(client, /sendMateTalkMessage/);
  assert.match(functions, /canAccessRoom\(room, studentNumber\)/);
  assert.match(functions, /notifyMateTalkMessage/);
  assert.match(rules, /resource\.data\.participants\.hasAny/);
  assert.match(rules, /allow write: if false/);
});

test("交換IDは公開プロフィールから分離する", () => {
  assert.match(functions, /mateTalkPrivateProfiles/);
  assert.doesNotMatch(functions.match(/function mateTalkProfileCopy[\s\S]*?\n}/)?.[0] || "", /exchangeId:/);
  assert.match(rules, /match \/mateTalkPrivateProfiles\/\{studentNumber\}/);
});

test("予定の非表示設定をサーバーへ保存する", () => {
  assert.match(client, /setMateTalkScheduleVisibility/);
  assert.match(functions, /hiddenEventKeys/);
});
