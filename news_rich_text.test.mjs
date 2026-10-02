import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { richNewsHtmlFromText } from "./news_rich_text.mjs";

const [adminHtml, adminJs, studentJs, helperSource] = await Promise.all([
  readFile(new URL("./system_news_admin.html", import.meta.url), "utf8"),
  readFile(new URL("./system_news_admin.js", import.meta.url), "utf8"),
  readFile(new URL("./news.js", import.meta.url), "utf8"),
  readFile(new URL("./news_rich_text.mjs", import.meta.url), "utf8"),
]);

test("通常本文をHTMLへ変換する時にタグを実行しない", () => {
  assert.equal(
    richNewsHtmlFromText("1行目\n<script>alert(1)</script>"),
    "1行目<br>&lt;script&gt;alert(1)&lt;/script&gt;",
  );
});

test("管理画面は選択範囲の文字サイズ・色・太字・下線・フォントを編集できる", () => {
  for (const command of ["bold", "underline", "fontSize", "foreColor", "fontName", "removeFormat"]) {
    assert.match(adminHtml, new RegExp(`data-rich-command="${command}"`));
  }
  assert.match(adminHtml, /systemNewsPreviewBody/);
  assert.match(adminHtml, /editSystemNewsPreviewBody/);
  assert.match(adminJs, /bodyHtml/);
  assert.match(adminJs, /getRichNewsEditorHtml/);
});

test("保存HTMLは管理画面と学生画面の両方で安全化して表示する", () => {
  assert.match(adminJs, /sanitizeRichNewsHtml/);
  assert.match(studentJs, /sanitizeRichNewsHtml\(notice\.bodyHtml\)/);
  assert.match(helperSource, /ALLOWED_TAGS/);
  assert.match(helperSource, /element\.removeAttribute/);
  assert.match(helperSource, /SCRIPT/);
});

