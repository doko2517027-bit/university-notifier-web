import assert from "node:assert/strict";
import { test } from "node:test";
import { courseRegistrationAccess } from "./course_registration_access.mjs";

test("manaba未設定・確認失敗でも在籍学生の履修登録を止めない", () => {
  assert.equal(courseRegistrationAccess({ manabaVerified: false }).allowed, true);
  assert.equal(courseRegistrationAccess({ manabaVerified: null }).allowed, true);
  assert.equal(courseRegistrationAccess({ manabaNeedsReset: true }).allowed, true);
});

test("休学・卒業・退学の既存制限は維持する", () => {
  assert.equal(courseRegistrationAccess({ academicStatus: "leave", leaveStartDate: "2026-04-01" }).allowed, false);
  assert.equal(courseRegistrationAccess({ academicStatus: "graduated" }).allowed, false);
  assert.equal(courseRegistrationAccess({ academicStatus: "withdrawn" }).allowed, false);
  assert.equal(courseRegistrationAccess({ academicStatus: "leave" }, { previewMode: true }).allowed, true);
});
