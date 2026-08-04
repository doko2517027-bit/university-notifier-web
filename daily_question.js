import {
    db,
    setupTheme,
    initializePage,
    loadProfileImage
} from "./common.js";

import {
    doc,
    getDoc,
    increment,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { reportWrongAnswer } from "./question_report.js";

const themeButton = document.getElementById("themeButton");
const topProfileImage = document.getElementById("topProfileImage");
const questionArea = document.getElementById("questionArea");
const params = new URLSearchParams(location.search);
const subjectId = params.get("subjectId");
const unitId = params.get("unitId");
let visibleDailyQuestion = null;

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

    if (!snap.exists()) {
        questionArea.innerHTML = "今日の1問はまだありません。";
        return;
    }

    const data = snap.data();
    const q = data.today_question;

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

        const now = new Date();

        const today =
            `${now.getFullYear()}-` +
            `${String(now.getMonth() + 1).padStart(2,"0")}-` +
            `${String(now.getDate()).padStart(2,"0")}`;

        const studentNumber =
            localStorage.getItem("studentNumber");

        console.log(
            localStorage.getItem("studentNumber")
        );

        const questionId =
            `${subjectId}_${unitId}_today`;


        const solvedRef =
            doc(
                db,
                "users",
                studentNumber,
                "solvedQuestions",
                questionId
            );


        const solvedSnap =
            await getDoc(
                solvedRef
            );


        if (!solvedSnap.exists()) {


            await setDoc(
                solvedRef,
                {
                    firstCorrectAt:
                        serverTimestamp()
                }
            );


            await setDoc(
                doc(
                    db,
                    "dailyRanking",
                    today,
                    "users",
                    studentNumber
                ),
                {
                    lastAnsweredAt:
                        serverTimestamp(),

                    point:
                        increment(1),

                    solved:
                        increment(1)
                },
                {
                    merge:true
                }
            );

            console.log(
                "ポイント追加:",
                studentNumber
            );


            // 累計ポイント追加
            await setDoc(
                doc(
                    db,
                    "totalRanking",
                    studentNumber
                ),
                {
                    point:
                        increment(1),

                    updatedAt:
                        serverTimestamp()
                },
                {
                    merge:true
                }
            );

        }

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
