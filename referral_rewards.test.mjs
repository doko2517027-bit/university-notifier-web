import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [functionsSource, commonSource, referralSource, referralHtml, referralAdminSource, referralAdminHtml, appSource, styleSource] = await Promise.all([
  readFile(new URL("./functions/index.js", import.meta.url), "utf8"),
  readFile(new URL("./common.js", import.meta.url), "utf8"),
  readFile(new URL("./referral.js", import.meta.url), "utf8"),
  readFile(new URL("./referral.html", import.meta.url), "utf8"),
  readFile(new URL("./referral_admin.js", import.meta.url), "utf8"),
  readFile(new URL("./referral_admin.html", import.meta.url), "utf8"),
  readFile(new URL("./app.js", import.meta.url), "utf8"),
  readFile(new URL("./style.css", import.meta.url), "utf8"),
]);

test("2人達成の100ポイントはサーバー側の一度限りの記録と同じ取引で加算する", () => {
  assert.match(functionsSource, /m2LearningPoints\?\.grantedAt/);
  assert.match(functionsSource, /FieldValue\.increment\(100\)/);
  assert.match(functionsSource, /rewardGrants:\s*rewardGrantState\.rewardGrants/);
});

test("色テーマ・ペット・アクセサリーは達成人数に応じてサーバー側で制限する", () => {
  assert.match(functionsSource, /exports\.saveReferralPersonalization = onCall/);
  assert.match(functionsSource, /account\.milestones\?\.m4\?\.unlockedAt/);
  assert.match(functionsSource, /account\.milestones\?\.m6\?\.unlockedAt/);
  assert.match(functionsSource, /account\.milestones\?\.m8\?\.unlockedAt/);
  assert.match(functionsSource, /ペットの種類と名前は確定済みです/);
});

test("全画面同期と紹介画面のペット設定UIが接続されている", () => {
  assert.match(commonSource, /void initializeReferralPersonalization\(\)/);
  assert.match(commonSource, /data\.caremateTheme|dataset\.caremateTheme/);
  assert.match(commonSource, /renderCareMatePet/);
  assert.match(referralHtml, /id="referralPetCard"/);
  assert.match(referralSource, /saveReferralPersonalization/);
  assert.match(styleSource, /data-caremate-theme="pink"/);
  assert.match(styleSource, /\.caremate-referral-pet/);
});

test("ペットは画面内をランダムに移動し表情を切り替える", () => {
  assert.match(commonSource, /startCareMatePetMotion/);
  assert.match(commonSource, /Math\.random\(\).*maxX|Math\.random\(\) \* Math\.max\(1, limit\.maxX/);
  assert.match(commonSource, /dataset\.expression/);
  assert.match(commonSource, /prefers-reduced-motion/);
});

test("2510044の特典管理からホーム招待枠だけをオンオフできる", () => {
  assert.match(functionsSource, /exports\.updateReferralHomeVisibilityAdmin = onCall/);
  assert.match(functionsSource, /requirePrimaryDeviceAuditAdmin\(request\)/);
  assert.match(functionsSource, /homeVisible:\s*settings\.homeVisible !== false/);
  assert.match(referralAdminHtml, /id="referralHomeVisible"/);
  assert.match(referralAdminSource, /updateReferralHomeVisibilityAdmin/);
  assert.match(appSource, /homeReferralCard\.hidden = !homeVisible/);
});
