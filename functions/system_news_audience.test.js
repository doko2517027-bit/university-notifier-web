const test = require("node:test");
const assert = require("node:assert/strict");
const {
  targetedSystemNewsMatchesStudent,
  targetedSystemNewsPredatesRegistration,
  targetedSystemNewsCopy,
  targetedSystemNewsContentSignature,
} = require("./system_news_audience");

test("個人指定は指定した学生だけに一致する", () => {
  const news = { audienceMode: "only", targetStudentNumbers: ["2510001"] };
  assert.equal(targetedSystemNewsMatchesStudent(news, "2510001", { grade: "2年" }), true);
  assert.equal(targetedSystemNewsMatchesStudent(news, "2510002", { grade: "2年" }), false);
});

test("学年指定は後から登録した同学年の学生にも一致する", () => {
  const news = { audienceMode: "grade", targetGrades: ["2"] };
  assert.equal(targetedSystemNewsMatchesStudent(news, "2510099", { grade: "2年" }), true);
  assert.equal(targetedSystemNewsMatchesStudent(news, "2610001", { grade: "1年" }), false);
});

test("除外指定は新規登録者も除外一覧になければ一致する", () => {
  const news = { audienceMode: "exclude", excludedStudentNumbers: ["2510001"] };
  assert.equal(targetedSystemNewsMatchesStudent(news, "2510001", {}), false);
  assert.equal(targetedSystemNewsMatchesStudent(news, "2510099", {}), true);
});

test("新規登録前から存在するお知らせは対象条件外でも初回表示できる", () => {
  const news = {
    audienceMode: "only",
    targetStudentNumbers: ["2510001"],
    createdAt: new Date("2026-10-01T00:00:00Z"),
  };
  const newlyRegisteredUser = {
    studentPageVerifiedAt: "2026-10-08T00:00:00Z",
  };
  assert.equal(
    targetedSystemNewsPredatesRegistration(news, newlyRegisteredUser),
    true,
  );
});

test("登録後に投稿された対象外のお知らせは新規登録者にも表示しない", () => {
  const news = { createdAt: new Date("2026-10-08T00:00:00Z") };
  const user = { createdAt: new Date("2026-10-01T00:00:00Z") };
  assert.equal(targetedSystemNewsPredatesRegistration(news, user), false);
});

test("学生用コピーには装飾本文も保持する", () => {
  const copied = targetedSystemNewsCopy({
    title: "案内",
    body: "本文",
    bodyHtml: "<strong>本文</strong>",
    format: { richText: true },
  }, "news-1");
  assert.equal(copied.bodyHtml, "<strong>本文</strong>");
  assert.equal(copied.sourceNewsId, "news-1");
});

test("配信結果だけの更新では同期シグネチャが変化しない", () => {
  const before = { title: "案内", targetGrades: ["2"] };
  const after = { ...before, notificationSentAt: new Date(), notificationResults: [] };
  assert.equal(
    targetedSystemNewsContentSignature(before),
    targetedSystemNewsContentSignature(after),
  );
});
