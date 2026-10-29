import { db, setupTheme, initializePage, loadProfileImage } from "./common.js?v=20261029-1";

import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { reportWrongAnswer } from "./question_report.js?v=20261021-2";
import { awardDailyQuestionPoints } from "./test_points.js";
import {
  loadTestSession,
  createNewTestSession,
  saveTestProgress,
  scrubberHtml,
  setupScrubber,
  finishTest,
} from "./test_session.js?v=20261021-2";
import {
  studyPointHtml,
  studySearchHtml,
  setupStudyTools,
  refreshTotalPoints,
} from "./study_tools.js";
import {
  startStudyTimer,
  stopExamStudyTimer,
  markQuestionShown,
  recordQuestionAttempt,
} from "./study_tracking.js?v=20261009-2";
import {
  questionExplanation,
  renderAnswerExplanation,
} from "./student_test_view.mjs?v=20261021-1";

const themeButton = document.getElementById("themeButton");
const topProfileImage = document.getElementById("topProfileImage");
const questions = document.getElementById("questions");

const params = new URLSearchParams(location.search);
const subjectId = params.get("subjectId");
const unitId = params.get("unitId");
let visibleFillBlank = [];
let currentFillIndex = 0;
let fillCompleted = false;
let subjectName = "科目";
let unitName = "単元";
let sessionPoints = 0;
let fillSession = null;
let sourceFillBlank = [];

setupTheme(themeButton);

document.getElementById("backButton").onclick = async () => {
  await stopExamStudyTimer("left-exam-page");
  history.back();
};

document.getElementById("profileButton").onclick = () => {
  location.href = document.documentElement.dataset.caremateRole === "admin" ? "admin.html" : "settings.html";
};

await initializePage([loadProfileImage(topProfileImage), loadQuestions()]);

async function loadQuestions() {
  if (!subjectId || !unitId) {
    questions.innerHTML = "科目または単元が指定されていません。";
    return;
  }

  const [snap, subjectSnap, unitSnap] = await Promise.all([
    getDoc(doc(
      db,
      "examSubjects",
      subjectId,
      "units",
      unitId,
      "publishedQuestions",
      "published",
    )),
    getDoc(doc(db, "examSubjects", subjectId)),
    getDoc(doc(db, "examSubjects", subjectId, "units", unitId)),
  ]);
  if (!subjectSnap.exists() || (subjectSnap.data().mode || "exam") !== "exam") {
    questions.textContent = "この問題は公開されていません。";
    return;
  }
  subjectName =
    subjectSnap.data()?.name || subjectSnap.data()?.subjectName || subjectId;
  unitName = unitSnap.data()?.name || unitSnap.data()?.unitName || unitId;

  if (!snap.exists()) {
    questions.innerHTML = "AI問題がありません。";
    return;
  }

  const data = snap.data();

  console.log("Firestoreから取得したAIデータ", data);
  console.log("穴埋め問題", data.fill_blank);

  const fillBlank = (data.fill_blank || []).filter(
    (q) =>
      q &&
      typeof q.question === "string" &&
      q.question.trim() !== "" &&
      ((Array.isArray(q.answers) &&
        q.answers.some((answer) => String(answer).trim() !== "")) ||
        String(q.answer || "").trim() !== ""),
  );
  const reviewIds = new Set(String(params.get("reviewIds") || "").split(",").filter(Boolean));
  sourceFillBlank = fillBlank.map((question, index) => ({
    ...question,
    _sessionId: String(question.id ?? `fill-${index}`),
  })).filter((question) => !reviewIds.size || reviewIds.has(question._sessionId));

  if (!sourceFillBlank.length) {
    questions.textContent = "AI問題がありません。";
    return;
  }

  fillSession = await loadTestSession(
    "fillBlank",
    subjectId,
    subjectName,
    unitId,
    sourceFillBlank.map((question) => ({ id: question._sessionId })),
  );
  applyFillSession();
  renderFillQuestion();
  await startStudyTimer({ source: "exam", subjectId, subjectName, unitId, unitName });

  sessionStorage.setItem("quizPlaying", "true");
}

