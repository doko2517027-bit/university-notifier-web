import test from "node:test";
import assert from "node:assert/strict";
import {
  formatAcademicGrade,
  normalizeAcademicGrade,
} from "./grade_display.mjs";

test("数字・年付き・重複した年表記をすべて同じ学年へ整える", () => {
  for (const value of [2, "2", "2年", "2年年", "２年生", " 2 年 "]) {
    assert.equal(normalizeAcademicGrade(value), "2");
    assert.equal(formatAcademicGrade(value), "2年");
  }
});

test("年度などを学年として誤認せず未設定表示にする", () => {
  assert.equal(normalizeAcademicGrade("2026年度"), "");
  assert.equal(formatAcademicGrade("2026年度"), "学年未設定");
  assert.equal(formatAcademicGrade("", "未設定"), "未設定");
});
