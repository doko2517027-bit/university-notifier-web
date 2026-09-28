import test from "node:test";
import assert from "node:assert/strict";
import { isSubjectInMode, getModeCategories, groupCatalogItems, parseExamSchedule } from "./exam_catalog.mjs";

test("existing subjects remain in regular exam mode", () => {
  assert.equal(isSubjectInMode({ name: "既存科目" }, "exam"), true);
  assert.equal(isSubjectInMode({ name: "既存科目" }, "national"), false);
  assert.equal(isSubjectInMode({ mode: "national" }, "national"), true);
});

test("category choices stay separate between regular and national exams", () => {
  const categories = [
    { id: "first", name: "2026年前期", mode: "exam" },
    { id: "national", name: "国家試験", mode: "national" },
  ];
  assert.deepEqual(getModeCategories(categories, "exam").map((item) => item.id), ["first"]);
  assert.deepEqual(getModeCategories(categories, "national").map((item) => item.id), ["national"]);
});

test("old and deleted-category subjects remain visible under unclassified", () => {
  const items = [
    { name: "A", groupId: "first" },
    { name: "B" },
    { name: "C", groupId: "removed" },
  ];
  const groups = groupCatalogItems(items, [{ id: "first", name: "2026年前期" }], (item) => item.groupId);
  assert.deepEqual(groups.map((group) => [group.name, group.items.map((item) => item.name)]), [
    ["2026年前期", ["A"]],
    ["未分類", ["B", "C"]],
  ]);
});

test("exam schedule accepts the full-width separator shown in the editor", () => {
  assert.deepEqual(parseExamSchedule("2026-07-20｜成人看護学｜09:00〜10:30｜301教室"), [
    { date: "2026-07-20", subject: "成人看護学", time: "09:00〜10:30", room: "301教室" },
  ]);
});
