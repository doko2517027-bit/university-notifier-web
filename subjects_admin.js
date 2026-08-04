import {
    db,
    setupTheme,
    initializePage,
    loadProfileImage,
    loadUserName,
    loadMyRanking,
    setupAdminTab,
    isAdmin,
    showToast
} from "./common.js";

import {
    collection,
    getDocs,
    doc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


const userName =
    document.getElementById("userName");

const myRanking =
    document.getElementById("myRanking");

const themeButton =
    document.getElementById("themeButton");

const topProfileImage =
    document.getElementById("topProfileImage");

const profileButton =
    document.getElementById("profileButton");

const subjectsJsonFile =
    document.getElementById("subjectsJsonFile");

const loadJsonButton =
    document.getElementById("loadJsonButton");

const loadFirestoreSubjects =
    document.getElementById("loadFirestoreSubjects");

const addSubjectButton =
    document.getElementById("addSubjectButton");

const saveSubjectsButton =
    document.getElementById("saveSubjectsButton");

const subjectEditorList =
    document.getElementById("subjectEditorList");

const subjectCount =
    document.getElementById("subjectCount");

const incompleteSubjectCount =
    document.getElementById("incompleteSubjectCount");


let subjects = [];

let deletedDocumentIds = new Set();


setupTheme(themeButton);


const admin = await isAdmin();

if (!admin) {

    alert(
        "管理者のみアクセスできます。"
    );

    location.href = "index.html";

}


await initializePage([
    setupAdminTab(),
    loadUserName(userName),
    loadMyRanking(myRanking),
    loadProfileImage(topProfileImage)
]);


if (profileButton) {

    profileButton.onclick = () => {

        location.href = "profile.html";

    };

}


loadJsonButton.onclick =
    loadSubjectsFromJsonFile;

loadFirestoreSubjects.onclick =
    loadSubjectsFromFirestore;

addSubjectButton.onclick =
    addEmptySubject;

saveSubjectsButton.onclick =
    saveSubjectsToFirestore;


subjectEditorList.addEventListener(
    "input",
    handleEditorChange
);

subjectEditorList.addEventListener(
    "change",
    handleEditorChange
);

subjectEditorList.addEventListener(
    "click",
    handleEditorClick
);


async function loadSubjectsFromJsonFile() {

    const file =
        subjectsJsonFile.files?.[0];

    if (!file) {

        alert(
            "subjects.jsonを選択してください。"
        );

        return;

    }

    try {

        const text =
            await file.text();

        const parsed =
            JSON.parse(text);

        if (!Array.isArray(parsed)) {

            throw new Error(
                "JSONの一番外側が配列ではありません。"
            );

        }

        subjects =
            parsed.map((subject, index) =>
                normalizeSubject(
                    subject,
                    index
                )
            );

        deletedDocumentIds.clear();

        renderSubjects();

        showToast(
            `${subjects.length}科目を読み込みました`
        );

    } catch (error) {

        console.error(
            "JSON読込エラー:",
            error
        );

        alert(
            "JSONを読み込めませんでした。\n" +
            error.message
        );

    }

}


async function loadSubjectsFromFirestore() {

    try {

        loadFirestoreSubjects.disabled = true;

        loadFirestoreSubjects.textContent =
            "読み込み中...";

        const snapshot =
            await getDocs(
                collection(db, "subjects")
            );

        subjects =
            snapshot.docs.map(
                (subjectDoc, index) => {

                    return normalizeSubject(
                        {
                            ...subjectDoc.data(),

                            firestoreId:
                                subjectDoc.id
                        },
                        index
                    );

                }
            );

        subjects.sort(
            compareSubjects
        );

        deletedDocumentIds.clear();

        renderSubjects();

        showToast(
            `${subjects.length}科目を取得しました`
        );

    } catch (error) {

        console.error(
            "科目取得エラー:",
            error
        );

        alert(
            "Firestoreから科目を取得できませんでした。"
        );

    } finally {

        loadFirestoreSubjects.disabled = false;

        loadFirestoreSubjects.textContent =
            "Firestoreから読み込む";

    }

}


function normalizeSubject(
    subject,
    index
) {

    const name =
        String(
            subject?.name || ""
        ).trim();

    return {

        localId:
            subject?.localId ||
            createLocalId(index),

        firestoreId:
            subject?.firestoreId ||
            subject?.subjectKey ||
            name ||
            "",

        name,

        subjectKey:
            String(
                subject?.subjectKey ||
                name
            ).trim(),

        department:
            String(
                subject?.department ||
                "看護学科"
            ).trim(),

        grade:
            String(
                subject?.grade || ""
            ).replace("年", ""),

        semester:
            String(
                subject?.semester || ""
            ).trim(),

        required:
            subject?.required === true,

        credits:
            toNonNegativeNumber(
                subject?.credits
            ),

        lectureCount:
            toNonNegativeNumber(
                subject?.lectureCount
            )

    };

}


function createLocalId(index = 0) {

    return (
        "subject_" +
        Date.now() +
        "_" +
        index +
        "_" +
        Math.random()
            .toString(36)
            .slice(2, 8)
    );

}


function addEmptySubject() {

    subjects.push({

        localId:
            createLocalId(
                subjects.length
            ),

        firestoreId: "",

        name: "",

        subjectKey: "",

        department: "看護学科",

        grade: "",

        semester: "",

        required: false,

        credits: 0,

        lectureCount: 0

    });

    renderSubjects();

    const cards =
        subjectEditorList.querySelectorAll(
            ".subject-editor-card"
        );

    const lastCard =
        cards[cards.length - 1];

    lastCard?.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

}


function renderSubjects() {

    updateSummary();

    if (subjects.length === 0) {

        subjectEditorList.innerHTML = `
            <div class="subject-empty">
                登録する科目がありません。
            </div>
        `;

        return;

    }

    subjectEditorList.innerHTML =
        subjects.map(
            (subject, index) =>
                createSubjectEditorHtml(
                    subject,
                    index
                )
        ).join("");

}


function createSubjectEditorHtml(
    subject,
    index
) {

    const warnings = [];

    if (!subject.name) {
        warnings.push("科目名");
    }

    if (!subject.grade) {
        warnings.push("学年");
    }

    if (!subject.semester) {
        warnings.push("学期");
    }

    if (subject.credits <= 0) {
        warnings.push("単位数");
    }

    if (subject.lectureCount <= 0) {
        warnings.push("講義回数");
    }

    const warningHtml =
        warnings.length > 0
            ? `
                <div class="subject-warning">
                    ⚠️ 未入力：
                    ${escapeHtml(
                        warnings.join("・")
                    )}
                </div>
            `
            : "";

    return `
        <div
            class="card setting-card subject-editor-card"
            data-local-id="${escapeHtml(subject.localId)}">

            <h3>
                ${
                    escapeHtml(subject.name) ||
                    `新しい講義 ${index + 1}`
                }
            </h3>

            <div class="subject-editor-grid">

                <label class="full-width">

                    <span class="subject-editor-label">
                        科目名
                    </span>

                    <input
                        type="text"
                        data-field="name"
                        value="${escapeAttribute(subject.name)}"
                        placeholder="成人看護学">

                </label>

                <label class="full-width">

                    <span class="subject-editor-label">
                        subjectKey
                    </span>

                    <input
                        type="text"
                        data-field="subjectKey"
                        value="${escapeAttribute(subject.subjectKey)}"
                        placeholder="成人看護学">

                </label>

                <label>

                    <span class="subject-editor-label">
                        学科
                    </span>

                    <input
                        type="text"
                        data-field="department"
                        value="${escapeAttribute(subject.department)}">

                </label>

                <label>

                    <span class="subject-editor-label">
                        学年
                    </span>

                    <select data-field="grade">

                        ${createOption(
                            "",
                            "未設定",
                            subject.grade
                        )}

                        ${createOption(
                            "1",
                            "1年",
                            subject.grade
                        )}

                        ${createOption(
                            "2",
                            "2年",
                            subject.grade
                        )}

                        ${createOption(
                            "3",
                            "3年",
                            subject.grade
                        )}

                        ${createOption(
                            "4",
                            "4年",
                            subject.grade
                        )}

                    </select>

                </label>

                <label>

                    <span class="subject-editor-label">
                        学期
                    </span>

                    <select data-field="semester">

                        ${createOption(
                            "",
                            "未設定",
                            subject.semester
                        )}

                        ${createOption(
                            "前期",
                            "前期",
                            subject.semester
                        )}

                        ${createOption(
                            "後期",
                            "後期",
                            subject.semester
                        )}

                        ${createOption(
                            "通期",
                            "通期",
                            subject.semester
                        )}

                    </select>

                </label>

                <label>

                    <span class="subject-editor-label">
                        単位数
                    </span>

                    <input
                        type="number"
                        min="0"
                        step="1"
                        data-field="credits"
                        value="${subject.credits}">

                </label>

                <label>

                    <span class="subject-editor-label">
                        講義回数
                    </span>

                    <input
                        type="number"
                        min="0"
                        step="1"
                        data-field="lectureCount"
                        value="${subject.lectureCount}">

                </label>

                <label>

                    <span class="subject-editor-label">
                        必修・選択
                    </span>

                    <span class="subject-required-row">

                        <input
                            type="checkbox"
                            data-field="required"
                            ${subject.required ? "checked" : ""}>

                        <span>
                            必修科目
                        </span>

                    </span>

                </label>

            </div>

            ${warningHtml}

            <button
                type="button"
                class="btn btn-danger subject-delete-button"
                data-action="delete-subject">

                この講義を削除

            </button>

        </div>
    `;

}


function createOption(
    value,
    label,
    currentValue
) {

    const selected =
        String(value) ===
        String(currentValue)
            ? "selected"
            : "";

    return `
        <option
            value="${escapeAttribute(value)}"
            ${selected}>

            ${escapeHtml(label)}

        </option>
    `;

}


function handleEditorChange(event) {

    const field =
        event.target.dataset.field;

    if (!field) {
        return;
    }

    const card =
        event.target.closest(
            ".subject-editor-card"
        );

    if (!card) {
        return;
    }

    const subject =
        subjects.find(
            item =>
                item.localId ===
                card.dataset.localId
        );

    if (!subject) {
        return;
    }

    if (field === "required") {

        subject.required =
            event.target.checked;

    } else if (
        field === "credits" ||
        field === "lectureCount"
    ) {

        subject[field] =
            toNonNegativeNumber(
                event.target.value
            );

    } else {

        subject[field] =
            event.target.value.trim();

    }

    if (
        field === "name" &&
        !subject.subjectKey
    ) {

        subject.subjectKey =
            subject.name;

        const subjectKeyInput =
            card.querySelector(
                '[data-field="subjectKey"]'
            );

        if (subjectKeyInput) {

            subjectKeyInput.value =
                subject.subjectKey;

        }

    }

    updateSummary();

}


function handleEditorClick(event) {

    const deleteButton =
        event.target.closest(
            '[data-action="delete-subject"]'
        );

    if (!deleteButton) {
        return;
    }

    const card =
        deleteButton.closest(
            ".subject-editor-card"
        );

    if (!card) {
        return;
    }

    const subject =
        subjects.find(
            item =>
                item.localId ===
                card.dataset.localId
        );

    if (!subject) {
        return;
    }

    const ok =
        confirm(
            `${subject.name || "この講義"}を削除しますか？`
        );

    if (!ok) {
        return;
    }

    if (subject.firestoreId) {

        deletedDocumentIds.add(
            subject.firestoreId
        );

    }

    subjects =
        subjects.filter(
            item =>
                item.localId !==
                subject.localId
        );

    renderSubjects();

}


function updateSummary() {

    subjectCount.textContent =
        subjects.length;

    const incompleteCount =
        subjects.filter(
            subject =>
                !subject.name ||
                !subject.grade ||
                !subject.semester ||
                subject.credits <= 0 ||
                subject.lectureCount <= 0
        ).length;

    incompleteSubjectCount.textContent =
        incompleteCount;

}


async function saveSubjectsToFirestore() {

    syncAllEditors();

    const invalidSubjects =
        subjects.filter(
            subject =>
                !subject.name ||
                !subject.subjectKey ||
                !subject.department ||
                !subject.grade ||
                !subject.semester
        );

    if (invalidSubjects.length > 0) {

        alert(
            "科目名・subjectKey・学科・学年・学期は必須です。\n" +
            `未入力の科目が${invalidSubjects.length}件あります。`
        );

        return;

    }

    const duplicateKeys =
        findDuplicateSubjectKeys();

    if (duplicateKeys.length > 0) {

        alert(
            "subjectKeyが重複しています。\n\n" +
            duplicateKeys.join("\n")
        );

        return;

    }

    const zeroValueCount =
        subjects.filter(
            subject =>
                subject.credits <= 0 ||
                subject.lectureCount <= 0
        ).length;

    if (zeroValueCount > 0) {

        const continueSave =
            confirm(
                `単位数または講義回数が未入力の科目が` +
                `${zeroValueCount}件あります。\n\n` +
                "このまま保存しますか？"
            );

        if (!continueSave) {
            return;
        }

    }

    const ok =
        confirm(
            `${subjects.length}科目をFirestoreへ保存しますか？`
        );

    if (!ok) {
        return;
    }

    try {

        saveSubjectsButton.disabled = true;

        saveSubjectsButton.textContent =
            "保存中...";

        const batch =
            writeBatch(db);

        for (
            const documentId
            of deletedDocumentIds
        ) {

            batch.delete(
                doc(
                    db,
                    "subjects",
                    documentId
                )
            );

        }

        for (const subject of subjects) {

            const documentId =
                createFirestoreDocumentId(
                    subject.subjectKey
                );

            const subjectRef =
                doc(
                    db,
                    "subjects",
                    documentId
                );

            batch.set(
                subjectRef,
                {
                    name:
                        subject.name,

                    subjectKey:
                        subject.subjectKey,

                    department:
                        subject.department,

                    grade:
                        subject.grade,

                    semester:
                        subject.semester,

                    required:
                        subject.required,

                    credits:
                        subject.credits,

                    lectureCount:
                        subject.lectureCount
                },
                {
                    merge: true
                }
            );

            subject.firestoreId =
                documentId;

        }

        await batch.commit();

        deletedDocumentIds.clear();

        showToast(
            `${subjects.length}科目を保存しました`
        );

        renderSubjects();

    } catch (error) {

        console.error(
            "科目保存エラー:",
            error
        );

        alert(
            "Firestoreへの保存に失敗しました。"
        );

    } finally {

        saveSubjectsButton.disabled = false;

        saveSubjectsButton.textContent =
            "Firestoreへ保存";

    }

}


function syncAllEditors() {

    const cards =
        subjectEditorList.querySelectorAll(
            ".subject-editor-card"
        );

    cards.forEach(card => {

        const subject =
            subjects.find(
                item =>
                    item.localId ===
                    card.dataset.localId
            );

        if (!subject) {
            return;
        }

        card
            .querySelectorAll("[data-field]")
            .forEach(input => {

                const field =
                    input.dataset.field;

                if (field === "required") {

                    subject.required =
                        input.checked;

                } else if (
                    field === "credits" ||
                    field === "lectureCount"
                ) {

                    subject[field] =
                        toNonNegativeNumber(
                            input.value
                        );

                } else {

                    subject[field] =
                        input.value.trim();

                }

            });

    });

}


function findDuplicateSubjectKeys() {

    const counts = {};

    subjects.forEach(subject => {

        const key =
            subject.subjectKey.trim();

        counts[key] =
            (counts[key] || 0) + 1;

    });

    return Object.entries(counts)
        .filter(
            ([, count]) =>
                count > 1
        )
        .map(
            ([key]) =>
                key
        );

}


function createFirestoreDocumentId(
    subjectKey
) {

    return String(subjectKey)
        .trim()
        .replace(/\//g, "／");

}


function toNonNegativeNumber(value) {

    const number =
        Number(value);

    if (
        !Number.isFinite(number) ||
        number < 0
    ) {
        return 0;
    }

    return number;

}


function compareSubjects(a, b) {

    const gradeA =
        Number(a.grade || 99);

    const gradeB =
        Number(b.grade || 99);

    if (gradeA !== gradeB) {
        return gradeA - gradeB;
    }

    const semesterOrder = {
        "前期": 1,
        "後期": 2,
        "通期": 3
    };

    const semesterA =
        semesterOrder[a.semester] || 99;

    const semesterB =
        semesterOrder[b.semester] || 99;

    if (semesterA !== semesterB) {
        return semesterA - semesterB;
    }

    return a.name.localeCompare(
        b.name,
        "ja"
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


function escapeAttribute(value) {

    return escapeHtml(value);

}