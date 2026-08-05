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
let dailyQuestionSeed = 0;
let forceLeavePage = false;

setupTheme(themeButton);

await initializePage([
    loadProfileImage(topProfileImage),
    loadDailyQuestion()
]);

document.getElementById("backButton").onclick = () => {

    forceLeavePage = true;

    sessionStorage.removeItem(
        "quizPlaying"
    );

    location.href = "exam.html";

};

document.getElementById("profileButton").onclick = () => {
    location.href = "profile.html";
};

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function renderQuestionImage(question) {

    const imageUrl =
        String(
            question?.imageUrl || ""
        ).trim();

    if (!imageUrl) {
        return "";
    }

    const description =
        String(
            question?.imageDescription ||
            ""
        ).trim();

    return `
        <figure class="test-question-image">

            <img
                src="${escapeHtml(imageUrl)}"
                alt="${escapeHtml(
                    description ||
                    "問題画像"
                )}"
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
    dailyQuestionSeed = [
        ...`${localDateKey()}|${subjectId}|${unitId}`
    ].reduce(
        (sum, char) =>
            (
                (sum * 31) +
                char.charCodeAt(0)
            ) >>> 0,
        7
    );

    const q = pool.length
        ? pool[
            dailyQuestionSeed %
            pool.length
        ]
        : data.today_question;

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
            <h2 class="test-question-text">${escapeHtml(q.question)}</h2>

            ${renderQuestionImage(q)}

            <div class="test-choice-list">${q.choices.map((choice, index) => `
                <button
                    class="test-choice answer-button"
                    data-index="${index}">
                    <b>${index + 1}</b><span>${escapeHtml(choice)}</span>
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

    const answerButton =
        e.target.closest(
            ".answer-button"
        );

    if (!answerButton) {
        return;
    }

    const selected =
        Number(
            answerButton.dataset.index
        );

    const card =
        answerButton.closest(
            ".card"
        );

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

        const awarded =
            await awardDailyQuestionPoints({

                type:
                    "daily",

                points:
                    3,

                subjectId,

                subjectName,

                unitId,

                questionId:
                    String(
                        visibleDailyQuestion.id ??
                        dailyQuestionSeed
                    )

            });
        if(awarded.awarded)panel.insertAdjacentHTML("afterbegin",'<div class="point-earned-effect">＋3pt</div>');

    } else {
        result.textContent = "不正解";
        sessionStorage.removeItem("quizPlaying");
    }

});

window.addEventListener(
    "beforeunload",
    event => {

        if (forceLeavePage) {
            return;
        }

        const questionCard =
            document.querySelector(
                ".test-focus-card"
            );

        if (!questionCard) {
            return;
        }

        const unfinished =
            questionCard.dataset.finished !==
            "true";

        if (!unfinished) {
            return;
        }

        event.preventDefault();

        event.returnValue = "";

    }
);
