import {
    db,
    studentNumber,
    setupTheme,
    initializePage,
    loadProfileImage,
    setupAdminTab,
    isAdmin,
    showToast,
    updateAssignmentNavBadge,
    updateShareNavBadge,
    updateNewsNavBadge
} from "./common.js";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    writeBatch,
    serverTimestamp,
    query,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/* ========================================
   HTML要素
======================================== */

const elements = {

    theme:
        document.getElementById("themeButton"),

    profile:
        document.getElementById("profileButton"),

    image:
        document.getElementById("topProfileImage"),

    back:
        document.getElementById("backButton"),


    previewBanner:
        document.getElementById("previewBanner"),

    phaseCard:
        document.getElementById("registrationPhaseCard"),

    phaseBadge:
        document.getElementById("registrationPhaseBadge"),

    info:
        document.getElementById("studentCourseInfo"),

    summary:
        document.getElementById("registrationSummary"),

    deadline:
        document.getElementById("registrationDeadline"),

    curriculumName:
        document.getElementById("studentCurriculumName"),

    departmentInfo:
        document.getElementById("studentDepartmentInfo"),

    gradeInfo:
        document.getElementById("studentGradeInfo"),

    lastRegistrationInfo:
        document.getElementById("lastRegistrationInfo"),


    unavailable:
        document.getElementById("registrationUnavailable"),

    unavailableTitle:
        document.getElementById("registrationUnavailableTitle"),

    unavailableMessage:
        document.getElementById("registrationUnavailableMessage"),

    unavailableBack:
        document.getElementById("unavailableBackButton"),


    guide:
        document.getElementById("registrationGuide"),

    mainLayout:
        document.getElementById("registrationMainLayout"),


    warningPanel:
        document.getElementById("courseWarningPanel"),

    warningTitle:
        document.getElementById("courseWarningTitle"),

    warningList:
        document.getElementById("courseWarningList"),


    graduationCard:
        document.getElementById("graduationProgressCard"),

    graduationToggle:
        document.getElementById("toggleGraduationProgressButton"),

    graduationContent:
        document.getElementById("graduationProgressContent"),

    graduationProgressBar:
        document.getElementById("graduationProgressBar"),

    earnedCredits:
        document.getElementById("earnedCredits"),

    earnedCreditsLabel:
        document.getElementById("earnedCreditsLabel"),

    graduationRequiredCredits:
        document.getElementById("requiredGraduationCredits"),

    projectedCredits:
        document.getElementById("projectedCredits"),

    remainingCredits:
        document.getElementById("remainingCredits"),

    categoryProgressList:
        document.getElementById("categoryProgressList"),

    specialRequirementProgressList:
        document.getElementById("specialRequirementProgressList"),


    progressCard:
        document.getElementById("courseProgressCard"),

    progressToggle:
        document.getElementById("toggleProgressEditor"),

    progressSummary:
        document.getElementById("courseProgressSummary"),

    progressEditor:
        document.getElementById("progressEditor"),

    progressYearFields:
        document.getElementById("courseProgressYearFields"),

    progressSave:
        document.getElementById("saveCourseProgress"),


    search:
        document.getElementById("courseSearchInput"),

    requirementFilter:
        document.getElementById("courseRequirementFilter"),

    categoryFilter:
        document.getElementById("courseCategoryFilter"),

    selectionFilter:
        document.getElementById("courseSelectionFilter"),

    resetFilters:
        document.getElementById("resetCourseFiltersButton"),

    visibleCount:
        document.getElementById("visibleCourseCount"),


    selectRequired:
        document.getElementById("selectRequiredCoursesButton"),

    restore:
        document.getElementById("restorePreviousEnrollment"),

    clearOptional:
        document.getElementById("clearOptionalCoursesButton"),


    list:
        document.getElementById("courseList"),


    selectedCount:
        document.getElementById("selectedCourseCount"),

    warningBadge:
        document.getElementById("summaryWarningBadge"),

    currentCredits:
        document.getElementById("currentCredits"),

    semesterCredits:
        document.getElementById("semesterCredits"),

    annualCredits:
        document.getElementById("annualCredits"),

    semesterLimitText:
        document.getElementById("semesterLimitText"),

    annualLimitText:
        document.getElementById("annualLimitText"),

    semesterLimitBar:
        document.getElementById("semesterLimitProgressBar"),

    annualLimitBar:
        document.getElementById("annualLimitProgressBar"),

    earnedCreditsSummary:
        document.getElementById("earnedCreditsSummary"),

    projectedCreditsSummary:
        document.getElementById("projectedCreditsSummary"),

    earnedRequiredCredits:
        document.getElementById("earnedRequiredCredits"),

    earnedElectiveCredits:
        document.getElementById("earnedElectiveCredits"),

    summaryMessage:
        document.getElementById("summaryMessage"),

    save:
        document.getElementById("saveCoursesButton"),


    mobileSaveBar:
        document.getElementById("mobileRegistrationSaveBar"),

    mobileSummaryToggle:
        document.getElementById("toggleMobileSummaryButton"),

    mobileSelectedCount:
        document.getElementById("mobileSelectedCourseCount"),

    mobileSelectedCredits:
        document.getElementById("mobileSelectedCredits"),

    mobileSave:
        document.getElementById("mobileSaveCoursesButton"),

    mobileOverlay:
        document.getElementById("mobileSummaryOverlay"),

    mobilePanel:
        document.getElementById("mobileSummaryPanel"),

    mobilePanelClose:
        document.getElementById("closeMobileSummaryButton"),

    mobilePanelCourseCount:
        document.getElementById("mobilePanelCourseCount"),

    mobilePanelCredits:
        document.getElementById("mobilePanelCredits"),

    mobileSemesterCredits:
        document.getElementById("mobileSemesterCredits"),

    mobileAnnualCredits:
        document.getElementById("mobileAnnualCredits"),

    mobileEarnedCredits:
        document.getElementById("mobileEarnedCredits"),

    mobileRemainingCredits:
        document.getElementById("mobileRemainingCredits"),

    mobileWarning:
        document.getElementById("mobileSummaryWarning"),

    mobilePanelSave:
        document.getElementById("mobilePanelSaveButton"),


    confirmModal:
        document.getElementById("enrollmentConfirmModal"),

    confirmClose:
        document.getElementById("closeConfirmEnrollmentButton"),

    confirmCancel:
        document.getElementById("cancelConfirmEnrollmentButton"),

    confirmCourseCount:
        document.getElementById("confirmCourseCount"),

    confirmCreditCount:
        document.getElementById("confirmCreditCount"),

    confirmSemesterCredits:
        document.getElementById("confirmSemesterCredits"),

    confirmAnnualCredits:
        document.getElementById("confirmAnnualCredits"),

    confirmCourseList:
        document.getElementById("confirmSelectedCourseList"),

    confirmWarningSection:
        document.getElementById("confirmWarningSection"),

    confirmWarningList:
        document.getElementById("confirmWarningList"),

    confirmAgreement:
        document.getElementById("confirmAgreementCheckbox"),

    confirmEnrollment:
        document.getElementById("confirmEnrollmentButton"),


    completeModal:
        document.getElementById("enrollmentCompleteModal"),

    completeMessage:
        document.getElementById("enrollmentCompleteMessage"),

    completeClose:
        document.getElementById("closeEnrollmentCompleteButton"),

    completeHome:
        document.getElementById("goHomeAfterEnrollmentButton")

};


/* ========================================
   URLパラメータ
======================================== */

const pageParameters =
    new URLSearchParams(location.search);

const previewMode =
    pageParameters.get("preview") === "1";

const requestedCurriculumId =
    pageParameters.get("curriculumId") || "";

const openCreditPanel =
    pageParameters.get("creditPanel") === "1";


/* ========================================
   状態
======================================== */

let config = null;

let userData = {};

let department =
    localStorage.getItem("department") || "";

let major =
    localStorage.getItem("major") || "";

let grade =
    normalizeGrade(
        localStorage.getItem("grade") || ""
    );

let admissionYear = 0;

let curricula = [];

let currentCurriculum = null;

let subjects = [];

let visibleSubjects = [];

let enrolledDocs =
    new Map();

let retakeSubjectIds =
    new Set();

let originalSelectedIds =
    new Set();

let selectedIds =
    new Set();

let earnedSubjectIds =
    new Set();

let earnedSubjectKeys =
    new Set();

let progress = createEmptyProgress();

let progressSource =
    "manual";

let pageDirty =
    false;

let savingEnrollment =
    false;

let lastRegistrationAt =
    null;

let currentWarnings = [];

let registrationAvailable =
    true;


/* ========================================
   初期化
======================================== */

setupTheme(
    elements.theme
);

setupEvents();


if (previewMode) {

    const admin =
        await isAdmin();

    if (!admin) {

        alert(
            "管理者プレビューは管理者のみ利用できます。"
        );

        location.href =
            "course_registration.html";

        throw new Error(
            "管理者権限がありません。"
        );

    }

}


await initializePage([

    setupAdminTab(),

    loadProfileImage(
        elements.image
    ),

    updateAssignmentNavBadge(),

    updateShareNavBadge(),

    updateNewsNavBadge(),

    loadRegistrationData()

]);


/* ========================================
   イベント
======================================== */

function setupEvents() {

    elements.back?.addEventListener(
        "click",
        () => navigateWithUnsavedCheck(
            history.length > 1
                ? null
                : "index.html"
        )
    );


    elements.profile?.addEventListener(
        "click",
        () => navigateWithUnsavedCheck(
            "profile.html"
        )
    );


    elements.unavailableBack?.addEventListener(
        "click",
        () => {
            location.href = "index.html";
        }
    );


    elements.graduationToggle?.addEventListener(
        "click",
        toggleGraduationProgress
    );


    elements.progressToggle?.addEventListener(
        "click",
        toggleProgressEditor
    );


    elements.progressSave?.addEventListener(
        "click",
        saveCourseProgress
    );


    elements.search?.addEventListener(
        "input",
        renderSubjects
    );


    elements.requirementFilter?.addEventListener(
        "change",
        renderSubjects
    );


    elements.categoryFilter?.addEventListener(
        "change",
        renderSubjects
    );


    elements.selectionFilter?.addEventListener(
        "change",
        renderSubjects
    );


    elements.resetFilters?.addEventListener(
        "click",
        resetFilters
    );


    elements.list?.addEventListener(
        "change",
        handleSubjectSelection
    );


    elements.selectRequired?.addEventListener(
        "click",
        selectAllRequiredSubjects
    );


    elements.clearOptional?.addEventListener(
        "click",
        clearAllOptionalSubjects
    );


    elements.restore?.addEventListener(
        "click",
        restorePreviousEnrollment
    );


    [
        elements.save,
        elements.mobileSave,
        elements.mobilePanelSave
    ]
    .filter(Boolean)
    .forEach(button => {

        button.addEventListener(
            "click",
            openEnrollmentConfirmation
        );

    });


    elements.mobileSummaryToggle?.addEventListener(
        "click",
        openMobileSummary
    );


    elements.mobilePanelClose?.addEventListener(
        "click",
        closeMobileSummary
    );


    elements.mobileOverlay?.addEventListener(
        "click",
        closeMobileSummary
    );


    elements.confirmClose?.addEventListener(
        "click",
        closeEnrollmentConfirmation
    );


    elements.confirmCancel?.addEventListener(
        "click",
        closeEnrollmentConfirmation
    );


    elements.confirmModal?.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                elements.confirmModal
            ) {

                closeEnrollmentConfirmation();

            }

        }
    );


    elements.confirmAgreement?.addEventListener(
        "change",
        updateConfirmButton
    );


    elements.confirmEnrollment?.addEventListener(
        "click",
        saveEnrollment
    );


    elements.completeClose?.addEventListener(
        "click",
        closeCompleteModal
    );


    elements.completeHome?.addEventListener(
        "click",
        () => {
            location.href = "index.html";
        }
    );


    document.addEventListener(
        "keydown",
        event => {

            if (event.key !== "Escape") {
                return;
            }

            closeMobileSummary();
            closeEnrollmentConfirmation();

        }
    );


    window.addEventListener(
        "beforeunload",
        event => {

            if (!pageDirty) {
                return;
            }

            event.preventDefault();

            event.returnValue = "";

        }
    );

}


/* ========================================
   データ読込
======================================== */

