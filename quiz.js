import { db, setupTheme, initializePage, loadProfileImage } from "./common.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { reportWrongAnswer } from "./question_report.js";
import { awardDailyQuestionPoints } from "./test_points.js";
import {
  loadTestSession,
  createNewTestSession,
  saveTestProgress,
  scrubberHtml,
  setupScrubber,
  finishTest,
} from "./test_session.js";
import {
  studyPointHtml,
  studySearchHtml,
  setupStudyTools,
  refreshTotalPoints,
} from "./study_tools.js";

const themeButton = document.getElementById("themeButton");
const topProfileImage = document.getElementById("topProfileImage");
const quizArea = document.getElementById("quizArea");
const params = new URLSearchParams(location.search);
const subjectId = params.get("subjectId");
const unitId = params.get("unitId");
let visibleQuiz = [];
let currentIndex = 0;
let completed = false;
let subjectName = "科目";
let sessionPoints = 0;
let quizSession = null;
let sourceQuiz = [];

setupTheme(themeButton);
document.getElementById("backButton").onclick = () => history.back();
document.getElementById("profileButton").onclick = () =>
  (location.href = "profile.html");
await initializePage([loadProfileImage(topProfileImage), loadQuiz()]);

async function loadQuiz() {
  if (!subjectId || !unitId) {
    quizArea.textContent = "科目または単元が指定されていません。";
    return;
  }
  const [snap, subjectSnap] = await Promise.all([
    getDoc(
      doc(
        db,
        "examSubjects",
        subjectId,
        "units",
        unitId,
        "publishedQuestions",
        "published",
      ),
    ),
    getDoc(doc(db, "examSubjects", subjectId)),
  ]);
  subjectName =
    subjectSnap.data()?.name || subjectSnap.data()?.subjectName || subjectId;
  if (!snap.exists()) {
    quizArea.textContent = "四択問題はまだありません。";
    return;
  }
  sourceQuiz = (snap.data().quiz || [])
    .filter(
    (q) =>
      q &&
      String(q.question || "").trim() &&
      Array.isArray(q.choices) &&
      q.choices.length &&
      q.answer !== undefined &&
      q.answer !== null,
    )
    .map((question, index) => ({
      ...question,
      _sessionId: String(question.id ?? `quiz-${index}`),
    }));
  if (!sourceQuiz.length) {
    quizArea.textContent = "四択問題はまだありません。";
    return;
  }
  sessionStorage.setItem("quizPlaying", "true");
  quizSession = await loadTestSession(
    "quiz",
    subjectId,
    subjectName,
    unitId,
    sourceQuiz.map((question) => ({
      id: question._sessionId,
      choiceCount: question.choices.length,
    })),
  );
  applyQuizSession();
  renderQuestion();
}

function applyQuizSession() {
  const byId = new Map(sourceQuiz.map((question) => [question._sessionId, question]));
  visibleQuiz = quizSession.questionOrder.map((id) => byId.get(id)).filter(Boolean);
  currentIndex = Math.min(quizSession.currentIndex, Math.max(visibleQuiz.length - 1, 0));
}

