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
    assert.match(html, /student_test\.css\?v=20261021-2/);
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

test("単元から登録問題一覧へ移動できる", async () => {
  const [examSource, listHtml, listSource] = await Promise.all([
    read("exam.js"),
    read("question_list.html"),
    read("question_list.js"),
  ]);
  assert.match(examSource, /登録問題を一覧で見る/);
  assert.match(examSource, /question_list\.html/);
  assert.match(listHtml, /登録問題一覧/);
  assert.match(listSource, /問題・選択肢・答え・解説/);
  assert.match(listSource, /data-question-filter/);
});

test("誤り報告と再開確認はブラウザ標準アラートを使わない", async () => {
  const [reportSource, sessionSource] = await Promise.all([
    read("question_report.js"),
    read("test_session.js"),
  ]);
  assert.doesNotMatch(reportSource, /window\.confirm|\balert\s*\(/);
  assert.doesNotMatch(sessionSource, /\bconfirm\s*\(/);
  assert.match(reportSource, /問題が違います/);
  assert.match(reportSource, /答えが違います/);
  assert.match(reportSource, /解説が違います/);
  assert.match(reportSource, /管理者へ送信しますか/);
  assert.match(sessionSource, /続きから始めますか/);
});
