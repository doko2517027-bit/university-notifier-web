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

const themeButton = document.getElementById("themeButton");
const topProfileImage = document.getElementById("topProfileImage");
const questions = document.getElementById("questions");

const params = new URLSearchParams(location.search);
const subjectId = params.get("subjectId");
const unitId = params.get("unitId");

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

    if (!snap.exists()) {
        questions.innerHTML = "AI問題がありません。";
        return;
    }

    const data = snap.data();

    console.log("Firestoreから取得したAIデータ", data);
    console.log("穴埋め問題", data.fill_blank);

    const fillBlank = data.fill_blank || [];
    if (fillBlank.length === 0) {
        questions.innerHTML = "穴埋め問題が生成されていません。";
        return;
    }

    questions.innerHTML = "";

    fillBlank.forEach((q, index) => {

        const answers =
            q.answers && q.answers.length > 0
                ? q.answers
                : [q.answer || ""];

        questions.innerHTML += `
            <div
                class="card setting-card fill-card"
                data-answer="${q.answer || answers.join("・")}"
                data-answers='${JSON.stringify(answers)}'>

                <h3>問題 ${index + 1}</h3>

                <p>${q.question}</p>

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

                <p class="fill-result"></p>
            </div>
        `;

    });

}

document.addEventListener("click", (e) => {

    if (!e.target.classList.contains("check-fill")) return;

    const card = e.target.closest(".fill-card");
    const result = card.querySelector(".fill-result");

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

    if (allCorrect) {
        result.textContent = "⭕ 正解！";
        result.style.color = "green";
    } else {
        result.textContent = `❌ 不正解。正解：${card.dataset.answer}`;
        result.style.color = "red";
    }

});

function normalizeAnswer(text) {

    return text
        .trim()
        .replace(/\s/g, "")
        .replace(/　/g, "")
        .toLowerCase();

}