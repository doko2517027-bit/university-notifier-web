import {
    db,
    setupTheme,
    initializePage,
    loadProfileImage,
    isAdmin,
    updateAssignmentNavBadge,
    updateShareNavBadge,
    updateNewsNavBadge
} from "./common.js";

import {
    doc,
    getDoc,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/* ========================================
   HTML要素
======================================== */

const elements = {

    themeButton:
        document.getElementById("themeButton"),

    profileButton:
        document.getElementById("profileButton"),

    profileImage:
        document.getElementById("topProfileImage"),

    backButton:
        document.getElementById("backButton"),


    examTitle:
        document.getElementById("examTitle"),

    examStateBadge:
        document.getElementById("examStateBadge"),

    examCountdown:
        document.getElementById("examCountdown"),

    examStartDate:
        document.getElementById("examStartDateText"),

    examEndDate:
        document.getElementById("examEndDateText"),


    overallStatusBadge:
        document.getElementById("overallStatusBadge"),

    overallProgressRing:
        document.getElementById("overallProgressRing"),

    overallProgressPercent:
        document.getElementById("overallProgressPercent"),

    overallProgressBar:
        document.getElementById("overallProgressBar"),

    overallProgressMessage:
        document.getElementById("overallProgressMessage"),

    completedFormatCount:
        document.getElementById("completedFormatCount"),

    inProgressFormatCount:
        document.getElementById("inProgressFormatCount"),

    unstartedFormatCount:
        document.getElementById("unstartedFormatCount"),

    completedSubjectCount:
        document.getElementById("completedSubjectCount"),


    continueSection:
        document.getElementById("continueLearningSection"),

    continueButton:
        document.getElementById("continueLearningButton"),

    continueIcon:
        document.getElementById("continueLearningIcon"),

    continueSubject:
        document.getElementById("continueLearningSubject"),

    continueTitle:
        document.getElementById("continueLearningTitle"),

    continueDetail:
        document.getElementById("continueLearningDetail"),


    todayDailyCount:
        document.getElementById("todayDailyCount"),

    todayDailyProgressBar:
        document.getElementById("todayDailyProgressBar"),

    todayDailyMessage:
        document.getElementById("todayDailyMessage"),


    searchInput:
        document.getElementById("examSubjectSearch"),

    clearSearchButton:
        document.getElementById("clearExamSearchButton"),

    statusFilters:
        document.getElementById("examStatusFilters"),

    allSubjectFilterCount:
        document.getElementById("allSubjectFilterCount"),

    unstartedSubjectFilterCount:
        document.getElementById("unstartedSubjectFilterCount"),

    inProgressSubjectFilterCount:
        document.getElementById("inProgressSubjectFilterCount"),

    completedSubjectFilterCount:
        document.getElementById("completedSubjectFilterCount"),

    visibleSubjectCount:
        document.getElementById("visibleExamSubjectCount"),

    toggleAllSubjectsButton:
        document.getElementById("toggleAllSubjectsButton"),

    totalSubjectCount:
        document.getElementById("totalSubjectCount"),

    subjectUnitList:
        document.getElementById("subjectUnitList"),


    helpModal:
        document.getElementById("examHelpModal"),

    openHelpButton:
        document.getElementById("openExamHelpButton"),

    closeHelpButton:
        document.getElementById("closeExamHelpButton"),

    confirmHelpButton:
        document.getElementById("confirmExamHelpButton"),


    settingsTab:
        document.getElementById("settingsTab"),

    adminTab:
        document.getElementById("adminTab")

};


/* ========================================
   基本情報
======================================== */

const studentNumber =
    localStorage.getItem("studentNumber") || "";

const todayKey =
    createLocalDateKey(new Date());

const todayCompactKey =
    todayKey.replaceAll("-", "");

const openSubjectsStorageKey =
    `caremateExamOpenSubjects_${studentNumber || "guest"}`;


/* ========================================
   状態
======================================== */

let examInformation = null;

let subjects = [];

let progressMap =
    new Map();

let dailyCompletionKeys =
    new Set();

let dailyRecordTexts = [];

let currentStatusFilter =
    "all";

let openSubjectIds =
    loadOpenSubjectIds();

let continueTarget = null;


/* ========================================
   初期設定
======================================== */

setupTheme(
    elements.themeButton
);

setupEvents();


await initializePage([

    loadProfileImage(
        elements.profileImage
    ),

    setupRoleTabs(),

    updateAssignmentNavBadge(),

    updateShareNavBadge(),

    updateNewsNavBadge(),

    loadExamDashboard()

]);


/* ========================================
   イベント登録
======================================== */

function setupEvents() {

    elements.backButton?.addEventListener(
        "click",
        () => {

            location.href =
                "index.html";

        }
    );


    elements.profileButton?.addEventListener(
        "click",
        () => {

            location.href =
                "profile.html";

        }
    );


    elements.searchInput?.addEventListener(
        "input",
        () => {

            elements.clearSearchButton.hidden =
                elements.searchInput.value === "";

            renderSubjectList();

        }
    );


    elements.clearSearchButton?.addEventListener(
        "click",
        () => {

            elements.searchInput.value =
                "";

            elements.clearSearchButton.hidden =
                true;

            elements.searchInput.focus();

            renderSubjectList();

        }
    );


    elements.statusFilters?.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    ".exam-filter-button"
                );

            if (!button) {
                return;
            }

            currentStatusFilter =
                button.dataset.status ||
                "all";

            elements.statusFilters
                .querySelectorAll(
                    ".exam-filter-button"
                )
                .forEach(
                    filterButton => {

                        filterButton.classList.toggle(
                            "is-active",
                            filterButton === button
                        );

                    }
                );

            renderSubjectList();

        }
    );


    elements.toggleAllSubjectsButton?.addEventListener(
        "click",
        toggleAllVisibleSubjects
    );


    elements.subjectUnitList?.addEventListener(
        "click",
        event => {

            const subjectToggle =
                event.target.closest(
                    ".exam-subject-toggle"
                );

            if (subjectToggle) {

                toggleSubject(
                    subjectToggle.dataset.subjectId
                );

                return;

            }


            const learningButton =
                event.target.closest(
                    "[data-learning-url]"
                );

            if (learningButton) {

                const url =
                    learningButton.dataset.learningUrl;

                if (url) {

                    location.href =
                        url;

                }

            }

        }
    );


    elements.continueButton?.addEventListener(
        "click",
        () => {

            if (!continueTarget?.url) {
                return;
            }

            location.href =
                continueTarget.url;

        }
    );


    elements.openHelpButton?.addEventListener(
        "click",
        openHelpModal
    );


    elements.closeHelpButton?.addEventListener(
        "click",
        closeHelpModal
    );


    elements.confirmHelpButton?.addEventListener(
        "click",
        closeHelpModal
    );


    elements.helpModal?.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                elements.helpModal
            ) {

                closeHelpModal();

            }

        }
    );


    document.addEventListener(
        "keydown",
        event => {

            if (event.key === "Escape") {

                closeHelpModal();

            }

        }
    );

}


/* ========================================
   管理・設定タブの仕分け
======================================== */