async function startNewQuizSession() {
  quizSession = createNewTestSession(
    sourceQuiz.map((question) => ({
      id: question._sessionId,
      choiceCount: question.choices.length,
    })),
  );
  applyQuizSession();
  await saveTestProgress("quiz", subjectId, subjectName, unitId, currentIndex, visibleQuiz.length, false, quizSession);
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

function renderQuestion() {
  const q = visibleQuiz[currentIndex];
  const choiceOrder = quizSession?.choiceOrders?.[q._sessionId] || q.choices.map((_, index) => index);
  const correctAnswers =
    Array.isArray(q.answers) && q.answers.length > 1
      ? q.answers.map(Number)
      : [Number(q.answer)];
  const isMultiple = correctAnswers.length > 1;
  quizArea.innerHTML = `
        <div class="test-progress"><span style="width:${((currentIndex + 1) / visibleQuiz.length) * 100}%"></span></div>
        <div class="card setting-card test-focus-card quiz-card" data-answers='${JSON.stringify(correctAnswers)}' data-multiple="${isMultiple}">
            <div class="test-question-number">問題 ${currentIndex + 1} / ${visibleQuiz.length}</div>
            <h2 class="test-question-text">${escapeHtml(q.question)}</h2>

            ${studyPointHtml(2)}

            ${renderQuestionImage(q)}

            <div class="test-choice-list">
                ${choiceOrder.map((choiceIndex, displayIndex) => `<button class="test-choice quiz-answer" data-index="${choiceIndex}"><b>${displayIndex + 1}</b><span>${escapeHtml(q.choices[choiceIndex])}</span></button>`).join("")}
            </div>
            ${isMultiple ? '<button class="btn btn-primary check-quiz" disabled>選択した答えを判定</button>' : ""}
            <div class="test-result-panel" hidden>
                <div class="test-mark" aria-hidden="true"></div>
                <div class="test-result-label"></div>
                ${q.explanation ? `<div class="test-explanation"><b>解説</b><p>${escapeHtml(q.explanation)}</p></div>` : ""}
                <button class="btn btn-primary next-question">${currentIndex + 1 < visibleQuiz.length ? "次の問題" : "結果を終了"}</button>
            </div>
            <button type="button" class="test-report-link report-wrong-answer">答えが違います</button>
        </div>${scrubberHtml(currentIndex, visibleQuiz.length)}${studySearchHtml()}`;
  setupScrubber(quizArea, (index) => {
    currentIndex = index;
    renderQuestion();
    saveTestProgress(
      "quiz",
      subjectId,
      subjectName,
      unitId,
      currentIndex,
      visibleQuiz.length,
      false,
      quizSession,
    );
  });
  setupStudyTools(quizArea);
}

document.addEventListener("click", async (event) => {
  if (event.target.closest(".report-wrong-answer")) {
    const q = visibleQuiz[currentIndex];
    await reportWrongAnswer(event.target.closest(".report-wrong-answer"), {
      questionType: "quiz",
      subjectId,
      unitId,
      questionId: String(q.id ?? currentIndex),
      question: q.question,
      registeredAnswer: q.answer,
      choices: q.choices,
    });
    return;
  }

  const next = event.target.closest(".next-question");
  if (next) {
    if (currentIndex + 1 < visibleQuiz.length) {
      currentIndex++;
      renderQuestion();
      await saveTestProgress(
        "quiz",
        subjectId,
        subjectName,
        unitId,
        currentIndex,
        visibleQuiz.length,
        false,
        quizSession,
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      completed = true;
      sessionStorage.removeItem("quizPlaying");
      await saveTestProgress(
        "quiz",
        subjectId,
        subjectName,
        unitId,
        currentIndex,
        visibleQuiz.length,
        true,
        quizSession,
      );
      finishTest(
        sessionPoints,
        async () => {
          completed = false;
          await startNewQuizSession();
          sessionPoints = 0;
          renderQuestion();
        },
        () => (location.href = "exam.html"),
      );
    }
    return;
  }

  const answerButton = event.target.closest(".quiz-answer");
  const checkButton = event.target.closest(".check-quiz");
  if (!answerButton && !checkButton) return;
  const card = (answerButton || checkButton).closest(".quiz-card");
  if (card.dataset.finished === "true") return;
  const correctAnswers = JSON.parse(card.dataset.answers || "[]").map(Number);
  if (answerButton && card.dataset.multiple === "true") {
    answerButton.classList.toggle("is-selected");
    const selected = card.querySelectorAll(".quiz-answer.is-selected").length;
    card.querySelector(".check-quiz").disabled = selected === 0;
    return;
  }
  const selectedAnswers = answerButton
    ? [Number(answerButton.dataset.index)]
    : Array.from(card.querySelectorAll(".quiz-answer.is-selected")).map(
        (button) => Number(button.dataset.index),
      );
  if (!selectedAnswers.length) return;
  card.dataset.finished = "true";
  const isCorrect =
    selectedAnswers.length === correctAnswers.length &&
    correctAnswers.every((answer) => selectedAnswers.includes(answer));
  card.querySelectorAll(".test-choice").forEach((button) => {
    button.disabled = true;
    const choiceIndex = Number(button.dataset.index);
    if (correctAnswers.includes(choiceIndex)) button.classList.add("is-correct");
    if (selectedAnswers.includes(choiceIndex) && !correctAnswers.includes(choiceIndex)) button.classList.add("is-wrong");
  });
  checkButton?.remove();
  const panel = card.querySelector(".test-result-panel");
  panel.hidden = false;
  panel.classList.add(isCorrect ? "correct" : "wrong");
  panel.querySelector(".test-mark").textContent = isCorrect ? "○" : "×";
  panel.querySelector(".test-result-label").textContent = isCorrect
    ? "正解！"
    : "不正解";
  if (isCorrect) {
    const result = await awardDailyQuestionPoints({
      type: "quiz",
      points: 2,
      subjectId,
      subjectName,
      unitId,
      questionId: String(visibleQuiz[currentIndex].id ?? currentIndex),
    });
    if (result.awarded) {
      sessionPoints += 2;
      panel.insertAdjacentHTML(
        "afterbegin",
        '<div class="point-earned-effect">＋2pt</div>',
      );
      await refreshTotalPoints(quizArea);
    }
  }
  await saveTestProgress(
    "quiz",
    subjectId,
    subjectName,
    unitId,
    currentIndex,
    visibleQuiz.length,
    false,
    quizSession,
  );
});

window.addEventListener("beforeunload", (event) => {
  if (completed || !visibleQuiz.length) return;
  event.preventDefault();
  event.returnValue = "";
});
