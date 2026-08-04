import {
    db,
    studentNumber,
    setupTheme,
    initializePage,
    loadProfileImage,
    showToast
} from "./common.js";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    writeBatch,
    serverTimestamp,
    query,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const elements = {
    theme: document.getElementById("themeButton"),
    profile: document.getElementById("profileButton"),
    image: document.getElementById("topProfileImage"),
    info: document.getElementById("studentCourseInfo"),
    summary: document.getElementById("registrationSummary"),
    list: document.getElementById("courseList"),
    count: document.getElementById("selectedCourseCount"),
    save: document.getElementById("saveCoursesButton"),
    restore: document.getElementById("restorePreviousEnrollment"),
    warning: document.getElementById("creditWarning"),
    toggleProgress: document.getElementById("toggleProgressEditor"),
    progressEditor: document.getElementById("progressEditor"),
    saveProgress: document.getElementById("saveCourseProgress"),
    earnedInput: document.getElementById("earnedCreditsInput"),
    earnedRequiredInput: document.getElementById("earnedRequiredCreditsInput"),
    earnedElectiveInput: document.getElementById("earnedElectiveCreditsInput"),
    currentCredits: document.getElementById("currentCredits"),
    semesterCredits: document.getElementById("semesterCredits"),
    annualCredits: document.getElementById("annualCredits"),
    earnedCredits: document.getElementById("earnedCredits"),
    requiredGraduationCredits: document.getElementById("requiredGraduationCredits"),
    remainingCredits: document.getElementById("remainingCredits"),
    earnedRequiredCredits: document.getElementById("earnedRequiredCredits"),
    earnedElectiveCredits: document.getElementById("earnedElectiveCredits"),
    semesterLimitText: document.getElementById("semesterLimitText"),
    annualLimitText: document.getElementById("annualLimitText")
};

const department = localStorage.getItem("department") || "";
const major = localStorage.getItem("major") || "";
const grade = localStorage.getItem("grade") || "";
const previewMode = new URLSearchParams(location.search).get("preview") === "1";

let config = null;
let subjects = [];
let visibleSubjects = [];
let enrolledDocs = new Map();
let originalSelectedIds = new Set();
let progress = {
    earnedCredits: 0,
    earnedRequiredCredits: 0,
    earnedElectiveCredits: 0
};
let pageDirty = false;
let lastRegistrationAt = null;

setupTheme(elements.theme);
document.getElementById("backButton").onclick = () => history.back();
elements.profile.onclick = () => location.href = "profile.html";
elements.list.addEventListener("change", () => {
    pageDirty = true;
    updateCreditDisplay();
});
elements.save.onclick = confirmAndSaveEnrollment;
elements.restore.onclick = restorePreviousEnrollment;
elements.toggleProgress.onclick = () => {
    elements.progressEditor.hidden = !elements.progressEditor.hidden;
};
elements.saveProgress.onclick = saveProgress;

window.addEventListener("beforeunload", event => {
    if (!pageDirty) return;
    event.preventDefault();
    event.returnValue = "";
});

await initializePage([
    loadProfileImage(elements.image),
    loadRegistrationData()
]);

async function loadRegistrationData() {
    if (!studentNumber) {
        location.href = "login.html";
        return;
    }

    const configRef = doc(
        db,
        "system",
        previewMode ? "courseRegistrationDraft" : "courseRegistration"
    );
    const [configSnap, userSnap, subjectSnap, enrollmentSnap] = await Promise.all([
        getDoc(configRef),
        getDoc(doc(db, "users", studentNumber)),
        getDocs(collection(db, "subjects")),
        getDocs(collection(db, "users", studentNumber, "enrolledSubjects"))
    ]);

    if (!configSnap.exists()) {
        renderUnavailable("履修登録はまだ公開されていません。");
        return;
    }

    config = configSnap.data();
    progress = {
        ...progress,
        ...(userSnap.data()?.courseProgress || {})
    };

    enrolledDocs = new Map(
        enrollmentSnap.docs.map(item => [item.id, item.data()])
    );
    originalSelectedIds = new Set(
        enrollmentSnap.docs
            .filter(item =>
                Number(item.data().academicYear) === Number(config.academicYear) &&
                (
                    item.data().registeredSemester === config.semester ||
                    String(item.data().semester || "").includes("通")
                )
            )
            .map(item => item.id)
    );
    lastRegistrationAt = enrollmentSnap.docs
        .map(item => item.data().updatedAt?.toDate?.() || null)
        .filter(Boolean)
        .sort((a, b) => b - a)[0] || null;

    subjects = subjectSnap.docs
        .map(subjectDoc => ({ id: subjectDoc.id, ...subjectDoc.data() }))
        .filter(matchesStudent)
        .sort(compareSubjects);
    visibleSubjects = subjects.filter(subject => matchesSemester(subject, config.semester));

    fillProgressEditor();
    renderPhase();
    renderSubjects();
}