async function loadRegistrationData() {

    if (!studentNumber) {

        location.href =
            "login.html";

        return;

    }


    try {

        const configReference =
            doc(
                db,
                "system",
                previewMode
                    ? "courseRegistrationDraft"
                    : "courseRegistration"
            );


        const [
            configSnapshot,
            userSnapshot,
            subjectSnapshot,
            enrollmentSnapshot,
            curriculumSnapshot,
            creditRecordSnapshot,
            topLevelCreditSnapshot
        ] = await Promise.all([

            getDoc(
                configReference
            ),

            getDoc(
                doc(
                    db,
                    "users",
                    studentNumber
                )
            ),

            getDocs(
                collection(
                    db,
                    "subjects"
                )
            ),

            getDocs(
                collection(
                    db,
                    "users",
                    studentNumber,
                    "enrolledSubjects"
                )
            ),

            getDocs(
                collection(
                    db,
                    "curricula"
                )
            ),

            safeGetDocs(
                collection(
                    db,
                    "users",
                    studentNumber,
                    "creditRecords"
                )
            ),

            safeGetDoc(
                doc(
                    db,
                    "creditRecords",
                    studentNumber
                )
            )

        ]);


        if (!configSnapshot.exists()) {

            renderUnavailable(
                "履修登録はまだ公開されていません。",
                "履修登録期間外です"
            );

            return;

        }


        if (!userSnapshot.exists()) {

            renderUnavailable(
                "学生情報を取得できませんでした。",
                "学生情報がありません"
            );

            return;

        }


        config =
            normalizeConfig(
                configSnapshot.data()
            );


        userData =
            userSnapshot.data() || {};


        if (
            !previewMode &&
            userData.manabaVerified !== true
        ) {

            renderUnavailable(
                "履修登録はManabaログイン確認が完了している学生のみ利用できます。",
                "Manabaログイン確認が必要です"
            );

            return;

        }


        normalizeStudentInformation();


        curricula =
            curriculumSnapshot.docs
                .map(curriculumDocument =>
                    normalizeCurriculum(
                        curriculumDocument.id,
                        curriculumDocument.data(),
                        previewMode
                    )
                )
                .sort(
                    compareCurricula
                );


        currentCurriculum =
            findStudentCurriculum();


        if (!currentCurriculum) {

            renderUnavailable(
                "学科・専攻・入学年度に対応するカリキュラムが公開されていません。管理者へ確認してください。",
                "対象カリキュラムがありません"
            );

            return;

        }


        subjects =
            subjectSnapshot.docs
                .map(subjectDocument =>
                    normalizeSubject(
                        subjectDocument.id,
                        subjectDocument.data()
                    )
                )
                .filter(
                    subject =>
                        subject.active
                )
                .sort(
                    compareSubjects
                );


        enrolledDocs =
            new Map(
                enrollmentSnapshot.docs.map(
                    enrollmentDocument => [

                        enrollmentDocument.id,

                        {
                            id:
                                enrollmentDocument.id,

                            ...enrollmentDocument.data()
                        }

                    ]
                )
            );

        retakeSubjectIds =
            new Set(
                [...enrolledDocs.values()]
                    .filter(
                        enrollment =>
                            enrollment.isRetake === true &&
                            enrollment.creditStatus === "not_earned"
                    )
                    .filter(
                        enrollment => {

                            const sourceYear =
                                Number(
                                    enrollment.retakeSourceAcademicYear ||
                                    enrollment.creditConfirmedAcademicYear ||
                                    enrollment.academicYear ||
                                    0
                                );

                            return (
                                sourceYear > 0 &&
                                Number(config.academicYear) >
                                sourceYear
                            );

                        }
                    )
                    .map(
                        enrollment =>
                            String(
                                enrollment.subjectId ||
                                enrollment.id ||
                                ""
                            )
                    )
                    .filter(Boolean)
            );

        const creditRecords =
            mergeCreditRecords(
                creditRecordSnapshot,
                topLevelCreditSnapshot
            );


        const earnedEnrollmentRecords =
            [...enrolledDocs.values()]
                .filter(
                    enrollment =>
                        enrollment.creditStatus ===
                        "earned"
                )
                .map(
                    enrollment => ({

                        subjectId:
                            String(
                                enrollment.subjectId ||
                                enrollment.id ||
                                ""
                            ),

                        subjectKey:
                            String(
                                enrollment.subjectKey ||
                                enrollment.name ||
                                enrollment.subject ||
                                ""
                            ),

                        name:
                            String(
                                enrollment.name ||
                                enrollment.subject ||
                                enrollment.subjectKey ||
                                ""
                            ),

                        credits:
                            toNonNegativeNumber(
                                enrollment.credits
                            ),

                        requirementType:
                            enrollment.requirementType ||
                            (
                                enrollment.required === true
                                    ? "required"
                                    : "elective"
                            ),

                        required:
                            enrollment.required === true,

                        category:
                            enrollment.category || "",

                        requirementTags:
                            Array.isArray(
                                enrollment.requirementTags
                            )
                                ? enrollment.requirementTags
                                : [],

                        academicYear:
                            Number(
                                enrollment.creditConfirmedAcademicYear ||
                                enrollment.academicYear ||
                                0
                            ),

                        semester:
                            enrollment.creditConfirmedSemester ||
                            enrollment.semester ||
                            "",

                        status:
                            "earned"

                    }))
                .filter(
                    record =>
                        record.subjectId ||
                        record.subjectKey
                );


        const combinedCreditRecordMap =
            new Map();


        [
            ...creditRecords,
            ...earnedEnrollmentRecords
        ]
        .forEach(
            record => {

                const key =
                    String(
                        record.subjectId ||
                        record.subjectKey ||
                        record.id ||
                        ""
                    );


                if (!key) {
                    return;
                }


                combinedCreditRecordMap.set(
                    key,
                    record
                );

            }
        );


        const combinedCreditRecords =
            [...combinedCreditRecordMap.values()];


        progress =
            buildProgress(
                userData.courseProgress || {},
                combinedCreditRecords
            );

        const regularSubjects =
            subjects.filter(
                subject =>
                    matchesCurriculum(subject) &&
                    matchesStudentGrade(subject) &&
                    matchesSemester(subject)
            );


        const retakeSubjects =
            subjects.filter(
                subject =>
                    matchesCurriculum(subject) &&
                    matchesSemester(subject) &&
                    isRetakeSubject(subject)
            );


        visibleSubjects =
            [
                ...new Map(
                    [
                        ...retakeSubjects,
                        ...regularSubjects
                    ]
                    .filter(
                        subject =>
                            !isAlreadyEarned(
                                subject
                            ) ||
                            isRetakeSubject(
                                subject
                            )
                    )
                    .map(
                        subject => [
                            subject.id,
                            subject
                        ]
                    )
                ).values()
            ];


        originalSelectedIds =
            new Set(
                [...enrolledDocs.values()]
                    .filter(
                        enrollment =>
                            isCurrentRegistration(
                                enrollment
                            )
                    )
                    .map(
                        enrollment =>
                            enrollment.id ||
                            enrollment.subjectId
                    )
                    .filter(Boolean)
            );


        selectedIds =
            new Set(
                [...originalSelectedIds]
                    .filter(id =>
                        visibleSubjects.some(
                            subject =>
                                subject.id === id &&
                                !isAlreadyEarned(subject)
                        )
                    )
            );


        lastRegistrationAt =
            [...enrolledDocs.values()]
                .map(
                    enrollment =>
                        toDate(
                            enrollment.updatedAt
                        )
                )
                .filter(Boolean)
                .sort(
                    (dateA, dateB) =>
                        dateB - dateA
                )[0] || null;


        renderPage();

    } catch (error) {

        console.error(
            "履修登録データ取得エラー:",
            error
        );


        renderUnavailable(
            "履修登録情報を読み込めませんでした。通信状態を確認して、もう一度開いてください。",
            "読み込みに失敗しました"
        );

    }

}


/* ========================================
   初期画面表示
======================================== */

function renderPage() {

    registrationAvailable =
        true;


    elements.unavailable.hidden =
        true;

    elements.guide.hidden =
        false;

    elements.mainLayout.hidden =
        false;

    elements.mobileSaveBar.hidden =
        false;


    if (previewMode) {

        elements.previewBanner.hidden =
            false;

    }


    renderPhase();

    renderProgress();

    updateCategoryFilter();

    renderSubjects();

    updateAllDisplays();


    if (openCreditPanel) {

        elements.graduationContent.hidden =
            false;

        elements.graduationToggle.textContent =
            "詳細を閉じる";


        setTimeout(
            () => {

                elements.graduationCard
                    ?.scrollIntoView({
                        behavior:
                            "smooth",

                        block:
                            "start"
                    });

            },
            250
        );

    }

}


/* ========================================
   設定正規化
======================================== */

function normalizeConfig(
    data
) {

    return {

        academicYear:
            toNonNegativeNumber(
                data.academicYear
            ),

        semester:
            normalizeSemester(
                data.semester
            ) || "前期",

        phase:
            String(
                data.phase ||
                "hidden"
            ),

        correctionMode:
            String(
                data.correctionMode ||
                "delete_only"
            ),

        startAt:
            String(
                data.startAt ||
                ""
            ),

        endAt:
            String(
                data.endAt ||
                ""
            ),

        published:
            data.published === true,

        pageEnabled:
            data.pageEnabled === true,

        semesterCreditLimit:
            toNonNegativeNumber(
                data.semesterCreditLimit
            ),

        annualCreditLimit:
            toNonNegativeNumber(
                data.annualCreditLimit
            )

    };

}


/* ========================================
   学生情報
======================================== */

function normalizeStudentInformation() {

    department =
        String(
            userData.department ||
            department ||
            ""
        ).trim();


    major =
        String(
            userData.major ||
            major ||
            ""
        ).trim();


    grade =
        normalizeGrade(
            userData.grade ||
            grade ||
            ""
        );


    if (
        department ===
        "理学療法学専攻"
    ) {

        department =
            "リハビリテーション学科";

        major =
            "理学療法学専攻";

    }


    if (
        department ===
        "作業療法学専攻"
    ) {

        department =
            "リハビリテーション学科";

        major =
            "作業療法学専攻";

    }


    admissionYear =
        toNonNegativeNumber(

            userData.admissionYear ||

            userData.enrollmentYear ||

            userData.entranceYear

        );


    if (
        !admissionYear &&
        config?.academicYear &&
        Number(grade) > 0
    ) {

        admissionYear =
            Number(config.academicYear) -
            Number(grade) +
            1;

    }

}


/* ========================================
   カリキュラム
======================================== */

function normalizeCurriculum(
    id,
    data,
    useDraft
) {

    const draft =
        useDraft &&
        data?.draft &&
        typeof data.draft === "object" &&
        !Array.isArray(data.draft)
            ? data.draft
            : null;


    const source =
        draft
            ? {
                ...data,
                ...draft
            }
            : data;


    return {

        curriculumId:
            id,

        name:
            String(
                source.name ||
                id
            ).trim(),

        department:
            String(
                source.department ||
                ""
            ).trim(),

        major:
            String(
                source.major ||
                ""
            ).trim(),

        admissionYearFrom:
            toNonNegativeNumber(
                source.admissionYearFrom
            ),

        admissionYearTo:
            source.admissionYearTo
                ? toNonNegativeNumber(
                    source.admissionYearTo
                )
                : null,

        graduationCredits:
            toNonNegativeNumber(
                source.graduationCredits
            ),

        requiredCredits:
            toNonNegativeNumber(
                source.requiredCredits
            ),

        electiveCreditsMinimum:
            toNonNegativeNumber(
                source.electiveCreditsMinimum
            ),

        categoryRequirements:
            Array.isArray(
                source.categoryRequirements
            )
                ? source.categoryRequirements.map(
                    normalizeCategoryRequirement
                )
                : [],

        specialRequirements:
            Array.isArray(
                source.specialRequirements
            )
                ? source.specialRequirements.map(
                    normalizeSpecialRequirement
                )
                : [],

        published:
            data.published === true,

        usingDraft:
            draft !== null

    };

}


function normalizeCategoryRequirement(
    requirement
) {

    return {

        category:
            String(
                requirement.category ||
                ""
            ).trim(),

        requiredCredits:
            toNonNegativeNumber(
                requirement.requiredCredits
            ),

        electiveCreditsMinimum:
            toNonNegativeNumber(
                requirement.electiveCreditsMinimum
            ),

        totalCreditsMinimum:
            toNonNegativeNumber(
                requirement.totalCreditsMinimum
            )

    };

}