async function setupRoleTabs() {

    try {

        const administrator =
            await isAdmin();


        if (administrator) {

            if (elements.settingsTab) {

                elements.settingsTab.style.display =
                    "none";

            }


            if (elements.adminTab) {

                elements.adminTab.style.display =
                    "flex";

            }

        } else {

            if (elements.settingsTab) {

                elements.settingsTab.style.display =
                    "flex";

            }


            if (elements.adminTab) {

                elements.adminTab.style.display =
                    "none";

            }

        }

    } catch (error) {

        console.error(
            "管理者判定エラー:",
            error
        );


        if (elements.settingsTab) {

            elements.settingsTab.style.display =
                "flex";

        }


        if (elements.adminTab) {

            elements.adminTab.style.display =
                "none";

        }

    }

}


/* ========================================
   全データ読込
======================================== */

async function loadExamDashboard() {

    try {

        const [
            examSnapshot,
            subjectSnapshot,
            progressSnapshot,
            pointHistorySnapshot,
            subjectPointSnapshot
        ] = await Promise.all([

            getDoc(
                doc(
                    db,
                    "system",
                    "exam"
                )
            ),

            getDocs(
                collection(
                    db,
                    "examSubjects"
                )
            ),

            studentNumber
                ? safeGetDocs(
                    collection(
                        db,
                        "users",
                        studentNumber,
                        "examProgress"
                    )
                )
                : Promise.resolve(null),

            studentNumber
                ? safeGetDocs(
                    collection(
                        db,
                        "users",
                        studentNumber,
                        "subjectPointHistory"
                    )
                )
                : Promise.resolve(null),

            studentNumber
                ? safeGetDocs(
                    collection(
                        db,
                        "users",
                        studentNumber,
                        "subjectPoints"
                    )
                )
                : Promise.resolve(null)

        ]);


        renderExamInformation(
            examSnapshot
        );


        buildProgressMap(
            progressSnapshot
        );


        buildDailyCompletionData(
            pointHistorySnapshot,
            subjectPointSnapshot
        );


        subjects =
            await buildSubjectData(
                subjectSnapshot
            );


        subjects.sort(
            compareSubjects
        );


        prepareInitialOpenSubject();

        updateDashboard();

    } catch (error) {

        console.error(
            "テスト対策画面読込エラー:",
            error
        );


        elements.subjectUnitList.innerHTML = `

            <div class="exam-empty-state">

                <div>
                    ⚠️
                </div>

                <h2>
                    読み込みに失敗しました
                </h2>

                <p>
                    通信状態を確認して、もう一度開いてください。
                </p>

                <button
                    type="button"
                    class="btn btn-primary"
                    onclick="location.reload()">

                    再読み込み

                </button>

            </div>

        `;


        updateEmptyDashboard();

    }

}


/* ========================================
   試験情報
======================================== */

function renderExamInformation(
    snapshot
) {

    if (!snapshot.exists()) {

        examInformation =
            null;

        elements.examTitle.textContent =
            "テスト対策";

        elements.examStateBadge.textContent =
            "情報未登録";

        elements.examStateBadge.className =
            "exam-state-badge is-off";

        elements.examCountdown.textContent =
            "テスト情報はまだ登録されていません。";

        elements.examStartDate.textContent =
            "----";

        elements.examEndDate.textContent =
            "----";

        return;

    }


    examInformation =
        snapshot.data() || {};


    elements.examTitle.textContent =
        examInformation.title ||
        "テスト対策";


    elements.examStartDate.textContent =
        formatExamDate(
            examInformation.startDate
        );


    elements.examEndDate.textContent =
        formatExamDate(
            examInformation.endDate
        );


    if (
        examInformation.enabled !== true
    ) {

        elements.examStateBadge.textContent =
            "テストモードOFF";

        elements.examStateBadge.className =
            "exam-state-badge is-off";

        elements.examCountdown.textContent =
            "問題は復習用として利用できます。";

        return;

    }


    const today =
        startOfLocalDay(
            new Date()
        );

    const startDate =
        parseLocalDate(
            examInformation.startDate
        );

    const endDate =
        parseLocalDate(
            examInformation.endDate
        );


    if (
        !startDate ||
        !endDate
    ) {

        elements.examStateBadge.textContent =
            "期間未設定";

        elements.examStateBadge.className =
            "exam-state-badge is-off";

        elements.examCountdown.textContent =
            "テスト期間が正しく設定されていません。";

        return;

    }


    if (today < startDate) {

        const days =
            differenceInDays(
                today,
                startDate
            );

        elements.examStateBadge.textContent =
            "テスト前";

        elements.examStateBadge.className =
            "exam-state-badge is-before";

        elements.examCountdown.textContent =
            `開始まであと${days}日です。`;

        return;

    }


    if (today <= endDate) {

        const days =
            differenceInDays(
                today,
                endDate
            );

        elements.examStateBadge.textContent =
            "テスト期間中";

        elements.examStateBadge.className =
            "exam-state-badge is-active";

        elements.examCountdown.textContent =
            days === 0
                ? "テスト期間は今日までです。"
                : `終了まであと${days}日です。`;

        return;

    }


    elements.examStateBadge.textContent =
        "期間終了";

    elements.examStateBadge.className =
        "exam-state-badge is-ended";

    elements.examCountdown.textContent =
        "テスト期間は終了しました。復習に利用できます。";

}


/* ========================================
   学習進捗
======================================== */

function buildProgressMap(
    snapshot
) {

    progressMap =
        new Map();


    if (!snapshot) {
        return;
    }


    snapshot.docs.forEach(
        progressDocument => {

            const data =
                progressDocument.data() || {};


            const type =
                normalizeProgressType(
                    data.type
                );


            const subjectId =
                String(
                    data.subjectId ||
                    ""
                );


            const unitId =
                String(
                    data.unitId ||
                    ""
                );


            if (
                !type ||
                !subjectId ||
                !unitId
            ) {

                return;

            }


            const key =
                createProgressKey(
                    type,
                    subjectId,
                    unitId
                );


            const normalized = {

                id:
                    progressDocument.id,

                type,

                subjectId,

                unitId,

                subjectName:
                    String(
                        data.subjectName ||
                        ""
                    ),

                completed:
                    data.completed === true,

                currentIndex:
                    nonNegativeNumber(
                        data.currentIndex
                    ),

                totalQuestions:
                    nonNegativeNumber(
                        data.totalQuestions
                    ),

                updatedAt:
                    toMilliseconds(
                        data.updatedAt ||
                        data.savedAt ||
                        data.completedAt ||
                        data.createdAt
                    ),

                raw:
                    data

            };


            const previous =
                progressMap.get(key);


            if (
                !previous ||
                normalized.updatedAt >=
                    previous.updatedAt
            ) {

                progressMap.set(
                    key,
                    normalized
                );

            }

        }
    );

}


/* ========================================
   今日の1問達成情報
======================================== */

function buildDailyCompletionData(
    historySnapshot,
    subjectPointSnapshot
) {

    dailyCompletionKeys =
        new Set();

    dailyRecordTexts =
        [];


    const snapshots = [

        historySnapshot,
        subjectPointSnapshot

    ].filter(Boolean);


    snapshots.forEach(
        snapshot => {

            snapshot.docs.forEach(
                pointDocument => {

                    const data =
                        pointDocument.data() || {};


                    collectDailyRecord(
                        pointDocument.id,
                        data
                    );

                }
            );

        }
    );

}


