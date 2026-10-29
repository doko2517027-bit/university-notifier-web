import { db, setupTheme, initializePage, loadProfileImage } from "./common.js?v=20261029-1";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {
  answerLinesForChoices,
  escapeStudentText,
  questionExplanation,
  renderAnswerExplanation,
} from "./student_test_view.mjs?v=20261021-1";

const params = new URLSearchParams(location.search);
const subjectId = params.get("subjectId");
const unitId = params.get("unitId");
const root = document.getElementById("questionListArea");
let allQuestions = [];
let activeType = "all";
let searchText = "";
let subjectName = "科目";
let unitName = "単元";

setupTheme(document.getElementById("themeButton"));
document.getElementById("backButton").onclick = () => history.back();
document.getElementById("profileButton").onclick = () => {
  location.href = document.documentElement.dataset.caremateRole === "admin"
    ? "admin.html"
    : "settings.html";
};

await initializePage([
  loadProfileImage(document.getElementById("topProfileImage")),
  loadQuestionList(),
]);

function normalizeQuestionItems(data) {
  const quiz = (Array.isArray(data.quiz) ? data.quiz : [])
    .filter((item) => item && String(item.question || "").trim())
    .map((item, index) => ({
      ...item,
      key: `quiz-${item.id ?? index}`,
      type: "quiz",
      typeLabel: "選択問題",
      choices: Array.isArray(item.choices) ? item.choices : [],
      answerLines: answerLinesForChoices(
        item,
        Array.isArray(item.answers) && item.answers.length
          ? item.answers
          : [item.answer],
      ),
    }));
  const fillBlank = (Array.isArray(data.fill_blank) ? data.fill_blank : [])
    .filter((item) => item && String(item.question || "").trim())
    .map((item, index) => ({
      ...item,
      key: `fill-${item.id ?? index}`,
      type: "fillBlank",
      typeLabel: "穴埋め問題",
      choices: [],
      answerLines: (Array.isArray(item.answers) && item.answers.length
        ? item.answers
        : [item.answer]
      ).map((answer) => String(answer ?? "")),
    }));
  const qa = (Array.isArray(data.qa) ? data.qa : [])
    .filter((item) => item && String(item.question || "").trim())
    .map((item, index) => ({
      ...item,
      key: `qa-${item.id ?? index}`,
      type: "qa",
      typeLabel: "一問一答",
      choices: [],
      answerLines: [String(item.answer ?? "")],
    }));
  return [...quiz, ...fillBlank, ...qa];
}

async function loadQuestionList() {
  if (!subjectId || !unitId) {
    root.innerHTML = '<div class="card setting-card">科目または単元が指定されていません。</div>';
    return;
  }
  const [subjectSnap, unitSnap, publishedSnap] = await Promise.all([
    getDoc(doc(db, "examSubjects", subjectId)),
    getDoc(doc(db, "examSubjects", subjectId, "units", unitId)),
    getDoc(doc(db, "examSubjects", subjectId, "units", unitId, "publishedQuestions", "published")),
  ]);
  if (!subjectSnap.exists() || (subjectSnap.data().mode || "exam") !== "exam") {
    root.innerHTML = '<div class="card setting-card">この問題は公開されていません。</div>';
    return;
  }
  subjectName = subjectSnap.data()?.name || subjectSnap.data()?.subjectName || subjectId;
  unitName = unitSnap.data()?.name || unitSnap.data()?.unitName || unitId;
  allQuestions = publishedSnap.exists()
    ? normalizeQuestionItems(publishedSnap.data() || {})
    : [];
  renderPage();
}

function countFor(type) {
  return type === "all"
    ? allQuestions.length
    : allQuestions.filter((item) => item.type === type).length;
}

function renderControls() {
  const filters = [
    ["all", "すべて"],
    ["quiz", "選択問題"],
    ["fillBlank", "穴埋め"],
    ["qa", "一問一答"],
  ];
  return `
    <section class="question-list-toolbar" aria-label="問題一覧の絞り込み">
      <label class="question-list-search">
        <span aria-hidden="true">⌕</span>
        <input id="questionListSearch" type="search" value="${escapeStudentText(searchText)}" placeholder="問題・選択肢・答え・解説から検索" />
      </label>
      <div class="question-list-filters">
        ${filters.map(([value, label]) => `
          <button type="button" class="question-list-filter ${activeType === value ? "is-active" : ""}" data-question-filter="${value}">
            <span>${label}</span><b>${countFor(value)}</b>
          </button>`).join("")}
      </div>
    </section>`;
}

function renderChoices(item) {
  if (!item.choices.length) {
    return '<p class="question-list-no-choices">この問題形式には選択肢はありません。</p>';
  }
  return `<ol class="question-list-choices">${item.choices
    .map((choice) => `<li>${escapeStudentText(choice)}</li>`)
    .join("")}</ol>`;
}

function renderQuestionCard(item, number) {
  return `
    <article class="question-list-card">
      <header class="question-list-card-header">
        <span class="test-content-label">${escapeStudentText(item.typeLabel)}</span>
        <small>問題 ${number}</small>
      </header>
      <section class="question-list-block is-question">
        <b>問題</b>
        <p>${escapeStudentText(item.question)}</p>
      </section>
      <section class="question-list-block is-choices">
        <b>選択肢</b>
        ${renderChoices(item)}
      </section>
      ${renderAnswerExplanation({
        answerLines: item.answerLines,
        explanation: questionExplanation(item),
      })}
    </article>`;
}

function filteredQuestions() {
  const needle = searchText.trim().toLocaleLowerCase("ja");
  return allQuestions.filter((item) => {
    if (activeType !== "all" && item.type !== activeType) return false;
    if (!needle) return true;
    const haystack = [
      item.question,
      ...(item.choices || []),
      ...(item.answerLines || []),
      questionExplanation(item),
    ].join(" ").toLocaleLowerCase("ja");
    return haystack.includes(needle);
  });
}

function renderPage() {
  const visible = filteredQuestions();
  root.innerHTML = `
    <section class="question-list-hero">
      <div class="test-context-line"><b>${escapeStudentText(subjectName)}</b><span>›</span><span>${escapeStudentText(unitName)}</span></div>
      <h1>登録問題一覧</h1>
      <p>問題・選択肢・答え・解説を、登録されている文章のまま確認できます。</p>
    </section>
    ${renderControls()}
    <div class="question-list-result-line"><b>${visible.length}</b>問を表示</div>
    <section class="question-list-grid">
      ${visible.length
        ? visible.map((item) => renderQuestionCard(item, allQuestions.indexOf(item) + 1)).join("")
        : '<div class="card setting-card question-list-empty">該当する問題はありません。</div>'}
    </section>`;
  const search = document.getElementById("questionListSearch");
  search?.addEventListener("input", (event) => {
    searchText = event.target.value;
    renderPage();
    document.getElementById("questionListSearch")?.focus();
  });
}

root.addEventListener("click", (event) => {
  const filter = event.target.closest("[data-question-filter]");
  if (!filter) return;
  activeType = filter.dataset.questionFilter;
  renderPage();
});
