import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("招待コードは学生ページの本人確認を使い、Active!Mail認証を要求しない", async () => {
  const [client, server] = await Promise.all([
    readFile(new URL("./register.js", import.meta.url), "utf8"),
    readFile(new URL("./functions/index.js", import.meta.url), "utf8"),
  ]);
  const prepare = server.split("exports.prepareReferralRegistration =")[1]
    .split("exports.completeReferralRegistration =")[0];
  assert.match(client, /studentPageVerificationToken/);
  assert.match(prepare, /registrationVerificationProofs/);
  assert.match(prepare, /isReferralCodeUsable/);
  assert.doesNotMatch(prepare, /activeMailPassword|verifyActiveMailPassword/);
  assert.doesNotMatch(client, /referralCodeValue && !activeMailPassword/);
});

test("通知購読の保存失敗は登録全体の失敗として表示しない", async () => {
  const client = await readFile(new URL("./register.js", import.meta.url), "utf8");
  assert.match(client, /await signInCareMateAuth\(studentNumber\.value, appPassword\.value\);[\s\S]*?try \{[\s\S]*?savePushSubscription/);
  assert.doesNotMatch(client, /alert\("通知は登録できませんでした/);
});

test("リクエスト画面と管理画面の入口は廃止し、全学生をメイトークへ案内する", async () => {
  const [home, admin, common, rules] = await Promise.all([
    readFile(new URL("./index.html", import.meta.url), "utf8"),
    readFile(new URL("./admin.html", import.meta.url), "utf8"),
    readFile(new URL("./common.js", import.meta.url), "utf8"),
    readFile(new URL("./firestore.rules", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(home, /href="requests\.html"/);
  assert.doesNotMatch(admin, /feature_requests_admin/);
  assert.doesNotMatch(rules, /match \/featureRequests\//);
  assert.match(common, /chat\.href = "matetalk\.html"/);
});

test("履修未登録の案内は今学期の登録を確認し、過去分未保存なら保存を案内する", async () => {
  const [home, registration] = await Promise.all([
    readFile(new URL("./app.js", import.meta.url), "utf8"),
    readFile(new URL("./course_registration.js", import.meta.url), "utf8"),
  ]);
  assert.match(home, /updateHomeEnrollmentNotice\(user\)/);
  assert.match(home, /Number\(enrollment\.academicYear\) === currentYear/);
  assert.match(registration, /function hasPastCourseEntry\(\)/);
  assert.match(registration, /hasPastCourseEntry\(\) && !pastHistoryInitialized/);
  assert.match(registration, /data-bulk-history-status/);
});
