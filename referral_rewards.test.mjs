import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [functionsSource, commonSource, referralSource, referralHtml, referralAdminSource, referralAdminHtml, petRoomSource, petRoomHtml, petConfigSource, appSource, styleSource] = await Promise.all([
  readFile(new URL("./functions/index.js", import.meta.url), "utf8"),
  readFile(new URL("./common.js", import.meta.url), "utf8"),
  readFile(new URL("./referral.js", import.meta.url), "utf8"),
  readFile(new URL("./referral.html", import.meta.url), "utf8"),
  readFile(new URL("./referral_admin.js", import.meta.url), "utf8"),
  readFile(new URL("./referral_admin.html", import.meta.url), "utf8"),
  readFile(new URL("./pet_room.js", import.meta.url), "utf8"),
  readFile(new URL("./pet_room.html", import.meta.url), "utf8"),
  readFile(new URL("./pet_character_config.mjs", import.meta.url), "utf8"),
  readFile(new URL("./app.js", import.meta.url), "utf8"),
  readFile(new URL("./style.css", import.meta.url), "utf8"),
]);

test("2人達成の100ポイントはサーバー側の一度限りの記録と同じ取引で加算する", () => {
  assert.match(functionsSource, /m2LearningPoints\?\.grantedAt/);
  assert.match(functionsSource, /FieldValue\.increment\(100\)/);
  assert.match(functionsSource, /rewardGrants:\s*rewardGrantState\.rewardGrants/);
});

test("色テーマ・ペット・毎日のお世話は達成人数に応じてサーバー側で制限する", () => {
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
  assert.match(commonSource, /pointerdown/);
  assert.match(commonSource, /careMatePetPosition/);
  assert.match(commonSource, /location\.assign\("pet_room\.html"\)/);
});

test("2510044の特典管理からホーム招待枠だけをオンオフできる", () => {
  assert.match(functionsSource, /exports\.updateReferralHomeVisibilityAdmin = onCall/);
  assert.match(functionsSource, /requirePrimaryDeviceAuditAdmin\(request\)/);
  assert.match(functionsSource, /homeVisible:\s*settings\.homeVisible !== false/);
  assert.match(referralAdminHtml, /id="referralHomeVisible"/);
  assert.match(referralAdminSource, /updateReferralHomeVisibilityAdmin/);
  assert.match(appSource, /homeReferralCard\.hidden = !homeVisible/);
});

test("ペットの部屋で表示切替と8人特典の毎日のお世話を管理する", () => {
  assert.match(petRoomHtml, /id="petVisibilityToggle"/);
  assert.match(petRoomHtml, /id="petCareActions"/);
  assert.match(petRoomSource, /action: "pet_visibility"/);
  assert.match(petRoomSource, /action: "pet_interaction"/);
  assert.match(petRoomSource, /entitlements\?\.petCare/);
  assert.match(functionsSource, /action === "pet_visibility"/);
  assert.match(functionsSource, /action === "pet_interaction"/);
});

test("3体の透過スプライトで行動と表情の固定IDを保持する", () => {
  assert.match(petConfigSource, /CAREMATE_PET_ASSETS_READY = true/);
  assert.match(petConfigSource, /images\/pets\/cat\.webp/);
  assert.match(petConfigSource, /images\/pets\/dog\.webp/);
  assert.match(petConfigSource, /images\/pets\/rabbit\.webp/);
  assert.match(petConfigSource, /applyPetSprite/);
  for (const action of ["rampage", "walk", "run", "stop", "sleep", "jump", "stretch", "eat", "play", "wave"]) {
    assert.match(petConfigSource, new RegExp(`id: "${action}"`));
  }
  for (const expression of ["smile", "angry", "cry", "sad", "hurt", "neutral", "surprised", "sleepy", "embarrassed", "worried", "excited", "affection"]) {
    assert.match(petConfigSource, new RegExp(`id: "${expression}"`));
  }
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
