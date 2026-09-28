import test from "node:test";
import assert from "node:assert/strict";
import { choosePreferredAttendanceRecord, dedupeAttendanceRecords } from "./attendance_record_view.mjs";

test("同じ講義の旧記録と修正記録は修正後の判定を1件だけ表示する", () => {
  const old = { id: "old", session: "2026-09-28|3|health", status: "absent" };
  const corrected = { id: "new", session: old.session, status: "present", manualEdited: true };
  assert.deepEqual(dedupeAttendanceRecords([corrected, old], (row) => row.session), [corrected]);
  assert.equal(choosePreferredAttendanceRecord(old, corrected), corrected);
});

test("異なる時限と別の通知テストは統合しない", () => {
  const rows = [{ session: "2026-09-28|3|health" }, { session: "2026-09-28|4|health" }, { session: "2026-09-28|3|health|test-1" }];
  assert.equal(dedupeAttendanceRecords(rows, (row) => row.session).length, 3);
});

test("同じ講義を複数回修正した場合は最新の修正を表示する", () => {
  const before = { manualEdited: true, editedAt: new Date("2026-09-28T12:00:00+09:00"), status: "absent" };
  const after = { manualEdited: true, editedAt: new Date("2026-09-28T13:00:00+09:00"), status: "present" };
  assert.equal(choosePreferredAttendanceRecord(before, after), after);
});
