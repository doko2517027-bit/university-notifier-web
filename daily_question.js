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
const questionArea = document.getElementById("questionArea");
const params = new URLSearchParams(location.search);
const subjectId = params.get("subjectId");
const unitId = params.get("unitId");

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
            "ai",
            "generated"
        )
    );

    if (!snap.exists()) {
        questionArea.innerHTML = "今日の1問はまだありません。";
        return;
    }

    const data = snap.data();
    const q = data.today_question;

    if (!q) {
        questionArea.innerHTML = "今日の1問が生成されていません。";
        return;
    }

    questionArea.innerHTML = `
        <div class="card setting-card" data-answer="${q.answer}">
            <h3>${q.question}</h3>

            ${q.choices.map((choice, index) => `
                <button
                    class="btn btn-secondary answer-button"
                    data-index="${index}">
                    ${index + 1}. ${choice}
                </button>
                <br><br>
            `).join("")}

            <p id="result"></p>
        </div>
    `;
}

document.addEventListener("click", (e) => {

    if (!e.target.classList.contains("answer-button")) return;

    const selected = Number(e.target.dataset.index);

    const card = e.target.closest(".card");
    const correct = Number(card.dataset.answer);

    const result = document.getElementById("result");

    if (selected === correct) {
        result.textContent = "⭕ 正解！";
        result.style.color = "green";
    } else {
        result.textContent = "❌ 不正解";
        result.style.color = "red";
    }

});