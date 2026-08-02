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

    sessionStorage.setItem(
        "quizPlaying",
        "true"
    );
}

document.addEventListener("click", async (e) => {

    if (!e.target.classList.contains("answer-button")) return;

    const selected = Number(e.target.dataset.index);

    const card = e.target.closest(".card");

    if (card.dataset.finished === "true") {
        return;
    }
    const correct = Number(card.dataset.answer);

    const result = document.getElementById("result");

    if (selected === correct) {
        result.textContent = "⭕ 正解！";
        result.style.color = "green";

        card.dataset.finished = "true";

        sessionStorage.removeItem(
            "quizPlaying"
        );

        const today =
            new Date().toISOString().slice(0,10);

        const studentNumber =
            localStorage.getItem("studentNumber");

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

        }

    } else {
        result.textContent = "❌ 不正解";
        result.style.color = "red";
    }

});

window.addEventListener("beforeunload",(e)=>{

    const unfinished =
        document.querySelector(".card")?.dataset.finished !== "true";

    if(!unfinished) return;

    e.preventDefault();

    e.returnValue="";

});