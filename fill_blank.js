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

await initializePage([
    loadProfileImage(topProfileImage),
    loadQuestions()
]);

document.getElementById("backButton").onclick = () => {
    history.back();
};

document.getElementById("profileButton").onclick = () => {
    location.href = "profile.html";
};

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
            "ai",
            "generated"
        )
    );

    if (!snap.exists()) {
        questions.innerHTML = "AI問題がありません。";
        return;
    }

    const data = snap.data();
    const fillBlank = data.fill_blank || [];

    if (fillBlank.length === 0) {
        questions.innerHTML = "穴埋め問題が生成されていません。";
        return;
    }

    questions.innerHTML = "";

    fillBlank.forEach((q, index) => {

        questions.innerHTML += `
            <div class="card setting-card fill-card" data-answer="${q.answer}">
                <h3>問題 ${index + 1}</h3>

                <p>${q.question}</p>

                <input
                    class="fill-answer"
                    type="text"
                    placeholder="答えを入力">

                <br><br>

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
    const input = card.querySelector(".fill-answer");
    const result = card.querySelector(".fill-result");

    const userAnswer = input.value.trim();
    const correctAnswer = card.dataset.answer;

    if (userAnswer === correctAnswer) {
        result.textContent = "⭕ 正解！";
        result.style.color = "green";
    } else {
        result.textContent = `❌ 不正解。正解：${correctAnswer}`;
        result.style.color = "red";
    }

});