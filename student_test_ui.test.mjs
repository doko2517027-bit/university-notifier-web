import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (name) => readFile(new URL(name, import.meta.url), "utf8");

test("学生向けテスト画面だけが共通デザインを読み込む", async () => {
  const studentPages = await Promise.all(
    ["exam.html", "quiz.html", "fill_blank.html", "qa.html", "daily_question.html"]
      .map(read),
  );
  for (const html of studentPages) {
    assert.match(html, /student_test\.css\?v=20261021-1/);
    assert.match(html, /student-test-body/);
  }

  const adminHtml = await read("admin.html");
  assert.doesNotMatch(adminHtml, /student_test\.css/);
});

test("既存の全問題形式で答えと解説を共通表示する", async () => {
  const scripts = await Promise.all(
    ["quiz.js", "fill_blank.js", "qa.js", "daily_question.js"].map(read),
  );
  for (const source of scripts) {
    assert.match(source, /renderAnswerExplanation/);
    assert.match(source, /questionExplanation/);
  }
});

test("問題一覧は横スクロールに頼らずスマホでも見つけられる", async () => {
  const css = await read("student_test.css");
  assert.match(css, /\.exam-period-tabs[\s\S]*display:\s*grid\s*!important/);
  assert.match(css, /overflow:\s*visible\s*!important/);
  assert.match(css, /\.test-choice-list\s*\{\s*grid-template-columns:\s*1fr/);
});
