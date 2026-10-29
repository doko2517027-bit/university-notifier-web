import test from "node:test";
import assert from "node:assert/strict";

import {
  buildContentSectionPatch,
  parseEditableLines,
} from "./exam_question_content_model.mjs";

test("要約と重要ポイントは空欄を0件として保存できる", () => {
  assert.deepEqual(buildContentSectionPatch("summary", "  \n"), {
    summary: [],
    manual_summary: [],
    hasManualContent: true,
  });
  assert.deepEqual(buildContentSectionPatch("important_points", ""), {
    important_points: [],
    manual_important_points: [],
    hasManualContent: true,
  });
});

test("編集内容は空行を除き、前後の空白を整えて保存する", () => {
  assert.deepEqual(parseEditableLines("  1項目目  \n\n2項目目\n"), [
    "1項目目",
    "2項目目",
  ]);
});

test("想定外の項目は保存対象にしない", () => {
  assert.throws(() => buildContentSectionPatch("quiz", "内容"), /保存対象/);
});
