import { db, setupTheme, initializePage, loadProfileImage } from "./common.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { reportWrongAnswer } from "./question_report.js";
import { awardDailyQuestionPoints } from "./test_points.js";
import {
  loadTestProgress,
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
  visibleQuiz = (snap.data().quiz || []).filter(
    (q) =>
      q &&
      String(q.question || "").trim() &&
      Array.isArray(q.choices) &&
      q.choices.length &&
      q.answer !== undefined &&
      q.answer !== null,
  );
  if (!visibleQuiz.length) {
    quizArea.textContent = "四択問題はまだありません。";
    return;
  }
  sessionStorage.setItem("quizPlaying", "true");
  currentIndex = await loadTestProgress(
    "quiz",
    subjectId,
    unitId,
    visibleQuiz.length,
  );
  renderQuestion();
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
  quizArea.innerHTML = `
        <div class="test-progress"><span style="width:${((currentIndex + 1) / visibleQuiz.length) * 100}%"></span></div>
        <div class="card setting-card test-focus-card quiz-card" data-answer="${Number(q.answer)}">
            <div class="test-question-number">問題 ${currentIndex + 1} / ${visibleQuiz.length}</div>
            <h2 class="test-question-text">${escapeHtml(q.question)}</h2>

            ${studyPointHtml(2)}

            ${renderQuestionImage(q)}

            <div class="test-choice-list">
                ${q.choices.map((choice, index) => `<button class="test-choice quiz-answer" data-index="${index}"><b>${index + 1}</b><span>${escapeHtml(choice)}</span></button>`).join("")}
            </div>
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
      );
      finishTest(
        sessionPoints,
        () => {
          completed = false;
          currentIndex = 0;
          sessionPoints = 0;
          renderQuestion();
        },
        () => (location.href = "exam.html"),
      );
    }
    return;
  }

  const answerButton = event.target.closest(".quiz-answer");
  if (!answerButton) return;
  const card = answerButton.closest(".quiz-card");
  if (card.dataset.finished === "true") return;
  card.dataset.finished = "true";
  const selected = Number(answerButton.dataset.index);
  const correct = Number(card.dataset.answer);
  const isCorrect = selected === correct;
  card.querySelectorAll(".test-choice").forEach((button, index) => {
    button.disabled = true;
    if (index === correct) button.classList.add("is-correct");
    if (index === selected && !isCorrect) button.classList.add("is-wrong");
  });
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
  );
});

window.addEventListener("beforeunload", (event) => {
  if (completed || !visibleQuiz.length) return;
  event.preventDefault();
  event.returnValue = "";
});
