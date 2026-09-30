import test from "node:test";
import assert from "node:assert/strict";
import { dailyQuestionIndex } from "./daily_question_rotation.mjs";

test("今日の1問は問題数分を一巡するまで翌日に同じ問題を出さない", () => {
  const indexes = ["2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"].map(
    (dateKey) =>
      dailyQuestionIndex({
        dateKey,
        subjectId: "community-nursing",
        unitId: "unit-1",
        poolLength: 4,
      }),
  );
  assert.equal(new Set(indexes).size, 4);
});

test("問題がない時は選択しない", () => {
  assert.equal(
    dailyQuestionIndex({
      dateKey: "2026-09-30",
      subjectId: "subject",
      unitId: "unit",
      poolLength: 0,
    }),
    -1,
  );
});