function normalizeSpecialRequirement(
    requirement
) {

    return {

        requirementTag:
            String(
                requirement.requirementTag ||
                ""
            ).trim(),

        minimumCredits:
            toNonNegativeNumber(
                requirement.minimumCredits
            )

    };

}


function findStudentCurriculum() {

    if (
        previewMode &&
        requestedCurriculumId
    ) {

        return curricula.find(
            curriculum =>
                curriculum.curriculumId ===
                requestedCurriculumId
        ) || null;

    }


    const storedCurriculumId =
        String(
            userData.curriculumId ||
            ""
        ).trim();


    if (storedCurriculumId) {

        const exactCurriculum =
            curricula.find(
                curriculum =>
                    curriculum.curriculumId ===
                        storedCurriculumId &&
                    curriculum.published
            );


        if (exactCurriculum) {

            return exactCurriculum;

        }

    }


    return curricula
        .filter(
            curriculum => {

                if (!curriculum.published) {
                    return false;
                }


                if (
                    curriculum.department !==
                    department
                ) {

                    return false;

                }


                if (
                    curriculum.major !==
                    major
                ) {

                    return false;

                }


                if (
                    admissionYear &&
                    curriculum.admissionYearFrom &&
                    admissionYear <
                        curriculum.admissionYearFrom
                ) {

                    return false;

                }


                if (
                    admissionYear &&
                    curriculum.admissionYearTo &&
                    admissionYear >
                        curriculum.admissionYearTo
                ) {

                    return false;

                }


                return true;

            }
        )
        .sort(
            (
                curriculumA,
                curriculumB
            ) =>
                curriculumB.admissionYearFrom -
                curriculumA.admissionYearFrom
        )[0] || null;

}


/* ========================================
   科目正規化
======================================== */

function normalizeSubject(
    id,
    data
) {

    let departmentValue =
        String(
            data.department ||
            ""
        ).trim();


    let majorValue =
        String(
            data.major ||
            ""
        ).trim();


    if (
        departmentValue ===
        "理学療法学専攻"
    ) {

        departmentValue =
            "リハビリテーション学科";

        majorValue =
            "理学療法学専攻";

    }


    if (
        departmentValue ===
        "作業療法学専攻"
    ) {

        departmentValue =
            "リハビリテーション学科";

        majorValue =
            "作業療法学専攻";

    }


    let requirementType =
        String(
            data.requirementType ||
            ""
        ).trim();


    if (!requirementType) {

        requirementType =
            data.required === true
                ? "required"
                : "elective";

    }


    const curriculumIds =
        normalizeStringArray(
            data.curriculumIds
        );


    if (
        data.curriculumId &&
        !curriculumIds.includes(
            String(data.curriculumId)
        )
    ) {

        curriculumIds.push(
            String(data.curriculumId)
        );

    }


    return {

        id,

        name:
            String(
                data.name ||
                data.subjectKey ||
                id
            ).trim(),

        subjectKey:
            String(
                data.subjectKey ||
                data.name ||
                id
            ).trim(),

        department:
            departmentValue,

        major:
            majorValue,

        curriculumIds,

        grade:
            normalizeGrade(
                data.grade
            ),

        semester:
            normalizeSemester(
                data.semester
            ),

        requirementType,

        category:
            String(
                data.category ||
                data.subjectCategory ||
                ""
            ).trim(),

        subcategory:
            String(
                data.subcategory ||
                data.subCategory ||
                ""
            ).trim(),

        requirementTags:
            Array.isArray(
                data.requirementTags
            )
                ? normalizeStringArray(
                    data.requirementTags
                )
                : splitTags(
                    data.requirementTags ||
                    data.requirementTag ||
                    ""
                ),

        credits:
            toNonNegativeNumber(
                data.credits
            ),

        lectureCount:
            toNonNegativeNumber(
                data.lectureCount
            ),

        isPractical:
            data.isPractical === true,

        active:
            data.active !== false,

        attendanceNotificationDefaultEnabled:
            data
                .attendanceNotificationDefaultEnabled
                !== false,

        attendanceReminderMinutes:
            toNonNegativeNumber(
                data.attendanceReminderMinutes ??
                10
            )

    };

}


/* ========================================
   科目対象判定
======================================== */

function matchesCurriculum(
    subject
) {

    if (
        subject.curriculumIds.length > 0
    ) {

        return subject.curriculumIds.includes(
            currentCurriculum.curriculumId
        );

    }


    if (
        subject.department !==
        currentCurriculum.department
    ) {

        return false;

    }


    if (currentCurriculum.major) {

        return (
            subject.major ===
            currentCurriculum.major
        );

    }


    return !subject.major;

}


function matchesStudentGrade(
    subject
) {

    return (
        subject.grade === grade
    );

}


function matchesSemester(
    subject
) {

    return (

        subject.semester ===
            config.semester ||

        subject.semester ===
            "通期"

    );

}

// ========================================
// ④ matchesSemester() の下に追加
// ========================================

function getRetakeEnrollment(
    subject
) {

    const direct =
        enrolledDocs.get(
            subject.id
        );


    if (
        direct &&
        direct.isRetake === true &&
        direct.creditStatus === "not_earned"
    ) {

        return direct;

    }


    return (
        [...enrolledDocs.values()]
            .find(
                enrollment => {

                    if (
                        enrollment.isRetake !== true ||
                        enrollment.creditStatus !==
                            "not_earned"
                    ) {

                        return false;

                    }


                    const enrollmentKey =
                        String(
                            enrollment.subjectKey ||
                            enrollment.name ||
                            ""
                        ).trim();


                    return (
                        enrollmentKey &&
                        enrollmentKey ===
                            subject.subjectKey
                    );

                }
            ) ||
        null
    );

}


function isRetakeSubject(
    subject
) {

    const enrollment =
        getRetakeEnrollment(
            subject
        );


    if (!enrollment) {
        return false;
    }


    const sourceYear =
        Number(
            enrollment.retakeSourceAcademicYear ||
            enrollment.creditConfirmedAcademicYear ||
            enrollment.academicYear ||
            0
        );


    if (
        !sourceYear ||
        Number(config.academicYear) <=
        sourceYear
    ) {

        return false;

    }


    return matchesSemester(
        subject
    );

}


/* ========================================
   取得単位
======================================== */

function createEmptyProgress() {

    return {

        locked:
            false,

        years:
            {},

        earnedCredits:
            0,

        earnedRequiredCredits:
            0,

        earnedElectiveCredits:
            0,

        categoryCredits:
            {},

        categoryRequiredCredits:
            {},

        categoryElectiveCredits:
            {},

        requirementTagCredits:
            {}

    };

}


function mergeCreditRecords(
    subcollectionSnapshot,
    topLevelSnapshot
) {

    const records =
        [];


    if (subcollectionSnapshot) {

        subcollectionSnapshot.docs.forEach(
            recordDocument => {

                records.push({

                    id:
                        recordDocument.id,

                    ...recordDocument.data()

                });

            }
        );

    }


    if (
        topLevelSnapshot?.exists()
    ) {

        const topLevelData =
            topLevelSnapshot.data() || {};


        if (
            Array.isArray(
                topLevelData.records
            )
        ) {

            topLevelData.records.forEach(
                (
                    record,
                    index
                ) => {

                    records.push({

                        id:
                            record.id ||
                            `record_${index}`,

                        ...record

                    });

                }
            );

        }

    }


    const recordMap =
        new Map();


    records.forEach(
        record => {

            const status =
                String(
                    record.status ||
                    ""
                ).toLowerCase();


            if (
                [
                    "failed",
                    "不合格",
                    "不可",
                    "未修得"
                ].includes(status)
            ) {

                return;

            }


            const credits =
                toNonNegativeNumber(
                    record.credits
                );


            if (credits <= 0) {
                return;
            }


            const key =
                String(

                    record.subjectId ||

                    record.subjectKey ||

                    record.id

                );


            recordMap.set(
                key,
                record
            );

        }
    );


    return [...recordMap.values()];

}


function buildProgress(
    storedProgress,
    creditRecords
) {

    earnedSubjectIds =
        new Set();

    earnedSubjectKeys =
        new Set();


    if (
        creditRecords.length === 0
    ) {

        progressSource =
            "manual";


        return {

            ...createEmptyProgress(),

            ...storedProgress,

            years:
                storedProgress.years || {},

            categoryCredits:
                storedProgress.categoryCredits || {},

            categoryRequiredCredits:
                storedProgress.categoryRequiredCredits || {},

            categoryElectiveCredits:
                storedProgress.categoryElectiveCredits || {},

            requirementTagCredits:
                storedProgress.requirementTagCredits || {}

        };

    }


    progressSource =
        "records";


    const calculatedProgress =
        createEmptyProgress();


    calculatedProgress.locked =
        true;


    creditRecords.forEach(
        record => {

            const credits =
                toNonNegativeNumber(
                    record.credits
                );


            const requirementType =
                String(
                    record.requirementType ||
                    (
                        record.required === true
                            ? "required"
                            : "elective"
                    )
                );


            const category =
                String(
                    record.category ||
                    ""
                ).trim();


            const requirementTags =
                Array.isArray(
                    record.requirementTags
                )
                    ? normalizeStringArray(
                        record.requirementTags
                    )
                    : splitTags(
                        record.requirementTags ||
                        record.requirementTag ||
                        ""
                    );


            calculatedProgress.earnedCredits +=
                credits;


            if (
                requirementType ===
                "required"
            ) {

                calculatedProgress
                    .earnedRequiredCredits +=
                    credits;

            } else if (
                requirementType ===
                "elective"
            ) {

                calculatedProgress
                    .earnedElectiveCredits +=
                    credits;

            }


            if (category) {

                addObjectNumber(
                    calculatedProgress.categoryCredits,
                    category,
                    credits
                );


                if (
                    requirementType ===
                    "required"
                ) {

                    addObjectNumber(
                        calculatedProgress
                            .categoryRequiredCredits,
                        category,
                        credits
                    );

                }


                if (
                    requirementType ===
                    "elective"
                ) {

                    addObjectNumber(
                        calculatedProgress
                            .categoryElectiveCredits,
                        category,
                        credits
                    );

                }

            }


            requirementTags.forEach(
                tag => {

                    addObjectNumber(
                        calculatedProgress
                            .requirementTagCredits,
                        tag,
                        credits
                    );

                }
            );


            if (record.subjectId) {

                earnedSubjectIds.add(
                    String(record.subjectId)
                );

            }


            if (record.subjectKey) {

                earnedSubjectKeys.add(
                    String(record.subjectKey)
                );

            }

        }
    );


    return calculatedProgress;

}


/* ========================================
   公開期間
======================================== */

function getEffectivePhase() {

    if (previewMode) {

        return config.phase ||
            "view_only";

    }


    if (
        config.published !== true ||
        config.pageEnabled !== true
    ) {

        return "hidden";

    }


    const now =
        Date.now();


    const startTime =
        config.startAt
            ? new Date(
                config.startAt
            ).getTime()
            : 0;


    const endTime =
        config.endAt
            ? new Date(
                config.endAt
            ).getTime()
            : Number.POSITIVE_INFINITY;


    if (
        now < startTime ||
        now > endTime
    ) {

        return "view_only";

    }


    return config.phase ||
        "view_only";

}


function phaseLabel(
    phase
) {

    return {

        registration:
            "履修登録期間",

        correction:
            "履修修正期間",

        cancellation:
            "履修取消期間",

        view_only:
            "閲覧期間",

        hidden:
            "非公開"

    }[phase] || "閲覧期間";

}


function renderPhase() {

    const phase =
        getEffectivePhase();


    if (
        phase === "hidden" &&
        !previewMode
    ) {

        renderUnavailable(
            "現在、履修登録画面は公開されていません。",
            "履修登録期間外です"
        );

        return;

    }


    elements.phaseBadge.textContent =
        phaseLabel(phase);


    elements.phaseBadge.className =
        `course-phase-badge is-${phase}`;


    elements.info.textContent =
        `${config.academicYear}年度 ${config.semester}`;


    const summaryParts = [

        phaseLabel(phase),

        previewMode
            ? "管理者プレビュー"
            : null,

        currentCurriculum.usingDraft
            ? "編集中の下書きを表示"
            : null

    ].filter(Boolean);


    elements.summary.textContent =
        summaryParts.join("｜");


    elements.deadline.textContent =
        config.endAt
            ? formatDateTime(
                config.endAt
            )
            : "期限なし";


    elements.curriculumName.textContent =
        currentCurriculum.name;


    elements.departmentInfo.textContent =
        major
            ? `${department} ${major}`
            : department || "未設定";


    elements.gradeInfo.textContent =
        grade
            ? `${grade}年`
            : "未設定";


    elements.lastRegistrationInfo.textContent =
        lastRegistrationAt
            ? formatDateTime(
                lastRegistrationAt
            )
            : "未登録";

}


