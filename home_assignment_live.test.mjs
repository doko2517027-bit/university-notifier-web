import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

test("表示中に提出確認が届くと再読込なしで青へ更新し、古い未提出の通知でも戻さない", async () => {
  const source = await readFile(new URL("./home.js", import.meta.url), "utf8");
  const callbacks = {};
  const events = {};
  const status = { textContent: "" };
  let renders = 0;
  let stops = 0;
  const context = vm.createContext({
    URL, Date, Intl, console, assignmentAccess: true, db: {}, studentNumber: "2510044",
    currentItems: [{ url: "course_1_query_2", submitted: false }],
    archivedItems: [{ url: "course_1_query_2", deadline: "2026-10-26 09:35" }],
    currentResult: { status: "fulfilled", value: { data: () => ({}) } },
    byId: () => status, assignments: [], dayOverlay: { hidden: true }, eventOverlay: { hidden: true },
    renderCalendar: () => { renders++; },
    doc: (_db, name) => name, collection: (_db, name) => name,
    onSnapshot: (name, callback) => { callbacks[name] = callback; return () => { stops++; }; },
    window: { addEventListener: (name, callback) => { events[name] = callback; } },
  });
  vm.runInContext(source.slice(source.indexOf("function deadlineDate"), source.indexOf("function openDay")), context);
  vm.runInContext(source.slice(source.indexOf("// Keep the visible calendar")), context);
  callbacks.assignments({ data: () => ({ assignments: context.currentItems }) });
  assert.equal(context.assignmentState(context.assignments[0]), "overdue");
  callbacks.calendarAssignments({ docs: [{ data: () => ({ url: "course_1_query_2", submissionConfirmed: true }) }] });
  assert.equal(context.assignmentState(context.assignments[0]), "submitted");
  callbacks.assignments({ data: () => ({ assignments: context.currentItems }) });
  assert.equal(context.assignmentState(context.assignments[0]), "submitted");
  assert.equal(renders, 3);
  events.pagehide({ persisted: true });
  assert.equal(stops, 0);
  events.pagehide({ persisted: false });
  assert.equal(stops, 2);
});
