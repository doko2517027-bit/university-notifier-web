import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [functionsSource, detailHtml, detailJs, referralJs, rules] = await Promise.all([
  readFile(new URL("./functions/index.js", import.meta.url), "utf8"),
  readFile(new URL("./user_detail_admin.html", import.meta.url), "utf8"),
  readFile(new URL("./user_detail_admin.js", import.meta.url), "utf8"),
  readFile(new URL("./referral_admin.js", import.meta.url), "utf8"),
  readFile(new URL("./firestore.rules", import.meta.url), "utf8"),
]);

test("紹介人数の補正は2510044限定サーバー認可と監査履歴を必須にする", () => {
  const section = functionsSource.slice(
    functionsSource.indexOf("exports.adjustReferralCountAdmin"),
    functionsSource.indexOf("exports.claimReferralGift"),
  );
  assert.match(section, /requirePrimaryDeviceAuditAdmin\(request\)/);
  assert.match(section, /referralManualAdjustments/);
  assert.match(section, /reason\.length < 4/);
  assert.match(rules, /match \/referralManualAdjustments\/\{documentId\}[\s\S]*allow read, write: if false/);
  assert.match(referralJs, /studentNumber !== "2510044"/);
});

test("学生詳細の機能別データは有効な管理者だけが取得・更新する", () => {
  for (const exportName of ["getStudentFeatureAdmin", "updateStudentFeatureAdmin"]) {
    const start = functionsSource.indexOf(`exports.${exportName}`);
    assert.ok(start > 0);
    assert.match(functionsSource.slice(start, start + 900), /requireEnabledCareMateAdmin\(request\)/);
  }
});

test("学生詳細は履修・出席・テスト・紹介を切替表示する", () => {
  for (const tab of ["enrollment", "attendance", "exam", "referral"]) {
    assert.match(detailHtml, new RegExp(`data-feature-tab="${tab}"`));
    assert.match(detailHtml, new RegExp(`data-feature-panel="${tab}"`));
  }
  assert.match(detailJs, /updateStudentFeatureAdmin/);
  assert.match(detailJs, /feature === "examProgress"/);
});

test("学生詳細の機能別明細は変更監視と定期再取得で更新される", () => {
  assert.match(detailHtml, /studentFeatureRealtimeStatus/);
  assert.match(detailJs, /startStudentFeatureRealtime/);
  assert.match(detailJs, /onSnapshot\(/);
  assert.match(detailJs, /setInterval\(\(\) =>/);
  assert.match(detailJs, /getStudentFeatureAdmin/);
});

test("機能別明細は一つの描画失敗で他の機能まで空にならない", () => {
  assert.match(detailJs, /履修明細の描画エラー/);
  assert.match(detailJs, /出席明細の描画エラー/);
  assert.match(detailJs, /テスト明細の描画エラー/);
  assert.match(detailJs, /紹介明細の描画エラー/);
});

test("履修登録が0件でも管理者が対象科目を初期登録できる", () => {
  assert.match(functionsSource, /availableEnrollmentSubjects/);
  assert.match(functionsSource, /feature === "enrollmentInitial"/);
  assert.match(functionsSource, /adminEnrollmentCandidates/);
  assert.match(functionsSource, /admin-initial-registration/);
  assert.match(detailJs, /履修科目を初期登録/);
  assert.match(detailJs, /data-initial-enrollment-subject/);
  assert.match(detailJs, /data-register-initial-enrollments/);
  assert.match(detailJs, /feature: "enrollmentInitial"/);
});

test("管理者の初期登録後も学生側と同じenrolledSubjectsへ保存する", () => {
  const start = functionsSource.indexOf('feature === "enrollmentInitial"');
  const section = functionsSource.slice(start, start + 4200);
  assert.match(section, /collection\("enrolledSubjects"\)/);
  assert.match(section, /status: "enrolled"/);
  assert.match(section, /enrollmentHistory/);
});