function collectDailyRecord(
    documentId,
    data
) {

    let serialized = "";


    try {

        serialized =
            JSON.stringify(
                data,
                (
                    key,
                    value
                ) => {

                    if (
                        value &&
                        typeof value.toDate ===
                            "function"
                    ) {

                        return value
                            .toDate()
                            .toISOString();

                    }

                    return value;

                }
            );

    } catch {

        serialized =
            String(data);

    }


    const searchableText =
        `${documentId}|${serialized}`
            .toLowerCase();


    const appearsToBeToday =
        searchableText.includes(
            todayKey.toLowerCase()
        ) ||
        searchableText.includes(
            todayCompactKey.toLowerCase()
        ) ||
        valueIsToday(
            data.date
        ) ||
        valueIsToday(
            data.dateKey
        ) ||
        valueIsToday(
            data.localDate
        ) ||
        valueIsToday(
            data.dayKey
        ) ||
        valueIsToday(
            data.createdAt
        ) ||
        valueIsToday(
            data.updatedAt
        );


    const appearsToBeDaily =
        String(
            data.type ||
            data.questionType ||
            data.pointType ||
            ""
        )
        .toLowerCase()
        .includes("daily") ||
        searchableText.includes(
            "daily"
        );


    if (
        appearsToBeToday &&
        appearsToBeDaily
    ) {

        dailyRecordTexts.push(
            searchableText
        );

    }


    const type =
        String(
            data.type ||
            data.questionType ||
            data.pointType ||
            ""
        ).toLowerCase();


    if (
        type.includes("daily") &&
        appearsToBeToday &&
        data.subjectId &&
        data.unitId
    ) {

        dailyCompletionKeys.add(
            createDailyKey(
                data.subjectId,
                data.unitId
            )
        );

    }


    const possibleArrays = [

        data.records,
        data.items,
        data.awards,
        data.questions,
        data.history

    ];


    possibleArrays.forEach(
        possibleArray => {

            if (!Array.isArray(possibleArray)) {
                return;
            }


            possibleArray.forEach(
                (
                    item,
                    index
                ) => {

                    if (
                        item &&
                        typeof item === "object"
                    ) {

                        collectDailyRecord(
                            `${documentId}_${index}`,
                            item
                        );

                    }

                }
            );

        }
    );

}


/* ========================================
   科目データ作成
======================================== */

async function buildSubjectData(
    subjectSnapshot
) {

    if (subjectSnapshot.empty) {
        return [];
    }


    const subjectPromises =
        subjectSnapshot.docs.map(
            async subjectDocument => {

                const subjectData =
                    subjectDocument.data() || {};


                const unitSnapshot =
                    await safeGetDocs(
                        collection(
                            db,
                            "examSubjects",
                            subjectDocument.id,
                            "units"
                        )
                    );


                if (
                    !unitSnapshot ||
                    unitSnapshot.empty
                ) {

                    return null;

                }


                const units =
                    await Promise.all(

                        unitSnapshot.docs.map(
                            unitDocument =>
                                buildUnitData(
                                    subjectDocument.id,
                                    unitDocument
                                )
                        )

                    );


                const availableUnits =
                    units
                        .filter(Boolean)
                        .sort(
                            compareUnits
                        );


                if (
                    availableUnits.length === 0
                ) {

                    return null;

                }


                const subject = {

                    id:
                        subjectDocument.id,

                    name:
                        String(
                            subjectData.name ||
                            subjectData.subjectName ||
                            "名称未設定"
                        ),

                    completedExam:
                        subjectData.completed === true,

                    completedDate:
                        String(
                            subjectData.completedDate ||
                            ""
                        ),

                    completedPeriod:
                        String(
                            subjectData.completedPeriod ||
                            ""
                        ),

                    createdAt:
                        toMilliseconds(
                            subjectData.createdAt
                        ),

                    units:
                        availableUnits

                };


                calculateSubjectProgress(
                    subject
                );


                return subject;

            }
        );


    const result =
        await Promise.all(
            subjectPromises
        );


    return result.filter(Boolean);

}


/* ========================================
   テーマデータ作成
======================================== */

async function buildUnitData(
    subjectId,
    unitDocument
) {

    const unitData =
        unitDocument.data() || {};


    const publishedSnapshot =
        await safeGetDoc(
            doc(
                db,
                "examSubjects",
                subjectId,
                "units",
                unitDocument.id,
                "publishedQuestions",
                "published"
            )
        );


    if (
        !publishedSnapshot ||
        !publishedSnapshot.exists()
    ) {

        return null;

    }


    const publishedData =
        publishedSnapshot.data() || {};


    const fillBlankQuestions =
        getValidFillBlankQuestions(
            publishedData
        );


    const quizQuestions =
        getValidQuizQuestions(
            publishedData
        );

    const qaQuestions =
        getValidQaQuestions(
            publishedData
        );


    const hasDailyQuestion =
        hasValidDailyQuestion(
            publishedData
        );


    const hasImportantPoints =
        hasValidImportantPoints(
            publishedData
        );


    if (
        fillBlankQuestions.length === 0 &&
        quizQuestions.length === 0 &&
        qaQuestions.length === 0 &&
        !hasDailyQuestion &&
        !hasImportantPoints
    ) {

        return null;

    }


    const formats = [];


    if (hasDailyQuestion) {

        const completedToday =
            isDailyCompleted(
                subjectId,
                unitDocument.id
            );


        formats.push({

            type:
                "daily",

            title:
                "今日の1問",

            icon:
                "🎯",

            status:
                completedToday
                    ? "today-completed"
                    : "today-unstarted",

            completed:
                completedToday,

            progressText:
                completedToday
                    ? "本日は達成済み"
                    : "今日の問題に挑戦",

            url:
                createLearningUrl(
                    "daily_question.html",
                    subjectId,
                    unitDocument.id
                ),

            questionCount:
                1,

            countsForAchievement:
                false

        });

    }


    if (
        fillBlankQuestions.length > 0
    ) {

        formats.push(
            createPracticeFormat({

                type:
                    "fillBlank",

                title:
                    "穴埋め問題",

                icon:
                    "📝",

                file:
                    "fill_blank.html",

                subjectId,

                unitId:
                    unitDocument.id,

                questionCount:
                    fillBlankQuestions.length

            })
        );

    }


    if (
        quizQuestions.length > 0
    ) {

        formats.push(
            createPracticeFormat({

                type:
                    "quiz",

                title:
                    "四択問題",

                icon:
                    "🧠",

                file:
                    "quiz.html",

                subjectId,

                unitId:
                    unitDocument.id,

                questionCount:
                    quizQuestions.length

            })
        );

    }

    if (
        qaQuestions.length > 0
    ) {

        formats.push(
            createPracticeFormat({

                type:
                    "qa",

                title:
                    "一問一答",

                icon:
                    "💬",

                file:
                    "qa.html",

                subjectId,

                unitId:
                    unitDocument.id,

                questionCount:
                    qaQuestions.length

            })
        );

    }


    if (hasImportantPoints) {

        formats.push({

            type:
                "important",

            title:
                "ここだけ覚えろ",

            icon:
                "⭐",

            status:
                "reference",

            completed:
                false,

            progressText:
                "重要ポイントを確認",

            url:
                createLearningUrl(
                    "must_remember.html",
                    subjectId,
                    unitDocument.id
                ),

            questionCount:
                0,

            countsForAchievement:
                false

        });

    }


    const unit = {

        id:
            unitDocument.id,

        subjectId,

        name:
            String(
                unitData.name ||
                unitData.title ||
                "名称未設定"
            ),

        range:
            String(
                unitData.range ||
                unitData.description ||
                ""
            ),

        createdAt:
            toMilliseconds(
                unitData.createdAt
            ),

        formats

    };


    calculateUnitProgress(
        unit
    );


    return unit;

}


