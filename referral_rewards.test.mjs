import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [functionsSource, commonSource, referralSource, referralHtml, referralAdminSource, referralAdminHtml, appSource, styleSource, serviceWorkerSource] = await Promise.all([
  readFile(new URL("./functions/index.js", import.meta.url), "utf8"),
  readFile(new URL("./common.js", import.meta.url), "utf8"),
  readFile(new URL("./referral.js", import.meta.url), "utf8"),
  readFile(new URL("./referral.html", import.meta.url), "utf8"),
  readFile(new URL("./referral_admin.js", import.meta.url), "utf8"),
  readFile(new URL("./referral_admin.html", import.meta.url), "utf8"),
  readFile(new URL("./app.js", import.meta.url), "utf8"),
  readFile(new URL("./style.css", import.meta.url), "utf8"),
  readFile(new URL("./sw.js", import.meta.url), "utf8"),
]);

test("2人達成の100ポイントはサーバー側の一度限りの記録と同じ取引で加算する", () => {
  assert.match(functionsSource, /m2LearningPoints\?\.grantedAt/);
  assert.match(functionsSource, /FieldValue\.increment\(100\)/);
  assert.match(functionsSource, /rewardGrants:\s*rewardGrantState\.rewardGrants/);
});

test("色テーマ・写真背景・背景調整は達成人数に応じてサーバー側で制限する", () => {
  assert.match(functionsSource, /exports\.saveReferralPersonalization = onCall/);
  assert.match(functionsSource, /account\.milestones\?\.m4\?\.unlockedAt/);
  assert.match(functionsSource, /account\.milestones\?\.m6\?\.unlockedAt/);
  assert.match(functionsSource, /account\.milestones\?\.m8\?\.unlockedAt/);
  assert.match(functionsSource, /写真背景はまだ解放されていません/);
  assert.match(functionsSource, /背景の詳細調整を利用できません/);
});

test("全画面同期と紹介画面の写真背景UIが接続されている", () => {
  assert.match(commonSource, /void initializeReferralPersonalization\(\)/);
  assert.match(commonSource, /data\.caremateTheme|dataset\.caremateTheme/);
  assert.match(commonSource, /applyCareMatePhotoBackground/);
  assert.match(commonSource, /data\.carematePhotoBackground|dataset\.carematePhotoBackground/);
  assert.match(referralHtml, /id="referralBackgroundCard"/);
  assert.match(referralHtml, /id="referralBackgroundFile"/);
  assert.match(referralSource, /saveReferralPersonalization/);
  assert.match(referralSource, /api\.cloudinary\.com\/v1_1\/vpctonjf\/image\/upload/);
  assert.match(styleSource, /data-caremate-theme="pink"/);
  assert.match(styleSource, /data-caremate-photo-background/);
});

test("ペット機能を表示せず6人・8人特典を背景機能へ置き換える", () => {
  assert.doesNotMatch(referralSource, /saveReferralPet|openPetRoom|applyPetSprite/);
  assert.doesNotMatch(referralHtml, /CareMateペット|ペットの部屋/);
  assert.doesNotMatch(serviceWorkerSource, /pet_room\.html|images\/pets\//);
  assert.match(referralHtml, /背景カスタマイズ＋/);
  assert.match(referralSource, /action: "background_effects"/);
});

test("2510044の特典管理からホーム招待枠だけをオンオフできる", () => {
  assert.match(functionsSource, /exports\.updateReferralHomeVisibilityAdmin = onCall/);
  assert.match(functionsSource, /requirePrimaryDeviceAuditAdmin\(request\)/);
  assert.match(functionsSource, /homeVisible:\s*settings\.homeVisible !== false/);
  assert.match(referralAdminHtml, /id="referralHomeVisible"/);
  assert.match(referralAdminSource, /updateReferralHomeVisibilityAdmin/);
  assert.match(appSource, /homeReferralCard\.hidden = !homeVisible/);
});

test("Cloudinary以外の背景URLをサーバー側で拒否し、詳細設定値を制限する", () => {
  assert.match(functionsSource, /validReferralBackgroundUrl/);
  assert.match(functionsSource, /res\.cloudinary\.com/);
  assert.match(functionsSource, /\/vpctonjf\/image\/upload\//);
  assert.match(functionsSource, /blur < 0/);
  assert.match(functionsSource, /brightness < 40/);
});

test("2510044だけが達成特典を理由付きで削除・復元できる", () => {
  assert.match(functionsSource, /exports\.setReferralRewardDeletedAdmin = onCall/);
  assert.match(functionsSource, /requirePrimaryDeviceAuditAdmin\(request\)/);
  assert.match(functionsSource, /referralRewardDeletions/);
  assert.match(referralAdminSource, /setReferralRewardDeletedAdmin/);
  assert.match(referralAdminSource, /学習ポイント100ptも差し引かれます/);
  assert.match(functionsSource, /\[`rewardSuppressions\.\$\{key\}`\]: FieldValue\.delete\(\)/);
  assert.match(referralAdminSource, /error\?\.message/);
});