/* ========================================
   利用不可
======================================== */

function renderUnavailable(
    message,
    title = "履修登録を利用できません"
) {

    registrationAvailable =
        false;


    elements.unavailable.hidden =
        false;

    elements.unavailableTitle.textContent =
        title;

    elements.unavailableMessage.textContent =
        message;


    elements.guide.hidden =
        true;

    elements.mainLayout.hidden =
        true;

    elements.mobileSaveBar.hidden =
        true;


    elements.summary.textContent =
        message;


    closeMobileSummary();
    closeEnrollmentConfirmation();

}


/* ========================================
   取得単位表示
======================================== */

function renderProgress() {

    const currentGrade =
        Math.max(
            1,
            Math.min(
                4,
                Number(grade) || 1
            )
        );


    if (
        currentGrade === 1 &&
        progress.earnedCredits <= 0
    ) {

        elements.progressCard.hidden =
            true;

        return;

    }


    elements.progressCard.hidden =
        false;


    if (
        progressSource === "records"
    ) {

        elements.progressToggle.hidden =
            true;

        elements.progressEditor.hidden =
            true;


        elements.progressSummary.innerHTML = `

            <div class="course-progress-official-summary">

                <span>
                    ✅
                </span>

                <div>

                    <b>
                        取得済み単位を確認しました
                    </b>

                    <strong>
                        ${formatCredit(
                            progress.earnedCredits
                        )}単位
                    </strong>

                    <small>
                        必修
                        ${formatCredit(
                            progress.earnedRequiredCredits
                        )}単位・
                        選択
                        ${formatCredit(
                            progress.earnedElectiveCredits
                        )}単位
                    </small>

                </div>

            </div>

        `;

        return;

    }


    const yearRows =
        Array.from(
            {
                length:
                    Math.max(
                        0,
                        currentGrade - 1
                    )
            },
            (
                _,
                index
            ) =>
                index + 1
        );


    if (
        progress.locked === true
    ) {

        elements.progressToggle.hidden =
            true;

        elements.progressEditor.hidden =
            true;

        elements.progressSummary.hidden =
            false;


        elements.progressSummary.innerHTML =
            yearRows.map(
                year => {

                    const yearProgress =
                        progress.years?.[
                            String(year)
                        ] || {};


                    return `

                        <div class="course-progress-year-summary">

                            <b>
                                ${year}年次
                            </b>

                            <span>
                                ${formatCredit(
                                    yearProgress.total
                                )}単位
                            </span>

                            <small>

                                必修
                                ${formatCredit(
                                    yearProgress.required
                                )}・

                                選択
                                ${formatCredit(
                                    yearProgress.elective
                                )}

                            </small>

                        </div>

                    `;

                }
            )
            .join("");


        return;

    }


    elements.progressToggle.hidden =
        false;

    elements.progressSummary.hidden =
        true;


    elements.progressYearFields.innerHTML =
        yearRows.map(
            year => {

                const yearProgress =
                    progress.years?.[
                        String(year)
                    ] || {};


                return `

                    <fieldset
                        class="course-progress-year"
                        data-year="${year}">

                        <legend>
                            ${year}年次の取得単位
                        </legend>


                        <label>

                            <span>
                                合計
                            </span>

                            <input
                                data-credit="total"
                                type="number"
                                min="0"
                                step="0.5"
                                value="${formatCredit(
                                    yearProgress.total
                                )}">

                        </label>


                        <label>

                            <span>
                                必修
                            </span>

                            <input
                                data-credit="required"
                                type="number"
                                min="0"
                                step="0.5"
                                value="${formatCredit(
                                    yearProgress.required
                                )}">

                        </label>


                        <label>

                            <span>
                                選択
                            </span>

                            <input
                                data-credit="elective"
                                type="number"
                                min="0"
                                step="0.5"
                                value="${formatCredit(
                                    yearProgress.elective
                                )}">

                        </label>

                    </fieldset>

                `;

            }
        )
        .join("");

}


/* ========================================
   取得単位登録
======================================== */

function toggleProgressEditor() {

    elements.progressEditor.hidden =
        !elements.progressEditor.hidden;


    elements.progressToggle.textContent =
        elements.progressEditor.hidden
            ? "初回登録"
            : "入力欄を閉じる";

}


async function saveCourseProgress() {

    if (
        progress.locked === true ||
        progressSource === "records"
    ) {

        return;

    }


    const rows =
        elements.progressYearFields
            .querySelectorAll(
                "[data-year]"
            );


    const years = {};


    for (const row of rows) {

        const year =
            row.dataset.year;


        const readValue =
            field =>
                toNonNegativeNumber(
                    row.querySelector(
                        `[data-credit="${field}"]`
                    )?.value
                );


        years[year] = {

            total:
                readValue("total"),

            required:
                readValue("required"),

            elective:
                readValue("elective")

        };


        if (
            years[year].required +
            years[year].elective >
            years[year].total
        ) {

            alert(
                `${year}年次の必修と選択の合計が、取得単位合計を超えています。`
            );

            return;

        }

    }


    const confirmed =
        confirm(
            "取得単位は一度だけ登録できます。\n\n" +
            "保存後は学生側から変更できません。\n" +
            "内容に間違いがないか確認してください。"
        );


    if (!confirmed) {
        return;
    }


    const latestUserSnapshot =
        await getDoc(
            doc(
                db,
                "users",
                studentNumber
            )
        );


    if (
        latestUserSnapshot
            .data()
            ?.courseProgress
            ?.locked === true
    ) {

        progress =
            latestUserSnapshot
                .data()
                .courseProgress;


        renderProgress();

        updateAllDisplays();


        alert(
            "取得単位はすでに登録済みです。"
        );

        return;

    }


    const nextProgress = {

        years,

        locked:
            true,

        earnedCredits:
            sumObjectValues(
                years,
                "total"
            ),

        earnedRequiredCredits:
            sumObjectValues(
                years,
                "required"
            ),

        earnedElectiveCredits:
            sumObjectValues(
                years,
                "elective"
            ),

        categoryCredits:
            {},

        categoryRequiredCredits:
            {},

        categoryElectiveCredits:
            {},

        requirementTagCredits:
            {},

        registeredAt:
            new Date()
                .toISOString(),

        updatedAt:
            new Date()
                .toISOString()

    };


    try {

        elements.progressSave.disabled =
            true;

        elements.progressSave.textContent =
            "保存中...";


        await setDoc(
            doc(
                db,
                "users",
                studentNumber
            ),
            {
                courseProgress:
                    nextProgress
            },
            {
                merge:
                    true
            }
        );


        progress =
            nextProgress;


        renderProgress();

        updateAllDisplays();


        showToast(
            "取得単位を保存しました"
        );

    } catch (error) {

        console.error(
            "取得単位保存エラー:",
            error
        );


        alert(
            "取得単位を保存できませんでした。"
        );

    } finally {

        elements.progressSave.disabled =
            false;

        elements.progressSave.textContent =
            "この内容で取得単位を登録";

    }

}


/* ========================================
   科目区分フィルター
======================================== */

function updateCategoryFilter() {

    const currentValue =
        elements.categoryFilter.value;


    const categories =
        new Set();


    currentCurriculum
        .categoryRequirements
        .forEach(
            requirement => {

                if (requirement.category) {

                    categories.add(
                        requirement.category
                    );

                }

            }
        );


    visibleSubjects.forEach(
        subject => {

            if (subject.category) {

                categories.add(
                    subject.category
                );

            }

        }
    );


    elements.categoryFilter.innerHTML = `

        <option value="">
            すべて
        </option>

        ${
            [...categories]
                .sort(
                    (
                        categoryA,
                        categoryB
                    ) =>
                        categoryA.localeCompare(
                            categoryB,
                            "ja"
                        )
                )
                .map(
                    category => `

                        <option
                            value="${escapeAttribute(
                                category
                            )}">

                            ${escapeHtml(
                                category
                            )}

                        </option>

                    `
                )
                .join("")
        }

    `;


    const exists =
        Array.from(
            elements.categoryFilter.options
        )
        .some(
            option =>
                option.value ===
                currentValue
        );


    if (exists) {

        elements.categoryFilter.value =
            currentValue;

    }

}


/* ========================================
   科目一覧表示
======================================== */

function renderSubjects() {

    if (!registrationAvailable) {
        return;
    }


    const filteredSubjects =
        getFilteredSubjects();


    elements.visibleCount.textContent =
        `${filteredSubjects.length}科目`;


    if (
        visibleSubjects.length === 0
    ) {

        elements.list.innerHTML = `

            <div class="course-registration-empty">

                <div>
                    📚
                </div>

                <h2>
                    対象科目がありません
                </h2>

                <p>

                    ${escapeHtml(
                        department
                    )}

                    ${
                        major
                            ? escapeHtml(
                                major
                            )
                            : ""
                    }

                    ${escapeHtml(
                        grade
                    )}年・

                    ${escapeHtml(
                        config.semester
                    )}

                    に一致する科目が登録されていません。

                </p>

            </div>

        `;


        updateAllDisplays();

        return;

    }


    if (
        filteredSubjects.length === 0
    ) {

        elements.list.innerHTML = `

            <div class="course-registration-empty">

                <div>
                    🔍
                </div>

                <h2>
                    条件に一致する科目がありません
                </h2>

                <p>
                    検索条件を変更してください。
                </p>

            </div>

        `;

        return;

    }


    // ========================================
    // ⑤ renderSubjects() の
    // const groups = [ ... ] より前に追加
    // ========================================

    const retakeSubjects =
        filteredSubjects.filter(
            subject =>
                isRetakeSubject(
                    subject
                )
        );


    const regularFilteredSubjects =
        filteredSubjects.filter(
            subject =>
                !isRetakeSubject(
                    subject
                )
        );


    const retakeHtml =
        retakeSubjects.length > 0
            ? `

                <section
                    class="
                        course-registration-section
                        is-retake
                    ">

                    <div class="course-list-section-heading">

                        <div>

                            <h2>

                                🔁 再履修が必要な科目

                                <small>
                                    ${retakeSubjects.length}科目
                                </small>

                            </h2>

                            <p>
                                過去に単位を取得できなかった科目です
                            </p>

                        </div>

                    </div>


                    <div class="course-registration-card-list">

                        ${
                            retakeSubjects
                                .map(
                                    createSubjectCardHtml
                                )
                                .join("")
                        }

                    </div>

                </section>

            `
            : "";


    const groups = [

        {
            type:
                "required",

            title:
                "必修科目",

            icon:
                "🔴",

            description:
                "卒業のために履修が必要な科目です"
        },

        {
            type:
                "elective",

            title:
                "選択科目",

            icon:
                "🔵",

            description:
                "必要単位数を確認しながら選びます"
        },

        {
            type:
                "free",

            title:
                "自由科目",

            icon:
                "🟢",

            description:
                "卒業要件への算入方法を確認して選びます"
        }

    ];


    elements.list.innerHTML =
        retakeHtml +
        groups.map(
            group => {

                const groupSubjects =
                    regularFilteredSubjects.filter(
                        subject =>
                            subject.requirementType ===
                            group.type
                    );


                if (
                    groupSubjects.length === 0
                ) {

                    return "";

                }


                return `

                    <section
                        class="
                            course-registration-section
                            is-${group.type}
                        ">

                        <div class="course-list-section-heading">

                            <div>

                                <h2>

                                    ${group.icon}
                                    ${group.title}

                                    <small>
                                        ${groupSubjects.length}科目
                                    </small>

                                </h2>

                                <p>
                                    ${group.description}
                                </p>

                            </div>

                        </div>


                        <div class="course-registration-card-list">

                            ${
                                groupSubjects
                                    .map(
                                        createSubjectCardHtml
                                    )
                                    .join("")
                            }

                        </div>

                    </section>

                `;

            }
        )
        .join("");

}


/* ========================================
   科目カード
======================================== */