/* ========================================
   問題形式作成
======================================== */

function createPracticeFormat({

    type,
    title,
    icon,
    file,
    subjectId,
    unitId,
    questionCount

}) {

    const progress =
        progressMap.get(
            createProgressKey(
                type,
                subjectId,
                unitId
            )
        ) || null;


    let status =
        "unstarted";


    if (progress?.completed === true) {

        status =
            "completed";

    } else if (progress) {

        status =
            "in-progress";

    }


    let progressText =
        `${questionCount}問に挑戦`;


    if (
        status === "completed"
    ) {

        progressText =
            `${questionCount}問を最後まで完了`;

    } else if (
        status === "in-progress"
    ) {

        const totalQuestions =
            progress.totalQuestions ||
            questionCount;


        const displayIndex =
            Math.min(
                totalQuestions,
                progress.currentIndex + 1
            );


        progressText =
            `問題 ${displayIndex} / ${totalQuestions} から再開`;

    }


    return {

        type,

        title,

        icon,

        status,

        completed:
            status === "completed",

        progressText,

        url:
            createLearningUrl(
                file,
                subjectId,
                unitId
            ),

        questionCount,

        countsForAchievement:
            true,

        progress

    };

}


/* ========================================
   テーマ達成度
======================================== */

function calculateUnitProgress(
    unit
) {

    const achievementFormats =
        unit.formats.filter(
            format =>
                format.countsForAchievement
        );


    unit.totalFormats =
        achievementFormats.length;


    unit.completedFormats =
        achievementFormats.filter(
            format =>
                format.status ===
                "completed"
        ).length;


    unit.inProgressFormats =
        achievementFormats.filter(
            format =>
                format.status ===
                "in-progress"
        ).length;


    unit.unstartedFormats =
        achievementFormats.filter(
            format =>
                format.status ===
                "unstarted"
        ).length;


    unit.progressPercent =
        unit.totalFormats > 0
            ? Math.round(
                unit.completedFormats /
                unit.totalFormats *
                100
            )
            : 0;


    if (
        unit.totalFormats > 0 &&
        unit.completedFormats ===
            unit.totalFormats
    ) {

        unit.status =
            "completed";

    } else if (
        unit.completedFormats > 0 ||
        unit.inProgressFormats > 0
    ) {

        unit.status =
            "in-progress";

    } else {

        unit.status =
            "unstarted";

    }


    unit.hasDaily =
        unit.formats.some(
            format =>
                format.type === "daily"
        );


    unit.dailyCompleted =
        unit.formats.some(
            format =>
                format.type === "daily" &&
                format.completed
        );

}


/* ========================================
   科目達成度
======================================== */

function calculateSubjectProgress(
    subject
) {

    subject.totalFormats =
        subject.units.reduce(
            (
                total,
                unit
            ) =>
                total +
                unit.totalFormats,
            0
        );


    subject.completedFormats =
        subject.units.reduce(
            (
                total,
                unit
            ) =>
                total +
                unit.completedFormats,
            0
        );


    subject.inProgressFormats =
        subject.units.reduce(
            (
                total,
                unit
            ) =>
                total +
                unit.inProgressFormats,
            0
        );


    subject.unstartedFormats =
        subject.units.reduce(
            (
                total,
                unit
            ) =>
                total +
                unit.unstartedFormats,
            0
        );


    subject.progressPercent =
        subject.totalFormats > 0
            ? Math.round(
                subject.completedFormats /
                subject.totalFormats *
                100
            )
            : 0;


    if (
        subject.totalFormats > 0 &&
        subject.completedFormats ===
            subject.totalFormats
    ) {

        subject.status =
            "completed";

    } else if (
        subject.completedFormats > 0 ||
        subject.inProgressFormats > 0
    ) {

        subject.status =
            "in-progress";

    } else {

        subject.status =
            "unstarted";

    }


    subject.dailyTotal =
        subject.units.filter(
            unit =>
                unit.hasDaily
        ).length;


    subject.dailyCompleted =
        subject.units.filter(
            unit =>
                unit.dailyCompleted
        ).length;

}


/* ========================================
   ダッシュボード更新
======================================== */

function updateDashboard() {

    updateOverallProgress();

    updateDailyProgress();

    updateContinueLearning();

    updateFilterCounts();

    renderSubjectList();

}


/* ========================================
   全体達成度
======================================== */

function updateOverallProgress() {

    const totalFormats =
        subjects.reduce(
            (
                total,
                subject
            ) =>
                total +
                subject.totalFormats,
            0
        );


    const completedFormats =
        subjects.reduce(
            (
                total,
                subject
            ) =>
                total +
                subject.completedFormats,
            0
        );


    const inProgressFormats =
        subjects.reduce(
            (
                total,
                subject
            ) =>
                total +
                subject.inProgressFormats,
            0
        );


    const unstartedFormats =
        subjects.reduce(
            (
                total,
                subject
            ) =>
                total +
                subject.unstartedFormats,
            0
        );


    const completedSubjects =
        subjects.filter(
            subject =>
                subject.status ===
                "completed"
        ).length;


    const percentage =
        totalFormats > 0
            ? Math.round(
                completedFormats /
                totalFormats *
                100
            )
            : 0;


    elements.overallProgressPercent.textContent =
        String(percentage);


    elements.overallProgressRing.style.setProperty(
        "--progress",
        percentage
    );


    elements.overallProgressBar.style.setProperty(
        "width",
        `${percentage}%`,
        "important"
    );


    elements.completedFormatCount.textContent =
        String(completedFormats);


    elements.inProgressFormatCount.textContent =
        String(inProgressFormats);


    elements.unstartedFormatCount.textContent =
        String(unstartedFormats);


    elements.completedSubjectCount.textContent =
        String(completedSubjects);


    let status =
        "unstarted";


    if (
        totalFormats > 0 &&
        completedFormats === totalFormats
    ) {

        status =
            "completed";

    } else if (
        completedFormats > 0 ||
        inProgressFormats > 0
    ) {

        status =
            "in-progress";

    }


    elements.overallStatusBadge.className =
        `exam-achievement-badge is-${status}`;


    elements.overallStatusBadge.textContent =
        statusLabel(status);


    if (totalFormats === 0) {

        elements.overallProgressMessage.textContent =
            "挑戦できる穴埋め・四択問題はまだありません。";

    } else if (percentage === 100) {

        elements.overallProgressMessage.textContent =
            `全${totalFormats}形式を達成しました。復習して定着させよう。`;

    } else if (
        inProgressFormats > 0
    ) {

        elements.overallProgressMessage.textContent =
            `${completedFormats} / ${totalFormats}形式を達成。学習中の問題が${inProgressFormats}形式あります。`;

    } else {

        elements.overallProgressMessage.textContent =
            `${completedFormats} / ${totalFormats}形式を達成しています。`;

    }

}


