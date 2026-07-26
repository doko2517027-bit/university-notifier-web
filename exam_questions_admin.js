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
        doc(
            db,
            "examSubjects",
            subjectId,
            "units",
            unitId
        )
    );

    if (!subjectSnap.exists() || !unitSnap.exists()) {

        unitInfo.textContent =
            "科目または単元が見つかりません。";

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

    /*
     * すでに編集済み・手動作成済みのデータがあれば、
     * それを最優先で表示する
     */
    const editedSnap = await getDoc(editedRef);

    if (editedSnap.exists()) {

        renderQuestions(editedSnap.data());

        return;
    }

    /*
     * AI生成結果がある場合は、
     * 編集用データとしてコピーして表示する
     */
    const generatedSnap = await getDoc(generatedRef);

    if (generatedSnap.exists()) {

        const editedData = {
            ...generatedSnap.data(),
            editedCreatedAt: new Date(),
            editedCreatedBy: studentNumber
        };

        await setDoc(
            editedRef,
            editedData
        );

        renderQuestions(editedData);

        return;
    }

    /*
     * AI生成結果がなくても、
     * 空の編集データを作って手動入力を開始できるようにする
     */
    const emptyData = {
        summary: [],
        important_points: [],
        fill_blank: [],
        quiz: [],
        today_question: null,

        manual_summary: [],
        manual_important_points: [],

        createdManually: true,
        editedCreatedAt: new Date(),
        editedCreatedBy: studentNumber
    };

    await setDoc(
        editedRef,
        emptyData
    );

    renderQuestions(emptyData);
}

function renderQuestions(data) {

    const summary =
        Array.isArray(data.summary)
            ? data.summary
            : [];

    const importantPoints =
        Array.isArray(data.important_points)
            ? data.important_points
            : [];

    const fillBlank =
        Array.isArray(data.fill_blank)
            ? data.fill_blank
            : [];

    const quiz =
        Array.isArray(data.quiz)
            ? data.quiz
            : [];

    const todayQuestion =
        data.today_question || null;

    questionList.innerHTML = `
        <div class="card setting-card">

            <h3>📌 要約</h3>

            <p>
                1行につき1項目入力してください。
            </p>

            <textarea
                id="editSummary"
                rows="6"
                placeholder="例：心不全では心拍出量が低下する。">${summary.join("\n")}</textarea>

        </div>


        <div class="card setting-card">

            <h3>⭐ 重要ポイント</h3>

            <p>
                1行につき1項目入力してください。
            </p>

            <textarea
                id="editImportantPoints"
                rows="6"
                placeholder="例：左心不全では肺うっ血が起こりやすい。">${importantPoints.join("\n")}</textarea>

        </div>


        <div class="card setting-card">

            <h3>🎯 今日の1問</h3>

            <div id="todayQuestionArea">

                ${
                    todayQuestion
                        ? renderQuizItem(
                            todayQuestion,
                            null,
                            "today"
                        )
                        : `
                            <p id="noTodayQuestion">
                                今日の1問はありません。
                            </p>

                            <button
                                class="btn btn-secondary"
                                id="addTodayQuestion">
                                ＋ 今日の1問を手動作成
                            </button>
                        `
                }

            </div>

        </div>


        <div class="card setting-card">

            <h3>📝 穴埋め</h3>

            <div id="fillBlankList">

                ${
                    fillBlank.length
                        ? fillBlank
                            .map(
                                (item, index) =>
                                    renderFillBlankItem(
                                        item,
                                        index
                                    )
                            )
                            .join("")
                        : `
                            <p id="noFillBlank">
                                穴埋め問題はありません。
                            </p>
                        `
                }

            </div>

            <br>

            <button
                class="btn btn-secondary"
                id="addFillBlank">
                ＋ 穴埋め問題を手動作成
            </button>

        </div>


        <div class="card setting-card">

            <h3>🧠 四択</h3>

            <div id="quizList">

                ${
                    quiz.length
                        ? quiz
                            .map(
                                (item, index) =>
                                    renderQuizItem(
                                        item,
                                        index,
                                        "quiz"
                                    )
                            )
                            .join("")
                        : `
                            <p id="noQuiz">
                                四択問題はありません。
                            </p>
                        `
                }

            </div>

            <br>

            <button
                class="btn btn-secondary"
                id="addQuiz">
                ＋ 四択問題を手動作成
            </button>

        </div>
    `;
}

