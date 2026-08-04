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
    getDoc,
    setDoc,
    writeBatch,
    serverTimestamp
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

const incompleteNextButton =
    document.getElementById("incompleteNextButton");

const scrollTopButton =
    document.getElementById("scrollTopButton");

const registrationFields = {
    academicYear: document.getElementById("registrationAcademicYear"),
    semester: document.getElementById("registrationSemester"),
    phase: document.getElementById("registrationPhase"),
    correctionMode: document.getElementById("registrationCorrectionMode"),
    startAt: document.getElementById("registrationStartAt"),
    endAt: document.getElementById("registrationEndAt"),
    bannerEnabled: document.getElementById("registrationBannerEnabled"),
    bannerText: document.getElementById("registrationBannerText"),
    bannerSpeed: document.getElementById("registrationBannerSpeed"),
    pageEnabled: document.getElementById("registrationPageEnabled"),
    convenienceCardEnabled: document.getElementById("registrationConvenienceCardEnabled"),
    semesterCreditLimit: document.getElementById("semesterCreditLimit"),
    annualCreditLimit: document.getElementById("annualCreditLimit"),
    graduationRequiredCredits: document.getElementById("graduationRequiredCredits"),
    electiveRequiredCredits: document.getElementById("electiveRequiredCredits")
};

const saveRegistrationDraft = document.getElementById("saveRegistrationDraft");
const publishRegistrationSettings = document.getElementById("publishRegistrationSettings");
const previewRegistrationPage = document.getElementById("previewRegistrationPage");
const registrationPublishStatus = document.getElementById("registrationPublishStatus");


let subjects = [];

let deletedDocumentIds = new Set();

let incompleteNavigationIndex = -1;


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

await loadRegistrationSettings();


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

incompleteNextButton.onclick =
    jumpToNextIncompleteSubject;

scrollTopButton.onclick = () => {

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

};

saveRegistrationDraft.onclick = () => saveRegistrationSettings(false);
publishRegistrationSettings.onclick = () => saveRegistrationSettings(true);
previewRegistrationPage.onclick = () => {
    window.open("course_registration.html?preview=1", "_blank");
};

function defaultRegistrationSettings() {
    return {
        academicYear: new Date().getFullYear(),
        semester: "前期",
        phase: "hidden",
        correctionMode: "delete_only",
        startAt: "",
        endAt: "",
        bannerEnabled: false,
        bannerText: "履修登録期間中！！",
        bannerSpeed: "normal",
        pageEnabled: false,
        convenienceCardEnabled: false,
        semesterCreditLimit: 30,
        annualCreditLimit: 50,
        graduationRequiredCredits: 0,
        electiveRequiredCredits: 0
    };
}

function readRegistrationForm() {
    return {
        academicYear: Number(registrationFields.academicYear.value),
        semester: registrationFields.semester.value,
        phase: registrationFields.phase.value,
        correctionMode: registrationFields.correctionMode.value,
        startAt: registrationFields.startAt.value,
        endAt: registrationFields.endAt.value,
        bannerEnabled: registrationFields.bannerEnabled.checked,
        bannerText: registrationFields.bannerText.value.trim(),
        bannerSpeed: registrationFields.bannerSpeed.value,
        pageEnabled: registrationFields.pageEnabled.checked,
        convenienceCardEnabled: registrationFields.convenienceCardEnabled.checked,
        semesterCreditLimit: Number(registrationFields.semesterCreditLimit.value || 0),
        annualCreditLimit: Number(registrationFields.annualCreditLimit.value || 0),
        graduationRequiredCredits: Number(registrationFields.graduationRequiredCredits.value || 0),
        electiveRequiredCredits: Number(registrationFields.electiveRequiredCredits.value || 0)
    };
}