/* ========================================
   今日の1問進捗
======================================== */

function updateDailyProgress() {

    const dailyTotal =
        subjects.reduce(
            (
                total,
                subject
            ) =>
                total +
                subject.dailyTotal,
            0
        );


    const dailyCompleted =
        subjects.reduce(
            (
                total,
                subject
            ) =>
                total +
                subject.dailyCompleted,
            0
        );


    const percentage =
        dailyTotal > 0
            ? Math.round(
                dailyCompleted /
                dailyTotal *
                100
            )
            : 0;


    elements.todayDailyCount.textContent =
        `${dailyCompleted} / ${dailyTotal}達成`;


    elements.todayDailyProgressBar.style.setProperty(
        "width",
        `${percentage}%`,
        "important"
    );


    if (dailyTotal === 0) {

        elements.todayDailyMessage.textContent =
            "今日の1問はまだ公開されていません。";

    } else if (
        dailyCompleted === dailyTotal
    ) {

        elements.todayDailyMessage.textContent =
            "今日の1問をすべて達成しました。おつかれさま！";

    } else if (
        dailyCompleted > 0
    ) {

        elements.todayDailyMessage.textContent =
            `あと${dailyTotal - dailyCompleted}テーマで今日の1問を達成できます。`;

    } else {

        elements.todayDailyMessage.textContent =
            `今日は${dailyTotal}テーマの問題に挑戦できます。`;

    }

}


/* ========================================
   続きから
======================================== */

function updateContinueLearning() {

    const candidates = [];


    subjects.forEach(
        subject => {

            subject.units.forEach(
                unit => {

                    unit.formats.forEach(
                        format => {

                            if (
                                format.status !==
                                "in-progress"
                            ) {

                                return;

                            }


                            candidates.push({

                                subjectId:
                                    subject.id,

                                subjectName:
                                    subject.name,

                                unitId:
                                    unit.id,

                                unitName:
                                    unit.name,

                                format,

                                updatedAt:
                                    format.progress
                                        ?.updatedAt || 0,

                                url:
                                    format.url

                            });

                        }
                    );

                }
            );

        }
    );


    candidates.sort(
        (
            candidateA,
            candidateB
        ) =>
            candidateB.updatedAt -
            candidateA.updatedAt
    );


    continueTarget =
        candidates[0] || null;


    if (!continueTarget) {

        continueTarget =
            findFirstUnstartedFormat();

    }


    if (!continueTarget) {

        elements.continueSection.hidden =
            true;

        return;

    }


    elements.continueSection.hidden =
        false;


    elements.continueIcon.textContent =
        continueTarget.format.icon;


    elements.continueSubject.textContent =
        continueTarget.subjectName;


    elements.continueTitle.textContent =
        `${continueTarget.unitName}・${continueTarget.format.title}`;


    if (
        continueTarget.format.status ===
        "in-progress"
    ) {

        elements.continueDetail.textContent =
            continueTarget.format.progressText;

    } else {

        elements.continueDetail.textContent =
            "まだ始めていない問題に挑戦";

    }

}


function findFirstUnstartedFormat() {

    for (const subject of subjects) {

        for (const unit of subject.units) {

            const format =
                unit.formats.find(
                    item =>
                        item.countsForAchievement &&
                        item.status ===
                            "unstarted"
                );


            if (format) {

                return {

                    subjectId:
                        subject.id,

                    subjectName:
                        subject.name,

                    unitId:
                        unit.id,

                    unitName:
                        unit.name,

                    format,

                    updatedAt:
                        0,

                    url:
                        format.url

                };

            }

        }

    }


    return null;

}


/* ========================================
   絞り込み件数
======================================== */

function updateFilterCounts() {

    const unstartedSubjects =
        subjects.filter(
            subject =>
                subject.status ===
                "unstarted"
        ).length;


    const inProgressSubjects =
        subjects.filter(
            subject =>
                subject.status ===
                "in-progress"
        ).length;


    const completedSubjects =
        subjects.filter(
            subject =>
                subject.status ===
                "completed"
        ).length;


    elements.allSubjectFilterCount.textContent =
        String(subjects.length);


    elements.unstartedSubjectFilterCount.textContent =
        String(unstartedSubjects);


    elements.inProgressSubjectFilterCount.textContent =
        String(inProgressSubjects);


    elements.completedSubjectFilterCount.textContent =
        String(completedSubjects);


    elements.totalSubjectCount.textContent =
        `${subjects.length}科目`;

}


/* ========================================
   科目一覧表示
======================================== */

function renderSubjectList() {

    const keyword =
        normalizeSearchText(
            elements.searchInput.value
        );


    const filteredSubjects =
        subjects
            .filter(
                subject =>
                    currentStatusFilter ===
                        "all" ||
                    subject.status ===
                        currentStatusFilter
            )
            .map(
                subject => {

                    if (!keyword) {

                        return {

                            subject,

                            units:
                                subject.units

                        };

                    }


                    const subjectMatches =
                        normalizeSearchText(
                            subject.name
                        ).includes(keyword);


                    const matchingUnits =
                        subjectMatches
                            ? subject.units
                            : subject.units.filter(
                                unit => {

                                    const text =
                                        normalizeSearchText(
                                            `${unit.name} ${unit.range}`
                                        );


                                    return text.includes(
                                        keyword
                                    );

                                }
                            );


                    return {

                        subject,

                        units:
                            matchingUnits

                    };

                }
            )
            .filter(
                item =>
                    item.units.length > 0
            );


    elements.visibleSubjectCount.textContent =
        `${filteredSubjects.length}科目を表示`;


    if (
        filteredSubjects.length === 0
    ) {

        elements.subjectUnitList.innerHTML = `

            <div class="exam-empty-state">

                <div>
                    🔍
                </div>

                <h2>
                    条件に一致する科目がありません
                </h2>

                <p>
                    検索する言葉や学習状況を変更してください。
                </p>

                <button
                    id="resetExamFiltersButton"
                    type="button"
                    class="btn btn-primary">

                    絞り込みを解除

                </button>

            </div>

        `;


        document
            .getElementById(
                "resetExamFiltersButton"
            )
            ?.addEventListener(
                "click",
                resetFilters
            );


        updateToggleAllButton(
            []
        );

        return;

    }


    elements.subjectUnitList.innerHTML =
        filteredSubjects
            .map(
                item =>
                    createSubjectHtml(
                        item.subject,
                        item.units,
                        keyword !== ""
                    )
            )
            .join("");


    updateToggleAllButton(
        filteredSubjects.map(
            item =>
                item.subject.id
        )
    );

}


/* ========================================
   科目HTML
======================================== */

