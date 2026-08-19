import { db, setupTheme, initializePage, loadProfileImage } from "./common.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {
  loadTestSession,
  createNewTestSession,
  saveTestProgress,
  scrubberHtml,
  setupScrubber,
} from "./test_session.js";
import { studySearchHtml, setupStudyTools } from "./study_tools.js";

const themeButton = document.getElementById("themeButton");
const topProfileImage = document.getElementById("topProfileImage");
const qaArea = document.getElementById("qaArea");
const params = new URLSearchParams(location.search);
const subjectId = params.get("subjectId");
const unitId = params.get("unitId");
let questions = [];
let currentIndex = 0;
let subjectName = "科目";
let qaSession = null;
let sourceQuestions = [];

setupTheme(themeButton);
document.getElementById("backButton").onclick = () => history.back();
document.getElementById("profileButton").onclick = () =>
  (location.href = "profile.html");
await initializePage([loadProfileImage(topProfileImage), loadQuestions()]);

async function loadQuestions() {
  if (!subjectId || !unitId) {
    qaArea.textContent = "科目または単元が指定されていません。";
    return;
  }
  const [questionSnap, subjectSnap] = await Promise.all([
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
  subjectName = subjectSnap.data()?.name || subjectId;
  sourceQuestions = (questionSnap.data()?.qa || [])
    .filter(
    (item) =>
      item &&
      String(item.question || "").trim() &&
      String(item.answer || "").trim(),
    )
    .map((question, index) => ({
      ...question,
      _sessionId: String(question.id ?? `qa-${index}`),
    }));
  if (!sourceQuestions.length) {
    qaArea.textContent = "一問一答はまだありません。";
    return;
  }
  qaSession = await loadTestSession(
    "qa",
    subjectId,
    subjectName,
    unitId,
    sourceQuestions.map((question) => ({ id: question._sessionId })),
  );
  const byId = new Map(
    sourceQuestions.map((question) => [question._sessionId, question]),
  );
  questions = qaSession.questionOrder.map((id) => byId.get(id)).filter(Boolean);
  currentIndex = qaSession.currentIndex;
  renderQuestion();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderQuestion() {
  const item = questions[currentIndex];
  qaArea.innerHTML = `
        <div class="test-progress"><span style="width:${((currentIndex + 1) / questions.length) * 100}%"></span></div>
        <article class="card setting-card test-focus-card qa-card">
            <div class="test-question-number">問題 ${currentIndex + 1} / ${questions.length}</div>
            <h2 class="test-question-text">${escapeHtml(item.question)}</h2>
            <button type="button" class="btn btn-primary qa-show-answer">答えを見る</button>
            <section class="test-result-panel qa-answer" hidden>
                <b>答え</b>
                <p>${escapeHtml(item.answer)}</p>
            </section>
            <button type="button" class="btn qa-next">${currentIndex + 1 < questions.length ? "次の問題" : "最初に戻る"}</button>
        </article>
        ${scrubberHtml(currentIndex, questions.length)}
        ${studySearchHtml()}`;
  setupScrubber(qaArea, (index) => {
    currentIndex = index;
    renderQuestion();
    saveTestProgress(
      "qa",
      subjectId,
      subjectName,
      unitId,
      currentIndex,
      questions.length,
      false,
      qaSession,
    );
  });
  setupStudyTools(qaArea);
}

qaArea.addEventListener("click", async (event) => {
  if (event.target.closest(".qa-show-answer")) {
    qaArea.querySelector(".qa-answer").hidden = false;
    event.target.closest(".qa-show-answer").hidden = true;
    return;
  }
  if (!event.target.closest(".qa-next")) return;
  if (currentIndex + 1 < questions.length) {
    currentIndex += 1;
  } else {
    qaSession = createNewTestSession(
      sourceQuestions.map((question) => ({ id: question._sessionId })),
    );
    const byId = new Map(
      sourceQuestions.map((question) => [question._sessionId, question]),
    );
    questions = qaSession.questionOrder
      .map((id) => byId.get(id))
      .filter(Boolean);
    currentIndex = 0;
  }
  renderQuestion();
  await saveTestProgress(
    "qa",
    subjectId,
    subjectName,
    unitId,
    currentIndex,
    questions.length,
    false,
    qaSession,
  );
  window.scrollTo({ top: 0, behavior: "smooth" });
});
