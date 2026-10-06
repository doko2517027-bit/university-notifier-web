import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCourseLinkName,
  resolveCourseLink,
} from "./course_link_resolver.mjs";

test("時間割のASCIIローマ数字とmanabaの全角ローマ数字を同じ科目として扱う", () => {
  const courses = {
    "成人看護方法論Ⅰ": "https://sums.manaba.jp/ct/course_194225",
  };
  assert.equal(
    resolveCourseLink(courses, "成人看護方法論I"),
    "https://sums.manaba.jp/ct/course_194225",
  );
});

test("ⅠとⅡを取り違えない", () => {
  assert.notEqual(
    normalizeCourseLinkName("成人看護方法論Ⅰ"),
    normalizeCourseLinkName("成人看護方法論Ⅱ"),
  );
});

test("時間割にクラス表記が付いていても元科目のリンクを返す", () => {
  const courses = {
    社会福祉論: "https://sums.manaba.jp/ct/course_1",
  };
  assert.equal(
    resolveCourseLink(courses, "社会福祉論（Aクラス）"),
    "https://sums.manaba.jp/ct/course_1",
  );
});

test("一致しない別科目のリンクは返さない", () => {
  assert.equal(
    resolveCourseLink(
      { "成人看護方法論Ⅱ": "https://sums.manaba.jp/ct/course_2" },
      "成人看護方法論Ⅰ",
    ),
    "",
  );
});