function createSubjectHtml(
    subject,
    displayedUnits,
    searchActive
) {

    const isOpen =
        searchActive ||
        openSubjectIds.has(
            subject.id
        );


    const completedExamInformation =
        subject.completedExam
            ? createCompletedExamText(
                subject
            )
            : "";


    const achievementText =
        subject.totalFormats > 0
            ? `${subject.completedFormats} / ${subject.totalFormats}形式達成`
            : "確認教材のみ";


    return `

        <article
            class="
                exam-subject-card
                is-${escapeAttribute(
                    subject.status
                )}
                ${
                    subject.completedExam
                        ? "is-exam-completed"
                        : ""
                }
                ${
                    isOpen
                        ? "is-open"
                        : ""
                }
            "
            data-subject-id="${escapeAttribute(
                subject.id
            )}">


            <button
                type="button"
                class="exam-subject-toggle"
                data-subject-id="${escapeAttribute(
                    subject.id
                )}"
                aria-expanded="${isOpen}">


                <span class="exam-subject-icon">

                    ${
                        subject.status ===
                            "completed"
                            ? "✅"
                            : subject.status ===
                                "in-progress"
                                ? "📖"
                                : "📚"
                    }

                </span>


                <span class="exam-subject-heading">


                    <span class="exam-subject-title-row">

                        <strong>

                            ${escapeHtml(
                                subject.name
                            )}

                        </strong>


                        <span
                            class="
                                exam-achievement-badge
                                is-${escapeAttribute(
                                    subject.status
                                )}
                            ">

                            ${statusLabel(
                                subject.status
                            )}

                        </span>

                    </span>


                    ${
                        completedExamInformation
                            ? `

                                <span class="exam-completed-exam-label">

                                    🗓️
                                    ${escapeHtml(
                                        completedExamInformation
                                    )}

                                </span>

                            `
                            : ""
                    }


                    <span class="exam-subject-meta">

                        <span>
                            ${displayedUnits.length}テーマ
                        </span>

                        <span>
                            ${achievementText}
                        </span>

                        ${
                            subject.dailyTotal > 0
                                ? `

                                    <span>

                                        今日の1問
                                        ${subject.dailyCompleted}
                                        /
                                        ${subject.dailyTotal}

                                    </span>

                                `
                                : ""
                        }

                    </span>


                    <span class="exam-subject-progress-row">

                        <span class="exam-subject-progress-track">

                            <span
                                style="
                                    width:
                                    ${subject.progressPercent}%
                                ">

                            </span>

                        </span>

                        <b>
                            ${subject.progressPercent}%
                        </b>

                    </span>

                </span>


                <span class="exam-subject-arrow">

                    ${
                        isOpen
                            ? "▲"
                            : "▼"
                    }

                </span>

            </button>


            <div
                class="exam-subject-content"
                ${isOpen ? "" : "hidden"}>


                <div class="exam-unit-list">

                    ${
                        displayedUnits
                            .map(
                                unit =>
                                    createUnitHtml(
                                        unit
                                    )
                            )
                            .join("")
                    }

                </div>

            </div>

        </article>

    `;

}


/* ========================================
   テーマHTML
======================================== */

function createUnitHtml(
    unit
) {

    const progressText =
        unit.totalFormats > 0
            ? `${unit.completedFormats} / ${unit.totalFormats}形式達成`
            : "確認教材";


    return `

        <section
            class="
                exam-unit-card
                is-${escapeAttribute(
                    unit.status
                )}
            ">


            <div class="exam-unit-heading">


                <div class="exam-unit-title-area">

                    <span class="exam-unit-number-icon">

                        📘

                    </span>


                    <div>

                        <div class="exam-unit-title-row">

                            <h3>

                                ${escapeHtml(
                                    unit.name
                                )}

                            </h3>


                            <span
                                class="
                                    exam-achievement-badge
                                    is-${escapeAttribute(
                                        unit.status
                                    )}
                                ">

                                ${statusLabel(
                                    unit.status
                                )}

                            </span>

                        </div>


                        ${
                            unit.range
                                ? `

                                    <p>
                                        ${escapeHtml(
                                            unit.range
                                        )}
                                    </p>

                                `
                                : ""
                        }

                    </div>

                </div>


                <div class="exam-unit-progress-summary">

                    <strong>
                        ${unit.progressPercent}%
                    </strong>

                    <span>
                        ${progressText}
                    </span>

                </div>

            </div>


            <div class="exam-unit-progress-track">

                <div
                    style="
                        width:
                        ${unit.progressPercent}%
                    ">

                </div>

            </div>


            <div class="exam-format-grid">

                ${
                    unit.formats
                        .map(
                            format =>
                                createFormatHtml(
                                    format
                                )
                        )
                        .join("")
                }

            </div>

        </section>

    `;

}


/* ========================================
   問題形式HTML
======================================== */

function createFormatHtml(
    format
) {

    const appearance =
        getFormatAppearance(
            format.status
        );


    return `

        <button
            type="button"
            class="
                exam-format-card
                ${appearance.className}
            "
            data-learning-url="${escapeAttribute(
                format.url
            )}">


            <span class="exam-format-icon">

                ${format.icon}

            </span>


            <span class="exam-format-content">

                <span class="exam-format-title-row">

                    <strong>

                        ${escapeHtml(
                            format.title
                        )}

                    </strong>


                    <span class="exam-format-status">

                        ${appearance.icon}
                        ${appearance.label}

                    </span>

                </span>


                <span class="exam-format-description">

                    ${escapeHtml(
                        format.progressText
                    )}

                </span>


                ${
                    format.questionCount > 0 &&
                    format.type !== "daily"
                        ? `

                            <span class="exam-format-question-count">

                                全${format.questionCount}問

                            </span>

                        `
                        : ""
                }

            </span>


            <span class="exam-format-arrow">

                →

            </span>

        </button>

    `;

}


/* ========================================
   科目開閉
======================================== */

function toggleSubject(
    subjectId
) {

    if (!subjectId) {
        return;
    }


    if (
        openSubjectIds.has(
            subjectId
        )
    ) {

        openSubjectIds.delete(
            subjectId
        );

    } else {

        openSubjectIds.add(
            subjectId
        );

    }


    saveOpenSubjectIds();

    renderSubjectList();

}


function toggleAllVisibleSubjects() {

    const visibleSubjectIds =
        Array.from(
            elements.subjectUnitList
                .querySelectorAll(
                    ".exam-subject-card"
                )
        )
        .map(
            card =>
                card.dataset.subjectId
        )
        .filter(Boolean);


    if (
        visibleSubjectIds.length === 0
    ) {

        return;

    }


    const allOpen =
        visibleSubjectIds.every(
            subjectId =>
                openSubjectIds.has(
                    subjectId
                )
        );


    visibleSubjectIds.forEach(
        subjectId => {

            if (allOpen) {

                openSubjectIds.delete(
                    subjectId
                );

            } else {

                openSubjectIds.add(
                    subjectId
                );

            }

        }
    );


    saveOpenSubjectIds();

    renderSubjectList();

}


function updateToggleAllButton(
    visibleSubjectIds
) {

    if (
        visibleSubjectIds.length === 0
    ) {

        elements.toggleAllSubjectsButton.disabled =
            true;

        elements.toggleAllSubjectsButton.textContent =
            "すべて開く";

        return;

    }


    elements.toggleAllSubjectsButton.disabled =
        false;


    const allOpen =
        visibleSubjectIds.every(
            subjectId =>
                openSubjectIds.has(
                    subjectId
                )
        );


    elements.toggleAllSubjectsButton.textContent =
        allOpen
            ? "すべて閉じる"
            : "すべて開く";

}