function fillRegistrationForm(settings) {
    const value = { ...defaultRegistrationSettings(), ...settings };
    registrationFields.academicYear.value = value.academicYear;
    registrationFields.semester.value = value.semester;
    registrationFields.phase.value = value.phase;
    registrationFields.correctionMode.value = value.correctionMode;
    registrationFields.startAt.value = value.startAt || "";
    registrationFields.endAt.value = value.endAt || "";
    registrationFields.bannerEnabled.checked = value.bannerEnabled === true;
    registrationFields.bannerText.value = value.bannerText || "";
    registrationFields.bannerSpeed.value = value.bannerSpeed;
    registrationFields.pageEnabled.checked = value.pageEnabled === true;
    registrationFields.convenienceCardEnabled.checked = value.convenienceCardEnabled === true;
    registrationFields.semesterCreditLimit.value = value.semesterCreditLimit;
    registrationFields.annualCreditLimit.value = value.annualCreditLimit;
    registrationFields.graduationRequiredCredits.value = value.graduationRequiredCredits;
    registrationFields.electiveRequiredCredits.value = value.electiveRequiredCredits;
}

async function loadRegistrationSettings() {
    try {
        const [draftSnap, publishedSnap] = await Promise.all([
            getDoc(doc(db, "system", "courseRegistrationDraft")),
            getDoc(doc(db, "system", "courseRegistration"))
        ]);
        fillRegistrationForm(
            draftSnap.exists()
                ? draftSnap.data()
                : publishedSnap.exists()
                    ? publishedSnap.data()
                    : defaultRegistrationSettings()
        );
        registrationPublishStatus.textContent = publishedSnap.exists()
            ? `公開済み：${publishedSnap.data().academicYear}年度 ${publishedSnap.data().semester}`
            : "学生側にはまだ公開されていません。";
    } catch (error) {
        console.error("履修公開設定取得エラー:", error);
        fillRegistrationForm(defaultRegistrationSettings());
        registrationPublishStatus.textContent = "公開設定を取得できませんでした。";
    }
}

async function saveRegistrationSettings(publish) {
    const settings = readRegistrationForm();

    if (!settings.academicYear || settings.academicYear < 2020) {
        alert("対象年度を入力してください。");
        return;
    }

    if (settings.startAt && settings.endAt && settings.startAt >= settings.endAt) {
        alert("終了日時は開始日時より後にしてください。");
        return;
    }

    if (publish && !confirm("この設定を学生側へ公開しますか？")) return;

    const button = publish ? publishRegistrationSettings : saveRegistrationDraft;
    const originalText = button.textContent;

    try {
        button.disabled = true;
        button.textContent = "保存中...";
        await setDoc(
            doc(db, "system", publish ? "courseRegistration" : "courseRegistrationDraft"),
            {
                ...settings,
                published: publish,
                updatedAt: serverTimestamp()
            },
            { merge: true }
        );
        registrationPublishStatus.textContent = publish
            ? `${settings.academicYear}年度 ${settings.semester}を学生側へ公開しました。`
            : "下書きを保存しました。学生側にはまだ反映されません。";
        showToast(publish ? "学生側へ公開しました" : "下書きを保存しました");
    } catch (error) {
        console.error("履修公開設定保存エラー:", error);
        alert("公開設定を保存できませんでした。");
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}


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

        isPractical:
            typeof subject?.isPractical === "boolean"
                ? subject.isPractical
                : String(subject?.classFormat || "").includes("実習"),

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

function createEmptySubject() {

    return {

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

        isPractical: false,

        credits: 0,

        lectureCount: 0

    };

}


function addEmptySubject() {

    const newSubject =
        createEmptySubject();

    subjects.push(
        newSubject
    );

    renderSubjects();

    scrollToSubject(
        newSubject.localId
    );

}

function insertEmptySubjectAt(index) {

    const insertIndex =
        Math.max(
            0,
            Math.min(
                Number(index),
                subjects.length
            )
        );

    const newSubject =
        createEmptySubject();

    subjects.splice(
        insertIndex,
        0,
        newSubject
    );

    renderSubjects();

    scrollToSubject(
        newSubject.localId
    );

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
            (subject, index) => {

                const insertButtonHtml =
                    index > 0
                        ? createInsertSubjectButtonHtml(
                            index
                        )
                        : "";

                return (
                    insertButtonHtml +
                    createSubjectEditorHtml(
                        subject,
                        index
                    )
                );

            }
        ).join("");

    incompleteNavigationIndex = -1;

}