function renderFillBlankItem(item, index) {

    const answers =
        Array.isArray(item.answers) &&
        item.answers.length > 0
            ? item.answers
            : [item.answer || ""];

    const sourceType =
        item.source_type || "ai";

    const preserveOriginal =
        item.preserve_original === true;

    return `
        <div
            class="card setting-card fill-edit-card"
            data-index="${index}"
            data-source-type="${sourceType}"
            data-preserve-original="${preserveOriginal}">

            <p>
                <b>問題 ${index + 1}</b>
            </p>

            <p>問題文</p>

            <textarea
                class="edit-fill-question"
                data-index="${index}"
                rows="3"
                placeholder="例：心臓から送り出される血液量を〇〇という。">${item.question || ""}</textarea>

            <p>模範解答表示</p>

            <input
                class="edit-fill-answer"
                data-index="${index}"
                value="${item.answer || answers.join("・")}"
                placeholder="例：心拍出量">

            <p>解答ボックス</p>

            <div
                class="fill-answers-area"
                data-index="${index}">

                ${
                    answers
                        .map(
                            (answer, answerIndex) => `
                                <input
                                    class="edit-fill-answer-box"
                                    data-index="${index}"
                                    data-answer-index="${answerIndex}"
                                    value="${answer}"
                                    placeholder="解答 ${answerIndex + 1}">

                                <br><br>
                            `
                        )
                        .join("")
                }

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

function renderQuizItem(
    item,
    index = null,
    type = "quiz"
) {

    const quizIndex =
        type === "today"
            ? "today"
            : index;

    const choices =
        Array.isArray(item.choices)
            ? [...item.choices]
            : [];

    /*
     * 選択肢が4つ未満でも、
     * 必ず4つの入力欄を表示する
     */
    while (choices.length < 4) {
        choices.push("");
    }

    const sourceType =
        item.source_type || "ai";

    const preserveOriginal =
        item.preserve_original === true;

    return `
        <div
            class="card setting-card quiz-edit-card"
            data-index="${quizIndex}"
            data-question-type="${type}"
            data-source-type="${sourceType}"
            data-preserve-original="${preserveOriginal}">

            ${
                type === "quiz"
                    ? `<p><b>問題 ${Number(index) + 1}</b></p>`
                    : ""
            }

            <p>問題文</p>

            <textarea
                class="edit-quiz-question"
                data-index="${quizIndex}"
                rows="3"
                placeholder="問題文を入力してください。">${item.question || ""}</textarea>

            <p>選択肢</p>

            ${
                choices
                    .slice(0, 4)
                    .map(
                        (choice, choiceIndex) => `
                            <input
                                class="edit-quiz-choice"
                                data-index="${quizIndex}"
                                data-choice-index="${choiceIndex}"
                                value="${choice}"
                                placeholder="選択肢 ${choiceIndex + 1}">

                            <br><br>
                        `
                    )
                    .join("")
            }

            <p>正解番号</p>

            <input
                class="edit-quiz-answer"
                data-index="${quizIndex}"
                type="number"
                min="1"
                max="4"
                value="${
                    Number.isInteger(Number(item.answer))
                        ? Number(item.answer) + 1
                        : 1
                }">

            <p>解説</p>

            <textarea
                class="edit-quiz-explanation"
                data-index="${quizIndex}"
                rows="3"
                placeholder="解説を入力してください。">${item.explanation || ""}</textarea>

            <br><br>

            ${
                type === "today"
                    ? `
                        <button
                            class="btn btn-danger"
                            id="deleteTodayQuestion">
                            🗑 今日の1問を削除
                        </button>
                    `
                    : `
                        <button
                            class="btn btn-danger delete-quiz"
                            data-index="${index}">
                            🗑 この四択問題を削除
                        </button>
                    `
            }

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

    if (!confirm("編集内容を保存しますか？")) {
        return;
    }

    const editedRef = doc(
        db,
        "examSubjects",
        subjectId,
        "units",
        unitId,
        "ai",
        "edited"
    );

    const editedSnap =
        await getDoc(editedRef);

    /*
     * AI生成結果がなくても保存可能にする
     */
    const current =
        editedSnap.exists()
            ? editedSnap.data()
            : {};

    const summaryInput =
        document.getElementById("editSummary");

    const importantPointsInput =
        document.getElementById(
            "editImportantPoints"
        );

    if (!summaryInput || !importantPointsInput) {

        alert(
            "問題入力欄を読み込めませんでした。"
        );

        return;
    }

    const summary =
        summaryInput
            .value
            .split("\n")
            .map(text => text.trim())
            .filter(text => text !== "");

    const important_points =
        importantPointsInput
            .value
            .split("\n")
            .map(text => text.trim())
            .filter(text => text !== "");

    /*
     * 穴埋め問題
     */
    const fill_blank =
        Array.from(
            document.querySelectorAll(
                ".fill-edit-card"
            )
        )
            .map(card => {

                const question =
                    card
                        .querySelector(
                            ".edit-fill-question"
                        )
                        ?.value
                        .trim() || "";

                const answer =
                    card
                        .querySelector(
                            ".edit-fill-answer"
                        )
                        ?.value
                        .trim() || "";

                const answers =
                    Array.from(
                        card.querySelectorAll(
                            ".edit-fill-answer-box"
                        )
                    )
                        .map(input =>
                            input.value.trim()
                        )
                        .filter(value =>
                            value !== ""
                        );

                return {
                    question,
                    answer,
                    answers,

                    /*
                     * 保存ボタンを押した内容は、
                     * 次回のAI生成で消さない
                     */
                    source_type: "manual",
                    preserve_original: true,
                    edited_manually: true
                };

            })
            .filter(item =>
                item.question !== ""
            );

    /*
     * 四択問題
     */
    const quiz =
        Array.from(
            document.querySelectorAll(
                `.quiz-edit-card[data-question-type="quiz"]`
            )
        )
            .map(card => {

                const index =
                    card.dataset.index;

                const question =
                    card
                        .querySelector(
                            ".edit-quiz-question"
                        )
                        ?.value
                        .trim() || "";

                const choices =
                    Array.from(
                        card.querySelectorAll(
                            ".edit-quiz-choice"
                        )
                    )
                        .map(input =>
                            input.value.trim()
                        );

                const answerInput =
                    card.querySelector(
                        ".edit-quiz-answer"
                    );

                const explanation =
                    card
                        .querySelector(
                            ".edit-quiz-explanation"
                        )
                        ?.value
                        .trim() || "";

                const answer =
                    Math.max(
                        0,
                        Math.min(
                            3,
                            Number(
                                answerInput?.value || 1
                            ) - 1
                        )
                    );

                return {
                    question,
                    choices,
                    answer,
                    explanation,

                    source_type: "manual",
                    preserve_original: true,
                    edited_manually: true
                };

            })
            .filter(item =>
                item.question !== ""
            );

    /*
     * 今日の1問
     */
    let today_question = null;

    const todayCard =
        document.querySelector(
            `.quiz-edit-card[data-question-type="today"]`
        );

    if (todayCard) {

        const question =
            todayCard
                .querySelector(
                    ".edit-quiz-question"
                )
                ?.value
                .trim() || "";

        const choices =
            Array.from(
                todayCard.querySelectorAll(
                    ".edit-quiz-choice"
                )
            )
                .map(input =>
                    input.value.trim()
                );

        const answerInput =
            todayCard.querySelector(
                ".edit-quiz-answer"
            );

        const answer =
            Math.max(
                0,
                Math.min(
                    3,
                    Number(
                        answerInput?.value || 1
                    ) - 1
                )
            );

        const explanation =
            todayCard
                .querySelector(
                    ".edit-quiz-explanation"
                )
                ?.value
                .trim() || "";

        if (question !== "") {

            today_question = {
                question,
                choices,
                answer,
                explanation,

                source_type: "manual",
                preserve_original: true,
                edited_manually: true
            };
        }
    }

    /*
     * 入力チェック
     */
    const invalidFillBlank =
        fill_blank.find(item =>
            item.answers.length === 0 &&
            item.answer === ""
        );

    if (invalidFillBlank) {

        alert(
            "穴埋め問題の解答を入力してください。"
        );

        return;
    }

    const invalidQuiz =
        quiz.find(item =>
            item.choices.length !== 4 ||
            item.choices.some(choice =>
                choice === ""
            )
        );

    if (invalidQuiz) {

        alert(
            "四択問題の選択肢を4つすべて入力してください。"
        );

        return;
    }

    if (
        today_question &&
        today_question.choices.some(
            choice => choice === ""
        )
    ) {

        alert(
            "今日の1問の選択肢を4つすべて入力してください。"
        );

        return;
    }

    await setDoc(
        editedRef,
        {
            ...current,

            summary,
            important_points,
            fill_blank,
            quiz,
            today_question,

            /*
             * AI再生成時に残すための項目
             */
            manual_summary: summary,
            manual_important_points:
                important_points,

            hasManualContent: true,

            editedAt: new Date(),
            editedBy: studentNumber
        }
    );

    alert("編集内容を保存しました。");

    await loadQuestions();
};