function createSubjectCardHtml(
    subject
) {

    const selected =
        selectedIds.has(
            subject.id
        );


    const alreadyEarned =
        isAlreadyEarned(
            subject
        );


    const retake =
        isRetakeSubject(
            subject
        );


    const retakeEnrollment =
        retake
            ? getRetakeEnrollment(
                subject
            )
            : null;


    const selectable =
        canToggleSubject(
            subject,
            selected
        );


    const typeLabel = {

        required:
            "必修",

        elective:
            "選択",

        free:
            "自由"

    }[
        subject.requirementType
    ] || "未設定";


    const warnings =
        getSubjectWarnings(
            subject
        );


    let statusText =
        retake
            ? "再履修を登録"
            : "タップして選択";


    if (alreadyEarned) {

        statusText =
            "取得済み";

    } else if (
        selected &&
        retake
    ) {

        statusText =
            "再履修・選択中";

    } else if (selected) {

        statusText =
            "選択中";

    } else if (!selectable) {

        statusText =
            "現在は変更できません";

    } else if (
        subject.requirementType ===
        "required"
    ) {

        statusText =
            retake
                ? "再履修を登録"
                : "登録が必要";

    }


    return `

        <label
            class="
                course-registration-item
                ${
                    selected
                        ? "is-selected"
                        : ""
                }
                ${
                    alreadyEarned
                        ? "is-earned"
                        : ""
                }
                ${
                    !selectable
                        ? "is-disabled"
                        : ""
                }
                ${
                    warnings.length > 0
                        ? "has-warning"
                        : ""
                }

                ${
                    retake
                        ? "is-retake"
                        : ""
                }
            "
            data-subject-id="${escapeAttribute(
                subject.id
            )}">


            <input
                type="checkbox"
                class="course-checkbox"
                data-subject-id="${escapeAttribute(
                    subject.id
                )}"
                ${
                    selected
                        ? "checked"
                        : ""
                }
                ${
                    selectable
                        ? ""
                        : "disabled"
                }>


            <span class="course-card-check">

                ${
                    alreadyEarned
                        ? "✓"
                        : selected
                            ? "✓"
                            : ""
                }

            </span>


            <span class="course-registration-content">


                <span class="course-registration-title-row">

                    <span class="course-registration-title">

                        ${escapeHtml(
                            subject.name
                        )}

                    </span>

                    <span
                        class="
                            course-card-status
                            ${
                                selected
                                    ? "is-selected"
                                    : ""
                            }
                        ">

                        ${statusText}

                    </span>

                </span>


                <span class="course-registration-meta">

                    ${
                        retake
                            ? `

                                <span class="course-tag retake">
                                    🔁 再履修
                                </span>

                                ${
                                    retakeEnrollment
                                        ?.retakeSourceAcademicYear
                                        ? `
                                            <span>
                                                ${escapeHtml(
                                                    retakeEnrollment.retakeSourceAcademicYear
                                                )}年度
                                                ${escapeHtml(
                                                    retakeEnrollment.retakeSourceSemester || ""
                                                )}
                                                未取得
                                            </span>
                                        `
                                        : ""
                                }

                            `
                            : ""
                    }

                    <span
                        class="
                            course-tag
                            ${escapeAttribute(
                                subject.requirementType
                            )}
                        ">

                        ${typeLabel}

                    </span>


                    ${
                        subject.category
                            ? `

                                <span class="course-tag category">

                                    ${escapeHtml(
                                        subject.category
                                    )}

                                </span>

                            `
                            : ""
                    }


                    ${
                        subject.isPractical
                            ? `

                                <span class="course-tag practical">

                                    実習

                                </span>

                            `
                            : ""
                    }


                    <span class="course-credit-label">

                        <b>
                            ${formatCredit(
                                subject.credits
                            )}
                        </b>

                        単位

                    </span>


                    ${
                        subject.lectureCount > 0
                            ? `

                                <span>

                                    全${formatCredit(
                                        subject.lectureCount
                                    )}回

                                </span>

                            `
                            : ""
                    }

                </span>


                ${
                    subject.subcategory
                        ? `

                            <span class="course-subcategory">

                                ${escapeHtml(
                                    subject.subcategory
                                )}

                            </span>

                        `
                        : ""
                }


                ${
                    subject.requirementTags.length > 0
                        ? `

                            <span class="course-requirement-tags">

                                ${
                                    subject.requirementTags
                                        .map(
                                            tag => `

                                                <span>

                                                    ${escapeHtml(
                                                        tag
                                                    )}

                                                </span>

                                            `
                                        )
                                        .join("")
                                }

                            </span>

                        `
                        : ""
                }


                ${
                    warnings.length > 0
                        ? `

                            <span class="course-card-warning">

                                ⚠️
                                ${escapeHtml(
                                    warnings.join("・")
                                )}

                            </span>

                        `
                        : ""
                }

            </span>

        </label>

    `;

}


/* ========================================
   絞り込み
======================================== */

function getFilteredSubjects() {

    const keyword =
        String(
            elements.search.value ||
            ""
        )
        .trim()
        .toLowerCase();


    const requirementType =
        elements.requirementFilter.value;


    const category =
        elements.categoryFilter.value;


    const selection =
        elements.selectionFilter.value;


    return visibleSubjects.filter(
        subject => {

            if (keyword) {

                const searchText = (

                    `${subject.name} ` +
                    `${subject.subjectKey} ` +
                    `${subject.category} ` +
                    `${subject.subcategory} ` +
                    `${subject.requirementTags.join(" ")}`

                ).toLowerCase();


                if (
                    !searchText.includes(
                        keyword
                    )
                ) {

                    return false;

                }

            }


            if (
                requirementType &&
                subject.requirementType !==
                    requirementType
            ) {

                return false;

            }


            if (
                category &&
                subject.category !== category
            ) {

                return false;

            }


            if (
                selection === "selected" &&
                !selectedIds.has(
                    subject.id
                )
            ) {

                return false;

            }


            if (
                selection === "unselected" &&
                selectedIds.has(
                    subject.id
                )
            ) {

                return false;

            }


            if (
                selection === "warning" &&
                !subjectHasWarning(
                    subject
                )
            ) {

                return false;

            }


            return true;

        }
    );

}


function resetFilters() {

    elements.search.value =
        "";

    elements.requirementFilter.value =
        "";

    elements.categoryFilter.value =
        "";

    elements.selectionFilter.value =
        "";


    renderSubjects();


    showToast(
        "絞り込みを解除しました"
    );

}


/* ========================================
   科目選択
======================================== */

function handleSubjectSelection(
    event
) {

    const input =
        event.target.closest(
            ".course-checkbox"
        );


    if (!input) {
        return;
    }


    const subjectId =
        input.dataset.subjectId;


    const subject =
        visibleSubjects.find(
            item =>
                item.id === subjectId
        );


    if (
        !subject ||
        !canToggleSubject(
            subject,
            selectedIds.has(subjectId)
        )
    ) {

        input.checked =
            selectedIds.has(subjectId);

        return;

    }


    if (input.checked) {

        selectedIds.add(
            subjectId
        );

    } else {

        selectedIds.delete(
            subjectId
        );

    }


    updateDirtyState();

    updateAllDisplays();


    if (
        elements.selectionFilter.value
    ) {

        renderSubjects();

    } else {

        updateSubjectCardState(
            subject
        );

    }

}


function updateSubjectCardState(
    subject
) {

    const card =
        elements.list.querySelector(
            `[data-subject-id="${cssEscape(
                subject.id
            )}"].course-registration-item`
        );


    if (!card) {
        return;
    }


    const selected =
        selectedIds.has(
            subject.id
        );


    card.classList.toggle(
        "is-selected",
        selected
    );


    const check =
        card.querySelector(
            ".course-card-check"
        );


    if (check) {

        check.textContent =
            selected
                ? "✓"
                : "";

    }


    const status =
        card.querySelector(
            ".course-card-status"
        );


    if (status) {

        status.textContent =
            selected
                ? "選択中"
                : subject.requirementType ===
                    "required"
                    ? "登録が必要"
                    : "タップして選択";


        status.classList.toggle(
            "is-selected",
            selected
        );

    }

}


/* ========================================
   一括操作
======================================== */

function selectAllRequiredSubjects() {

    const selectableRequiredSubjects =
        visibleSubjects.filter(
            subject =>
                subject.requirementType ===
                    "required" &&
                !isAlreadyEarned(subject) &&
                canToggleSubject(
                    subject,
                    selectedIds.has(subject.id)
                )
        );


    if (
        selectableRequiredSubjects.length ===
        0
    ) {

        showToast(
            "選択できる必修科目はありません"
        );

        return;

    }


    const confirmed =
        confirm(
            `必修科目${selectableRequiredSubjects.length}科目をまとめて選択しますか？`
        );


    if (!confirmed) {
        return;
    }


    selectableRequiredSubjects.forEach(
        subject => {

            selectedIds.add(
                subject.id
            );

        }
    );


    updateDirtyState();

    renderSubjects();

    updateAllDisplays();


    showToast(
        "必修科目を選択しました"
    );

}


function clearAllOptionalSubjects() {

    const removableSubjects =
        visibleSubjects.filter(
            subject =>
                subject.requirementType !==
                    "required" &&
                selectedIds.has(
                    subject.id
                ) &&
                canToggleSubject(
                    subject,
                    true
                )
        );


    if (
        removableSubjects.length === 0
    ) {

        showToast(
            "外せる選択科目はありません"
        );

        return;

    }


    const confirmed =
        confirm(
            `選択中の選択・自由科目${removableSubjects.length}科目を外しますか？`
        );


    if (!confirmed) {
        return;
    }


    removableSubjects.forEach(
        subject => {

            selectedIds.delete(
                subject.id
            );

        }
    );


    updateDirtyState();

    renderSubjects();

    updateAllDisplays();


    showToast(
        "選択科目を外しました"
    );

}


/* ========================================
   選択可否
======================================== */

function canToggleSubject(
    subject,
    currentlySelected
) {

    if (
        isAlreadyEarned(
            subject
        )
    ) {

        return false;

    }


    if (previewMode) {

        return true;

    }


    const phase =
        getEffectivePhase();


    /*
     通常の履修登録期間は、
     対象科目を自由に選択・解除できる。
    */

    if (
        phase ===
        "registration"
    ) {

        return true;

    }


    /*
     履修修正期間で
     追加・削除の両方が許可されている場合。
    */

    if (
        phase ===
            "correction" &&
        config.correctionMode ===
            "add_delete"
    ) {

        return true;

    }


    /*
     履修取消期間、
     または削除のみの履修修正期間では、
     期間開始前から履修していた科目だけ操作できる。

     selectedIdsではなく
     originalSelectedIdsを判定に使うことで、
     保存前ならチェックを外した後でも
     再びチェックを入れられる。
    */

    if (
        phase ===
            "cancellation" ||
        phase ===
            "correction"
    ) {

        return originalSelectedIds.has(
            subject.id
        );

    }


    return false;

}


/* ========================================
   単位計算
======================================== */

function getSelectionSummary() {

    const selectedSubjects =
        visibleSubjects.filter(
            subject =>
                selectedIds.has(
                    subject.id
                )
        );


    const currentCredits =
        sumSubjectCredits(
            selectedSubjects
        );


    const otherSemesterCredits =
        getOtherSemesterAnnualCredits();


    const annualCredits =
        currentCredits +
        otherSemesterCredits;


    const projectedCredits =
        progress.earnedCredits +
        currentCredits;


    const graduationCredits =
        currentCurriculum
            .graduationCredits;


    const remainingCredits =
        Math.max(
            0,
            graduationCredits -
            projectedCredits
        );


    return {

        selectedSubjects,

        selectedCount:
            selectedSubjects.length,

        currentCredits,

        semesterCredits:
            currentCredits,

        annualCredits,

        otherSemesterCredits,

        projectedCredits,

        graduationCredits,

        remainingCredits

    };

}


function getOtherSemesterAnnualCredits() {

    return [...enrolledDocs.values()]
        .filter(
            enrollment => {

                if (
                    Number(
                        enrollment.academicYear
                    ) !==
                    Number(
                        config.academicYear
                    )
                ) {

                    return false;

                }


                if (
                    enrollment.registeredSemester ===
                    config.semester
                ) {

                    return false;

                }


                if (
                    normalizeSemester(
                        enrollment.semester
                    ) === "通期"
                ) {

                    return false;

                }


                return true;

            }
        )
        .reduce(
            (
                total,
                enrollment
            ) =>
                total +
                toNonNegativeNumber(
                    enrollment.credits
                ),
            0
        );

}


