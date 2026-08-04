import {
    db,
    setupTheme,
    initializePage,
    loadProfileImage
} from "./common.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { reportWrongAnswer } from "./question_report.js";
import { awardDailyQuestionPoints, localDateKey } from "./test_points.js";

const themeButton = document.getElementById("themeButton");
const topProfileImage = document.getElementById("topProfileImage");
const questionArea = document.getElementById("questionArea");
const params = new URLSearchParams(location.search);
const subjectId = params.get("subjectId");
const unitId = params.get("unitId");
let visibleDailyQuestion = null;
let subjectName = "科目";

setupTheme(themeButton);

await initializePage([
    loadProfileImage(topProfileImage),
    loadDailyQuestion()
]);

document.getElementById("backButton").onclick = () => {
    history.back();
};

document.getElementById("profileButton").onclick = () => {
    location.href = "profile.html";
};

async function loadDailyQuestion() {

    if (!subjectId || !unitId) {
        questionArea.innerHTML = "科目IDまたは単元IDがありません。";
        return;
    }

    const snap = await getDoc(
        doc(
            db,
            "examSubjects",
            subjectId,
            "units",
            unitId,
            "publishedQuestions",
            "published"
        )
    );
    const subjectSnap=await getDoc(doc(db,"examSubjects",subjectId));
    subjectName=subjectSnap.data()?.name||subjectSnap.data()?.subjectName||subjectId;

    if (!snap.exists()) {
        questionArea.innerHTML = "今日の1問はまだありません。";
        return;
    }

    const data = snap.data();
    const pool=(data.quiz||[]).filter(q=>q?.question&&Array.isArray(q.choices)&&q.choices.length);
    const seed=[...`${localDateKey()}|${subjectId}|${unitId}`].reduce((sum,char)=>((sum*31)+char.charCodeAt(0))>>>0,7);
    const q = pool.length ? pool[seed % pool.length] : data.today_question;

    if (
        !q ||
        !q.question ||
        !Array.isArray(q.choices) ||
        q.choices.length === 0
    ) {
        questionArea.innerHTML = "今日の1問はまだありません。";
        return;
    }

    visibleDailyQuestion = q;

    questionArea.innerHTML = `
        <div class="card setting-card test-focus-card" data-answer="${q.answer}">
            <div class="test-question-number">今日の1問</div>
            <h2 class="test-question-text">${q.question}</h2>

            <div class="test-choice-list">${q.choices.map((choice, index) => `
                <button
                    class="test-choice answer-button"
                    data-index="${index}">
                    <b>${index + 1}</b><span>${choice}</span>
                </button>
            `).join("")}</div>

            <div class="test-result-panel" hidden>
                <div class="test-mark"></div>
                <div id="result" class="test-result-label"></div>
                ${q.explanation ? `<div class="test-explanation"><b>解説</b><p>${q.explanation}</p></div>` : ""}
            </div>

            <button
                type="button"
                class="test-report-link report-wrong-answer">
                答えが違います
            </button>
        </div>
    `;

    sessionStorage.setItem(
        "quizPlaying",
        "true"
    );
}

document.addEventListener("click", async (e) => {

    if (e.target.classList.contains("report-wrong-answer")) {

        if (visibleDailyQuestion) {
            await reportWrongAnswer(e.target, {
                questionType: "daily",
                subjectId,
                unitId,
                questionId: `${subjectId}_${unitId}_today`,
                question: visibleDailyQuestion.question,
                registeredAnswer: visibleDailyQuestion.answer,
                choices: visibleDailyQuestion.choices
            });
        }

        return;

    }

    if (!e.target.classList.contains("answer-button")) return;

    const selected = Number(e.target.dataset.index);

    const card = e.target.closest(".card");

    if (card.dataset.finished === "true") {
        return;
    }
    const correct = Number(card.dataset.answer);

    const result = document.getElementById("result");
    const panel = card.querySelector(".test-result-panel");
    const isCorrect = selected === correct;

    card.dataset.finished = "true";
    card.querySelectorAll(".test-choice").forEach((button, index) => {
        button.disabled = true;
        if (index === correct) button.classList.add("is-correct");
        if (index === selected && !isCorrect) button.classList.add("is-wrong");
    });
    panel.hidden = false;
    panel.classList.add(isCorrect ? "correct" : "wrong");
    panel.querySelector(".test-mark").textContent = isCorrect ? "○" : "×";

    if (isCorrect) {
        result.textContent = "正解！";

        sessionStorage.removeItem(
            "quizPlaying"
        );

        const awarded=await awardDailyQuestionPoints({type:"daily",points:3,subjectId,subjectName,unitId,questionId:String(visibleDailyQuestion.id??seed)});
        if(awarded.awarded)panel.insertAdjacentHTML("afterbegin",'<div class="point-earned-effect">＋3pt</div>');

    } else {
        result.textContent = "不正解";
        sessionStorage.removeItem("quizPlaying");
    }

});

window.addEventListener("beforeunload",(e)=>{

    const unfinished =
        document.querySelector(".card")?.dataset.finished !== "true";

    if(!unfinished) return;

    e.preventDefault();

    e.returnValue="";

});
