import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  summarizeStudyData,
  aggregateBySubject,
  problemStats,
  weakAreaRanking,
  nextReviewAt,
  sessionsToCsv,
} from "./study_analytics_model.mjs";

const day = 86_400_000;
const now = new Date("2026-10-09T12:00:00+09:00");

test("学習時間を今日・週・月・累計で重複なく集計する", () => {
  const sessions = [
    { durationSeconds: 3600, endedAt: new Date("2026-10-09T10:00:00+09:00") },
    { durationSeconds: 1800, endedAt: new Date("2026-10-05T10:00:00+09:00") },
    { durationSeconds: 7200, endedAt: new Date("2026-09-01T10:00:00+09:00") },
  ];
  const summary = summarizeStudyData(sessions, [], now);
  assert.equal(summary.todaySeconds, 3600);
  assert.equal(summary.weekSeconds, 5400);
  assert.equal(summary.monthSeconds, 5400);
  assert.equal(summary.totalSeconds, 12_600);
});

test("同じ問題の総解答回数と解答済み問題数を区別する", () => {
  const attempts = [
    { questionKey: "q1", correct: false, answeredAt: now },
    { questionKey: "q1", correct: true, answeredAt: new Date(now.getTime() + 1000) },
    { questionKey: "q2", correct: true, answeredAt: now },
  ];
  const summary = summarizeStudyData([], attempts, now);
  assert.equal(summary.totalAttempts, 3);
  assert.equal(summary.uniqueAnswered, 2);
  assert.equal(summary.correctCount, 2);
  assert.equal(Math.round(summary.accuracy), 67);
});

test("科目別時間と正答率を同じ科目に集約する", () => {
  const rows = aggregateBySubject(
    [{ subjectId: "mental", subjectName: "精神看護学", durationSeconds: 3600 }],
    [
      { subjectId: "mental", subjectName: "精神看護学", correct: true, responseSeconds: 20 },
      { subjectId: "mental", subjectName: "精神看護学", correct: false, responseSeconds: 40 },
    ],
  );
  assert.equal(rows[0].seconds, 3600);
  assert.equal(rows[0].attempts, 2);
  assert.equal(rows[0].accuracy, 50);
  assert.equal(rows[0].averageResponseSeconds, 30);
});

test("問題ごとの改善・連続正解・苦手判定を履歴から作る", () => {
  const attempts = [
    { questionKey: "q1", question: "問題1", correct: false, answeredAt: new Date(now.getTime() - 2 * day) },
    { questionKey: "q1", question: "問題1", correct: true, answeredAt: new Date(now.getTime() - day) },
    { questionKey: "q1", question: "問題1", correct: true, answeredAt: now },
  ];
  const row = problemStats(attempts)[0];
  assert.equal(row.improved, true);
  assert.equal(row.consecutiveCorrect, 2);
  assert.equal(row.incorrect, 1);
  const weak = weakAreaRanking([{ name: "A", attempts: 8, accuracy: 40, dataSufficient: true }, { name: "B", attempts: 2, accuracy: 0, dataSufficient: false }]);
  assert.equal(weak[0].name, "A");
});

test("復習日は不正解の翌日から段階的に延長する", () => {
  const incorrectAt = new Date("2026-10-01T10:00:00+09:00");
  assert.equal(nextReviewAt([{ correct: false, answeredAt: incorrectAt }]), incorrectAt.getTime() + day);
});

test("CSVは自主学習とテスト対策を区別して出力する", () => {
  const csv = sessionsToCsv([{ source: "exam", subjectName: "精神看護学", durationSeconds: 600, startedAt: now, endedAt: now }]);
  assert.match(csv, /テスト対策問題/);
  assert.match(csv, /精神看護学/);
});

test("ホーム導線、共通タイマー、既存問題画面、本人限定ルールが接続されている", async () => {
  const [home, requests, common, tracking, quiz, fill, daily, rules, page, styles] = await Promise.all([
    readFile(new URL("./index.html", import.meta.url), "utf8"),
    readFile(new URL("./requests.html", import.meta.url), "utf8"),
    readFile(new URL("./common.js", import.meta.url), "utf8"),
    readFile(new URL("./study_tracking.js", import.meta.url), "utf8"),
    readFile(new URL("./quiz.js", import.meta.url), "utf8"),
    readFile(new URL("./fill_blank.js", import.meta.url), "utf8"),
    readFile(new URL("./daily_question.js", import.meta.url), "utf8"),
    readFile(new URL("./firestore.rules", import.meta.url), "utf8"),
    readFile(new URL("./study_analytics.html", import.meta.url), "utf8"),
    readFile(new URL("./style.css", import.meta.url), "utf8"),
  ]);
  assert.match(home, /自己学習・学習分析/);
  assert.doesNotMatch(requests, /study_analytics\.html/);
  assert.match(common, /initializeGlobalStudyTracking/);
  assert.match(tracking, /\["running", "paused"\]\.includes\(state\.status\)/);
  assert.match(tracking, /state\?\.source === "exam" && state\.route !== currentPage/);
  assert.match(quiz, /recordQuestionAttempt/);
  assert.match(fill, /recordQuestionAttempt/);
  assert.match(daily, /recordQuestionAttempt/);
  assert.match(rules, /match \/studySessions\/\{sessionId\}/);
  assert.match(rules, /allow read, create, update, delete: if isUserOwner\(\)/);
  assert.match(page, /data-study-tab="questions"/);
  assert.match(page, /id="exportStudyCsv"/);
  assert.match(page, /class="study-secondary-summary"/);
  assert.match(page, /data-summary-tone="today"/);
  assert.match(styles, /\.study-analytics-body \{ padding-bottom: 104px; overflow-x: hidden; \}/);
  assert.match(styles, /\.study-subtabs \{ top: 61px; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.study-table-row\.is-heading \{ display: none; \}/);
});