/* ========================================
   最初に開く科目
======================================== */

function prepareInitialOpenSubject() {

    if (
        openSubjectIds.size > 0
    ) {

        const existingSubjectIds =
            new Set(
                subjects.map(
                    subject =>
                        subject.id
                )
            );


        openSubjectIds =
            new Set(
                [...openSubjectIds].filter(
                    subjectId =>
                        existingSubjectIds.has(
                            subjectId
                        )
                )
            );

    }


    if (
        openSubjectIds.size === 0
    ) {

        const initialSubject =
            subjects.find(
                subject =>
                    subject.status ===
                    "in-progress"
            ) ||
            subjects.find(
                subject =>
                    subject.status ===
                    "unstarted"
            ) ||
            subjects[0];


        if (initialSubject) {

            openSubjectIds.add(
                initialSubject.id
            );

        }

    }


    saveOpenSubjectIds();

}


/* ========================================
   絞り込み解除
======================================== */

function resetFilters() {

    currentStatusFilter =
        "all";


    elements.searchInput.value =
        "";

    elements.clearSearchButton.hidden =
        true;


    elements.statusFilters
        .querySelectorAll(
            ".exam-filter-button"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "is-active",
                    button.dataset.status ===
                        "all"
                );

            }
        );


    renderSubjectList();

}


/* ========================================
   ヘルプモーダル
======================================== */

function openHelpModal() {

    elements.helpModal.hidden =
        false;

    document.body.classList.add(
        "admin-modal-open"
    );

}


function closeHelpModal() {

    if (
        !elements.helpModal ||
        elements.helpModal.hidden
    ) {

        return;

    }


    elements.helpModal.hidden =
        true;

    document.body.classList.remove(
        "admin-modal-open"
    );

}


/* ========================================
   問題データ判定
======================================== */

function getValidFillBlankQuestions(
    data
) {

    if (
        !Array.isArray(
            data.fill_blank
        )
    ) {

        return [];

    }


    return data.fill_blank.filter(
        question => {

            if (
                !question ||
                typeof question.question !==
                    "string" ||
                question.question.trim() ===
                    ""
            ) {

                return false;

            }


            const answers =
                Array.isArray(
                    question.answers
                )
                    ? question.answers
                    : [
                        question.answer
                    ];


            return answers.some(
                answer =>
                    String(
                        answer || ""
                    ).trim() !== ""
            );

        }
    );

}


function getValidQuizQuestions(
    data
) {

    if (
        !Array.isArray(
            data.quiz
        )
    ) {

        return [];

    }


    return data.quiz.filter(
        question => {

            if (
                !question ||
                typeof question.question !==
                    "string" ||
                question.question.trim() ===
                    ""
            ) {

                return false;

            }


            if (
                !Array.isArray(
                    question.choices
                ) ||
                question.choices.length ===
                    0
            ) {

                return false;

            }


            if (
                !question.choices.every(
                    choice =>
                        String(
                            choice || ""
                        ).trim() !== ""
                )
            ) {

                return false;

            }


            return (
                question.answer !== undefined &&
                question.answer !== null
            );

        }
    );

}

function getValidQaQuestions(
    data
) {

    if (!Array.isArray(data.qa)) {
        return [];
    }

    return data.qa.filter(question =>
        question &&
        typeof question.question === "string" &&
        question.question.trim() !== "" &&
        typeof question.answer === "string" &&
        question.answer.trim() !== ""
    );

}


function hasValidDailyQuestion(
    data
) {

    if (
        getValidQuizQuestions(
            data
        ).length > 0
    ) {

        return true;

    }


    const question =
        data.today_question;


    return Boolean(

        question &&

        typeof question.question ===
            "string" &&

        question.question.trim() !==
            "" &&

        Array.isArray(
            question.choices
        ) &&

        question.choices.length > 0

    );

}


function hasValidImportantPoints(
    data
) {

    if (
        !Array.isArray(
            data.important_points
        )
    ) {

        return false;

    }


    return data.important_points.some(
        point => {

            if (
                typeof point ===
                "string"
            ) {

                return point.trim() !== "";

            }


            if (
                point &&
                typeof point ===
                    "object"
            ) {

                return Boolean(

                    String(
                        point.text ||
                        point.point ||
                        point.title ||
                        point.body ||
                        point.imageUrl ||
                        ""
                    ).trim()

                );

            }


            return false;

        }
    );

}


/* ========================================
   今日の1問達成判定
======================================== */

function isDailyCompleted(
    subjectId,
    unitId
) {

    const directKey =
        createDailyKey(
            subjectId,
            unitId
        );


    if (
        dailyCompletionKeys.has(
            directKey
        )
    ) {

        return true;

    }


    const normalizedSubjectId =
        String(
            subjectId
        ).toLowerCase();


    const normalizedUnitId =
        String(
            unitId
        ).toLowerCase();


    return dailyRecordTexts.some(
        recordText =>

            recordText.includes(
                normalizedSubjectId
            ) &&

            recordText.includes(
                normalizedUnitId
            )

    );

}


/* ========================================
   表示情報
======================================== */

function getFormatAppearance(
    status
) {

    const appearances = {

        completed: {

            className:
                "is-completed",

            icon:
                "✓",

            label:
                "達成"

        },

        "in-progress": {

            className:
                "is-progress",

            icon:
                "▶",

            label:
                "学習中"

        },

        unstarted: {

            className:
                "is-unstarted",

            icon:
                "○",

            label:
                "未着手"

        },

        "today-completed": {

            className:
                "is-today-completed",

            icon:
                "✓",

            label:
                "本日達成"

        },

        "today-unstarted": {

            className:
                "is-today-unstarted",

            icon:
                "○",

            label:
                "本日未達成"

        },

        reference: {

            className:
                "is-reference",

            icon:
                "📖",

            label:
                "確認教材"

        }

    };


    return appearances[status] ||
        appearances.unstarted;

}


function statusLabel(
    status
) {

    return {

        completed:
            "達成",

        "in-progress":
            "学習中",

        unstarted:
            "未着手"

    }[status] || "未着手";

}


/* ========================================
   並び順
======================================== */

function compareSubjects(
    subjectA,
    subjectB
) {

    const statusOrder = {

        "in-progress":
            1,

        unstarted:
            2,

        completed:
            3

    };


    const orderA =
        statusOrder[
            subjectA.status
        ] || 99;


    const orderB =
        statusOrder[
            subjectB.status
        ] || 99;


    if (
        orderA !==
        orderB
    ) {

        return orderA -
            orderB;

    }


    if (
        subjectA.completedExam !==
        subjectB.completedExam
    ) {

        return Number(
            subjectA.completedExam
        ) -
        Number(
            subjectB.completedExam
        );

    }


    if (
        subjectA.createdAt !==
        subjectB.createdAt
    ) {

        return subjectB.createdAt -
            subjectA.createdAt;

    }


    return subjectA.name.localeCompare(
        subjectB.name,
        "ja"
    );

}


function compareUnits(
    unitA,
    unitB
) {

    if (
        unitA.createdAt !==
        unitB.createdAt
    ) {

        return unitB.createdAt -
            unitA.createdAt;

    }


    return unitA.name.localeCompare(
        unitB.name,
        "ja"
    );

}


