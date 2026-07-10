import {
    db,
    studentNumber,
    setupTheme,
    initializePage,
    loadProfileImage,
    isAdmin
} from "./common.js";

import {
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const params = new URLSearchParams(location.search);

const subjectId = params.get("subjectId");
const unitId = params.get("unitId");

const themeButton = document.getElementById("themeButton");
const topProfileImage = document.getElementById("topProfileImage");
const unitInfo = document.getElementById("unitInfo");
const questionList = document.getElementById("questionList");
const publishQuestions = document.getElementById("publishQuestions");

setupTheme(themeButton);

const admin = await isAdmin();

if (!admin) {
    alert("管理者のみアクセスできます。");
    location.href = "index.html";
}

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

    const subjectSnap = await getDoc(
        doc(db, "examSubjects", subjectId)
    );

    const unitSnap = await getDoc(
        doc(db, "examSubjects", subjectId, "units", unitId)
    );

    if (!subjectSnap.exists() || !unitSnap.exists()) {
        unitInfo.textContent = "科目または単元が見つかりません。";
        questionList.innerHTML = "";
        return;
    }

    unitInfo.textContent =
        `${subjectSnap.data().name} / ${unitSnap.data().name}`;

    const aiSnap = await getDoc(
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

    if (!aiSnap.exists()) {
        questionList.innerHTML =
            "AI生成結果はまだありません。";
        return;
    }

    const data = aiSnap.data();

    renderQuestions(data);
}

function renderQuestions(data) {

    const summary = data.summary || [];
    const importantPoints = data.important_points || [];
    const fillBlank = data.fill_blank || [];
    const quiz = data.quiz || [];
    const todayQuestion = data.today_question || null;

    questionList.innerHTML = `
        <div class="card setting-card">
            <h3>📌 要約</h3>
            ${summary.length
                ? `<ul>${summary.map(item => `<li>${item}</li>`).join("")}</ul>`
                : "<p>要約はありません。</p>"
            }
        </div>

        <div class="card setting-card">
            <h3>⭐ 重要ポイント</h3>
            ${importantPoints.length
                ? `<ul>${importantPoints.map(item => `<li>${item}</li>`).join("")}</ul>`
                : "<p>重要ポイントはありません。</p>"
            }
        </div>

        <div class="card setting-card">
            <h3>🎯 今日の1問</h3>
            ${todayQuestion
                ? renderQuizItem(todayQuestion)
                : "<p>今日の1問はありません。</p>"
            }
        </div>

        <div class="card setting-card">
            <h3>📝 穴埋め</h3>
            ${fillBlank.length
                ? fillBlank.map((item, index) => renderFillBlankItem(item, index)).join("")
                : "<p>穴埋め問題はありません。</p>"
            }
        </div>

        <div class="card setting-card">
            <h3>🧠 四択</h3>
            ${quiz.length
                ? quiz.map((item, index) => renderQuizItem(item, index)).join("")
                : "<p>四択問題はありません。</p>"
            }
        </div>
    `;
}

function renderFillBlankItem(item, index) {

    return `
        <div class="card setting-card">
            <p><b>問題 ${index + 1}</b></p>
            <p>${item.question || ""}</p>
            <p><b>答え：</b>${item.answer || ""}</p>
        </div>
    `;
}

function renderQuizItem(item, index = null) {

    return `
        <div class="card setting-card">
            ${index !== null ? `<p><b>問題 ${index + 1}</b></p>` : ""}
            <p>${item.question || ""}</p>

            <ol>
                ${(item.choices || []).map(choice => `<li>${choice}</li>`).join("")}
            </ol>

            <p><b>正解：</b>${Number(item.answer) + 1}</p>
            <p><b>解説：</b>${item.explanation || ""}</p>
        </div>
    `;
}

publishQuestions.onclick = async () => {

    if (!confirm("この問題を学生へ公開しますか？")) return;

    const aiSnap = await getDoc(
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

    if (!aiSnap.exists()) {
        alert("AI生成結果がありません。");
        return;
    }

    await setDoc(
        doc(
            db,
            "examSubjects",
            subjectId,
            "units",
            unitId,
            "publishedQuestions",
            "generated"
        ),
        {
            ...aiSnap.data(),
            publishedAt: new Date(),
            publishedBy: studentNumber
        }
    );

    alert("公開しました。");

};