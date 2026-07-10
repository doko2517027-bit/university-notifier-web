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
const quizArea = document.getElementById("quizArea");

const params = new URLSearchParams(location.search);
const subjectId = params.get("subjectId");
const unitId = params.get("unitId");

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
            "ai",
            "generated"
        )
    );

    if (!snap.exists()) {
        quizArea.innerHTML = "四択問題はまだありません。";
        return;
    }

    const data = snap.data();
    const quiz = data.quiz || [];

    if (quiz.length === 0) {
        quizArea.innerHTML = "四択問題が生成されていません。";
        return;
    }

    quizArea.innerHTML = "";

    quiz.forEach((q, index) => {

        quizArea.innerHTML += `
            <div class="card setting-card quiz-card" data-answer="${q.answer}">
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
            </div>
        `;

    });

}

document.addEventListener("click", (e) => {

    if (!e.target.classList.contains("quiz-answer")) return;

    const selected = Number(e.target.dataset.index);
    const card = e.target.closest(".quiz-card");
    const correct = Number(card.dataset.answer);
    const result = card.querySelector(".quiz-result");

    if (selected === correct) {
        result.textContent = "⭕ 正解！";
        result.style.color = "green";
    } else {
        result.textContent = "❌ 不正解";
        result.style.color = "red";
    }

});