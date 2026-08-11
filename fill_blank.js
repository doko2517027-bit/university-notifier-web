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
import { awardDailyQuestionPoints } from "./test_points.js";
import { loadTestProgress, saveTestProgress, scrubberHtml, setupScrubber, finishTest } from "./test_session.js";
import { studyPointHtml, studySearchHtml, setupStudyTools, refreshTotalPoints } from "./study_tools.js";

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
let sessionPoints = 0;

setupTheme(themeButton);

document.getElementById("backButton").onclick = () => {
    history.back();
};

document.getElementById("profileButton").onclick = () => {
    location.href = "profile.html";
};

await initializePage([
    loadProfileImage(topProfileImage),
    loadQuestions()
]);

async function loadQuestions() {

    if (!subjectId || !unitId) {
        questions.innerHTML = "科目または単元が指定されていません。";
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
        questions.innerHTML = "AI問題がありません。";
        return;
    }

    const data = snap.data();

    console.log("Firestoreから取得したAIデータ", data);
    console.log("穴埋め問題", data.fill_blank);

    const fillBlank = (data.fill_blank || []).filter(q =>
        q &&
        typeof q.question === "string" &&
        q.question.trim() !== "" &&
        (
            (Array.isArray(q.answers) &&
                q.answers.some(answer =>
                    String(answer).trim() !== ""
                )
            ) ||
            String(q.answer || "").trim() !== ""
        )
    );
    visibleFillBlank = fillBlank;

    if (!fillBlank.length) {
        questions.textContent = "AI問題がありません。";
        return;
    }

    currentFillIndex=await loadTestProgress("fillBlank",subjectId,unitId,visibleFillBlank.length);
    renderFillQuestion();

    sessionStorage.setItem(
        "quizPlaying",
        "true"
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

function renderFillQuestion() {
    const q = visibleFillBlank[currentFillIndex];
    const answers = q.answers && q.answers.length > 0 ? q.answers : [q.answer || ""];
    questions.innerHTML = `
            <div class="test-progress"><span style="width:${((currentFillIndex + 1) / visibleFillBlank.length) * 100}%"></span></div>
            <div
                class="card setting-card fill-card test-focus-card"
                data-question="${currentFillIndex}"
                data-answer="${q.answer || answers.join("・")}"
                data-answers='${JSON.stringify(answers)}'>

                <div class="test-question-number">問題 ${currentFillIndex + 1} / ${visibleFillBlank.length}</div>

                <h2 class="test-question-text">${escapeHtml(q.question)}</h2>

                ${studyPointHtml(4)}

                ${renderQuestionImage(q)}

                ${answers.map((answer, answerIndex) => `
                    <input
                        class="fill-answer"
                        type="text"
                        placeholder="解答 ${answerIndex + 1}">
                    <br><br>
                `).join("")}

                <button class="btn btn-primary check-fill">
                    判定
                </button>

                <div class="test-result-panel" hidden>
                    <div class="test-mark"></div>
                    <div class="fill-result test-result-label"></div>
                    ${q.explanation ? `<div class="test-explanation"><b>解説</b><p>${q.explanation}</p></div>` : ""}
                    <button class="btn btn-primary next-fill-question">${currentFillIndex + 1 < visibleFillBlank.length ? "次の問題" : "結果を終了"}</button>
                </div>

                <button
                    type="button"
                    class="test-report-link report-wrong-answer"
                    data-question-index="${currentFillIndex}">
                    答えが違います
                </button>
            </div>${scrubberHtml(currentFillIndex,visibleFillBlank.length)}${studySearchHtml(q.question)}
        `;
    setupScrubber(questions,index=>{currentFillIndex=index;renderFillQuestion();saveTestProgress("fillBlank",subjectId,subjectName,unitId,currentFillIndex,visibleFillBlank.length)});
    setupStudyTools(questions);
}

document.addEventListener("click", async (e) => {

    if (e.target.classList.contains("next-fill-question")) {
        if (currentFillIndex + 1 < visibleFillBlank.length) {
            currentFillIndex++;
            renderFillQuestion();
            await saveTestProgress("fillBlank",subjectId,subjectName,unitId,currentFillIndex,visibleFillBlank.length);
            window.scrollTo({top:0, behavior:"smooth"});
        } else {
            fillCompleted = true;
            sessionStorage.removeItem("quizPlaying");
            await saveTestProgress("fillBlank",subjectId,subjectName,unitId,currentFillIndex,visibleFillBlank.length,true);
            finishTest(sessionPoints,()=>{fillCompleted=false;currentFillIndex=0;sessionPoints=0;renderFillQuestion()},()=>location.href="exam.html");
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
                registeredAnswer: q.answers || q.answer || ""
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

    const correctAnswers =
        JSON.parse(card.dataset.answers || "[]")
            .map(answer => normalizeAnswer(answer));

    const userAnswers =
        Array.from(card.querySelectorAll(".fill-answer"))
            .map(input => normalizeAnswer(input.value))
            .filter(answer => answer !== "");

    const allCorrect =
        correctAnswers.length === userAnswers.length &&
        correctAnswers.every(answer => userAnswers.includes(answer));

    card.dataset.finished = "true";
    card.querySelectorAll("input, .check-fill").forEach(element => element.disabled = true);
    panel.hidden = false;

    if (allCorrect) {
        result.textContent = "正解！";
        panel.classList.add("correct");
        panel.querySelector(".test-mark").textContent = "○";

        const awarded=await awardDailyQuestionPoints({type:"fillBlank",points:4,subjectId,subjectName,unitId,questionId:String(visibleFillBlank[currentFillIndex].id??currentFillIndex)});
        if(awarded.awarded){sessionPoints+=4;panel.insertAdjacentHTML("afterbegin",'<div class="point-earned-effect">＋4pt</div>');await refreshTotalPoints(questions)}

    } else {

        result.textContent =
            `不正解　正解：${card.dataset.answer}`;
        panel.classList.add("wrong");
        panel.querySelector(".test-mark").textContent = "×";

    }

    await saveTestProgress("fillBlank",subjectId,subjectName,unitId,currentFillIndex,visibleFillBlank.length);

});

function normalizeAnswer(text) {

    return text
        .trim()
        .replace(/\s/g, "")
        .replace(/　/g, "")
        .toLowerCase();

}

window.addEventListener("beforeunload",(e)=>{

    if(fillCompleted || !visibleFillBlank.length) return;

    e.preventDefault();

    e.returnValue="";

});
