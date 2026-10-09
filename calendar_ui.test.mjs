import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("日付の予定はカレンダー下ではなくポップアップに表示する", async () => {
  const [page, script, styles] = await Promise.all([
    readFile(new URL("./calendar.html", import.meta.url), "utf8"),
    readFile(new URL("./calendar.js", import.meta.url), "utf8"),
    readFile(new URL("./style.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /id="calendarDayOverlay"/);
  assert.match(page, /class="calendar-dialog calendar-day-dialog"/);
  assert.doesNotMatch(page, /<section class="card calendar-agenda"/);
  assert.match(script, /openDayPopup\(button\.dataset\.date\)/);
  assert.match(script, /\$\("calendarDayOverlay"\)\.hidden = false/);
  assert.match(script, /event\.target\.id === "calendarDayOverlay"/);
  assert.match(styles, /\.calendar-day-dialog \{ width: min\(600px, 100%\)/);
  assert.match(styles, /#calendarDayEvents \{ max-height:/);
});