/* ========================================
   全表示更新
======================================== */

function updateAllDisplays() {

    if (!registrationAvailable) {
        return;
    }


    const selectionSummary =
        getSelectionSummary();


    currentWarnings =
        buildWarnings(
            selectionSummary
        );


    updateGraduationDisplay(
        selectionSummary
    );

    updateCategoryProgress(
        selectionSummary
    );

    updateSpecialRequirementProgress(
        selectionSummary
    );

    renderWarnings(
        currentWarnings
    );

    updateDesktopSummary(
        selectionSummary
    );

    updateMobileSummary(
        selectionSummary
    );

    updateSaveAvailability(
        selectionSummary
    );

}


/* ========================================
   卒業進捗
======================================== */

function updateGraduationDisplay(
    summary
) {

    setText(
        elements.earnedCredits,
        formatCredit(
            progress.earnedCredits
        )
    );


    setText(
        elements.earnedCreditsLabel,
        `${formatCredit(
            progress.earnedCredits
        )}単位`
    );


    setText(
        elements.graduationRequiredCredits,
        formatCredit(
            summary.graduationCredits
        )
    );


    setText(
        elements.projectedCredits,
        formatCredit(
            summary.projectedCredits
        )
    );


    setText(
        elements.remainingCredits,
        formatCredit(
            summary.remainingCredits
        )
    );


    const percentage =
        summary.graduationCredits > 0
            ? Math.min(
                100,
                summary.projectedCredits /
                summary.graduationCredits *
                100
            )
            : 0;


    setProgressWidth(
        elements.graduationProgressBar,
        percentage
    );

}


/* ========================================
   区分別進捗
======================================== */

function updateCategoryProgress(
    summary
) {

    const requirements =
        currentCurriculum
            .categoryRequirements;


    if (
        requirements.length === 0
    ) {

        elements.categoryProgressList.innerHTML = `

            <div class="course-progress-empty">

                区分別要件は設定されていません。

            </div>

        `;

        return;

    }


    elements.categoryProgressList.innerHTML =
        requirements.map(
            requirement => {

                const selectedCategorySubjects =
                    summary.selectedSubjects.filter(
                        subject =>
                            subject.category ===
                            requirement.category
                    );


                const selectedTotal =
                    sumSubjectCredits(
                        selectedCategorySubjects
                    );


                const selectedRequired =
                    sumSubjectCredits(
                        selectedCategorySubjects.filter(
                            subject =>
                                subject.requirementType ===
                                "required"
                        )
                    );


                const selectedElective =
                    sumSubjectCredits(
                        selectedCategorySubjects.filter(
                            subject =>
                                subject.requirementType ===
                                "elective"
                        )
                    );


                const earnedTotal =
                    getObjectNumber(
                        progress.categoryCredits,
                        requirement.category
                    );


                const earnedRequired =
                    getObjectNumber(
                        progress.categoryRequiredCredits,
                        requirement.category
                    );


                const earnedElective =
                    getObjectNumber(
                        progress.categoryElectiveCredits,
                        requirement.category
                    );


                const projectedTotal =
                    earnedTotal +
                    selectedTotal;


                const projectedRequired =
                    earnedRequired +
                    selectedRequired;


                const projectedElective =
                    earnedElective +
                    selectedElective;


                const totalTarget =
                    requirement.totalCreditsMinimum;


                const percentage =
                    totalTarget > 0
                        ? Math.min(
                            100,
                            projectedTotal /
                            totalTarget *
                            100
                        )
                        : 100;


                const complete =
                    projectedTotal >=
                        requirement.totalCreditsMinimum &&
                    projectedRequired >=
                        requirement.requiredCredits &&
                    projectedElective >=
                        requirement.electiveCreditsMinimum;


                return `

                    <article
                        class="
                            category-progress-item
                            ${
                                complete
                                    ? "is-complete"
                                    : ""
                            }
                        ">


                        <div class="category-progress-heading">

                            <div>

                                <h3>

                                    ${escapeHtml(
                                        requirement.category
                                    )}

                                </h3>

                                <small>

                                    ${
                                        complete
                                            ? "要件を満たす見込みです"
                                            : "まだ必要な単位があります"
                                    }

                                </small>

                            </div>


                            <strong>

                                ${formatCredit(
                                    projectedTotal
                                )}

                                /

                                ${formatCredit(
                                    totalTarget
                                )}

                                単位

                            </strong>

                        </div>


                        <div class="category-progress-track">

                            <div
                                class="category-progress-bar"
                                style="width:${percentage}%">

                            </div>

                        </div>


                        <div class="category-progress-breakdown">

                            <span>

                                取得済み
                                <b>
                                    ${formatCredit(
                                        earnedTotal
                                    )}
                                </b>

                            </span>

                            <span>

                                今回選択
                                <b>
                                    ${formatCredit(
                                        selectedTotal
                                    )}
                                </b>

                            </span>

                            <span>

                                必修
                                <b>

                                    ${formatCredit(
                                        projectedRequired
                                    )}

                                    /

                                    ${formatCredit(
                                        requirement.requiredCredits
                                    )}

                                </b>

                            </span>

                            <span>

                                選択
                                <b>

                                    ${formatCredit(
                                        projectedElective
                                    )}

                                    /

                                    ${formatCredit(
                                        requirement
                                            .electiveCreditsMinimum
                                    )}

                                </b>

                            </span>

                        </div>

                    </article>

                `;

            }
        )
        .join("");


    if (
        progressSource === "manual" &&
        progress.earnedCredits > 0 &&
        Object.keys(
            progress.categoryCredits
        ).length === 0
    ) {

        elements.categoryProgressList.insertAdjacentHTML(
            "afterbegin",
            `

                <div class="course-category-data-note">

                    ℹ️ 過去の取得単位は区分別の内訳が登録されていないため、
                    区分別表示には今回選択した科目だけが反映されています。

                </div>

            `
        );

    }

}


/* ========================================
   特別要件進捗
======================================== */

function updateSpecialRequirementProgress(
    summary
) {

    const requirements =
        currentCurriculum
            .specialRequirements;


    if (
        requirements.length === 0
    ) {

        elements
            .specialRequirementProgressList
            .innerHTML =
            "";

        return;

    }


    elements
        .specialRequirementProgressList
        .innerHTML = `

            <h3 class="special-requirement-heading">

                🏷️ 特別要件

            </h3>

            ${
                requirements.map(
                    requirement => {

                        const selectedCredits =
                            sumSubjectCredits(
                                summary.selectedSubjects.filter(
                                    subject =>
                                        subject.requirementTags.includes(
                                            requirement.requirementTag
                                        ) ||
                                        subject.subcategory ===
                                            requirement.requirementTag
                                )
                            );


                        const earnedCredits =
                            getObjectNumber(
                                progress.requirementTagCredits,
                                requirement.requirementTag
                            );


                        const projectedCredits =
                            earnedCredits +
                            selectedCredits;


                        const complete =
                            projectedCredits >=
                            requirement.minimumCredits;


                        return `

                            <div
                                class="
                                    special-requirement-item
                                    ${
                                        complete
                                            ? "is-complete"
                                            : ""
                                    }
                                ">

                                <span>

                                    ${complete ? "✅" : "○"}

                                    ${escapeHtml(
                                        requirement.requirementTag
                                    )}

                                </span>

                                <strong>

                                    ${formatCredit(
                                        projectedCredits
                                    )}

                                    /

                                    ${formatCredit(
                                        requirement.minimumCredits
                                    )}

                                    単位

                                </strong>

                            </div>

                        `;

                    }
                )
                .join("")
            }

        `;

}


/* ========================================
   警告作成
======================================== */

function buildWarnings(
    summary
) {

    const warnings = [];


    const semesterLimit =
        config.semesterCreditLimit;


    const annualLimit =
        config.annualCreditLimit;


    if (
        semesterLimit > 0 &&
        summary.semesterCredits >
        semesterLimit
    ) {

        warnings.push({

            level:
                "error",

            message:
                `半期の履修上限を${formatCredit(
                    summary.semesterCredits -
                    semesterLimit
                )}単位超えています。`

        });

    }


    if (
        annualLimit > 0 &&
        summary.annualCredits >
        annualLimit
    ) {

        warnings.push({

            level:
                "error",

            message:
                `年間の履修上限を${formatCredit(
                    summary.annualCredits -
                    annualLimit
                )}単位超えています。`

        });

    }


    const missingRequiredSubjects =
        visibleSubjects.filter(
            subject =>
                subject.requirementType ===
                    "required" &&
                !isAlreadyEarned(subject) &&
                !selectedIds.has(
                    subject.id
                )
        );


    if (
        missingRequiredSubjects.length >
        0
    ) {

        warnings.push({

            level:
                "error",

            message:
                `未選択の必修科目が${missingRequiredSubjects.length}科目あります。`

        });

    }


    const incompleteSelectedSubjects =
        summary.selectedSubjects.filter(
            subject =>
                getSubjectWarnings(
                    subject
                ).length > 0
        );


    if (
        incompleteSelectedSubjects.length >
        0
    ) {

        warnings.push({

            level:
                "warning",

            message:
                `科目情報に確認が必要な科目が${incompleteSelectedSubjects.length}科目あります。`

        });

    }


    const legacySubjectCount =
        visibleSubjects.filter(
            subject =>
                subject.curriculumIds.length ===
                0
        ).length;


    if (
        legacySubjectCount > 0
    ) {

        warnings.push({

            level:
                "info",

            message:
                `${legacySubjectCount}科目は学科・専攻情報から対象判定されています。`

        });

    }


    if (
        summary.selectedCount === 0
    ) {

        warnings.push({

            level:
                "info",

            message:
                "履修する科目がまだ選択されていません。"

        });

    }


    return warnings;

}


/* ========================================
   警告表示
======================================== */

function renderWarnings(
    warnings
) {

    const importantWarnings =
        warnings.filter(
            warning =>
                warning.level !==
                "info"
        );


    if (
        warnings.length === 0
    ) {

        elements.warningPanel.hidden =
            true;

        return;

    }


    elements.warningPanel.hidden =
        false;


    elements.warningTitle.textContent =
        importantWarnings.length > 0
            ? "保存前に確認が必要です"
            : "現在の登録状況";


    elements.warningList.innerHTML =
        warnings.map(
            warning => {

                const icon = {

                    error:
                        "🚨",

                    warning:
                        "⚠️",

                    info:
                        "ℹ️"

                }[
                    warning.level
                ] || "ℹ️";


                return `

                    <div
                        class="
                            course-warning-item
                            is-${escapeAttribute(
                                warning.level
                            )}
                        ">

                        <span>
                            ${icon}
                        </span>

                        <p>
                            ${escapeHtml(
                                warning.message
                            )}
                        </p>

                    </div>

                `;

            }
        )
        .join("");

}


/* ========================================
   PCサマリー
======================================== */

function updateDesktopSummary(
    summary
) {

    setText(
        elements.selectedCount,
        `${summary.selectedCount}科目`
    );


    setText(
        elements.currentCredits,
        formatCredit(
            summary.currentCredits
        )
    );


    setText(
        elements.semesterCredits,
        formatCredit(
            summary.semesterCredits
        )
    );


    setText(
        elements.annualCredits,
        formatCredit(
            summary.annualCredits
        )
    );


    setText(
        elements.semesterLimitText,
        config.semesterCreditLimit > 0
            ? `/ ${formatCredit(
                config.semesterCreditLimit
            )}単位`
            : "単位"
    );


    setText(
        elements.annualLimitText,
        config.annualCreditLimit > 0
            ? `/ ${formatCredit(
                config.annualCreditLimit
            )}単位`
            : "単位"
    );


    setText(
        elements.earnedCreditsSummary,
        formatCredit(
            progress.earnedCredits
        )
    );


    setText(
        elements.projectedCreditsSummary,
        formatCredit(
            summary.projectedCredits
        )
    );


    setText(
        elements.earnedRequiredCredits,
        formatCredit(
            progress.earnedRequiredCredits
        )
    );


    setText(
        elements.earnedElectiveCredits,
        formatCredit(
            progress.earnedElectiveCredits
        )
    );


    setProgressWidth(
        elements.semesterLimitBar,
        getLimitPercentage(
            summary.semesterCredits,
            config.semesterCreditLimit
        )
    );


    setProgressWidth(
        elements.annualLimitBar,
        getLimitPercentage(
            summary.annualCredits,
            config.annualCreditLimit
        )
    );


    const importantWarningCount =
        currentWarnings.filter(
            warning =>
                warning.level ===
                    "error" ||
                warning.level ===
                    "warning"
        ).length;


    elements.warningBadge.hidden =
        importantWarningCount === 0;


    elements.warningBadge.textContent =
        importantWarningCount;


    const errorCount =
        currentWarnings.filter(
            warning =>
                warning.level ===
                "error"
        ).length;


    if (errorCount > 0) {

        elements.summaryMessage.textContent =
            `${errorCount}件の問題を修正してください`;

        elements.summaryMessage.className =
            "course-summary-message is-error";

    } else if (
        importantWarningCount > 0
    ) {

        elements.summaryMessage.textContent =
            "確認事項があります";

        elements.summaryMessage.className =
            "course-summary-message is-warning";

    } else if (
        !pageDirty
    ) {

        elements.summaryMessage.textContent =
            "現在の登録内容から変更はありません";

        elements.summaryMessage.className =
            "course-summary-message";

    } else {

        elements.summaryMessage.textContent =
            "保存できる状態です";

        elements.summaryMessage.className =
            "course-summary-message is-ready";

    }

}


