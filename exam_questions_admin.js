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
const saveEditedQuestions = document.getElementById("saveEditedQuestions");

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

    const editedRef = doc(
        db,
        "examSubjects",
        subjectId,
        "units",
        unitId,
        "ai",
        "edited"
    );

    const generatedRef = doc(
        db,
        "examSubjects",
        subjectId,
        "units",
        unitId,
        "ai",
        "generated"
    );

    const editedSnap = await getDoc(editedRef);

    if (editedSnap.exists()) {
        renderQuestions(editedSnap.data());
        return;
    }

    const generatedSnap = await getDoc(generatedRef);

    if (!generatedSnap.exists()) {
        questionList.innerHTML =
            "AI生成結果はまだありません。";
        return;
    }

    await setDoc(
        editedRef,
        {
            ...generatedSnap.data(),
            editedCreatedAt: new Date(),
            editedCreatedBy: studentNumber
        }
    );

    renderQuestions({
        ...generatedSnap.data(),
        editedCreatedAt: new Date(),
        editedCreatedBy: studentNumber
    });
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

            <textarea
                id="editSummary"
                rows="6">${summary.join("\n")}</textarea>
        </div>

        <div class="card setting-card">
            <h3>⭐ 重要ポイント</h3>

            <textarea
                id="editImportantPoints"
                rows="6">${importantPoints.join("\n")}</textarea>
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

    const answers =
        item.answers && item.answers.length > 0
            ? item.answers
            : [item.answer || ""];

    return `
        <div class="card setting-card fill-edit-card" data-index="${index}">
            <p><b>問題 ${index + 1}</b></p>

            <p>問題文</p>
            <textarea
                class="edit-fill-question"
                data-index="${index}"
                rows="3">${item.question || ""}</textarea>

            <p>模範解答表示</p>
            <input
                class="edit-fill-answer"
                data-index="${index}"
                value="${item.answer || answers.join("・")}">

            <p>解答ボックス</p>

            <div class="fill-answers-area" data-index="${index}">
                ${answers.map((answer, answerIndex) => `
                    <input
                        class="edit-fill-answer-box"
                        data-index="${index}"
                        data-answer-index="${answerIndex}"
                        value="${answer}"
                        placeholder="解答 ${answerIndex + 1}">
                    <br><br>
                `).join("")}
            </div>

            <button
                class="btn btn-secondary add-fill-answer-box"
                data-index="${index}">
                ＋ 解答ボックスを追加
            </button>

            <br><br>

            <button
                class="btn btn-danger delete-fill"
                data-index="${index}">
                🗑 この穴埋め問題を削除
            </button>
        </div>
    `;
}

function renderQuizItem(item, index = null) {

    const quizIndex =
        index !== null ? index : "today";

    return `
        <div class="card setting-card">
            ${index !== null ? `<p><b>問題 ${index + 1}</b></p>` : ""}

            <p>問題文</p>
            <textarea
                class="edit-quiz-question"
                data-index="${quizIndex}"
                rows="3">${item.question || ""}</textarea>

            <p>選択肢</p>

            ${(item.choices || []).map((choice, choiceIndex) => `
                <input
                    class="edit-quiz-choice"
                    data-index="${quizIndex}"
                    data-choice-index="${choiceIndex}"
                    value="${choice}">
                <br><br>
            `).join("")}

            <p>正解番号</p>
            <input
                class="edit-quiz-answer"
                data-index="${quizIndex}"
                type="number"
                min="1"
                max="4"
                value="${Number(item.answer) + 1}">

            <p>解説</p>
            <textarea
                class="edit-quiz-explanation"
                data-index="${quizIndex}"
                rows="3">${item.explanation || ""}</textarea>
        </div>
    `;
}

publishQuestions.onclick = async () => {

    if (!confirm("この問題を学生へ公開しますか？")) return;

    const editedRef = doc(
	    db,
	    "examSubjects",
	    subjectId,
	    "units",
	    unitId,
	    "ai",
	    "edited"
	);
	
	const generatedRef = doc(
	    db,
	    "examSubjects",
	    subjectId,
	    "units",
	    unitId,
	    "ai",
	    "generated"
	);
	
	let sourceSnap = await getDoc(editedRef);
	
	if (!sourceSnap.exists()) {
	    sourceSnap = await getDoc(generatedRef);
	}
	
	if (!sourceSnap.exists()) {
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
	        "published"
	    ),
	    {
	        ...sourceSnap.data(),
	        publishedAt: new Date(),
	        publishedBy: studentNumber
	    }
	);

    alert("公開しました。");

};

