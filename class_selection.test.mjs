import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Firebaseを起動せず、画面と共通の純粋な選択ロジックを検証する。
const source = readFileSync(new URL("./class_selection.js", import.meta.url), "utf8");
const logic = source.slice(source.indexOf("export const CLASS_SELECTION_NONE"));
const selection = await import(`data:text/javascript,${encodeURIComponent(logic)}`);

test("全角の時限でも選択対象を作り、保存後は選んだクラスだけ残す", () => {
  const rows = ["A", "B"].map((group) => ({
    date: "2026-09-29",
    subject: "社会福祉論",
    period: "３限",
    classGroup: `${group}クラス`,
  }));
  const targets = selection.buildClassSelectionTargets(rows);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].key, "社会福祉論_2026-09-29_3");
  assert.deepEqual(targets[0].options, ["A", "B"]);
  assert.equal(selection.applyClassSelections(rows, {}).length, 1);
  assert.equal(
    selection.applyClassSelections(rows, { [targets[0].key]: "B" })[0].classGroup,
    "Bクラス",
  );
});

test("前バージョンで選択済みの学生も今日以降は再選択する", () => {
  const selections = {
    "社会福祉論_2026-09-28_3": "A",
    "社会福祉論_2026-09-29_3": "B",
  };
  assert.deepEqual(selection.effectiveClassSelections({
    classSelections: selections,
    classSelectionResetVersion: "2026-09-29-v2",
  }), { "社会福祉論_2026-09-28_3": "A" });
  assert.deepEqual(selection.effectiveClassSelections({
    classSelections: selections,
    classSelectionResetVersion: selection.CLASS_SELECTION_RESET_VERSION,
  }), selections);
});