function createInsertSubjectButtonHtml(
    insertIndex
) {

    return `
        <div class="subject-insert-area">

            <button
                type="button"
                class="btn btn-secondary subject-insert-button"
                data-action="insert-subject"
                data-insert-index="${insertIndex}">

                ＋ ここに講義を追加

            </button>

        </div>
    `;

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
                        出席判定区分
                    </span>

                    <span class="subject-required-row">

                        <input
                            type="checkbox"
                            data-field="isPractical"
                            ${subject.isPractical ? "checked" : ""}>

                        <span>
                            実習科目（出席4/5以上が必要）
                        </span>

                    </span>

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

    if (field === "required" || field === "isPractical") {

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

    const insertButton =
        event.target.closest(
            '[data-action="insert-subject"]'
        );

    if (insertButton) {

        insertEmptySubjectAt(
            insertButton.dataset.insertIndex
        );

        return;

    }

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

function isSubjectIncomplete(subject) {

    return (
        !subject.name ||
        !subject.grade ||
        !subject.semester ||
        subject.credits <= 0 ||
        subject.lectureCount <= 0
    );

}


function updateSummary() {

    subjectCount.textContent =
        subjects.length;

    const incompleteCount =
        subjects.filter(
            isSubjectIncomplete
        ).length;

    incompleteSubjectCount.textContent =
        incompleteCount;

    incompleteNextButton.disabled =
        incompleteCount === 0;

    if (incompleteCount === 0) {

        incompleteNavigationIndex = -1;

    }

}

function getIncompleteSubjects() {

    return subjects.filter(
        isSubjectIncomplete
    );

}


function jumpToFirstIncompleteSubject() {

    syncAllEditors();

    const incompleteSubjects =
        getIncompleteSubjects();

    if (incompleteSubjects.length === 0) {

        showToast(
            "未入力の科目はありません"
        );

        return;

    }

    incompleteNavigationIndex = 0;

    jumpToIncompleteSubject(
        incompleteSubjects
    );

}


function jumpToNextIncompleteSubject() {

    syncAllEditors();

    const incompleteSubjects =
        getIncompleteSubjects();

    if (incompleteSubjects.length === 0) {

        incompleteNavigationIndex = -1;

        showToast(
            "未入力の科目はありません"
        );

        return;

    }

    if (
        incompleteNavigationIndex < 0 ||
        incompleteNavigationIndex >=
            incompleteSubjects.length - 1
    ) {

        incompleteNavigationIndex = 0;

    } else {

        incompleteNavigationIndex++;

    }

    jumpToIncompleteSubject(
        incompleteSubjects
    );

}


function jumpToIncompleteSubject(
    incompleteSubjects
) {

    const target =
        incompleteSubjects[
            incompleteNavigationIndex
        ];

    if (!target) {
        return;
    }

    scrollToSubject(
        target.localId
    );

    showToast(
        `未入力科目 ${
            incompleteNavigationIndex + 1
        } / ${incompleteSubjects.length}`
    );

}

function scrollToSubject(localId) {

    const cards =
        subjectEditorList.querySelectorAll(
            ".subject-editor-card"
        );

    const targetCard =
        Array.from(cards).find(
            card =>
                card.dataset.localId ===
                localId
        );

    if (!targetCard) {
        return;
    }

    targetCard.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    targetCard.classList.remove(
        "subject-jump-highlight"
    );

    void targetCard.offsetWidth;

    targetCard.classList.add(
        "subject-jump-highlight"
    );

    setTimeout(() => {

        targetCard.classList.remove(
            "subject-jump-highlight"
        );

    }, 1600);

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

                    isPractical:
                        subject.isPractical,

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

                if (field === "required" || field === "isPractical") {

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
