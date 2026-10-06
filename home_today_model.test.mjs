import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTodayAutomaticItems, findNextLecture, manualTodoIsDimmed } from "./home_today_model.mjs";
import { formatClassGroupLabel, normalizeScheduleClassData, parenthesizedClassGroup } from "./class_group_label.mjs";

const now = new Date("2026-09-29T14:00:00+09:00");

test("今日の課題・予定・講義を統合し、他学年の共有予定を除外する", () => {
  const items = buildTodayAutomaticItems({
    now,
    user: { grade: "2" },
    assignments: [{ title: "レポート", course: "看護", url: "https://example.test/a", deadlineAt: "2026-09-29T18:00:00+09:00" }],
    archivedAssignments: [{ title: "レポート", course: "看護", url: "https://example.test/a", deadlineAt: "2026-09-29T18:00:00+09:00" }],
    personalEvents: [{ title: "面談", startAt: "2026-09-29T10:00:00+09:00", endAt: "2026-09-29T11:00:00+09:00" }],
    sharedEvents: [{ title: "2年行事", grade: "2", startAt: "2026-09-29T09:00:00+09:00" }, { title: "4年行事", grade: "4", startAt: "2026-09-29T09:00:00+09:00" }],
    lectures: [{ subject: "社会福祉論", period: "3", endTime: "14:30" }],
  });
  assert.deepEqual(items.map(({ title }) => title), ["2年行事", "面談", "社会福祉論", "レポート"]);
});

test("完了した項目と時刻を過ぎた項目だけを薄くする", () => {
  assert.equal(manualTodoIsDimmed({ date: "2026-09-29", dueTime: "12:00", completed: false }, now), true);
  assert.equal(manualTodoIsDimmed({ date: "2026-09-29", dueTime: "15:00", completed: false }, now), false);
  assert.equal(manualTodoIsDimmed({ date: "2026-09-29", dueTime: "", completed: true }, now), true);
});

test("次の講義は学生の時間割から選び、時限の時刻を補完する", () => {
  const next = findNextLecture([
    { date: "2026-09-29", schedules: [{ subject: "終了済み", period: "1" }] },
    { date: "2026-09-30", schedules: [{ subject: "社会福祉論", period: "3", classGroup: "A" }] },
  ], now);
  assert.equal(next.subject, "社会福祉論");
  assert.equal(next.startTime, "13:00");
  assert.equal(next.endTime, "14:30");
});

test("提出済みが明示された課題だけを提出済みとして扱う", () => {
  const [pending, submitted] = buildTodayAutomaticItems({ now, assignments: [
    { title: "未提出", deadlineAt: "2026-09-29T18:00:00+09:00" },
    { title: "提出済み", submitted: true, deadlineAt: "2026-09-29T19:00:00+09:00" },
  ] });
  assert.equal(pending.submitted, false);
  assert.equal(submitted.submitted, true);
});

test("同じ課題の履歴に提出済み情報があれば重複せず反映する", () => {
  const items = buildTodayAutomaticItems({
    now,
    assignments: [{ title: "課題", url: "/ct/a", deadlineAt: "2026-09-29T18:00:00+09:00" }],
    archivedAssignments: [{ title: "課題", url: "/ct/a", status: "submitted", deadlineAt: "2026-09-29T18:00:00+09:00" }],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].submitted, true);
});

test("クラス表示は保存形式にかかわらずクラスを1回だけ付ける", () => {
  assert.equal(formatClassGroupLabel("A"), "Aクラス");
  assert.equal(formatClassGroupLabel("Aクラス"), "Aクラス");
  assert.equal(formatClassGroupLabel("Aクラスクラス"), "Aクラス");
  assert.equal(parenthesizedClassGroup("Bクラス"), "（Bクラス）");
});

test("科目名末尾のクラス表記を表示用データとして保持する", () => {
  assert.deepEqual(
    normalizeScheduleClassData({ subject: "社会福祉論（Aクラス）" }),
    { subject: "社会福祉論", classGroup: "Aクラス" },
  );
  const [item] = buildTodayAutomaticItems({
    now,
    lectures: [{ subject: "社会福祉論", period: "3", classGroup: "Aクラス" }],
  });
  assert.match(item.detail, /Aクラス/);
  assert.doesNotMatch(item.detail, /クラスクラス/);
});
