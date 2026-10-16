import assert from "node:assert/strict";
import test from "node:test";
import { isCommonScheduleEvent } from "./schedule_event_policy.mjs";

test("予防接種は履修科目でなくても時間割に表示する", () => {
  assert.equal(isCommonScheduleEvent({ subject: "インフルエンザ予防接種", classGroup: "Aクラス" }), true);
  assert.equal(isCommonScheduleEvent({ subject: "ワクチン接種", classGroup: "Bクラス" }), true);
});

test("通常講義は履修登録による判定を維持する", () => {
  assert.equal(isCommonScheduleEvent({ subject: "社会福祉論", classGroup: "Aクラス" }), false);
});