/* ========================================
   空状態
======================================== */

function updateEmptyDashboard() {

    elements.overallProgressPercent.textContent =
        "0";

    elements.overallProgressRing.style.setProperty(
        "--progress",
        0
    );

    elements.overallProgressBar.style.width =
        "0%";

    elements.completedFormatCount.textContent =
        "0";

    elements.inProgressFormatCount.textContent =
        "0";

    elements.unstartedFormatCount.textContent =
        "0";

    elements.completedSubjectCount.textContent =
        "0";

    elements.todayDailyCount.textContent =
        "0 / 0達成";

    elements.todayDailyProgressBar.style.width =
        "0%";

    elements.continueSection.hidden =
        true;

}


/* ========================================
   Firestore安全取得
======================================== */

async function safeGetDocs(
    reference
) {

    try {

        return await getDocs(
            reference
        );

    } catch (error) {

        console.error(
            "コレクション取得エラー:",
            error
        );

        return null;

    }

}


async function safeGetDoc(
    reference
) {

    try {

        return await getDoc(
            reference
        );

    } catch (error) {

        console.error(
            "ドキュメント取得エラー:",
            error
        );

        return null;

    }

}


/* ========================================
   ローカル保存
======================================== */

function loadOpenSubjectIds() {

    try {

        const storedValue =
            localStorage.getItem(
                openSubjectsStorageKey
            );


        if (!storedValue) {

            return new Set();

        }


        const parsed =
            JSON.parse(
                storedValue
            );


        if (!Array.isArray(parsed)) {

            return new Set();

        }


        return new Set(
            parsed.map(
                value =>
                    String(value)
            )
        );

    } catch {

        return new Set();

    }

}


function saveOpenSubjectIds() {

    try {

        localStorage.setItem(
            openSubjectsStorageKey,
            JSON.stringify(
                [...openSubjectIds]
            )
        );

    } catch (error) {

        console.warn(
            "開閉状態保存エラー:",
            error
        );

    }

}


/* ========================================
   日付
======================================== */

function parseLocalDate(
    value
) {

    if (!value) {
        return null;
    }


    if (
        value &&
        typeof value.toDate ===
            "function"
    ) {

        return startOfLocalDay(
            value.toDate()
        );

    }


    if (
        value instanceof Date
    ) {

        return startOfLocalDay(
            value
        );

    }


    const text =
        String(value);


    const matched =
        text.match(
            /^(\d{4})-(\d{1,2})-(\d{1,2})/
        );


    if (matched) {

        return new Date(

            Number(matched[1]),

            Number(matched[2]) - 1,

            Number(matched[3]),

            0,
            0,
            0,
            0

        );

    }


    const parsed =
        new Date(value);


    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {

        return null;

    }


    return startOfLocalDay(
        parsed
    );

}


function startOfLocalDay(
    date
) {

    const result =
        new Date(date);


    result.setHours(
        0,
        0,
        0,
        0
    );


    return result;

}


function differenceInDays(
    fromDate,
    toDate
) {

    return Math.max(

        0,

        Math.ceil(

            (
                startOfLocalDay(toDate) -
                startOfLocalDay(fromDate)
            ) /

            86400000

        )

    );

}


function createLocalDateKey(
    date
) {

    return [

        date.getFullYear(),

        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        ),

        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        )

    ].join("-");

}


function valueIsToday(
    value
) {

    if (!value) {
        return false;
    }


    if (
        typeof value.toDate ===
        "function"
    ) {

        return (
            createLocalDateKey(
                value.toDate()
            ) === todayKey
        );

    }


    if (
        value instanceof Date
    ) {

        return (
            createLocalDateKey(
                value
            ) === todayKey
        );

    }


    if (
        typeof value ===
            "number"
    ) {

        const date =
            new Date(value);


        return (
            !Number.isNaN(
                date.getTime()
            ) &&
            createLocalDateKey(
                date
            ) === todayKey
        );

    }


    const text =
        String(value);


    if (
        text.includes(
            todayKey
        ) ||
        text.includes(
            todayCompactKey
        )
    ) {

        return true;

    }


    const date =
        new Date(text);


    return (
        !Number.isNaN(
            date.getTime()
        ) &&
        createLocalDateKey(
            date
        ) === todayKey
    );

}


function formatExamDate(
    value
) {

    const date =
        parseLocalDate(
            value
        );


    if (!date) {

        return "----";

    }


    const weekdays = [

        "日",
        "月",
        "火",
        "水",
        "木",
        "金",
        "土"

    ];


    return (

        `${date.getMonth() + 1}/` +
        `${date.getDate()}` +
        `（${weekdays[date.getDay()]}）`

    );

}


function createCompletedExamText(
    subject
) {

    if (!subject.completedDate) {

        return "試験実施済み";

    }


    const dateText =
        formatExamDate(
            subject.completedDate
        );


    return (

        `${dateText}` +

        (
            subject.completedPeriod
                ? ` ${subject.completedPeriod}限目`
                : ""
        ) +

        "・試験実施済み"

    );

}


/* ========================================
   キー・URL
======================================== */

function createProgressKey(
    type,
    subjectId,
    unitId
) {

    return (

        `${normalizeProgressType(type)}|` +
        `${String(subjectId)}|` +
        `${String(unitId)}`

    );

}


function createDailyKey(
    subjectId,
    unitId
) {

    return (
        `${String(subjectId)}|` +
        `${String(unitId)}`
    );

}


function createLearningUrl(
    file,
    subjectId,
    unitId
) {

    const parameters =
        new URLSearchParams({

            subjectId:
                String(subjectId),

            unitId:
                String(unitId)

        });


    return (
        `${file}?${parameters.toString()}`
    );

}


function normalizeProgressType(
    type
) {

    const value =
        String(
            type ||
            ""
        )
        .trim()
        .toLowerCase();


    if (
        [
            "fillblank",
            "fill_blank",
            "fill-blank"
        ].includes(value)
    ) {

        return "fillBlank";

    }


    if (
        [
            "quiz",
            "multiplechoice",
            "multiple_choice"
        ].includes(value)
    ) {

        return "quiz";

    }


    if (
        value === "daily"
    ) {

        return "daily";

    }


    return String(
        type ||
        ""
    ).trim();

}


/* ========================================
   数値・日時
======================================== */

function nonNegativeNumber(
    value
) {

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


function toMilliseconds(
    value
) {

    if (!value) {

        return 0;

    }


    if (
        typeof value.toMillis ===
        "function"
    ) {

        return value.toMillis();

    }


    if (
        typeof value.toDate ===
        "function"
    ) {

        return value
            .toDate()
            .getTime();

    }


    if (
        value instanceof Date
    ) {

        return value.getTime();

    }


    const number =
        Number(value);


    if (
        Number.isFinite(number) &&
        number > 0
    ) {

        return number;

    }


    const date =
        new Date(value);


    return Number.isNaN(
        date.getTime()
    )
        ? 0
        : date.getTime();

}


/* ========================================
   文字列処理
======================================== */

function normalizeSearchText(
    value
) {

    return String(
        value ||
        ""
    )
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "");

}


function escapeHtml(
    value
) {

    return String(
        value ??
        ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}


function escapeAttribute(
    value
) {

    return escapeHtml(
        value
    );

}