function applyFillSession() {
  const byId = new Map(
    sourceFillBlank.map((question) => [question._sessionId, question]),
  );
  visibleFillBlank = fillSession.questionOrder
    .map((id) => byId.get(id))
    .filter(Boolean);
  currentFillIndex = Math.min(
    fillSession.currentIndex,
    Math.max(visibleFillBlank.length - 1, 0),
  );
}

async function startNewFillSession() {
  fillSession = createNewTestSession(
    sourceFillBlank.map((question) => ({ id: question._sessionId })),
  );
  applyFillSession();
  await saveTestProgress(
    "fillBlank",
    subjectId,
    subjectName,
    unitId,
    currentFillIndex,
    visibleFillBlank.length,
    false,
    fillSession,
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderQuestionImage(question) {
  const imageUrl = String(question?.imageUrl || "").trim();

  if (!imageUrl) {
    return "";
  }

  const description = String(question?.imageDescription || "").trim();

  return `
        <figure class="test-question-image">

            <img
                src="${escapeHtml(imageUrl)}"
                alt="${escapeHtml(description || "問題画像")}"
                loading="lazy">

            ${
              description
                ? `
                        <figcaption>
                            ${escapeHtml(description)}
                        </figcaption>
                    `
                : ""
            }

        </figure>
    `;
}

function renderFillQuestion() {
  markQuestionShown();
  const q = visibleFillBlank[currentFillIndex];
  const answers =
    q.answers && q.answers.length > 0 ? q.answers : [q.answer || ""];
  questions.innerHTML = `
            <div class="test-progress"><span style="width:${((currentFillIndex + 1) / visibleFillBlank.length) * 100}%"></span></div>
            <div
                class="card setting-card fill-card test-focus-card"
                data-question="${currentFillIndex}"
                data-answer="${escapeHtml(q.answer || answers.join("・"))}"
                data-answers='${escapeHtml(JSON.stringify(answers))}'>

                <div class="test-context-line"><b>${escapeHtml(subjectName)}</b><span>›</span><span>${escapeHtml(unitName)}</span></div>
                <div class="test-question-heading">
                  <span class="test-content-label">問題</span>
                  <div class="test-question-number">${currentFillIndex + 1} / ${visibleFillBlank.length}</div>
                </div>

                <h2 class="test-question-text">${escapeHtml(q.question)}</h2>

                ${studyPointHtml(4)}

                ${renderQuestionImage(q)}

                <section class="test-content-section">
                  <div class="test-content-section-heading">
                    <span class="test-content-label">解答欄</span>
                    <small>${answers.length > 1 ? `${answers.length}か所すべて入力` : "答えを入力"}</small>
                  </div>
                  <div class="test-fill-inputs">
                    ${answers
                      .map(
                        (_answer, answerIndex) => `
                        <input
                            class="fill-answer"
                            type="text"
                            autocomplete="off"
                            placeholder="解答 ${answerIndex + 1}">
                    `,
                      )
                      .join("")}
                  </div>
                </section>

                <button class="btn btn-primary check-fill">
                    判定
                </button>

                <div class="test-result-panel" hidden>
                    <div class="test-result-summary">
                      <div class="test-mark"></div>
                      <div class="fill-result test-result-label"></div>
                    </div>
                    ${renderAnswerExplanation({
                      answerLines: answers,
                      explanation: questionExplanation(q),
                    })}
                    <button class="btn btn-primary next-fill-question">${currentFillIndex + 1 < visibleFillBlank.length ? "次の問題" : "結果を終了"}</button>
                </div>

                <button
                    type="button"
                    class="test-report-link report-wrong-answer"
                    data-question-index="${currentFillIndex}">
                    違います
                </button>
            </div>${scrubberHtml(currentFillIndex, visibleFillBlank.length)}${studySearchHtml()}
        `;
  setupScrubber(questions, (index) => {
    currentFillIndex = index;
    renderFillQuestion();
    saveTestProgress(
      "fillBlank",
      subjectId,
      subjectName,
      unitId,
      currentFillIndex,
      visibleFillBlank.length,
      false,
      fillSession,
    );
  });
  setupStudyTools(questions);
}

document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("next-fill-question")) {
    if (currentFillIndex + 1 < visibleFillBlank.length) {
      currentFillIndex++;
      renderFillQuestion();
      await saveTestProgress(
        "fillBlank",
        subjectId,
        subjectName,
        unitId,
        currentFillIndex,
        visibleFillBlank.length,
        false,
        fillSession,
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      fillCompleted = true;
      sessionStorage.removeItem("quizPlaying");
      await stopExamStudyTimer("exam-completed");
      await saveTestProgress(
        "fillBlank",
        subjectId,
        subjectName,
        unitId,
        currentFillIndex,
        visibleFillBlank.length,
        true,
        fillSession,
      );
      finishTest(
        sessionPoints,
        async () => {
          fillCompleted = false;
          await startNewFillSession();
          sessionPoints = 0;
          renderFillQuestion();
        },
        () => (location.href = "exam.html"),
      );
    }
    return;
  }

  if (e.target.classList.contains("report-wrong-answer")) {
    const index = Number(e.target.dataset.questionIndex);
    const q = visibleFillBlank[index];

    if (q) {
      await reportWrongAnswer(e.target, {
        questionType: "fillBlank",
        subjectId,
        unitId,
        questionId: String(q.id ?? index),
        question: q.question,
        registeredAnswer: q.answers || q.answer || "",
      });
    }

    return;
  }

  if (!e.target.classList.contains("check-fill")) return;

  const card = e.target.closest(".fill-card");

  if (card.dataset.finished === "true") {
    return;
  }
  const result = card.querySelector(".fill-result");
  const panel = card.querySelector(".test-result-panel");

  const correctAnswers = JSON.parse(card.dataset.answers || "[]").map(
    (answer) => normalizeAnswer(answer),
  );

  const userAnswers = Array.from(card.querySelectorAll(".fill-answer"))
    .map((input) => normalizeAnswer(input.value))
    .filter((answer) => answer !== "");

  const allCorrect =
    correctAnswers.length === userAnswers.length &&
    correctAnswers.every((answer) => userAnswers.includes(answer));
  const activeQuestion = visibleFillBlank[currentFillIndex];
  await recordQuestionAttempt({
    type: "fillBlank",
    subjectId,
    subjectName,
    unitId,
    unitName,
    questionId: String(activeQuestion._sessionId),
    question: activeQuestion.question,
    correctAnswer: correctAnswers,
    selectedAnswer: userAnswers,
    correct: allCorrect,
  });

  card.dataset.finished = "true";
  card
    .querySelectorAll("input, .check-fill")
    .forEach((element) => (element.disabled = true));
  panel.hidden = false;

  if (allCorrect) {
    result.textContent = "正解！";
    panel.classList.add("correct");
    panel.querySelector(".test-mark").textContent = "○";

    const awarded = await awardDailyQuestionPoints({
      type: "fillBlank",
      points: 4,
      subjectId,
      subjectName,
      unitId,
      questionId: String(
        visibleFillBlank[currentFillIndex].id ?? currentFillIndex,
      ),
    });
    if (awarded.awarded) {
      sessionPoints += 4;
      panel.insertAdjacentHTML(
        "afterbegin",
        '<div class="point-earned-effect">＋4pt</div>',
      );
      await refreshTotalPoints(questions);
    }
  } else {
    result.textContent = "不正解";
    panel.classList.add("wrong");
    panel.querySelector(".test-mark").textContent = "×";
  }

  await saveTestProgress(
    "fillBlank",
    subjectId,
    subjectName,
    unitId,
    currentFillIndex,
    visibleFillBlank.length,
    false,
    fillSession,
  );
});

function normalizeAnswer(text) {
  return text.trim().replace(/\s/g, "").replace(/　/g, "").toLowerCase();
}

window.addEventListener("beforeunload", (e) => {
  if (fillCompleted || !visibleFillBlank.length) return;

  e.preventDefault();

  e.returnValue = "";
});
