import assert from "node:assert/strict";
import test from "node:test";

import {
  answerLinesForChoices,
  questionExplanation,
  renderAnswerExplanation,
} from "./student_test_view.mjs";

test("既存の選択問題を番号・選択肢本文つきの答えにする", () => {
  const question = { choices: ["心臓", "肺", "腎臓"] };
  assert.deepEqual(answerLinesForChoices(question, [2, 0]), ["3. 腎臓", "1. 心臓"]);
});

test("答えと解説を順番どおり安全に表示する", () => {
  const html = renderAnswerExplanation({
    answerLines: ["2. <正解>"],
    explanation: "理由を\n確認する",
  });
  assert.ok(html.indexOf("答え") < html.indexOf("解説"));
  assert.match(html, /2\. &lt;正解&gt;/);
  assert.match(html, /理由を\n確認する/);
});

test("解説がない既存問題にも欄を残して状態を明示する", () => {
  assert.equal(questionExplanation({}), "");
  assert.match(renderAnswerExplanation({ answerLines: ["答え"] }), /解説が登録されていません/);
});
