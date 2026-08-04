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
const quizArea = document.getElementById("quizArea");

const params = new URLSearchParams(location.search);
const subjectId = params.get("subjectId");
const unitId = params.get("unitId");
let visibleQuiz = [];

setupTheme(themeButton);

await initializePage([
    loadProfileImage(topProfileImage),
    loadQuiz()
]);

document.getElementById("backButton").onclick = () => {
    history.back();
};

document.getElementById("profileButton").onclick = () => {
    location.href = "profile.html";
};

async function loadQuiz() {

    if (!subjectId || !unitId) {
        quizArea.innerHTML = "科目または単元が指定されていません。";
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
        quizArea.innerHTML = "四択問題はまだありません。";
        return;
    }

    const data = snap.data();
    const quiz = (data.quiz || []).filter(q =>
        q &&
        typeof q.question === "string" &&
        q.question.trim() !== "" &&
        Array.isArray(q.choices) &&
        q.choices.length > 0 &&
        q.choices.every(choice => String(choice).trim() !== "") &&
        q.answer !== undefined &&
        q.answer !== null
    );
    visibleQuiz = quiz;

    quizArea.innerHTML = "";

    quiz.forEach((q, index) => {

        quizArea.innerHTML += `
            <div
                class="card setting-card quiz-card"
                data-answer="${q.answer}"
                data-question="${q.id || index}">
                
                <h3>問題 ${index + 1}</h3>
                <p>${q.question}</p>

                ${q.choices.map((choice, choiceIndex) => `
                    <button
                        class="btn btn-secondary quiz-answer"
                        data-index="${choiceIndex}">
                        ${choiceIndex + 1}. ${choice}
                    </button>
                    <br><br>
                `).join("")}

                <p class="quiz-result"></p>
                <p><small>${q.explanation || ""}</small></p>

                <button
                    type="button"
                    class="btn btn-danger report-wrong-answer"
                    data-question-index="${index}">
                    答えが違います
                </button>
            </div>
        `;

    });

    sessionStorage.setItem(
        "quizPlaying",
        "true"
    );

}

document.addEventListener("click", async (e) => {

    if (e.target.classList.contains("report-wrong-answer")) {

        const index = Number(e.target.dataset.questionIndex);
        const q = visibleQuiz[index];

        if (q) {
            await reportWrongAnswer(e.target, {
                questionType: "quiz",
                subjectId,
                unitId,
                questionId: String(q.id ?? index),
                question: q.question,
                registeredAnswer: q.answer,
                choices: q.choices
            });
        }

        return;

    }

    if (!e.target.classList.contains("quiz-answer")) return;

    const card =
        e.target.closest(".quiz-card");

    if (card.dataset.finished === "true") {
        return;
    }

    const selected =
        Number(e.target.dataset.index);

    const correct =
        Number(card.dataset.answer);

    const result =
        card.querySelector(".quiz-result");

    if (selected === correct) {

        result.textContent = "⭕ 正解！";
        result.style.color = "green";

        card.dataset.finished = "true";

        const unfinished =
            [...document.querySelectorAll(".quiz-card")]
            .some(card => card.dataset.finished !== "true");

        if (!unfinished) {

            sessionStorage.removeItem(
                "quizPlaying"
            );

        }

        const now = new Date();

        const today =
            `${now.getFullYear()}-` +
            `${String(now.getMonth() + 1).padStart(2,"0")}-` +
            `${String(now.getDate()).padStart(2,"0")}`;

        const studentNumber =
            localStorage.getItem("studentNumber");

        const questionId =
            card.dataset.question;


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

        result.textContent = "❌ 不正解";
        result.style.color = "red";

    }

});

let quizLost = false;

window.addEventListener("beforeunload",(e)=>{

    const unfinished =
        [...document.querySelectorAll(".quiz-card")]
        .some(card=>card.dataset.finished!=="true");

    if(!unfinished) return;

    e.preventDefault();

    e.returnValue="";

});