saveEditedQuestions.onclick = async () => {

    if (!confirm("編集内容を保存しますか？")) return;

    const aiSnap = await getDoc(
	    doc(
	        db,
	        "examSubjects",
	        subjectId,
	        "units",
	        unitId,
	        "ai",
	        "edited"
	    )
	);

    if (!aiSnap.exists()) {
        alert("AI生成結果がありません。");
        return;
    }

    const current = aiSnap.data();

    const summary =
        document
            .getElementById("editSummary")
            .value
            .split("\n")
            .map(text => text.trim())
            .filter(text => text !== "");

    const important_points =
        document
            .getElementById("editImportantPoints")
            .value
            .split("\n")
            .map(text => text.trim())
            .filter(text => text !== "");

    const fill_blank =
    (current.fill_blank || [])
        .map((item, index) => {

            const question =
                card
                    .querySelector(".edit-fill-question")
                    .value
                    .trim();

            const answer =
                card
                    .querySelector(".edit-fill-answer")
                    .value
                    .trim();

            const answers = [];

            card
                .querySelectorAll(".edit-fill-answer-box")
                .forEach(input => {
                    const value = input.value.trim();

                    if (value !== "") {
                        answers.push(value);
                    }
                });

            return {
                ...item,
                question,
                answer,
                answers
            };

        })
        .filter(item => item !== null);

    const quiz =
        (current.quiz || []).map((item, index) => {

            const card = document.querySelector(
                `.fill-edit-card[data-index="${index}"]`
            );

            if (!card) return null;

            const question =
                document
                    .querySelector(`.edit-quiz-question[data-index="${index}"]`)
                    .value
                    .trim();

            const choices = [];

            document
                .querySelectorAll(`.edit-quiz-choice[data-index="${index}"]`)
                .forEach(input => {
                    choices.push(input.value.trim());
                });

            const answer =
                Number(
                    document
                        .querySelector(`.edit-quiz-answer[data-index="${index}"]`)
                        .value
                ) - 1;

            const explanation =
                document
                    .querySelector(`.edit-quiz-explanation[data-index="${index}"]`)
                    .value
                    .trim();

            return {
                ...item,
                question,
                choices,
                answer,
                explanation
            };

        });

    let today_question = current.today_question || null;

    if (today_question) {

        const question =
            document
                .querySelector(`.edit-quiz-question[data-index="today"]`)
                .value
                .trim();

        const choices = [];

        document
            .querySelectorAll(`.edit-quiz-choice[data-index="today"]`)
            .forEach(input => {
                choices.push(input.value.trim());
            });

        const answer =
            Number(
                document
                    .querySelector(`.edit-quiz-answer[data-index="today"]`)
                    .value
            ) - 1;

        const explanation =
            document
                .querySelector(`.edit-quiz-explanation[data-index="today"]`)
                .value
                .trim();

        today_question = {
            ...today_question,
            question,
            choices,
            answer,
            explanation
        };

    }

    await setDoc(
        doc(
            db,
            "examSubjects",
            subjectId,
            "units",
            unitId,
            "ai",
            "edited"
        ),
        {
            ...current,
            summary,
            important_points,
            fill_blank,
            quiz,
            today_question,
            editedAt: new Date(),
            editedBy: studentNumber
        }
    );

    alert("編集内容を保存しました。");

    await loadQuestions();

};

document.addEventListener("click", (e) => {

    if (e.target.classList.contains("add-fill-answer-box")) {

        const index = e.target.dataset.index;

        const area =
            document.querySelector(`.fill-answers-area[data-index="${index}"]`);

        const count =
            area.querySelectorAll(".edit-fill-answer-box").length;

        area.insertAdjacentHTML(
            "beforeend",
            `
            <input
                class="edit-fill-answer-box"
                data-index="${index}"
                data-answer-index="${count}"
                value=""
                placeholder="解答 ${count + 1}">
            <br><br>
            `
        );

        return;
    }

    if (e.target.classList.contains("delete-fill")) {

        if (!confirm("この穴埋め問題を削除しますか？")) return;

        const card =
            e.target.closest(".fill-edit-card");

        card.remove();

        return;
    }

});