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

const params =
    new URLSearchParams(
        location.search
    );

const subjectId =
    params.get("subjectId");

const unitId =
    params.get("unitId");

const themeButton =
    document.getElementById(
        "themeButton"
    );

const topProfileImage =
    document.getElementById(
        "topProfileImage"
    );

const unitInfo =
    document.getElementById(
        "unitInfo"
    );

const questionList =
    document.getElementById(
        "questionList"
    );

const publishQuestions =
    document.getElementById(
        "publishQuestions"
    );

const saveEditedQuestions =
    document.getElementById(
        "saveEditedQuestions"
    );

setupTheme(themeButton);

const admin =
    await isAdmin();

if (!admin) {

    alert(
        "管理者のみアクセスできます。"
    );

    location.href =
        "index.html";
}

await initializePage([
    loadProfileImage(
        topProfileImage
    ),
    loadQuestions()
]);

document
    .getElementById("backButton")
    .onclick = () => {

        history.back();

    };

document
    .getElementById("profileButton")
    .onclick = () => {

        location.href =
            "profile.html";

    };

async function loadQuestions() {

    const subjectSnap =
        await getDoc(
            doc(
                db,
                "examSubjects",
                subjectId
            )
        );

    const unitSnap =
        await getDoc(
            doc(
                db,
                "examSubjects",
                subjectId,
                "units",
                unitId
            )
        );

    if (
        !subjectSnap.exists() ||
        !unitSnap.exists()
    ) {

        unitInfo.textContent =
            "科目または単元が見つかりません。";

        questionList.innerHTML =
            "";

        return;
    }

    unitInfo.textContent =
        `${subjectSnap.data().name} / ${unitSnap.data().name}`;

    const editedRef =
        doc(
            db,
            "examSubjects",
            subjectId,
            "units",
            unitId,
            "ai",
            "edited"
        );

    const generatedRef =
        doc(
            db,
            "examSubjects",
            subjectId,
            "units",
            unitId,
            "ai",
            "generated"
        );

    const editedSnap =
        await getDoc(
            editedRef
        );

    if (editedSnap.exists()) {

        renderQuestions(
            editedSnap.data()
        );

        return;
    }

    const generatedSnap =
        await getDoc(
            generatedRef
        );

    if (generatedSnap.exists()) {

        const editedData = {
            ...generatedSnap.data(),

            editedCreatedAt:
                new Date(),

            editedCreatedBy:
                studentNumber
        };

        await setDoc(
            editedRef,
            editedData
        );

        renderQuestions(
            editedData
        );

        return;
    }

    const emptyData = {
        summary: [],
        important_points: [],
        fill_blank: [],
        quiz: [],
        today_question: null,

        manual_summary: [],
        manual_important_points: [],

        createdManually: true,

        editedCreatedAt:
            new Date(),

        editedCreatedBy:
            studentNumber
    };

    await setDoc(
        editedRef,
        emptyData
    );

    renderQuestions(
        emptyData
    );
}

