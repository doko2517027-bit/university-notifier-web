import { db, setupTheme, initializePage, loadProfileImage } from "./common.js";
import { doc, getDoc, increment, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { reportWrongAnswer } from "./question_report.js";

const themeButton = document.getElementById("themeButton");
const topProfileImage = document.getElementById("topProfileImage");
const quizArea = document.getElementById("quizArea");
const params = new URLSearchParams(location.search);
const subjectId = params.get("subjectId");
const unitId = params.get("unitId");
let visibleQuiz = [];
let currentIndex = 0;
let completed = false;

setupTheme(themeButton);
document.getElementById("backButton").onclick = () => history.back();
document.getElementById("profileButton").onclick = () => location.href = "profile.html";
await initializePage([loadProfileImage(topProfileImage), loadQuiz()]);

async function loadQuiz() {
    if (!subjectId || !unitId) {
        quizArea.textContent = "科目または単元が指定されていません。";
        return;
    }
    const snap = await getDoc(doc(db, "examSubjects", subjectId, "units", unitId, "publishedQuestions", "published"));
    if (!snap.exists()) {
        quizArea.textContent = "四択問題はまだありません。";
        return;
    }
    visibleQuiz = (snap.data().quiz || []).filter(q =>
        q && String(q.question || "").trim() && Array.isArray(q.choices) &&
        q.choices.length && q.answer !== undefined && q.answer !== null
    );
    if (!visibleQuiz.length) {
        quizArea.textContent = "四択問題はまだありません。";
        return;
    }
    sessionStorage.setItem("quizPlaying", "true");
    renderQuestion();
}

function escapeHtml(value) {
    return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;")
        .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function renderQuestion() {
    const q = visibleQuiz[currentIndex];
    quizArea.innerHTML = `
        <div class="test-progress"><span style="width:${((currentIndex + 1) / visibleQuiz.length) * 100}%"></span></div>
        <div class="card setting-card test-focus-card quiz-card" data-answer="${Number(q.answer)}">
            <div class="test-question-number">問題 ${currentIndex + 1} / ${visibleQuiz.length}</div>
            <h2 class="test-question-text">${escapeHtml(q.question)}</h2>
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
        </div>`;
}

document.addEventListener("click", async event => {
    if (event.target.closest(".report-wrong-answer")) {
        const q = visibleQuiz[currentIndex];
        await reportWrongAnswer(event.target.closest(".report-wrong-answer"), {
            questionType:"quiz", subjectId, unitId,
            questionId:String(q.id ?? currentIndex), question:q.question,
            registeredAnswer:q.answer, choices:q.choices
        });
        return;
    }

    const next = event.target.closest(".next-question");
    if (next) {
        if (currentIndex + 1 < visibleQuiz.length) {
            currentIndex++;
            renderQuestion();
            window.scrollTo({ top:0, behavior:"smooth" });
        } else {
            completed = true;
            sessionStorage.removeItem("quizPlaying");
            quizArea.innerHTML = `<div class="card setting-card test-complete"><div>🎉</div><h2>全問終了</h2><button class="btn btn-primary" onclick="history.back()">テスト画面へ戻る</button></div>`;
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
    panel.querySelector(".test-result-label").textContent = isCorrect ? "正解！" : "不正解";
    if (isCorrect) await awardPoint(String(visibleQuiz[currentIndex].id ?? currentIndex));
});

async function awardPoint(questionId) {
    const studentNumber = localStorage.getItem("studentNumber");
    if (!studentNumber) return;
    const solvedRef = doc(db,"users",studentNumber,"solvedQuestions",questionId);
    if ((await getDoc(solvedRef)).exists()) return;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    await setDoc(solvedRef,{firstCorrectAt:serverTimestamp()});
    await Promise.all([
        setDoc(doc(db,"dailyRanking",today,"users",studentNumber),{lastAnsweredAt:serverTimestamp(),point:increment(1),solved:increment(1)},{merge:true}),
        setDoc(doc(db,"totalRanking",studentNumber),{point:increment(1),updatedAt:serverTimestamp()},{merge:true})
    ]);
}

window.addEventListener("beforeunload", event => {
    if (completed || !visibleQuiz.length) return;
    event.preventDefault();
    event.returnValue = "";
});
