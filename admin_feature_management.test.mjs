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
