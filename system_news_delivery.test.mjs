import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [adminHtml, adminJs, commonJs, newsJs, functionsJs] = await Promise.all([
  readFile(new URL("./system_news_admin.html", import.meta.url), "utf8"),
  readFile(new URL("./system_news_admin.js", import.meta.url), "utf8"),
  readFile(new URL("./common.js", import.meta.url), "utf8"),
  readFile(new URL("./news.js", import.meta.url), "utf8"),
  readFile(new URL("./functions/index.js", import.meta.url), "utf8"),
]);

test("新規登録者も管理画面の配信先へ出すためusersを正本として読む", () => {
  assert.match(adminJs, /getDocs\(collection\(db, "users"\)\)/);
  assert.match(adminJs, /publicProfile/);
});

test("学年指定は条件として保存し、後から登録した学生にも表示する", () => {
  assert.match(adminHtml, /value="grade"/);
  assert.match(adminHtml, /後から登録した学生にも表示/);
  assert.match(adminJs, /targetGrades: recipientMode === "grade"/);
  assert.match(functionsJs, /backfillTargetedSystemNewsForNewUser/);
});

test("学生画面は個別お知らせを再同期し未読件数にも含める", () => {
  assert.match(commonJs, /syncTargetedSystemNewsInbox/);
  assert.match(commonJs, /targetedSystemSnapshot\.forEach/);
  assert.match(newsJs, /await syncTargetedSystemNewsInbox\(\)/);
});

test("個別お知らせの装飾本文と編集内容も学生用受信箱へ同期する", () => {
  assert.match(functionsJs, /targetedSystemNewsCopy/);
  assert.match(functionsJs, /syncUpdatedTargetedSystemNews/);
});

test("投稿先の学生選択はチェックボックスと選択人数で表示する", () => {
  assert.match(adminHtml, /id="systemNewsRecipientChecklist"/);
  assert.match(adminHtml, /id="systemNewsRecipientCount"/);
  assert.match(adminJs, /input\[data-student-number\]:checked/);
  assert.doesNotMatch(adminHtml, /id="systemNewsRecipientSelect"/);
});

test("編集画面から対象学生と通知有無を変更できる", () => {
  assert.match(adminHtml, /id="editSystemNewsRecipientMode"/);
  assert.match(adminHtml, /id="editSystemNewsRecipientChecklist"/);
  assert.match(adminHtml, /id="editSystemNewsNotification"/);
  assert.match(adminJs, /destinationCollection === sourceCollection/);
  assert.match(adminJs, /editNotificationRequestedAt/);
  assert.match(functionsJs, /targeted-system-news-update-/);
});

test("新規登録前からあるCareMateお知らせを初回受信箱へ同期する", () => {
  assert.match(functionsJs, /targetedSystemNewsPredatesRegistration/);
  assert.match(functionsJs, /syncTargetedSystemNewsForStudent/);
});