function renderQuestions(data) {

    const summary =
        Array.isArray(data.summary)
            ? data.summary
            : (
                typeof data.summary ===
                    "string" &&
                data.summary.trim() !== ""
            )
                ? [
                    data.summary.trim()
                ]
                : [];

    const importantPoints =
        Array.isArray(
            data.important_points
        )
            ? data.important_points
            : [];

    const importantPointImages =
        Array.isArray(
            data.important_point_images
        )
            ? data.important_point_images
            : [];

    const fillBlank =
        Array.isArray(
            data.fill_blank
        )
            ? data.fill_blank
            : [];

    const quiz =
        Array.isArray(data.quiz)
            ? data.quiz
            : [];

    const todayQuestion =
        data.today_question ||
        null;

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

            <hr>

            <h4>重要ポイント画像</h4>

            <p>
                図や写真と、その画像で覚える内容を登録できます。
            </p>

            <div id="importantPointImageList">

                ${
                    importantPointImages
                        .map(
                            (item, index) =>
                                renderImportantPointImageItem(
                                    item,
                                    index
                                )
                        )
                        .join("")
                }

            </div>

            <button
                type="button"
                class="btn btn-secondary"
                id="addImportantPointImage">

                ＋ 重要ポイント画像を追加

            </button>

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
                                (
                                    item,
                                    index
                                ) =>
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

            <h3>🧠 選択問題</h3>

            <div id="quizList">

                ${
                    quiz.length
                        ? quiz
                            .map(
                                (
                                    item,
                                    index
                                ) =>
                                    renderQuizItem(
                                        item,
                                        index,
                                        "quiz"
                                    )
                            )
                            .join("")
                        : `
                            <p id="noQuiz">
                                選択問題はありません。
                            </p>
                        `
                }

            </div>

            <br>

            <button
                class="btn btn-secondary"
                id="addQuiz">
                ＋ 選択問題を手動作成
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
        Array.isArray(
            item.choices
        )
            ? [
                ...item.choices
            ]
            : [];

    while (
        choices.length < 4
    ) {
        choices.push("");
    }

    const sourceType =
        item.source_type ||
        "ai";

    const preserveOriginal =
        item.preserve_original ===
        true;

    let answer =
        Number.isInteger(
            Number(item.answer)
        )
            ? Number(item.answer)
            : 0;

    answer =
        Math.max(
            0,
            Math.min(
                choices.length - 1,
                answer
            )
        );

    return `
        <div
            class="card setting-card quiz-edit-card"
            data-index="${quizIndex}"
            data-question-type="${type}"
            data-source-type="${sourceType}"
            data-preserve-original="${preserveOriginal}">

            ${
                type === "quiz"
                    ? `
                        <p>
                            <b>
                                問題 ${Number(index) + 1}
                            </b>
                        </p>
                    `
                    : ""
            }

            <p>問題文</p>

            <textarea
                class="edit-quiz-question"
                data-index="${quizIndex}"
                rows="3"
                placeholder="問題文を入力してください。">${item.question || ""}</textarea>
                ${renderQuestionImageEditor(item)}

            <p>選択肢</p>

            <div class="quiz-choices-area">

                ${
                    choices
                        .map(
                            (
                                choice,
                                choiceIndex
                            ) => `
                                <div
                                    class="quiz-choice-row"
                                    data-choice-index="${choiceIndex}">

                                    <input
                                        class="edit-quiz-choice"
                                        data-index="${quizIndex}"
                                        data-choice-index="${choiceIndex}"
                                        value="${choice}"
                                        placeholder="選択肢 ${choiceIndex + 1}">

                                    <button
                                        type="button"
                                        class="btn btn-danger delete-quiz-choice">
                                        −
                                    </button>

                                </div>

                                <br>
                            `
                        )
                        .join("")
                }

            </div>

            <button
                type="button"
                class="btn btn-secondary add-quiz-choice">
                ＋ 選択肢を追加
            </button>

            <p>正解番号</p>

            <input
                class="edit-quiz-answer"
                data-index="${quizIndex}"
                type="number"
                min="1"
                max="${choices.length}"
                value="${answer + 1}">

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
                            🗑 この選択問題を削除
                        </button>
                    `
            }

        </div>
    `;
}

function updateQuizChoiceIndexes(
    card
) {

    const rows =
        Array.from(
            card.querySelectorAll(
                ".quiz-choice-row"
            )
        );

    rows.forEach(
        (
            row,
            choiceIndex
        ) => {

            row.dataset.choiceIndex =
                choiceIndex;

            const input =
                row.querySelector(
                    ".edit-quiz-choice"
                );

            if (input) {

                input.dataset.choiceIndex =
                    choiceIndex;

                input.placeholder =
                    `選択肢 ${choiceIndex + 1}`;
            }
        }
    );

    const answerInput =
        card.querySelector(
            ".edit-quiz-answer"
        );

    if (!answerInput) {
        return;
    }

    answerInput.max =
        Math.max(
            1,
            rows.length
        );

    let answer =
        Number(
            answerInput.value ||
            1
        );

    answer =
        Math.max(
            1,
            Math.min(
                rows.length,
                answer
            )
        );

    answerInput.value =
        answer;
}

function renderFillBlankItem(
    item,
    index
) {

    const answers =
        Array.isArray(
            item.answers
        ) &&
        item.answers.length > 0
            ? item.answers
            : [
                item.answer ||
                ""
            ];

    const sourceType =
        item.source_type ||
        "ai";

    const preserveOriginal =
        item.preserve_original ===
        true;

    return `
        <div
            class="card setting-card fill-edit-card"
            data-index="${index}"
            data-source-type="${sourceType}"
            data-preserve-original="${preserveOriginal}">

            <p>
                <b>
                    問題 ${index + 1}
                </b>
            </p>

            <p>問題文</p>

            <textarea
                class="edit-fill-question"
                data-index="${index}"
                rows="3"
                placeholder="例：心臓から送り出される血液量を〇〇という。">${item.question || ""}</textarea>
                ${renderQuestionImageEditor(item)}

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
                            (
                                answer,
                                answerIndex
                            ) => `
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

function renderQuestionImageEditor(item = {}) {

    const imageUrl =
        String(
            item.imageUrl || ""
        );

    const imagePublicId =
        String(
            item.imagePublicId || ""
        );

    const imageDescription =
        String(
            item.imageDescription || ""
        );

    return `
        <div class="question-image-editor">

            <p>
                <b>問題画像（任意）</b>
            </p>

            <input
                type="file"
                accept="image/*"
                class="edit-question-image-file">

            <input
                type="hidden"
                class="edit-question-image-url"
                value="${escapeAdminAttribute(imageUrl)}">

            <input
                type="hidden"
                class="edit-question-image-public-id"
                value="${escapeAdminAttribute(imagePublicId)}">

            <textarea
                class="edit-question-image-description"
                rows="2"
                placeholder="画像の説明を入力してください。例：心臓の血液循環を示した図">${escapeAdminHtml(imageDescription)}</textarea>

            <div class="question-image-preview">

                ${
                    imageUrl
                        ? `
                            <img
                                src="${escapeAdminAttribute(imageUrl)}"
                                alt="${escapeAdminAttribute(
                                    imageDescription ||
                                    "問題画像"
                                )}">

                            <button
                                type="button"
                                class="btn btn-danger remove-question-image">

                                画像を削除

                            </button>
                        `
                        : `
                            <small>
                                画像は登録されていません。
                            </small>
                        `
                }

            </div>

        </div>
    `;
}

function renderImportantPointImageItem(
    item = {},
    index = 0
) {

    return `
        <div
            class="card setting-card important-point-image-card"
            data-index="${index}">

            <p>
                <b>重要ポイント画像 ${index + 1}</b>
            </p>

            ${renderQuestionImageEditor({
                imageUrl:
                    item.imageUrl || "",

                imagePublicId:
                    item.imagePublicId || "",

                imageDescription:
                    item.description || ""
            })}

            <button
                type="button"
                class="btn btn-danger delete-important-point-image">

                この画像ポイントを削除

            </button>

        </div>
    `;
}

async function uploadQuestionImage(
    file,
    editor
) {

    if (!file) {
        return;
    }

    if (
        !String(file.type)
            .startsWith("image/")
    ) {

        alert(
            "画像ファイルを選択してください。"
        );

        return;
    }

    if (
        file.size >
        10 * 1024 * 1024
    ) {

        alert(
            "画像は10MB以下にしてください。"
        );

        return;
    }

    const fileInput =
        editor.querySelector(
            ".edit-question-image-file"
        );

    const urlInput =
        editor.querySelector(
            ".edit-question-image-url"
        );

    const publicIdInput =
        editor.querySelector(
            ".edit-question-image-public-id"
        );

    const descriptionInput =
        editor.querySelector(
            ".edit-question-image-description"
        );

    const preview =
        editor.querySelector(
            ".question-image-preview"
        );

    try {

        if (fileInput) {
            fileInput.disabled = true;
        }

        if (preview) {

            preview.innerHTML = `
                <p>
                    画像をアップロード中...
                </p>
            `;
        }

        const formData =
            new FormData();

        formData.append(
            "file",
            file
        );

        formData.append(
            "upload_preset",
            "caremate_upload"
        );

        const response =
            await fetch(
                "https://api.cloudinary.com/v1_1/vpctonjf/image/upload",
                {
                    method: "POST",
                    body: formData
                }
            );

        const data =
            await response.json();

        if (
            !response.ok ||
            !data.secure_url
        ) {

            throw new Error(
                data.error?.message ||
                "画像URLを取得できませんでした。"
            );
        }

        if (urlInput) {

            urlInput.value =
                data.secure_url;
        }

        if (publicIdInput) {

            publicIdInput.value =
                data.public_id || "";
        }

        if (preview) {

            preview.innerHTML = `
                <img
                    src="${escapeAdminAttribute(data.secure_url)}"
                    alt="${escapeAdminAttribute(
                        descriptionInput?.value ||
                        "問題画像"
                    )}">

                <button
                    type="button"
                    class="btn btn-danger remove-question-image">

                    画像を削除

                </button>
            `;
        }

    } catch (error) {

        console.error(
            "問題画像アップロードエラー:",
            error
        );

        alert(
            `画像をアップロードできませんでした。\n${error.message}`
        );

        if (preview) {

            preview.innerHTML = `
                <small>
                    画像は登録されていません。
                </small>
            `;
        }

    } finally {

        if (fileInput) {

            fileInput.disabled =
                false;

            fileInput.value =
                "";
        }

    }
}

function readImageData(card) {

    return {
        imageUrl:
            card
                .querySelector(
                    ".edit-question-image-url"
                )
                ?.value
                .trim() ||
            "",

        imagePublicId:
            card
                .querySelector(
                    ".edit-question-image-public-id"
                )
                ?.value
                .trim() ||
            "",

        imageDescription:
            card
                .querySelector(
                    ".edit-question-image-description"
                )
                ?.value
                .trim() ||
            ""
    };
}

publishQuestions.onclick =
    async () => {

        if (
            !confirm(
                "この問題を学生へ公開しますか？"
            )
        ) {
            return;
        }

        const editedRef =
            doc(
                db,
                "examSubjects",
                subjectId,
                "units",
                unitId,
                "ai",
                "edited"
            );

        const generatedRef =
            doc(
                db,
                "examSubjects",
                subjectId,
                "units",
                unitId,
                "ai",
                "generated"
            );

        let sourceSnap =
            await getDoc(
                editedRef
            );

        if (
            !sourceSnap.exists()
        ) {

            sourceSnap =
                await getDoc(
                    generatedRef
                );
        }

        if (
            !sourceSnap.exists()
        ) {

            alert(
                "AI生成結果がありません。"
            );

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

                publishedAt:
                    new Date(),

                publishedBy:
                    studentNumber
            }
        );

        alert(
            "公開しました。"
        );

    };

saveEditedQuestions.onclick =
    async () => {

        if (
            !confirm(
                "編集内容を保存しますか？"
            )
        ) {
            return;
        }

        const editedRef =
            doc(
                db,
                "examSubjects",
                subjectId,
                "units",
                unitId,
                "ai",
                "edited"
            );

        const editedSnap =
            await getDoc(
                editedRef
            );

        const current =
            editedSnap.exists()
                ? editedSnap.data()
                : {};

        const summaryInput =
            document.getElementById(
                "editSummary"
            );

        const importantPointsInput =
            document.getElementById(
                "editImportantPoints"
            );

        if (
            !summaryInput ||
            !importantPointsInput
        ) {

            alert(
                "問題入力欄を読み込めませんでした。"
            );

            return;
        }

        const summary =
            summaryInput
                .value
                .split("\n")
                .map(text =>
                    text.trim()
                )
                .filter(text =>
                    text !== ""
                );

        const important_points =
            importantPointsInput
                .value
                .split("\n")
                .map(text =>
                    text.trim()
                )
                .filter(text =>
                    text !== ""
                );
        
        const important_point_images =
            Array.from(
                document.querySelectorAll(
                    ".important-point-image-card"
                )
            )
                .map(card => {

                    const imageData =
                        readImageData(card);

                    return {
                        imageUrl:
                            imageData.imageUrl,

                        imagePublicId:
                            imageData.imagePublicId,

                        description:
                            imageData.imageDescription
                    };

                })
                .filter(item =>
                    item.imageUrl !== ""
                );

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
                            .trim() ||
                        "";

                    const answer =
                        card
                            .querySelector(
                                ".edit-fill-answer"
                            )
                            ?.value
                            .trim() ||
                        "";

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

                    const imageData =
                        readImageData(card);

                    return {
                        question,
                        answer,
                        answers,

                        ...imageData,

                        source_type:
                            "manual",

                        preserve_original:
                            true,

                        edited_manually:
                            true
                    };

                })
                .filter(item =>
                    item.question !== ""
                );

        const quiz =
            Array.from(
                document.querySelectorAll(
                    `.quiz-edit-card[data-question-type="quiz"]`
                )
            )
                .map(card => {

                    const question =
                        card
                            .querySelector(
                                ".edit-quiz-question"
                            )
                            ?.value
                            .trim() ||
                        "";

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
                            .trim() ||
                        "";

                    const answer =
                        Math.max(
                            0,
                            Math.min(
                                choices.length - 1,
                                Number(
                                    answerInput?.value ||
                                    1
                                ) - 1
                            )
                        );

                    return {
                        question,
                        choices,
                        answer,
                        explanation,

                        source_type:
                            "manual",

                        preserve_original:
                            true,

                        edited_manually:
                            true
                    };

                })
                .filter(item =>
                    item.question !== ""
                );

        let today_question =
            null;

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
                    .trim() ||
                "";

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
                        choices.length - 1,
                        Number(
                            answerInput?.value ||
                            1
                        ) - 1
                    )
                );

            const explanation =
                todayCard
                    .querySelector(
                        ".edit-quiz-explanation"
                    )
                    ?.value
                    .trim() ||
                "";

            const imageData =
                readImageData(
                    todayCard
                );

            if (
                question !== ""
            ) {

                today_question = {
                    question,
                    choices,
                    answer,
                    explanation,

                    ...imageData,

                    source_type:
                        "manual",

                    preserve_original:
                        true,

                    edited_manually:
                        true
                };
            }
        }

        const invalidFillBlank =
            fill_blank.find(
                item =>
                    item.answers.length ===
                        0 &&
                    item.answer === ""
            );

        if (
            invalidFillBlank
        ) {

            alert(
                "穴埋め問題の解答を入力してください。"
            );

            return;
        }

        const invalidQuiz =
            quiz.find(
                item =>
                    item.choices.length <
                        4 ||
                    item.choices.some(
                        choice =>
                            choice === ""
                    ) ||
                    item.answer < 0 ||
                    item.answer >=
                        item.choices.length
            );

        if (
            invalidQuiz
        ) {

            alert(
                "選択問題には4つ以上の選択肢を入力し、正解番号を正しく指定してください。"
            );

            return;
        }

        if (
            today_question &&
            (
                today_question
                    .choices
                    .length < 4 ||
                today_question
                    .choices
                    .some(
                        choice =>
                            choice === ""
                    ) ||
                today_question.answer <
                    0 ||
                today_question.answer >=
                    today_question
                        .choices
                        .length
            )
        ) {

            alert(
                "今日の1問には4つ以上の選択肢を入力し、正解番号を正しく指定してください。"
            );

            return;
        }

        await setDoc(
            editedRef,
            {
                ...current,

                important_points,
                important_point_images,
                fill_blank,
                quiz,
                today_question,

                manual_summary:
                    summary,

                manual_important_points:
                    important_points,

                hasManualContent:
                    true,

                editedAt:
                    new Date(),

                editedBy:
                    studentNumber
            }
        );

        alert(
            "編集内容を保存しました。"
        );

        await loadQuestions();

    };

document.addEventListener(
    "click",
    e => {

        if (
            e.target.classList.contains(
                "remove-question-image"
            )
        ) {

            const editor =
                e.target.closest(
                    ".question-image-editor"
                );

            if (!editor) {
                return;
            }

            editor.querySelector(
                ".edit-question-image-url"
            ).value = "";

            editor.querySelector(
                ".edit-question-image-public-id"
            ).value = "";

            editor.querySelector(
                ".edit-question-image-file"
            ).value = "";

            editor.querySelector(
                ".question-image-preview"
            ).innerHTML = `
                <small>
                    画像は登録されていません。
                </small>
            `;

            return;
        }

        if (
            e.target.id ===
            "addImportantPointImage"
        ) {

            const list =
                document.getElementById(
                    "importantPointImageList"
                );

            const index =
                list.querySelectorAll(
                    ".important-point-image-card"
                ).length;

            list.insertAdjacentHTML(
                "beforeend",
                renderImportantPointImageItem(
                    {},
                    index
                )
            );

            return;
        }

        if (
            e.target.classList.contains(
                "delete-important-point-image"
            )
        ) {

            if (
                !confirm(
                    "この重要ポイント画像を削除しますか？"
                )
            ) {
                return;
            }

            e.target
                .closest(
                    ".important-point-image-card"
                )
                ?.remove();

            return;
        }

        if (
            e.target.id ===
            "addTodayQuestion"
        ) {

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

                        explanation:
                            "",

                        source_type:
                            "manual",

                        preserve_original:
                            true
                    },
                    null,
                    "today"
                );

            return;
        }

        if (
            e.target.id ===
            "deleteTodayQuestion"
        ) {

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

        if (
            e.target.id ===
            "addFillBlank"
        ) {

            const list =
                document.getElementById(
                    "fillBlankList"
                );

            document
                .getElementById(
                    "noFillBlank"
                )
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

                        answers: [
                            ""
                        ],

                        source_type:
                            "manual",

                        preserve_original:
                            true
                    },
                    index
                )
            );

            return;
        }

        if (
            e.target.id ===
            "addQuiz"
        ) {

            const list =
                document.getElementById(
                    "quizList"
                );

            document
                .getElementById(
                    "noQuiz"
                )
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

                        explanation:
                            "",

                        source_type:
                            "manual",

                        preserve_original:
                            true
                    },
                    index,
                    "quiz"
                )
            );

            return;
        }

        if (
            e.target.classList.contains(
                "add-quiz-choice"
            )
        ) {

            const card =
                e.target.closest(
                    ".quiz-edit-card"
                );

            if (!card) {
                return;
            }

            const area =
                card.querySelector(
                    ".quiz-choices-area"
                );

            if (!area) {
                return;
            }

            const quizIndex =
                card.dataset.index;

            const choiceIndex =
                area
                    .querySelectorAll(
                        ".quiz-choice-row"
                    )
                    .length;

            area.insertAdjacentHTML(
                "beforeend",
                `
                    <div
                        class="quiz-choice-row"
                        data-choice-index="${choiceIndex}">

                        <input
                            class="edit-quiz-choice"
                            data-index="${quizIndex}"
                            data-choice-index="${choiceIndex}"
                            value=""
                            placeholder="選択肢 ${choiceIndex + 1}">

                        <button
                            type="button"
                            class="btn btn-danger delete-quiz-choice">
                            −
                        </button>

                    </div>

                    <br>
                `
            );

            updateQuizChoiceIndexes(
                card
            );

            return;
        }

        if (
            e.target.classList.contains(
                "delete-quiz-choice"
            )
        ) {

            const card =
                e.target.closest(
                    ".quiz-edit-card"
                );

            if (!card) {
                return;
            }

            const rows =
                card.querySelectorAll(
                    ".quiz-choice-row"
                );

            if (
                rows.length <= 4
            ) {

                alert(
                    "選択肢は最低4つ必要です。"
                );

                return;
            }

            const row =
                e.target.closest(
                    ".quiz-choice-row"
                );

            const deletedNumber =
                Number(
                    row?.dataset
                        .choiceIndex ||
                    0
                ) + 1;

            const answerInput =
                card.querySelector(
                    ".edit-quiz-answer"
                );

            let currentAnswer =
                Number(
                    answerInput?.value ||
                    1
                );

            const nextBreak =
                row?.nextElementSibling;

            row?.remove();

            if (
                nextBreak &&
                nextBreak.tagName ===
                    "BR"
            ) {
                nextBreak.remove();
            }

            if (
                currentAnswer >
                deletedNumber
            ) {

                currentAnswer--;

            } else if (
                currentAnswer ===
                deletedNumber
            ) {

                currentAnswer =
                    1;
            }

            if (answerInput) {

                answerInput.value =
                    currentAnswer;
            }

            updateQuizChoiceIndexes(
                card
            );

            return;
        }

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
                area
                    .querySelectorAll(
                        ".edit-fill-answer-box"
                    )
                    .length;

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
                .closest(
                    ".fill-edit-card"
                )
                ?.remove();

            const list =
                document.getElementById(
                    "fillBlankList"
                );

            if (
                document
                    .querySelectorAll(
                        ".fill-edit-card"
                    )
                    .length === 0
            ) {

                list.innerHTML = `
                    <p id="noFillBlank">
                        穴埋め問題はありません。
                    </p>
                `;
            }

            return;
        }

        if (
            e.target.classList.contains(
                "delete-quiz"
            )
        ) {

            if (
                !confirm(
                    "この選択問題を削除しますか？"
                )
            ) {
                return;
            }

            e.target
                .closest(
                    ".quiz-edit-card"
                )
                ?.remove();

            const list =
                document.getElementById(
                    "quizList"
                );

            if (
                document
                    .querySelectorAll(
                        `.quiz-edit-card[data-question-type="quiz"]`
                    )
                    .length === 0
            ) {

                list.innerHTML = `
                    <p id="noQuiz">
                        選択問題はありません。
                    </p>
                `;
            }

            return;
        }
    }
);

const jsonImport =
    document.getElementById(
        "jsonImport"
    );

const previewJson =
    document.getElementById(
        "previewJson"
    );

const importJson =
    document.getElementById(
        "importJson"
    );

const jsonPreview =
    document.getElementById(
        "jsonPreview"
    );

previewJson.onclick =
    () => {

        try {

            const data =
                JSON.parse(
                    jsonImport.value
                );

            jsonPreview.innerHTML = `
                <p>
                    要約 :
                    ${data.summary ? "〇" : "×"}
                </p>

                <p>
                    重要ポイント :
                    ${data.important_points?.length || 0}
                </p>

                <p>
                    穴埋め :
                    ${data.fill_blank?.length || 0}
                </p>

                <p>
                    選択問題 :
                    ${data.quiz?.length || 0}
                </p>

                <p>
                    今日の1問 :
                    ${data.today_question ? "〇" : "×"}
                </p>
            `;

        } catch (e) {

            alert(
                "JSONが正しくありません"
            );

        }
    };

importJson.onclick =
    async () => {

        try {

            const data =
                JSON.parse(
                    jsonImport.value
                );

            if (
                !data ||
                typeof data !==
                    "object" ||
                Array.isArray(data)
            ) {

                throw new Error(
                    "JSONの形式が正しくありません。"
                );
            }

            const editedRef =
                doc(
                    db,
                    "examSubjects",
                    subjectId,
                    "units",
                    unitId,
                    "ai",
                    "edited"
                );

            const editedSnap =
                await getDoc(
                    editedRef
                );

            const current =
                editedSnap.exists()
                    ? editedSnap.data()
                    : {};

            const currentSummary =
                Array.isArray(
                    current.summary
                )
                    ? current.summary
                    : (
                        typeof current.summary ===
                            "string" &&
                        current.summary.trim() !==
                            ""
                    )
                        ? [
                            current.summary.trim()
                        ]
                        : [];

            const importedSummary =
                Array.isArray(
                    data.summary
                )
                    ? data.summary
                        .map(item =>
                            String(
                                item
                            ).trim()
                        )
                        .filter(item =>
                            item !== ""
                        )
                    : (
                        typeof data.summary ===
                            "string" &&
                        data.summary.trim() !==
                            ""
                    )
                        ? [
                            data.summary.trim()
                        ]
                        : [];

            const currentImportantPoints =
                Array.isArray(
                    current
                        .important_points
                )
                    ? current
                        .important_points
                    : [];

            const importedImportantPoints =
                Array.isArray(
                    data.important_points
                )
                    ? data
                        .important_points
                        .map(item =>
                            String(
                                item
                            ).trim()
                        )
                        .filter(item =>
                            item !== ""
                        )
                    : [];

            const currentFillBlank =
                Array.isArray(
                    current.fill_blank
                )
                    ? current.fill_blank
                    : [];

            const importedFillBlank =
                Array.isArray(
                    data.fill_blank
                )
                    ? data.fill_blank
                        .filter(item =>
                            item &&
                            typeof item ===
                                "object" &&
                            typeof item.question ===
                                "string" &&
                            item.question
                                .trim() !==
                                ""
                        )
                        .map(item => ({
                            ...item,

                            source_type:
                                item.source_type ||
                                "json",

                            preserve_original:
                                item.preserve_original ??
                                true
                        }))
                    : [];

            const currentQuiz =
                Array.isArray(
                    current.quiz
                )
                    ? current.quiz
                    : [];

            const importedQuiz =
                Array.isArray(
                    data.quiz
                )
                    ? data.quiz
                        .filter(item =>
                            item &&
                            typeof item ===
                                "object" &&
                            typeof item.question ===
                                "string" &&
                            item.question
                                .trim() !==
                                ""
                        )
                        .map(item => ({
                            ...item,

                            choices:
                                Array.isArray(
                                    item.choices
                                )
                                    ? item
                                        .choices
                                        .map(
                                            choice =>
                                                String(
                                                    choice
                                                )
                                                .trim()
                                        )
                                    : [],

                            answer:
                                Number.isInteger(
                                    Number(
                                        item.answer
                                    )
                                )
                                    ? Number(
                                        item.answer
                                    )
                                    : 0,

                            source_type:
                                item.source_type ||
                                "json",

                            preserve_original:
                                item.preserve_original ??
                                true
                        }))
                        .filter(item =>
                            item.choices.length >=
                                4 &&
                            item.choices.every(
                                choice =>
                                    choice !==
                                    ""
                            ) &&
                            item.answer >= 0 &&
                            item.answer <
                                item.choices.length
                        )
                    : [];

            let todayQuestion =
                current.today_question ||
                null;

            if (
                !todayQuestion &&
                data.today_question &&
                typeof data.today_question ===
                    "object" &&
                typeof data
                    .today_question
                    .question ===
                    "string" &&
                data.today_question
                    .question
                    .trim() !==
                    ""
            ) {

                const importedTodayChoices =
                    Array.isArray(
                        data.today_question
                            .choices
                    )
                        ? data.today_question
                            .choices
                            .map(choice =>
                                String(
                                    choice
                                ).trim()
                            )
                        : [];

                const importedTodayAnswer =
                    Number.isInteger(
                        Number(
                            data.today_question
                                .answer
                        )
                    )
                        ? Number(
                            data.today_question
                                .answer
                        )
                        : 0;

                if (
                    importedTodayChoices
                        .length >= 4 &&
                    importedTodayChoices
                        .every(
                            choice =>
                                choice !== ""
                        ) &&
                    importedTodayAnswer >=
                        0 &&
                    importedTodayAnswer <
                        importedTodayChoices
                            .length
                ) {

                    todayQuestion = {
                        ...data.today_question,

                        choices:
                            importedTodayChoices,

                        answer:
                            importedTodayAnswer,

                        source_type:
                            data.today_question
                                .source_type ||
                            "json",

                        preserve_original:
                            data.today_question
                                .preserve_original ??
                            true
                    };
                }
            }

            const addedCount =
                importedSummary.length +
                importedImportantPoints
                    .length +
                importedFillBlank.length +
                importedQuiz.length +
                (
                    !current
                        .today_question &&
                    todayQuestion
                        ? 1
                        : 0
                );

            if (
                addedCount === 0
            ) {

                alert(
                    "追加できる内容がJSONにありません。"
                );

                return;
            }

            await setDoc(
                editedRef,
                {
                    summary: [
                        ...currentSummary,
                        ...importedSummary
                    ],

                    important_points: [
                        ...currentImportantPoints,
                        ...importedImportantPoints
                    ],

                    fill_blank: [
                        ...currentFillBlank,
                        ...importedFillBlank
                    ],

                    quiz: [
                        ...currentQuiz,
                        ...importedQuiz
                    ],

                    today_question:
                        todayQuestion,

                    jsonImportedAt:
                        new Date(),

                    jsonImportedBy:
                        studentNumber,

                    editedAt:
                        new Date(),

                    editedBy:
                        studentNumber
                },
                {
                    merge: true
                }
            );

            alert(
                `${addedCount}件の内容を追加しました。`
            );

            jsonImport.value =
                "";

            jsonPreview.innerHTML =
                "";

            await loadQuestions();

        } catch (e) {

            console.error(
                "JSON一括追加エラー:",
                e
            );

            alert(
                `追加できませんでした。\n${e.message}`
            );

        }
    };

document.addEventListener(
    "change",
    async event => {

        const fileInput =
            event.target.closest(
                ".edit-question-image-file"
            );

        if (!fileInput) {
            return;
        }

        const editor =
            fileInput.closest(
                ".question-image-editor"
            );

        if (!editor) {
            return;
        }

        const file =
            fileInput.files?.[0];

        if (!file) {
            return;
        }

        await uploadQuestionImage(
            file,
            editor
        );

    }
);