/* ========================================
   スマホサマリー
======================================== */

function updateMobileSummary(
    summary
) {

    setText(
        elements.mobileSelectedCount,
        `${summary.selectedCount}科目`
    );


    setText(
        elements.mobileSelectedCredits,
        formatCredit(
            summary.currentCredits
        )
    );


    setText(
        elements.mobilePanelCourseCount,
        `${summary.selectedCount}科目`
    );


    setText(
        elements.mobilePanelCredits,
        formatCredit(
            summary.currentCredits
        )
    );


    setText(
        elements.mobileSemesterCredits,
        `${formatCredit(
            summary.semesterCredits
        )}単位`
    );


    setText(
        elements.mobileAnnualCredits,
        `${formatCredit(
            summary.annualCredits
        )}単位`
    );


    setText(
        elements.mobileEarnedCredits,
        `${formatCredit(
            progress.earnedCredits
        )}単位`
    );


    setText(
        elements.mobileRemainingCredits,
        `${formatCredit(
            summary.remainingCredits
        )}単位`
    );


    const importantWarnings =
        currentWarnings.filter(
            warning =>
                warning.level ===
                    "error" ||
                warning.level ===
                    "warning"
        );


    elements.mobileWarning.hidden =
        importantWarnings.length === 0;


    if (
        importantWarnings.length > 0
    ) {

        elements.mobileWarning.textContent =
            `⚠️ 確認が必要な項目が${importantWarnings.length}件あります`;

    }

}


/* ========================================
   保存可否
======================================== */

function updateSaveAvailability(
    summary
) {

    const editable =
        isRegistrationEditable();


    const hasBlockingError =
        currentWarnings.some(
            warning =>
                warning.level ===
                "error"
        );


    const disabled =
        previewMode ||
        !editable ||
        !pageDirty ||
        summary.selectedCount === 0 ||
        hasBlockingError ||
        savingEnrollment;


    [

        elements.save,
        elements.mobileSave,
        elements.mobilePanelSave

    ]
    .filter(Boolean)
    .forEach(
        button => {

            button.disabled =
                disabled;

        }
    );


    elements.restore.disabled =
        previewMode ||
        !editable ||
        savingEnrollment;


    elements.selectRequired.disabled =
        !editable ||
        savingEnrollment;


    elements.clearOptional.disabled =
        !editable ||
        savingEnrollment;

}


function isRegistrationEditable() {

    if (previewMode) {
        return true;
    }


    return [

        "registration",
        "correction",
        "cancellation"

    ].includes(
        getEffectivePhase()
    );

}


/* ========================================
   前回内容へ戻す
======================================== */

async function restorePreviousEnrollment() {

    if (
        previewMode ||
        !isRegistrationEditable()
    ) {

        return;

    }


    try {

        elements.restore.disabled =
            true;

        elements.restore.textContent =
            "取得中...";


        const historyQuery =
            query(
                collection(
                    db,
                    "users",
                    studentNumber,
                    "enrollmentHistory"
                ),
                orderBy(
                    "savedAt",
                    "desc"
                ),
                limit(10)
            );


        const historySnapshot =
            await getDocs(
                historyQuery
            );


        const previousHistory =
            historySnapshot.docs
                .map(
                    historyDocument =>
                        historyDocument.data()
                )
                .find(
                    history =>
                        Number(
                            history.academicYear
                        ) ===
                            Number(
                                config.academicYear
                            ) &&
                        history.semester ===
                            config.semester
                );


        if (!previousHistory) {

            alert(
                "戻せる以前の登録内容がありません。"
            );

            return;

        }


        const restoredIds =
            new Set(

                previousHistory
                    .previousSelectedSubjectIds ||

                previousHistory
                    .selectedSubjectIds ||

                []

            );


        selectedIds =
            new Set(
                [...restoredIds].filter(
                    id =>
                        visibleSubjects.some(
                            subject =>
                                subject.id === id &&
                                !isAlreadyEarned(
                                    subject
                                )
                        )
                )
            );


        updateDirtyState();

        renderSubjects();

        updateAllDisplays();


        showToast(
            "以前の内容を表示しました。保存すると確定します"
        );

    } catch (error) {

        console.error(
            "履修履歴取得エラー:",
            error
        );


        alert(
            "以前の登録内容を取得できませんでした。"
        );

    } finally {

        elements.restore.textContent =
            "前回の登録内容に戻す";


        updateSaveAvailability(
            getSelectionSummary()
        );

    }

}


/* ========================================
   最終確認モーダル
======================================== */

function openEnrollmentConfirmation() {

    const summary =
        getSelectionSummary();


    const blockingErrors =
        currentWarnings.filter(
            warning =>
                warning.level ===
                "error"
        );


    if (
        blockingErrors.length > 0
    ) {

        elements.warningPanel
            ?.scrollIntoView({
                behavior:
                    "smooth",

                block:
                    "center"
            });


        showToast(
            "保存できない項目があります"
        );

        return;

    }


    if (!pageDirty) {

        showToast(
            "登録内容に変更はありません"
        );

        return;

    }


    closeMobileSummary();


    setText(
        elements.confirmCourseCount,
        `${summary.selectedCount}科目`
    );


    setText(
        elements.confirmCreditCount,
        `${formatCredit(
            summary.currentCredits
        )}単位`
    );


    setText(
        elements.confirmSemesterCredits,
        `${formatCredit(
            summary.semesterCredits
        )}単位`
    );


    setText(
        elements.confirmAnnualCredits,
        `${formatCredit(
            summary.annualCredits
        )}単位`
    );


    elements.confirmCourseList.innerHTML =
        summary.selectedSubjects.map(
            subject => `

                <div class="course-confirm-course-item">

                    <div>

                        <b>
                            ${escapeHtml(
                                subject.name
                            )}
                        </b>

                        <small>

                            ${escapeHtml(
                                requirementTypeLabel(
                                    subject.requirementType
                                )
                            )}

                            ・

                            ${escapeHtml(
                                subject.category ||
                                "区分未設定"
                            )}

                        </small>

                    </div>

                    <strong>

                        ${formatCredit(
                            subject.credits
                        )}単位

                    </strong>

                </div>

            `
        )
        .join("");


    const confirmationWarnings =
        currentWarnings.filter(
            warning =>
                warning.level ===
                    "warning"
        );


    elements.confirmWarningSection.hidden =
        confirmationWarnings.length ===
        0;


    elements.confirmWarningList.innerHTML =
        confirmationWarnings.map(
            warning => `

                <div class="course-confirm-warning-item">

                    ⚠️
                    ${escapeHtml(
                        warning.message
                    )}

                </div>

            `
        )
        .join("");


    elements.confirmAgreement.checked =
        false;

    elements.confirmEnrollment.disabled =
        true;


    openModal(
        elements.confirmModal
    );

}


function updateConfirmButton() {

    elements.confirmEnrollment.disabled =
        !elements.confirmAgreement.checked ||
        savingEnrollment;

}


function closeEnrollmentConfirmation() {

    closeModal(
        elements.confirmModal
    );

}


/* ========================================
   履修登録保存
======================================== */

async function saveEnrollment() {

    if (
        savingEnrollment ||
        !elements.confirmAgreement.checked
    ) {

        return;

    }


    const summary =
        getSelectionSummary();


    if (
        currentWarnings.some(
            warning =>
                warning.level ===
                "error"
        )
    ) {

        alert(
            "保存できない項目があります。"
        );

        closeEnrollmentConfirmation();

        return;

    }


    savingEnrollment =
        true;


    const originalButtonText =
        elements.confirmEnrollment
            .textContent;


    try {

        elements.confirmEnrollment.disabled =
            true;

        elements.confirmEnrollment.textContent =
            "保存中...";


        const batch =
            writeBatch(
                db
            );


        const historyReference =
            doc(
                collection(
                    db,
                    "users",
                    studentNumber,
                    "enrollmentHistory"
                )
            );


        batch.set(
            historyReference,
            {

                academicYear:
                    Number(
                        config.academicYear
                    ),

                semester:
                    config.semester,

                curriculumId:
                    currentCurriculum
                        .curriculumId,

                previousSelectedSubjectIds:
                    [...originalSelectedIds],

                selectedSubjectIds:
                    [...selectedIds],

                selectedCourseCount:
                    summary.selectedCount,

                selectedCredits:
                    summary.currentCredits,

                savedAt:
                    serverTimestamp()

            }
        );


        visibleSubjects.forEach(
            subject => {

                const enrollmentReference =
                    doc(
                        db,
                        "users",
                        studentNumber,
                        "enrolledSubjects",
                        subject.id
                    );


                if (
                    selectedIds.has(
                        subject.id
                    )
                ) {

                    const existingEnrollment =
                        enrolledDocs.get(
                            subject.id
                        );


                    const retakeEnrollment =
                        getRetakeEnrollment(
                            subject
                        );


                    const registeringAsRetake =
                        isRetakeSubject(
                            subject
                        );


                    batch.set(
                        enrollmentReference,
                        {

                            subjectId:
                                subject.id,

                            name:
                                subject.name,

                            subjectKey:
                                subject.subjectKey,

                            curriculumId:
                                currentCurriculum
                                    .curriculumId,

                            department:
                                subject.department ||
                                department,

                            major:
                                subject.major ||
                                major,

                            grade:
                                subject.grade ||
                                grade,

                            semester:
                                subject.semester,

                            registeredSemester:
                                config.semester,

                            academicYear:
                                Number(
                                    config.academicYear
                                ),

                            requirementType:
                                subject.requirementType,

                            required:
                                subject.requirementType ===
                                "required",

                            category:
                                subject.category,

                            subcategory:
                                subject.subcategory,

                            requirementTags:
                                subject.requirementTags,

                            credits:
                                subject.credits,

                            lectureCount:
                                subject.lectureCount,

                            isPractical:
                                subject.isPractical,

                            attendanceNotificationEnabled:
                                existingEnrollment
                                    ?.attendanceNotificationEnabled ??
                                subject
                                    .attendanceNotificationDefaultEnabled,

                            attendanceReminderMinutes:
                                existingEnrollment
                                    ?.attendanceReminderMinutes ??
                                subject
                                    .attendanceReminderMinutes,


                            ...(registeringAsRetake
                                ? {

                                    isRetake:
                                        true,

                                    retakeLabel:
                                        "再履修",

                                    retakeSourceAcademicYear:
                                        Number(
                                            retakeEnrollment
                                                ?.retakeSourceAcademicYear ||
                                            retakeEnrollment
                                                ?.creditConfirmedAcademicYear ||
                                            retakeEnrollment
                                                ?.academicYear ||
                                            0
                                        ),

                                    retakeSourceSemester:
                                        retakeEnrollment
                                            ?.retakeSourceSemester ||
                                        retakeEnrollment
                                            ?.creditConfirmedSemester ||
                                        retakeEnrollment
                                            ?.semester ||
                                        "",

                                    retakeRegisteredAcademicYear:
                                        Number(
                                            config.academicYear
                                        ),

                                    retakeRegisteredSemester:
                                        config.semester,

                                    retakeRegisteredAt:
                                        new Date()
                                            .toISOString()

                                }
                                : {}),


                            status:
                                "enrolled",

                            registeredAt:
                                existingEnrollment
                                    ?.registeredAt ||
                                serverTimestamp(),

                            updatedAt:
                                serverTimestamp()

                        },
                        {
                            merge:
                                true
                        }
                    );

                } else if (
                    originalSelectedIds.has(
                        subject.id
                    )
                ) {

                    batch.delete(
                        enrollmentReference
                    );

                }

            }
        );


        await batch.commit();


        originalSelectedIds =
            new Set(
                selectedIds
            );


        visibleSubjects.forEach(
            subject => {

                if (
                    selectedIds.has(
                        subject.id
                    )
                ) {

                    const previousEnrollment =
                        enrolledDocs.get(
                            subject.id
                        ) || {};


                    const retakeEnrollment =
                        getRetakeEnrollment(
                            subject
                        );


                    const registeringAsRetake =
                        isRetakeSubject(
                            subject
                        );


                    enrolledDocs.set(
                        subject.id,
                        {

                            ...previousEnrollment,

                            id:
                                subject.id,

                            subjectId:
                                subject.id,

                            name:
                                subject.name,

                            subjectKey:
                                subject.subjectKey,

                            academicYear:
                                Number(
                                    config.academicYear
                                ),

                            registeredSemester:
                                config.semester,

                            semester:
                                subject.semester,

                            credits:
                                subject.credits,

                            status:
                                "enrolled",

                            ...(registeringAsRetake
                                ? {

                                    isRetake:
                                        true,

                                    retakeLabel:
                                        "再履修",

                                    retakeSourceAcademicYear:
                                        Number(
                                            retakeEnrollment
                                                ?.retakeSourceAcademicYear ||
                                            retakeEnrollment
                                                ?.creditConfirmedAcademicYear ||
                                            retakeEnrollment
                                                ?.academicYear ||
                                            0
                                        ),

                                    retakeSourceSemester:
                                        retakeEnrollment
                                            ?.retakeSourceSemester ||
                                        retakeEnrollment
                                            ?.creditConfirmedSemester ||
                                        retakeEnrollment
                                            ?.semester ||
                                        "",

                                    retakeRegisteredAcademicYear:
                                        Number(
                                            config.academicYear
                                        ),

                                    retakeRegisteredSemester:
                                        config.semester

                                }
                                : {}),

                            updatedAt:
                                new Date()

                        }
                    );

                } else {

                    enrolledDocs.delete(
                        subject.id
                    );

                }

            }
        );


        lastRegistrationAt =
            new Date();


        pageDirty =
            false;


        renderPhase();

        renderSubjects();

        updateAllDisplays();


        closeEnrollmentConfirmation();


        setText(
            elements.completeMessage,
            `${summary.selectedCount}科目・${formatCredit(
                summary.currentCredits
            )}単位を登録しました。`
        );


        openModal(
            elements.completeModal
        );


        showToast(
            "履修登録を保存しました"
        );

    } catch (error) {

        console.error(
            "履修登録保存エラー:",
            error
        );


        alert(
            "履修登録を保存できませんでした。通信状態を確認して、もう一度お試しください。"
        );

    } finally {

        savingEnrollment =
            false;

        elements.confirmEnrollment.textContent =
            originalButtonText;


        updateConfirmButton();

        updateSaveAvailability(
            getSelectionSummary()
        );

    }

}


