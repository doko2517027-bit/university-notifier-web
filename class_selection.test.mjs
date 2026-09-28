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
  assert.equal(targets[0].key, "社会福祉論_2026-09-29");
  assert.deepEqual(targets[0].options, ["A", "B"]);
  assert.deepEqual(selection.classSelectionOptions(targets[0]).map((item) => item.label), ["Aクラス", "Bクラス"]);
  assert.equal(selection.applyClassSelections(rows, {}).length, 1);
  assert.equal(
    selection.applyClassSelections(rows, selection.selectionsForClassTarget(targets[0], "B"))[0].classGroup,
    "Bクラス",
  );
});

test("同じ科目のA・Bが3限と4限に分かれても選択は1回", () => {
  const rows = [
    { date: "2026-09-29", subject: "社会福祉論", period: "３限", classGroup: "Aクラス" },
    { date: "2026-09-29", subject: "社会福祉論", period: "４限", classGroup: "Bクラス" },
  ];
  const [target] = selection.buildClassSelectionTargets(rows);
  assert.deepEqual(target.options, ["A", "B"]);
  assert.deepEqual(target.periods.map((item) => item.period), [3, 4]);
  assert.deepEqual(selection.selectionsForClassTarget(target, "B"), {
    "社会福祉論_2026-09-29_3": selection.CLASS_SELECTION_NONE,
    "社会福祉論_2026-09-29_4": "B",
  });
  assert.deepEqual(selection.applyClassSelections(rows, selection.selectionsForClassTarget(target, "B")), [rows[1]]);
});

test("同じ日でも科目が違えば、それぞれ独立して選択する", () => {
  const rows = [
    { date: "2026-09-29", subject: "社会福祉論", period: "１限", classGroup: "Aクラス" },
    { date: "2026-09-29", subject: "社会福祉論", period: "２限", classGroup: "Bクラス" },
    { date: "2026-09-29", subject: "精神看護学", period: "３限", classGroup: "Aクラス" },
    { date: "2026-09-29", subject: "精神看護学", period: "４限", classGroup: "Bクラス" },
  ];
  const targets = selection.buildClassSelectionTargets(rows);
  assert.equal(targets.length, 2);
  assert.deepEqual(targets.map((item) => item.subject), ["社会福祉論", "精神看護学"]);
  assert.deepEqual(targets.map((item) => item.options), [["A", "B"], ["A", "B"]]);
  const chosen = {
    ...selection.selectionsForClassTarget(targets[0], "A"),
    ...selection.selectionsForClassTarget(targets[1], "B"),
  };
  assert.deepEqual(selection.applyClassSelections(rows, chosen), [rows[0], rows[3]]);
});

test("その日にBクラスだけならBとクラスなしを選べる", () => {
  const [target] = selection.buildClassSelectionTargets([
    { date: "2026-09-29", subject: "社会福祉論", period: "４限", classGroup: "Bクラス" },
  ]);
  assert.deepEqual(selection.classSelectionOptions(target).map((item) => item.label), ["Bクラス", "クラスなし"]);
  assert.deepEqual(selection.selectionsForClassTarget(target, selection.CLASS_SELECTION_NONE), {
    "社会福祉論_2026-09-29_4": selection.CLASS_SELECTION_NONE,
  });
});

test("前バージョンで選択済みの学生も今日以降は再選択する", () => {
  const selections = {
    "社会福祉論_2026-09-28_3": "A",
    "社会福祉論_2026-09-29_3": "B",
  };
  assert.deepEqual(selection.effectiveClassSelections({
    classSelections: selections,
    classSelectionResetVersion: "2026-09-29-v3",
  }), { "社会福祉論_2026-09-28_3": "A" });
  assert.deepEqual(selection.effectiveClassSelections({
    classSelections: selections,
    classSelectionResetVersion: selection.CLASS_SELECTION_RESET_VERSION,
  }), selections);
});