function getEffectivePhase() {
    if (previewMode) return config.phase || "view_only";
    if (config.published !== true || config.pageEnabled !== true) return "hidden";

    const now = Date.now();
    const starts = config.startAt ? new Date(config.startAt).getTime() : 0;
    const ends = config.endAt ? new Date(config.endAt).getTime() : Infinity;

    if (now < starts || now > ends) return "view_only";
    return config.phase || "view_only";
}

function phaseLabel(phase) {
    return {
        registration: "履修登録期間",
        correction: "履修修正期間",
        cancellation: "履修取消期間",
        view_only: "閲覧期間",
        hidden: "非公開"
    }[phase] || "閲覧期間";
}

function formatDateTime(value) {
    if (!value) return "期限なし";
    const date = new Date(value);
    return date.toLocaleString("ja-JP", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function renderPhase() {
    const phase = getEffectivePhase();
    elements.info.textContent =
        `${config.academicYear}年度 ${config.semester}・${department}${major ? ` ${major}` : ""} ${grade}年`;
    elements.summary.textContent =
        `${phaseLabel(phase)}｜終了 ${formatDateTime(config.endAt)}` +
        (lastRegistrationAt ? `｜最終登録 ${formatDateTime(lastRegistrationAt)}` : "｜未登録") +
        (previewMode ? "｜管理者プレビュー" : "");

    if (phase === "hidden" && !previewMode) {
        renderUnavailable("現在、履修登録画面は公開されていません。");
    }
}

function renderUnavailable(message) {
    elements.list.innerHTML = `<div class="card setting-card"><h3>${escapeHtml(message)}</h3></div>`;
    elements.save.disabled = true;
    elements.restore.disabled = true;
    elements.summary.textContent = message;
    document.getElementById("creditDashboard").style.display = "none";
    document.querySelector(".course-registration-toolbar").style.display = "none";
    document.querySelector(".course-registration-save-bar").style.display = "none";
}

function matchesStudent(subject) {
    const subjectDepartment = String(subject.department || "").trim();
    const subjectGrade = String(subject.grade || "").replace("年", "").trim();
    const departmentMatches =
        !subjectDepartment || subjectDepartment === department ||
        (major && subjectDepartment === major);
    return departmentMatches && (!subjectGrade || subjectGrade === grade);
}

function matchesSemester(subject, semester) {
    const value = String(subject.semester || "").trim();
    return !value || value === semester || value.includes("通年") || value.includes("通期");
}

function compareSubjects(a, b) {
    if (Boolean(a.required) !== Boolean(b.required)) return a.required ? -1 : 1;
    return String(a.name || "").localeCompare(String(b.name || ""), "ja");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function canSelectSubject(subject, checked) {
    if (subject.required === true) return false;
    const phase = getEffectivePhase();
    if (previewMode) return true;
    if (phase === "registration") return true;
    if (phase === "correction" && config.correctionMode === "add_delete") return true;
    if (phase === "correction" || phase === "cancellation") {
        return checked && originalSelectedIds.has(subject.id);
    }
    return false;
}

function subjectCard(subject) {
    const required = subject.required === true;
    const checked = required || originalSelectedIds.has(subject.id);
    const selectable = canSelectSubject(subject, checked);
    const credits = Number(subject.credits || 0);
    return `
        <label class="card setting-card course-registration-item ${checked ? "is-selected" : ""}">
            <input type="checkbox" class="course-checkbox" data-subject-id="${escapeHtml(subject.id)}"
                ${checked ? "checked" : ""} ${selectable ? "" : "disabled"}>
            <span class="course-registration-content">
                <span class="course-registration-title">${escapeHtml(subject.name || subject.subjectKey || subject.id)}</span>
                <span class="course-registration-meta">
                    <span class="course-tag ${required ? "required" : "optional"}">${required ? "必修" : "選択"}</span>
                    ${subject.isPractical === true ? '<span class="course-tag practical">実習</span>' : ""}
                    <span>${credits}単位</span>
                    ${Number(subject.lectureCount || 0) > 0 ? `<span>全${Number(subject.lectureCount)}回</span>` : ""}
                </span>
            </span>
        </label>`;
}

function renderSubjects() {
    if (!config || getEffectivePhase() === "hidden" && !previewMode) return;
    const required = visibleSubjects.filter(item => item.required === true);
    const optional = visibleSubjects.filter(item => item.required !== true);

    elements.list.innerHTML = `
        <section class="course-registration-section">
            <h2>必修科目 <small>${required.length}科目</small></h2>
            ${required.map(subjectCard).join("") || '<p class="empty-text">必修科目はありません。</p>'}
        </section>
        <section class="course-registration-section">
            <h2>選択科目 <small>${optional.length}科目</small></h2>
            ${optional.map(subjectCard).join("") || '<p class="empty-text">選択科目はありません。</p>'}
        </section>`;

    const editable = [...elements.list.querySelectorAll(".course-checkbox")]
        .some(input => !input.disabled);
    elements.save.disabled = !editable || previewMode;
    elements.restore.disabled = previewMode;
    updateCreditDisplay();
}

function getSelectedIds() {
    return new Set(
        [...elements.list.querySelectorAll(".course-checkbox")]
            .filter(input => input.checked)
            .map(input => input.dataset.subjectId)
    );
}

function creditTotal(ids) {
    return visibleSubjects
        .filter(subject => ids.has(subject.id))
        .reduce((sum, subject) => sum + Number(subject.credits || 0), 0);
}

function otherSemesterAnnualCredits() {
    return [...enrolledDocs.values()]
        .filter(item =>
            Number(item.academicYear) === Number(config.academicYear) &&
            item.registeredSemester !== config.semester &&
            !String(item.semester || "").includes("通")
        )
        .reduce((sum, item) => sum + Number(item.credits || 0), 0);
}

function updateCreditDisplay() {
    if (!config) return;
    const selectedIds = getSelectedIds();
    const current = creditTotal(selectedIds);
    const annual = current + otherSemesterAnnualCredits();
    const semesterLimit = Number(config.semesterCreditLimit || 0);
    const annualLimit = Number(config.annualCreditLimit || 0);
    const graduationRequired = Number(config.graduationRequiredCredits || 0);
    const earned = Number(progress.earnedCredits || 0);

    elements.currentCredits.textContent = current;
    elements.semesterCredits.textContent = current;
    elements.annualCredits.textContent = annual;
    elements.earnedCredits.textContent = earned;
    elements.requiredGraduationCredits.textContent = graduationRequired;
    elements.remainingCredits.textContent = Math.max(0, graduationRequired - earned);
    elements.earnedRequiredCredits.textContent = Number(progress.earnedRequiredCredits || 0);
    elements.earnedElectiveCredits.textContent = Number(progress.earnedElectiveCredits || 0);
    elements.semesterLimitText.textContent = semesterLimit ? `/ ${semesterLimit}単位` : "単位";
    elements.annualLimitText.textContent = annualLimit ? `/ ${annualLimit}単位` : "単位";
    elements.count.textContent = `${selectedIds.size}科目・${current}単位`;

    const warnings = [];
    if (semesterLimit && current > semesterLimit) warnings.push(`半期上限を${current - semesterLimit}単位超えています。`);
    if (annualLimit && annual > annualLimit) warnings.push(`年間上限を${annual - annualLimit}単位超えています。`);
    const electiveRequired = Number(config.electiveRequiredCredits || 0);
    if (electiveRequired && Number(progress.earnedElectiveCredits || 0) < electiveRequired) {
        warnings.push(`選択科目は卒業までにあと${electiveRequired - Number(progress.earnedElectiveCredits || 0)}単位必要です。`);
    }
    elements.warning.hidden = warnings.length === 0;
    elements.warning.innerHTML = warnings.map(item => `<div>⚠️ ${escapeHtml(item)}</div>`).join("");
    elements.save.dataset.overLimit =
        (semesterLimit && current > semesterLimit) || (annualLimit && annual > annualLimit)
            ? "true" : "false";
}

function fillProgressEditor() {
    elements.earnedInput.value = Number(progress.earnedCredits || 0);
    elements.earnedRequiredInput.value = Number(progress.earnedRequiredCredits || 0);
    elements.earnedElectiveInput.value = Number(progress.earnedElectiveCredits || 0);
}

async function saveProgress() {
    const nextProgress = {
        earnedCredits: Number(elements.earnedInput.value || 0),
        earnedRequiredCredits: Number(elements.earnedRequiredInput.value || 0),
        earnedElectiveCredits: Number(elements.earnedElectiveInput.value || 0),
        updatedAt: new Date().toISOString()
    };
    if (nextProgress.earnedRequiredCredits + nextProgress.earnedElectiveCredits > nextProgress.earnedCredits) {
        alert("必修と選択の取得単位合計が、取得済み総単位を超えています。");
        return;
    }
    try {
        await setDoc(doc(db, "users", studentNumber), { courseProgress: nextProgress }, { merge: true });
        progress = nextProgress;
        elements.progressEditor.hidden = true;
        updateCreditDisplay();
        showToast("取得単位を保存しました");
    } catch (error) {
        console.error("取得単位保存エラー:", error);
        alert("取得単位を保存できませんでした。");
    }
}

async function confirmAndSaveEnrollment() {
    if (elements.save.dataset.overLimit === "true") {
        alert("単位上限を超えているため保存できません。");
        return;
    }
    const selectedIds = getSelectedIds();
    const credits = creditTotal(selectedIds);
    if (!confirm(`${config.academicYear}年度 ${config.semester}\n${selectedIds.size}科目・${credits}単位で履修登録しますか？`)) return;
    await saveEnrollment(selectedIds);
}

async function saveEnrollment(selectedIds) {
    const batch = writeBatch(db);
    const beforeIds = [...originalSelectedIds];

    for (const subject of visibleSubjects) {
        const ref = doc(db, "users", studentNumber, "enrolledSubjects", subject.id);
        if (selectedIds.has(subject.id)) {
            batch.set(ref, {
                subjectId: subject.id,
                name: subject.name || subject.subjectKey || subject.id,
                subjectKey: subject.subjectKey || subject.name || subject.id,
                department: subject.department || department,
                grade: String(subject.grade || grade),
                semester: subject.semester || config.semester,
                registeredSemester: config.semester,
                academicYear: Number(config.academicYear),
                required: subject.required === true,
                credits: Number(subject.credits || 0),
                lectureCount: Number(subject.lectureCount || 0),
                isPractical: subject.isPractical === true,
                status: "enrolled",
                updatedAt: serverTimestamp()
            }, { merge: true });
        } else if (originalSelectedIds.has(subject.id)) {
            batch.delete(ref);
        }
    }

    try {
        elements.save.disabled = true;
        elements.save.textContent = "保存中...";
        await addDoc(collection(db, "users", studentNumber, "enrollmentHistory"), {
            academicYear: Number(config.academicYear),
            semester: config.semester,
            selectedSubjectIds: beforeIds,
            savedAt: serverTimestamp()
        });
        await batch.commit();
        originalSelectedIds = new Set(selectedIds);
        lastRegistrationAt = new Date();
        pageDirty = false;
        showToast(`${selectedIds.size}科目を登録しました`);
        renderPhase();
        renderSubjects();
    } catch (error) {
        console.error("履修登録保存エラー:", error);
        alert("履修登録を保存できませんでした。");
    } finally {
        elements.save.textContent = "履修登録を保存";
    }
}

async function restorePreviousEnrollment() {
    try {
        const historyQuery = query(
            collection(db, "users", studentNumber, "enrollmentHistory"),
            orderBy("savedAt", "desc"),
            limit(10)
        );
        const historySnap = await getDocs(historyQuery);
        const previous = historySnap.docs
            .map(item => item.data())
            .find(item =>
                Number(item.academicYear) === Number(config.academicYear) &&
                item.semester === config.semester
            );
        if (!previous) {
            alert("戻せる以前の登録内容がありません。");
            return;
        }
        const ids = new Set(previous.selectedSubjectIds || []);
        for (const input of elements.list.querySelectorAll(".course-checkbox")) {
            if (!input.disabled) input.checked = ids.has(input.dataset.subjectId);
        }
        pageDirty = true;
        updateCreditDisplay();
        showToast("以前の内容を表示しました。保存すると確定します");
    } catch (error) {
        console.error("履修履歴取得エラー:", error);
        alert("以前の登録内容を取得できませんでした。");
    }
}