/* ========================================
   保存完了
======================================== */

function closeCompleteModal() {

    closeModal(
        elements.completeModal
    );

}


/* ========================================
   スマホサマリー
======================================== */

function openMobileSummary() {

    elements.mobileOverlay.hidden =
        false;

    elements.mobilePanel.hidden =
        false;


    requestAnimationFrame(
        () => {

            elements.mobileOverlay.classList.add(
                "is-open"
            );

            elements.mobilePanel.classList.add(
                "is-open"
            );

        }
    );


    document.body.classList.add(
        "course-mobile-panel-open"
    );

}


function closeMobileSummary() {

    if (
        !elements.mobilePanel ||
        elements.mobilePanel.hidden
    ) {

        return;

    }


    elements.mobileOverlay.classList.remove(
        "is-open"
    );

    elements.mobilePanel.classList.remove(
        "is-open"
    );


    setTimeout(
        () => {

            elements.mobileOverlay.hidden =
                true;

            elements.mobilePanel.hidden =
                true;

        },
        220
    );


    document.body.classList.remove(
        "course-mobile-panel-open"
    );

}


/* ========================================
   卒業進捗開閉
======================================== */

function toggleGraduationProgress() {

    elements.graduationContent.hidden =
        !elements.graduationContent.hidden;


    elements.graduationToggle.textContent =
        elements.graduationContent.hidden
            ? "詳細を表示"
            : "詳細を閉じる";

}


/* ========================================
   科目警告
======================================== */

function getSubjectWarnings(
    subject
) {

    const warnings = [];


    if (!subject.category) {

        warnings.push(
            "科目区分未設定"
        );

    }


    if (!subject.requirementType) {

        warnings.push(
            "必修・選択区分未設定"
        );

    }


    if (subject.credits <= 0) {

        warnings.push(
            "単位数未設定"
        );

    }


    return warnings;

}


function subjectHasWarning(
    subject
) {

    return (

        getSubjectWarnings(
            subject
        ).length > 0 ||

        (
            subject.requirementType ===
                "required" &&
            !selectedIds.has(
                subject.id
            ) &&
            !isAlreadyEarned(
                subject
            )
        )

    );

}


/* ========================================
   取得済み判定
======================================== */

function isAlreadyEarned(
    subject
) {

    return (

        earnedSubjectIds.has(
            subject.id
        ) ||

        earnedSubjectKeys.has(
            subject.subjectKey
        )

    );

}


/* ========================================
   登録対象判定
======================================== */

function isCurrentRegistration(
    enrollment
) {

    if (
        Number(
            enrollment.academicYear
        ) !==
        Number(
            config.academicYear
        )
    ) {

        return false;

    }


    return (

        enrollment.registeredSemester ===
            config.semester ||

        normalizeSemester(
            enrollment.semester
        ) === "通期"

    );

}


/* ========================================
   変更状態
======================================== */

function updateDirtyState() {

    pageDirty =
        !setsEqual(
            selectedIds,
            originalSelectedIds
        );

}


/* ========================================
   画面移動
======================================== */

function navigateWithUnsavedCheck(
    url
) {

    if (pageDirty) {

        const confirmed =
            confirm(
                "保存していない履修登録の変更があります。\n\n" +
                "変更を破棄して移動しますか？"
            );


        if (!confirmed) {
            return;
        }

    }


    pageDirty =
        false;


    if (url) {

        location.href =
            url;

    } else {

        history.back();

    }

}


/* ========================================
   モーダル
======================================== */

function openModal(
    modal
) {

    if (!modal) {
        return;
    }


    modal.hidden =
        false;


    document.body.classList.add(
        "admin-modal-open"
    );

}


function closeModal(
    modal
) {

    if (
        !modal ||
        modal.hidden
    ) {

        return;
    }


    modal.hidden =
        true;


    if (
        elements.confirmModal?.hidden &&
        elements.completeModal?.hidden
    ) {

        document.body.classList.remove(
            "admin-modal-open"
        );

    }

}


/* ========================================
   補助関数
======================================== */

async function safeGetDocs(
    reference
) {

    try {

        return await getDocs(
            reference
        );

    } catch (error) {

        console.warn(
            "任意コレクション取得エラー:",
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

        console.warn(
            "任意ドキュメント取得エラー:",
            error
        );

        return null;

    }

}


function sumSubjectCredits(
    subjectList
) {

    return subjectList.reduce(
        (
            total,
            subject
        ) =>
            total +
            toNonNegativeNumber(
                subject.credits
            ),
        0
    );

}


function sumObjectValues(
    object,
    field
) {

    return Object.values(
        object
    ).reduce(
        (
            total,
            item
        ) =>
            total +
            toNonNegativeNumber(
                item?.[field]
            ),
        0
    );

}


function addObjectNumber(
    object,
    key,
    value
) {

    object[key] =
        toNonNegativeNumber(
            object[key]
        ) +
        toNonNegativeNumber(
            value
        );

}


function getObjectNumber(
    object,
    key
) {

    return toNonNegativeNumber(
        object?.[key]
    );

}


function getLimitPercentage(
    value,
    limitValue
) {

    if (
        limitValue <= 0
    ) {

        return 0;

    }


    return Math.min(
        100,
        value /
        limitValue *
        100
    );

}


function setProgressWidth(
    element,
    percentage
) {

    if (!element) {
        return;
    }


    element.style.width =
        `${Math.max(
            0,
            Math.min(
                100,
                percentage
            )
        )}%`;

}


function normalizeGrade(
    value
) {

    return String(
        value ||
        ""
    )
    .replace(
        "年",
        ""
    )
    .trim();

}


function normalizeSemester(
    value
) {

    const semester =
        String(
            value ||
            ""
        ).trim();


    if (
        semester.includes(
            "通"
        )
    ) {

        return "通期";

    }


    if (
        semester.includes(
            "前"
        )
    ) {

        return "前期";

    }


    if (
        semester.includes(
            "後"
        )
    ) {

        return "後期";

    }


    return semester;

}


function normalizeStringArray(
    value
) {

    if (!Array.isArray(value)) {

        return [];

    }


    return [

        ...new Set(

            value
                .map(
                    item =>
                        String(
                            item
                        ).trim()
                )
                .filter(Boolean)

        )

    ];

}


function splitTags(
    value
) {

    if (Array.isArray(value)) {

        return normalizeStringArray(
            value
        );

    }


    return [

        ...new Set(

            String(
                value ||
                ""
            )
            .split(
                /[、,\n]/
            )
            .map(
                item =>
                    item.trim()
            )
            .filter(Boolean)

        )

    ];

}


function requirementTypeLabel(
    type
) {

    return {

        required:
            "必修",

        elective:
            "選択",

        free:
            "自由"

    }[type] || "未設定";

}


function compareCurricula(
    curriculumA,
    curriculumB
) {

    return (
        curriculumB.admissionYearFrom -
        curriculumA.admissionYearFrom
    );

}


function compareSubjects(
    subjectA,
    subjectB
) {

    const requirementOrder = {

        required:
            1,

        elective:
            2,

        free:
            3

    };


    const requirementA =
        requirementOrder[
            subjectA.requirementType
        ] || 99;


    const requirementB =
        requirementOrder[
            subjectB.requirementType
        ] || 99;


    if (
        requirementA !==
        requirementB
    ) {

        return requirementA -
            requirementB;

    }


    const categoryComparison =
        subjectA.category.localeCompare(
            subjectB.category,
            "ja"
        );


    if (
        categoryComparison !== 0
    ) {

        return categoryComparison;

    }


    return subjectA.name.localeCompare(
        subjectB.name,
        "ja"
    );

}


function setsEqual(
    setA,
    setB
) {

    if (
        setA.size !==
        setB.size
    ) {

        return false;

    }


    return [...setA].every(
        value =>
            setB.has(
                value
            )
    );

}


function toNonNegativeNumber(
    value
) {

    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(number) ||
        number < 0
    ) {

        return 0;

    }


    return number;

}


function formatCredit(
    value
) {

    const number =
        toNonNegativeNumber(
            value
        );


    return Number.isInteger(
        number
    )
        ? String(number)
        : number
            .toFixed(1)
            .replace(
                /\.0$/,
                ""
            );

}


function formatDateTime(
    value
) {

    const date =
        value instanceof Date
            ? value
            : new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "----";

    }


    return date.toLocaleString(
        "ja-JP",
        {
            month:
                "numeric",

            day:
                "numeric",

            hour:
                "2-digit",

            minute:
                "2-digit"
        }
    );

}


function toDate(
    value
) {

    if (!value) {
        return null;
    }


    try {

        const date =
            typeof value.toDate ===
                "function"
                ? value.toDate()
                : new Date(value);


        return Number.isNaN(
            date.getTime()
        )
            ? null
            : date;

    } catch {

        return null;

    }

}


function cssEscape(
    value
) {

    if (
        window.CSS &&
        typeof window.CSS.escape ===
            "function"
    ) {

        return window.CSS.escape(
            String(value)
        );

    }


    return String(value)
        .replace(
            /["\\]/g,
            "\\$&"
        );

}


function setText(
    element,
    value
) {

    if (!element) {
        return;
    }


    element.textContent =
        String(
            value ??
            ""
        );

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