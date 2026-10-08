import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [usersAdmin, userDetail, adminRegister, adminScope] = await Promise.all([
  readFile(new URL("./users_admin.js", import.meta.url), "utf8"),
  readFile(new URL("./user_detail_admin.js", import.meta.url), "utf8"),
  readFile(new URL("./admin_user_register.js", import.meta.url), "utf8"),
  readFile(new URL("./admin_scope.js", import.meta.url), "utf8"),
]);

test("ユーザー一覧と学生詳細は共通の学年表示を使う", () => {
  assert.match(usersAdmin, /formatAcademicGrade\(user\.grade\)/);
  assert.match(userDetail, /formatAcademicGrade\(targetUserData\.grade/);
});

test("管理者登録は新規データも年付きの統一形式で保存する", () => {
  assert.match(adminRegister, /grade: formatAcademicGrade\(selectedGrade, ""\)/);
});

test("学年フィルターも年の重複や全角数字を正規化する", () => {
  assert.match(usersAdmin, /normalizeAcademicGrade\(user\.grade\)/);
  assert.match(adminScope, /normalizeAcademicGrade\(user\?\.grade\)/);
});