document.addEventListener("click", (e) => {

    /*
     * 今日の1問を手動作成
     */
    if (e.target.id === "addTodayQuestion") {

        const area =
            document.getElementById(
                "todayQuestionArea"
            );

        area.innerHTML =
            renderQuizItem(
                {
                    question: "",
                    choices: [
                        "",
                        "",
                        "",
                        ""
                    ],
                    answer: 0,
                    explanation: "",
                    source_type: "manual",
                    preserve_original: true
                },
                null,
                "today"
            );

        return;
    }

    /*
     * 今日の1問を削除
     */
    if (e.target.id === "deleteTodayQuestion") {

        if (
            !confirm(
                "今日の1問を削除しますか？"
            )
        ) {
            return;
        }

        const area =
            document.getElementById(
                "todayQuestionArea"
            );

        area.innerHTML = `
            <p id="noTodayQuestion">
                今日の1問はありません。
            </p>

            <button
                class="btn btn-secondary"
                id="addTodayQuestion">
                ＋ 今日の1問を手動作成
            </button>
        `;

        return;
    }

    /*
     * 穴埋め問題を手動作成
     */
    if (e.target.id === "addFillBlank") {

        const list =
            document.getElementById(
                "fillBlankList"
            );

        document
            .getElementById("noFillBlank")
            ?.remove();

        const index =
            document.querySelectorAll(
                ".fill-edit-card"
            ).length;

        list.insertAdjacentHTML(
            "beforeend",
            renderFillBlankItem(
                {
                    question: "",
                    answer: "",
                    answers: [""],
                    source_type: "manual",
                    preserve_original: true
                },
                index
            )
        );

        return;
    }

    /*
     * 四択問題を手動作成
     */
    if (e.target.id === "addQuiz") {

        const list =
            document.getElementById(
                "quizList"
            );

        document
            .getElementById("noQuiz")
            ?.remove();

        const index =
            document.querySelectorAll(
                `.quiz-edit-card[data-question-type="quiz"]`
            ).length;

        list.insertAdjacentHTML(
            "beforeend",
            renderQuizItem(
                {
                    question: "",
                    choices: [
                        "",
                        "",
                        "",
                        ""
                    ],
                    answer: 0,
                    explanation: "",
                    source_type: "manual",
                    preserve_original: true
                },
                index,
                "quiz"
            )
        );

        return;
    }

    /*
     * 穴埋めの解答ボックス追加
     */
    if (
        e.target.classList.contains(
            "add-fill-answer-box"
        )
    ) {

        const card =
            e.target.closest(
                ".fill-edit-card"
            );

        if (!card) {
            return;
        }

        const area =
            card.querySelector(
                ".fill-answers-area"
            );

        const count =
            area.querySelectorAll(
                ".edit-fill-answer-box"
            ).length;

        area.insertAdjacentHTML(
            "beforeend",
            `
                <input
                    class="edit-fill-answer-box"
                    data-answer-index="${count}"
                    value=""
                    placeholder="解答 ${count + 1}">

                <br><br>
            `
        );

        return;
    }

    /*
     * 穴埋め問題削除
     */
    if (
        e.target.classList.contains(
            "delete-fill"
        )
    ) {

        if (
            !confirm(
                "この穴埋め問題を削除しますか？"
            )
        ) {
            return;
        }

        e.target
            .closest(".fill-edit-card")
            ?.remove();

        const list =
            document.getElementById(
                "fillBlankList"
            );

        if (
            document.querySelectorAll(
                ".fill-edit-card"
            ).length === 0
        ) {

            list.innerHTML = `
                <p id="noFillBlank">
                    穴埋め問題はありません。
                </p>
            `;
        }

        return;
    }

    /*
     * 四択問題削除
     */
    if (
        e.target.classList.contains(
            "delete-quiz"
        )
    ) {

        if (
            !confirm(
                "この四択問題を削除しますか？"
            )
        ) {
            return;
        }

        e.target
            .closest(".quiz-edit-card")
            ?.remove();

        const list =
            document.getElementById(
                "quizList"
            );

        if (
            document.querySelectorAll(
                `.quiz-edit-card[data-question-type="quiz"]`
            ).length === 0
        ) {

            list.innerHTML = `
                <p id="noQuiz">
                    四択問題はありません。
                </p>
            `;
        }

        return;
    }
});