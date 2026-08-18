import {
  db,
  studentNumber,
  setupTheme,
  initializePage,
  loadProfileImage,
  loadUserName,
  loadMyRanking,
  setupAdminTab,
  isAdmin,
  showToast,
  updateAssignmentNavBadge,
  updateShareNavBadge,
  updateNewsNavBadge,
} from "./common.js";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  deleteField,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

/* ========================================
   HTML要素
======================================== */

const userName = document.getElementById("userName");

const themeButton = document.getElementById("themeButton");

const profileButton = document.getElementById("profileButton");

const topProfileImage = document.getElementById("topProfileImage");

const backButton = document.getElementById("backButton");

const openSubjectsAdminButton = document.getElementById(
  "openSubjectsAdminButton",
);

const curriculumSelect = document.getElementById("curriculumSelect");

const createDefaultCurriculaButton = document.getElementById(
  "createDefaultCurriculaButton",
);

const addCurriculumButton = document.getElementById("addCurriculumButton");

const duplicateCurriculumButton = document.getElementById(
  "duplicateCurriculumButton",
);

const curriculumStatusBadge = document.getElementById("curriculumStatusBadge");

const curriculumUpdatedAt = document.getElementById("curriculumUpdatedAt");

const curriculumName = document.getElementById("curriculumName");

const curriculumId = document.getElementById("curriculumId");

const curriculumDepartment = document.getElementById("curriculumDepartment");

const curriculumMajor = document.getElementById("curriculumMajor");

const admissionYearFrom = document.getElementById("admissionYearFrom");

const admissionYearTo = document.getElementById("admissionYearTo");

const curriculumPublished = document.getElementById("curriculumPublished");

const graduationCredits = document.getElementById("graduationCredits");

const requiredCredits = document.getElementById("requiredCredits");

const electiveCreditsMinimum = document.getElementById(
  "electiveCreditsMinimum",
);

const addCategoryRequirementButton = document.getElementById(
  "addCategoryRequirementButton",
);

const categoryRequirementList = document.getElementById(
  "categoryRequirementList",
);

const addSpecialRequirementButton = document.getElementById(
  "addSpecialRequirementButton",
);

const specialRequirementList = document.getElementById(
  "specialRequirementList",
);

const integratedSubjectCount = document.getElementById(
  "integratedSubjectCount",
);

const calculatedTotalCredits = document.getElementById(
  "calculatedTotalCredits",
);

const calculatedRequiredCredits = document.getElementById(
  "calculatedRequiredCredits",
);

const calculatedElectiveCredits = document.getElementById(
  "calculatedElectiveCredits",
);

const unassignedSubjectCount = document.getElementById(
  "unassignedSubjectCount",
);

const incompleteCurriculumSubjectCount = document.getElementById(
  "incompleteCurriculumSubjectCount",
);

const curriculumWarningList = document.getElementById("curriculumWarningList");

const curriculumSubjectSearch = document.getElementById(
  "curriculumSubjectSearch",
);

const curriculumSubjectCategoryFilter = document.getElementById(
  "curriculumSubjectCategoryFilter",
);

const curriculumSubjectTypeFilter = document.getElementById(
  "curriculumSubjectTypeFilter",
);

const curriculumSubjectFilteredCount = document.getElementById(
  "curriculumSubjectFilteredCount",
);

const refreshCurriculumSubjectsButton = document.getElementById(
  "refreshCurriculumSubjectsButton",
);

const curriculumSubjectList = document.getElementById("curriculumSubjectList");

const previewCourseRegistrationButton = document.getElementById(
  "previewCourseRegistrationButton",
);

const previewCreditProgressButton = document.getElementById(
  "previewCreditProgressButton",
);

const curriculumUnsavedStatus = document.getElementById(
  "curriculumUnsavedStatus",
);

const saveCurriculumDraftButton = document.getElementById(
  "saveCurriculumDraftButton",
);

const publishCurriculumButton = document.getElementById(
  "publishCurriculumButton",
);

const deleteCurriculumButton = document.getElementById(
  "deleteCurriculumButton",
);

/* 新規作成モーダル */

const newCurriculumModal = document.getElementById("newCurriculumModal");

const newCurriculumId = document.getElementById("newCurriculumId");

const newCurriculumName = document.getElementById("newCurriculumName");

const cancelNewCurriculumButton = document.getElementById(
  "cancelNewCurriculumButton",
);

const confirmNewCurriculumButton = document.getElementById(
  "confirmNewCurriculumButton",
);

/* 削除確認モーダル */

const deleteCurriculumModal = document.getElementById("deleteCurriculumModal");

const deleteCurriculumName = document.getElementById("deleteCurriculumName");

const cancelDeleteCurriculumButton = document.getElementById(
  "cancelDeleteCurriculumButton",
);

const confirmDeleteCurriculumButton = document.getElementById(
  "confirmDeleteCurriculumButton",
);

/* ========================================
   学生便覧の初期カリキュラム
======================================== */

const HANDBOOK_DEFAULT_CURRICULA = [
  {
    curriculumId: "nursing_2024_plus",

    name: "看護学科 2024〜2025年度入学生",

    department: "看護学科",

    major: "",

    admissionYearFrom: 2024,

    admissionYearTo: 2025,

    graduationCredits: 126,

    requiredCredits: 106,

    electiveCreditsMinimum: 20,

    categoryRequirements: [
      {
        category: "総合教育科目",

        requiredCredits: 15,

        electiveCreditsMinimum: 16,

        totalCreditsMinimum: 31,
      },

      {
        category: "専門基礎科目",

        requiredCredits: 22,

        electiveCreditsMinimum: 2,

        totalCreditsMinimum: 24,
      },

      {
        category: "専門科目",

        requiredCredits: 69,

        electiveCreditsMinimum: 2,

        totalCreditsMinimum: 71,
      },
    ],

    specialRequirements: [],

    published: false,

    source: "2026_nursing_syllabus",

    sourceLabel: "2026年度シラバス 保健医療学部看護学科",

    sourceNote: "看護学科 2024〜2025年度入学生",
  },

  {
    curriculumId: "nursing_2026_plus",

    name: "看護学科 2026年度以降",

    department: "看護学科",

    major: "",

    admissionYearFrom: 2026,

    admissionYearTo: null,

    graduationCredits: 126,

    requiredCredits: 106,

    electiveCreditsMinimum: 20,

    categoryRequirements: [
      {
        category: "総合教育科目",

        requiredCredits: 15,

        electiveCreditsMinimum: 16,

        totalCreditsMinimum: 31,
      },

      {
        category: "専門基礎科目",

        requiredCredits: 22,

        electiveCreditsMinimum: 2,

        totalCreditsMinimum: 24,
      },

      {
        category: "専門科目",

        requiredCredits: 69,

        electiveCreditsMinimum: 2,

        totalCreditsMinimum: 71,
      },
    ],

    specialRequirements: [],

    published: false,

    source: "2026_nursing_syllabus",

    sourceLabel: "2026年度シラバス 保健医療学部看護学科",

    sourceNote: "看護学科 2026年度以降入学生",
  },

  {
    curriculumId: "pt_2020_plus",

    name: "理学療法学専攻 2020年度以降",

    department: "リハビリテーション学科",

    major: "理学療法学専攻",

    admissionYearFrom: 2020,

    admissionYearTo: null,

    graduationCredits: 127,

    requiredCredits: 108,

    electiveCreditsMinimum: 19,

    categoryRequirements: [
      {
        category: "総合教育科目",

        requiredCredits: 11,

        electiveCreditsMinimum: 16,

        totalCreditsMinimum: 27,
      },

      {
        category: "専門基礎科目",

        requiredCredits: 34,

        electiveCreditsMinimum: 0,

        totalCreditsMinimum: 34,
      },

      {
        category: "専門科目",

        requiredCredits: 63,

        electiveCreditsMinimum: 3,

        totalCreditsMinimum: 66,
      },
    ],

    specialRequirements: [
      {
        requirementTag: "専門共通",

        minimumCredits: 2,
      },

      {
        requirementTag: "地域理学療法学",

        minimumCredits: 1,
      },
    ],

    published: false,

    source: "2026_student_handbook",

    sourceLabel: "2026年度学生便覧 保健医療学部",

    sourceNote: "理学療法学専攻 2020年度以降入学生",
  },

  {
    curriculumId: "ot_2020_plus",

    name: "作業療法学専攻 2020年度以降",

    department: "リハビリテーション学科",

    major: "作業療法学専攻",

    admissionYearFrom: 2020,

    admissionYearTo: null,

    graduationCredits: 127,

    requiredCredits: 106,

    electiveCreditsMinimum: 21,

    categoryRequirements: [
      {
        category: "総合教育科目",

        requiredCredits: 11,

        electiveCreditsMinimum: 16,

        totalCreditsMinimum: 27,
      },

      {
        category: "専門基礎科目",

        requiredCredits: 34,

        electiveCreditsMinimum: 0,

        totalCreditsMinimum: 34,
      },

      {
        category: "専門科目",

        requiredCredits: 61,

        electiveCreditsMinimum: 5,

        totalCreditsMinimum: 66,
      },
    ],

    specialRequirements: [
      {
        requirementTag: "作業治療学",

        minimumCredits: 4,
      },

      {
        requirementTag: "専門共通",

        minimumCredits: 1,
      },
    ],

    published: false,

    source: "2026_student_handbook",

    sourceLabel: "2026年度学生便覧 保健医療学部",

    sourceNote: "作業療法学専攻 2020年度以降入学生",
  },
];

/* ========================================
   状態
======================================== */

let curricula = [];

let subjects = [];

let currentCurriculum = null;

let currentCurriculumId = "";

let categoryRequirements = [];

let specialRequirements = [];

let hasUnsavedChanges = false;

let newCurriculumMode = "create";

/* ========================================
   初期化
======================================== */

setupTheme(themeButton);

const admin = await isAdmin();

if (!admin) {
  alert("管理者のみアクセスできます。");

  location.href = "index.html";

  throw new Error("管理者権限がありません。");
}

await initializePage([
  setupAdminTab(),

  loadUserName(userName),

  loadMyRanking(),

  loadProfileImage(topProfileImage),

  updateAssignmentNavBadge(),

  updateShareNavBadge(),

  updateNewsNavBadge(),
]);

setupEvents();

await Promise.all([loadSubjects(), loadCurricula()]);

selectInitialCurriculum();

/* ========================================
   イベント設定
======================================== */

function setupEvents() {
  if (profileButton) {
    profileButton.onclick = () => {
      navigateWithUnsavedCheck("profile.html");
    };
  }

  if (backButton) {
    backButton.onclick = () => {
      navigateWithUnsavedCheck("admin.html");
    };
  }

  if (openSubjectsAdminButton) {
    openSubjectsAdminButton.onclick = openSubjectsAdmin;
  }

  if (curriculumSelect) {
    curriculumSelect.addEventListener("change", handleCurriculumSelection);
  }

  if (createDefaultCurriculaButton) {
    createDefaultCurriculaButton.onclick = createDefaultCurricula;
  }

  if (addCurriculumButton) {
    addCurriculumButton.onclick = openCreateCurriculumModal;
  }

  if (duplicateCurriculumButton) {
    duplicateCurriculumButton.onclick = openDuplicateCurriculumModal;
  }

  if (addCategoryRequirementButton) {
    addCategoryRequirementButton.onclick = addCategoryRequirement;
  }

  if (addSpecialRequirementButton) {
    addSpecialRequirementButton.onclick = addSpecialRequirement;
  }

  if (categoryRequirementList) {
    categoryRequirementList.addEventListener(
      "input",
      handleCategoryRequirementInput,
    );

    categoryRequirementList.addEventListener(
      "click",
      handleCategoryRequirementClick,
    );
  }

  if (specialRequirementList) {
    specialRequirementList.addEventListener(
      "input",
      handleSpecialRequirementInput,
    );

    specialRequirementList.addEventListener(
      "click",
      handleSpecialRequirementClick,
    );
  }

  const textAndNumberFields = [
    curriculumName,
    admissionYearFrom,
    admissionYearTo,
    graduationCredits,
    requiredCredits,
    electiveCreditsMinimum,
  ].filter(Boolean);

  textAndNumberFields.forEach((element) => {
    element.addEventListener("input", handleMainFormChange);
  });

  if (curriculumDepartment) {
    curriculumDepartment.addEventListener("change", () => {
      updateMajorAvailability();

      handleMainFormChange();
    });
  }

  if (curriculumMajor) {
    curriculumMajor.addEventListener("change", handleMainFormChange);
  }

  if (curriculumPublished) {
    curriculumPublished.addEventListener("change", handleMainFormChange);
  }

  /*
    renderSubjectListをそのままイベントへ渡すと、
    第1引数にEventが入り配列として扱われるため、
    必ず無名関数を挟む。
    */

  if (curriculumSubjectSearch) {
    curriculumSubjectSearch.addEventListener("input", () =>
      renderSubjectList(),
    );
  }

  if (curriculumSubjectCategoryFilter) {
    curriculumSubjectCategoryFilter.addEventListener("change", () =>
      renderSubjectList(),
    );
  }

  if (curriculumSubjectTypeFilter) {
    curriculumSubjectTypeFilter.addEventListener("change", () =>
      renderSubjectList(),
    );
  }

  if (refreshCurriculumSubjectsButton) {
    refreshCurriculumSubjectsButton.onclick = refreshSubjects;
  }

  if (curriculumSubjectList) {
    curriculumSubjectList.addEventListener("click", handleSubjectListClick);
  }

  if (previewCourseRegistrationButton) {
    previewCourseRegistrationButton.onclick = previewCourseRegistration;
  }

  if (previewCreditProgressButton) {
    previewCreditProgressButton.onclick = previewCreditProgress;
  }

  if (saveCurriculumDraftButton) {
    saveCurriculumDraftButton.onclick = () => {
      saveCurrentCurriculum(false);
    };
  }

  if (publishCurriculumButton) {
    publishCurriculumButton.onclick = () => {
      saveCurrentCurriculum(true);
    };
  }

  if (deleteCurriculumButton) {
    deleteCurriculumButton.onclick = openDeleteCurriculumModal;
  }

  if (cancelNewCurriculumButton) {
    cancelNewCurriculumButton.onclick = () => {
      closeModal(newCurriculumModal);
    };
  }

  if (confirmNewCurriculumButton) {
    confirmNewCurriculumButton.onclick = createOrDuplicateCurriculum;
  }

  if (cancelDeleteCurriculumButton) {
    cancelDeleteCurriculumButton.onclick = () => {
      closeModal(deleteCurriculumModal);
    };
  }

  if (confirmDeleteCurriculumButton) {
    confirmDeleteCurriculumButton.onclick = deleteSelectedCurriculum;
  }

  [newCurriculumModal, deleteCurriculumModal]
    .filter(Boolean)
    .forEach((modal) => {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) {
          closeModal(modal);
        }
      });
    });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    closeModal(newCurriculumModal);

    closeModal(deleteCurriculumModal);
  });

  window.addEventListener("beforeunload", (event) => {
    if (!hasUnsavedChanges) {
      return;
    }

    event.preventDefault();

    event.returnValue = "";
  });
}

/* ========================================
   初期選択
======================================== */

function selectInitialCurriculum(preferredCurriculumId = "") {
  const queryCurriculumId =
    new URLSearchParams(location.search).get("curriculumId") || "";

  const targetId = [
    preferredCurriculumId,
    currentCurriculumId,
    queryCurriculumId,
    curricula[0]?.curriculumId,
  ].find(
    (id) =>
      id && curricula.some((curriculum) => curriculum.curriculumId === id),
  );

  if (targetId) {
    selectCurriculum(targetId);

    return;
  }

  clearCurriculumForm();
}

/* ========================================
   カリキュラム取得
======================================== */

async function loadCurricula() {
  try {
    const snapshot = await getDocs(collection(db, "curricula"));

    curricula = snapshot.docs
      .map((curriculumDocument) =>
        normalizeCurriculum({
          ...curriculumDocument.data(),

          curriculumId: curriculumDocument.id,
        }),
      )
      .sort(compareCurricula);

    renderCurriculumSelect();
  } catch (error) {
    console.error("カリキュラム取得エラー:", error);

    curricula = [];

    renderCurriculumSelect();

    alert("カリキュラムを取得できませんでした。");
  }
}

/* ========================================
   カリキュラム正規化
======================================== */

function normalizeCurriculum(curriculum) {
  const draft =
    curriculum?.draft &&
    typeof curriculum.draft === "object" &&
    !Array.isArray(curriculum.draft)
      ? curriculum.draft
      : null;

  const editableData = draft
    ? {
        ...curriculum,
        ...draft,
      }
    : curriculum;

  return {
    curriculumId: String(curriculum.curriculumId || "").trim(),

    name: String(editableData.name || "").trim(),

    department: String(editableData.department || "").trim(),

    major: String(editableData.major || "").trim(),

    admissionYearFrom: toNonNegativeNumber(editableData.admissionYearFrom),

    admissionYearTo: editableData.admissionYearTo
      ? toNonNegativeNumber(editableData.admissionYearTo)
      : null,

    graduationCredits: toNonNegativeNumber(editableData.graduationCredits),

    requiredCredits: toNonNegativeNumber(editableData.requiredCredits),

    electiveCreditsMinimum: toNonNegativeNumber(
      editableData.electiveCreditsMinimum,
    ),

    categoryRequirements: Array.isArray(editableData.categoryRequirements)
      ? editableData.categoryRequirements.map(normalizeCategoryRequirement)
      : [],

    specialRequirements: Array.isArray(editableData.specialRequirements)
      ? editableData.specialRequirements.map(normalizeSpecialRequirement)
      : [],

    published: curriculum.published === true,

    hasDraft: draft !== null,

    source: String(editableData.source || ""),

    sourceLabel: String(editableData.sourceLabel || ""),

    sourceNote: String(editableData.sourceNote || ""),

    createdAt: curriculum.createdAt || null,

    updatedAt: curriculum.updatedAt || null,

    draftUpdatedAt: curriculum.draftUpdatedAt || null,

    publishedAt: curriculum.publishedAt || null,

    updatedBy: curriculum.updatedBy || "",
  };
}

function normalizeCategoryRequirement(requirement, index = 0) {
  return {
    localId: requirement.localId || createLocalId("category", index),

    category: String(requirement.category || "").trim(),

    requiredCredits: toNonNegativeNumber(requirement.requiredCredits),

    electiveCreditsMinimum: toNonNegativeNumber(
      requirement.electiveCreditsMinimum,
    ),

    totalCreditsMinimum: toNonNegativeNumber(requirement.totalCreditsMinimum),
  };
}

function normalizeSpecialRequirement(requirement, index = 0) {
  return {
    localId: requirement.localId || createLocalId("special", index),

    requirementTag: String(requirement.requirementTag || "").trim(),

    minimumCredits: toNonNegativeNumber(requirement.minimumCredits),
  };
}

/* ========================================
   カリキュラム選択欄
======================================== */

function renderCurriculumSelect() {
  if (!curriculumSelect) {
    return;
  }

  if (curricula.length === 0) {
    curriculumSelect.innerHTML = `

            <option value="">

                カリキュラムがありません

            </option>

        `;

    curriculumSelect.disabled = true;

    return;
  }

  curriculumSelect.disabled = false;

  curriculumSelect.innerHTML = curricula
    .map((curriculum) => {
      let statusLabel = "下書き";

      if (curriculum.published && curriculum.hasDraft) {
        statusLabel = "公開中・下書きあり";
      } else if (curriculum.published) {
        statusLabel = "公開中";
      } else if (curriculum.hasDraft) {
        statusLabel = "未公開・下書きあり";
      }

      return `

                        <option
                            value="${escapeAttribute(curriculum.curriculumId)}">

                            ${escapeHtml(curriculum.name)}

                            （${statusLabel}）

                        </option>

                    `;
    })
    .join("");
}

/* ========================================
   カリキュラム選択
======================================== */

function handleCurriculumSelection() {
  const selectedId = curriculumSelect?.value || "";

  if (hasUnsavedChanges && selectedId !== currentCurriculumId) {
    const discard = confirm(
      "保存していない変更があります。\n\n" +
        "変更を破棄して別のカリキュラムを開きますか？",
    );

    if (!discard) {
      curriculumSelect.value = currentCurriculumId;

      return;
    }
  }

  selectCurriculum(selectedId);
}

function selectCurriculum(selectedCurriculumId) {
  const selected = curricula.find(
    (curriculum) => curriculum.curriculumId === selectedCurriculumId,
  );

  if (!selected) {
    clearCurriculumForm();

    return;
  }

  currentCurriculumId = selected.curriculumId;

  currentCurriculum = normalizeCurriculum(selected);

  categoryRequirements = currentCurriculum.categoryRequirements.map(
    (requirement, index) => normalizeCategoryRequirement(requirement, index),
  );

  specialRequirements = currentCurriculum.specialRequirements.map(
    (requirement, index) => normalizeSpecialRequirement(requirement, index),
  );

  if (curriculumSelect) {
    curriculumSelect.value = currentCurriculumId;
  }

  fillCurriculumForm(currentCurriculum);

  renderCategoryRequirements();

  renderSpecialRequirements();

  updateMajorAvailability();

  updateCurriculumStatus();

  updateActionAvailability();

  analyzeCurriculum();

  setUnsavedState(false);

  const url = new URL(location.href);

  url.searchParams.set("curriculumId", currentCurriculumId);

  history.replaceState(null, "", url);
}

/* ========================================
   フォーム反映
======================================== */

function fillCurriculumForm(curriculum) {
  setInputValue(curriculumName, curriculum.name);

  setInputValue(curriculumId, curriculum.curriculumId);

  if (curriculumId) {
    curriculumId.readOnly = true;
  }

  setInputValue(curriculumDepartment, curriculum.department);

  setInputValue(curriculumMajor, curriculum.major);

  setInputValue(admissionYearFrom, curriculum.admissionYearFrom);

  setInputValue(admissionYearTo, curriculum.admissionYearTo ?? "");

  setChecked(curriculumPublished, curriculum.published);

  setInputValue(graduationCredits, curriculum.graduationCredits);

  setInputValue(requiredCredits, curriculum.requiredCredits);

  setInputValue(electiveCreditsMinimum, curriculum.electiveCreditsMinimum);
}

function clearCurriculumForm() {
  currentCurriculum = null;

  currentCurriculumId = "";

  categoryRequirements = [];

  specialRequirements = [];

  [
    curriculumName,
    curriculumId,
    curriculumDepartment,
    curriculumMajor,
    admissionYearFrom,
    admissionYearTo,
    graduationCredits,
    requiredCredits,
    electiveCreditsMinimum,
  ]
    .filter(Boolean)
    .forEach((element) => {
      element.value = "";
    });

  setChecked(curriculumPublished, false);

  if (categoryRequirementList) {
    categoryRequirementList.innerHTML = `

            <div class="curriculum-loading">

                カリキュラムを作成または選択してください。

            </div>

        `;
  }

  if (specialRequirementList) {
    specialRequirementList.innerHTML = `

            <div class="curriculum-empty">

                特別要件はありません。

            </div>

        `;
  }

  if (curriculumSubjectList) {
    curriculumSubjectList.innerHTML = `

            <div class="curriculum-loading">

                カリキュラムを選択してください。

            </div>

        `;
  }

  setText(curriculumStatusBadge, "未選択");

  setText(curriculumUpdatedAt, "最終更新：----");

  setText(curriculumSubjectFilteredCount, "0科目");

  updateAnalysisSummary({
    count: 0,

    total: 0,

    required: 0,

    elective: 0,

    unassigned: 0,

    incomplete: 0,
  });

  renderWarnings([
    {
      level: "info",

      message: "カリキュラムを作成または選択してください。",
    },
  ]);

  updateActionAvailability();

  setUnsavedState(false);
}

/* ========================================
   メインフォーム
======================================== */

function handleMainFormChange() {
  if (!currentCurriculumId) {
    return;
  }

  markUnsaved();

  analyzeCurriculum();
}

function updateMajorAvailability() {
  if (!curriculumMajor) {
    return;
  }

  const rehabilitation =
    curriculumDepartment?.value === "リハビリテーション学科";

  curriculumMajor.disabled = !rehabilitation;

  if (!rehabilitation) {
    curriculumMajor.value = "";
  }
}

function readCurriculumForm() {
  return {
    curriculumId: currentCurriculumId,

    name: curriculumName?.value.trim() || "",

    department: curriculumDepartment?.value || "",

    major: curriculumMajor?.value || "",

    admissionYearFrom: toNonNegativeNumber(admissionYearFrom?.value),

    admissionYearTo: admissionYearTo?.value
      ? toNonNegativeNumber(admissionYearTo.value)
      : null,

    graduationCredits: toNonNegativeNumber(graduationCredits?.value),

    requiredCredits: toNonNegativeNumber(requiredCredits?.value),

    electiveCreditsMinimum: toNonNegativeNumber(electiveCreditsMinimum?.value),

    categoryRequirements: categoryRequirements.map((requirement) => ({
      category: requirement.category,

      requiredCredits: requirement.requiredCredits,

      electiveCreditsMinimum: requirement.electiveCreditsMinimum,

      totalCreditsMinimum: requirement.totalCreditsMinimum,
    })),

    specialRequirements: specialRequirements.map((requirement) => ({
      requirementTag: requirement.requirementTag,

      minimumCredits: requirement.minimumCredits,
    })),

    source: currentCurriculum?.source || "",

    sourceLabel: currentCurriculum?.sourceLabel || "",

    sourceNote: currentCurriculum?.sourceNote || "",
  };
}

/* ========================================
   区分別要件
======================================== */

function renderCategoryRequirements() {
  if (!categoryRequirementList) {
    return;
  }

  if (categoryRequirements.length === 0) {
    categoryRequirementList.innerHTML = `

            <div class="curriculum-empty">

                区分別要件はありません。

            </div>

        `;

    return;
  }

  categoryRequirementList.innerHTML = categoryRequirements
    .map(createCategoryRequirementHtml)
    .join("");
}

function createCategoryRequirementHtml(requirement) {
  return `

        <div
            class="curriculum-requirement-row"
            data-local-id="${escapeAttribute(requirement.localId)}">


            <label class="curriculum-requirement-name">

                <span>
                    科目区分
                </span>

                <input
                    type="text"
                    data-field="category"
                    value="${escapeAttribute(requirement.category)}"
                    placeholder="総合教育科目">

            </label>


            <label>

                <span>
                    必修
                </span>

                <input
                    type="number"
                    min="0"
                    step="0.5"
                    data-field="requiredCredits"
                    value="${formatCredit(requirement.requiredCredits)}">

            </label>


            <label>

                <span>
                    選択以上
                </span>

                <input
                    type="number"
                    min="0"
                    step="0.5"
                    data-field="electiveCreditsMinimum"
                    value="${formatCredit(requirement.electiveCreditsMinimum)}">

            </label>


            <label>

                <span>
                    合計以上
                </span>

                <input
                    type="number"
                    min="0"
                    step="0.5"
                    data-field="totalCreditsMinimum"
                    value="${formatCredit(requirement.totalCreditsMinimum)}">

            </label>


            <button
                type="button"
                class="btn btn-danger curriculum-requirement-delete"
                data-action="delete-category">

                削除

            </button>

        </div>

    `;
}

function addCategoryRequirement() {
  if (!currentCurriculumId) {
    alert("先にカリキュラムを選択してください。");

    return;
  }

  categoryRequirements.push(
    normalizeCategoryRequirement(
      {
        category: "",

        requiredCredits: 0,

        electiveCreditsMinimum: 0,

        totalCreditsMinimum: 0,
      },
      categoryRequirements.length,
    ),
  );

  renderCategoryRequirements();

  markUnsaved();

  analyzeCurriculum();
}

function handleCategoryRequirementInput(event) {
  const field = event.target.dataset.field;

  if (!field) {
    return;
  }

  const row = event.target.closest(".curriculum-requirement-row");

  if (!row) {
    return;
  }

  const requirement = categoryRequirements.find(
    (item) => item.localId === row.dataset.localId,
  );

  if (!requirement) {
    return;
  }

  if (field === "category") {
    requirement.category = event.target.value.trim();
  } else {
    requirement[field] = toNonNegativeNumber(event.target.value);
  }

  markUnsaved();

  analyzeCurriculum();
}

function handleCategoryRequirementClick(event) {
  const deleteButton = event.target.closest('[data-action="delete-category"]');

  if (!deleteButton) {
    return;
  }

  const row = deleteButton.closest(".curriculum-requirement-row");

  if (!row) {
    return;
  }

  const confirmed = confirm("この区分別要件を削除しますか？");

  if (!confirmed) {
    return;
  }

  categoryRequirements = categoryRequirements.filter(
    (requirement) => requirement.localId !== row.dataset.localId,
  );

  renderCategoryRequirements();

  markUnsaved();

  analyzeCurriculum();
}

/* ========================================
   特別要件
======================================== */

function renderSpecialRequirements() {
  if (!specialRequirementList) {
    return;
  }

  if (specialRequirements.length === 0) {
    specialRequirementList.innerHTML = `

            <div class="curriculum-empty">

                特別要件はありません。

            </div>

        `;

    return;
  }

  specialRequirementList.innerHTML = specialRequirements
    .map(createSpecialRequirementHtml)
    .join("");
}

function createSpecialRequirementHtml(requirement) {
  return `

        <div
            class="curriculum-special-row"
            data-local-id="${escapeAttribute(requirement.localId)}">


            <label>

                <span>
                    要件タグ
                </span>

                <input
                    type="text"
                    data-field="requirementTag"
                    value="${escapeAttribute(requirement.requirementTag)}"
                    placeholder="専門共通">

            </label>


            <label>

                <span>
                    必要単位以上
                </span>

                <input
                    type="number"
                    min="0"
                    step="0.5"
                    data-field="minimumCredits"
                    value="${formatCredit(requirement.minimumCredits)}">

            </label>


            <button
                type="button"
                class="btn btn-danger"
                data-action="delete-special">

                削除

            </button>

        </div>

    `;
}

function addSpecialRequirement() {
  if (!currentCurriculumId) {
    alert("先にカリキュラムを選択してください。");

    return;
  }

  specialRequirements.push(
    normalizeSpecialRequirement(
      {
        requirementTag: "",

        minimumCredits: 0,
      },
      specialRequirements.length,
    ),
  );

  renderSpecialRequirements();

  markUnsaved();

  analyzeCurriculum();
}

function handleSpecialRequirementInput(event) {
  const field = event.target.dataset.field;

  if (!field) {
    return;
  }

  const row = event.target.closest(".curriculum-special-row");

  if (!row) {
    return;
  }

  const requirement = specialRequirements.find(
    (item) => item.localId === row.dataset.localId,
  );

  if (!requirement) {
    return;
  }

  if (field === "requirementTag") {
    requirement.requirementTag = event.target.value.trim();
  } else {
    requirement.minimumCredits = toNonNegativeNumber(event.target.value);
  }

  markUnsaved();

  analyzeCurriculum();
}

function handleSpecialRequirementClick(event) {
  const deleteButton = event.target.closest('[data-action="delete-special"]');

  if (!deleteButton) {
    return;
  }

  const row = deleteButton.closest(".curriculum-special-row");

  if (!row) {
    return;
  }

  const confirmed = confirm("この特別要件を削除しますか？");

  if (!confirmed) {
    return;
  }

  specialRequirements = specialRequirements.filter(
    (requirement) => requirement.localId !== row.dataset.localId,
  );

  renderSpecialRequirements();

  markUnsaved();

  analyzeCurriculum();
}

/* ========================================
   学生便覧初期データ
======================================== */

async function createDefaultCurricula() {
  const proceed = confirm(
    "学生便覧をもとに、次のカリキュラムを作成します。\n\n" +
      "・看護学科 2024年度以降\n" +
      "・理学療法学専攻 2020年度以降\n" +
      "・作業療法学専攻 2020年度以降\n\n" +
      "すでに存在するカリキュラムは上書きしません。",
  );

  if (!proceed) {
    return;
  }

  const originalText = createDefaultCurriculaButton.textContent;

  try {
    createDefaultCurriculaButton.disabled = true;

    createDefaultCurriculaButton.textContent = "作成中...";

    const existingSnapshots = await Promise.all(
      HANDBOOK_DEFAULT_CURRICULA.map((item) =>
        getDoc(doc(db, "curricula", item.curriculumId)),
      ),
    );

    const batch = writeBatch(db);

    let createdCount = 0;

    let firstCreatedId = "";

    HANDBOOK_DEFAULT_CURRICULA.forEach((item, index) => {
      if (existingSnapshots[index].exists()) {
        return;
      }

      const reference = doc(db, "curricula", item.curriculumId);

      batch.set(reference, {
        ...item,

        hasDraft: false,

        createdAt: serverTimestamp(),

        updatedAt: serverTimestamp(),

        updatedBy: studentNumber || "",
      });

      createdCount++;

      if (!firstCreatedId) {
        firstCreatedId = item.curriculumId;
      }
    });

    if (createdCount === 0) {
      showToast("初期カリキュラムはすでに作成されています");

      return;
    }

    await batch.commit();

    showToast(`${createdCount}件のカリキュラムを作成しました`);

    await reloadAllData(firstCreatedId);
  } catch (error) {
    console.error("初期カリキュラム作成エラー:", error);

    alert("初期カリキュラムを作成できませんでした。");
  } finally {
    createDefaultCurriculaButton.disabled = false;

    createDefaultCurriculaButton.textContent = originalText;
  }
}

/* ========================================
   新規作成・複製
======================================== */

function openCreateCurriculumModal() {
  newCurriculumMode = "create";

  setInputValue(newCurriculumId, "");

  setInputValue(newCurriculumName, "");

  openModal(newCurriculumModal);

  newCurriculumId?.focus();
}

function openDuplicateCurriculumModal() {
  if (!currentCurriculumId) {
    alert("複製するカリキュラムを選択してください。");

    return;
  }

  newCurriculumMode = "duplicate";

  setInputValue(newCurriculumId, currentCurriculumId + "_copy");

  setInputValue(
    newCurriculumName,
    (curriculumName?.value.trim() || currentCurriculum?.name || "") + " コピー",
  );

  openModal(newCurriculumModal);

  newCurriculumId?.focus();
}

async function createOrDuplicateCurriculum() {
  const id = newCurriculumId?.value.trim() || "";

  const name = newCurriculumName?.value.trim() || "";

  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    alert("カリキュラムIDは半角英数字・_・-で入力してください。");

    return;
  }

  if (!name) {
    alert("カリキュラム名を入力してください。");

    return;
  }

  const originalText = confirmNewCurriculumButton.textContent;

  try {
    confirmNewCurriculumButton.disabled = true;

    confirmNewCurriculumButton.textContent = "作成中...";

    const reference = doc(db, "curricula", id);

    const existingSnapshot = await getDoc(reference);

    if (existingSnapshot.exists()) {
      alert("同じカリキュラムIDがすでに存在します。");

      return;
    }

    let data;

    if (newCurriculumMode === "duplicate") {
      data = {
        ...readCurriculumForm(),

        curriculumId: id,

        name,

        published: false,

        hasDraft: false,
      };
    } else {
      data = {
        curriculumId: id,

        name,

        department: "",

        major: "",

        admissionYearFrom: new Date().getFullYear(),

        admissionYearTo: null,

        graduationCredits: 0,

        requiredCredits: 0,

        electiveCreditsMinimum: 0,

        categoryRequirements: [],

        specialRequirements: [],

        published: false,

        hasDraft: false,

        source: "manual",

        sourceLabel: "管理者作成",

        sourceNote: "",
      };
    }

    await setDoc(reference, {
      ...data,

      createdAt: serverTimestamp(),

      updatedAt: serverTimestamp(),

      updatedBy: studentNumber || "",
    });

    closeModal(newCurriculumModal);

    showToast("カリキュラムを作成しました");

    await reloadAllData(id);
  } catch (error) {
    console.error("カリキュラム作成エラー:", error);

    alert("カリキュラムを作成できませんでした。");
  } finally {
    confirmNewCurriculumButton.disabled = false;

    confirmNewCurriculumButton.textContent = originalText;
  }
}

/* ========================================
   保存・公開
======================================== */

async function saveCurrentCurriculum(publish) {
  if (!currentCurriculumId) {
    alert("保存するカリキュラムを選択してください。");

    return;
  }

  const data = readCurriculumForm();

  const validation = validateCurriculum(data);

  if (!validation.valid) {
    alert(validation.messages.join("\n"));

    return;
  }

  if (publish) {
    const analysis = createCurriculumAnalysis();

    const importantWarnings = analysis.warnings.filter(
      (warning) => warning.level === "error" || warning.level === "warning",
    );

    const warningText = importantWarnings
      .slice(0, 8)
      .map((warning) => `・${warning.message}`)
      .join("\n");

    const message =
      importantWarnings.length > 0
        ? "確認が必要な項目があります。\n\n" +
          warningText +
          "\n\nこの状態で学生側へ公開しますか？"
        : "このカリキュラムを学生側へ公開しますか？";

    if (!confirm(message)) {
      return;
    }
  }

  const button = publish ? publishCurriculumButton : saveCurriculumDraftButton;

  const originalText = button.textContent;

  try {
    button.disabled = true;

    button.textContent = "保存中...";

    const reference = doc(db, "curricula", currentCurriculumId);

    if (publish) {
      await setDoc(
        reference,
        {
          ...data,

          published: true,

          hasDraft: false,

          draft: deleteField(),

          draftUpdatedAt: deleteField(),

          publishedAt: serverTimestamp(),

          updatedAt: serverTimestamp(),

          updatedBy: studentNumber || "",
        },
        {
          merge: true,
        },
      );

      setChecked(curriculumPublished, true);

      showToast("カリキュラムを公開しました");
    } else {
      /*
            公開済みカリキュラムは公開内容を残したまま
            draftへ編集内容を保存する。

            公開チェックを外した状態で保存した場合だけ
            学生側を非公開にする。
            */

      const keepPublished =
        currentCurriculum?.published === true &&
        curriculumPublished?.checked === true;

      await setDoc(
        reference,
        {
          draft: data,

          hasDraft: true,

          published: keepPublished,

          draftUpdatedAt: serverTimestamp(),

          updatedBy: studentNumber || "",
        },
        {
          merge: true,
        },
      );

      showToast(
        keepPublished
          ? "公開内容を維持して下書きを保存しました"
          : "下書きを保存しました",
      );
    }

    setUnsavedState(false);

    await reloadAllData(currentCurriculumId);
  } catch (error) {
    console.error("カリキュラム保存エラー:", error);

    alert("カリキュラムを保存できませんでした。");
  } finally {
    button.disabled = false;

    button.textContent = originalText;
  }
}

/* ========================================
   入力チェック
======================================== */

function validateCurriculum(curriculum) {
  const messages = [];

  if (!curriculum.name) {
    messages.push("カリキュラム名を入力してください。");
  }

  if (!curriculum.department) {
    messages.push("学科を選択してください。");
  }

  if (curriculum.department === "リハビリテーション学科" && !curriculum.major) {
    messages.push("理学療法学専攻または作業療法学専攻を選択してください。");
  }

  if (curriculum.department === "看護学科" && curriculum.major) {
    messages.push("看護学科では専攻を設定しないでください。");
  }

  if (curriculum.admissionYearFrom < 2000) {
    messages.push("入学年度の開始年を入力してください。");
  }

  if (
    curriculum.admissionYearTo &&
    curriculum.admissionYearTo < curriculum.admissionYearFrom
  ) {
    messages.push("入学年度の終了年は開始年以降にしてください。");
  }

  if (curriculum.graduationCredits <= 0) {
    messages.push("卒業必要単位を入力してください。");
  }

  if (curriculum.requiredCredits > curriculum.graduationCredits) {
    messages.push("必修必要単位が卒業必要単位を超えています。");
  }

  if (
    curriculum.requiredCredits + curriculum.electiveCreditsMinimum >
    curriculum.graduationCredits
  ) {
    messages.push(
      "必修必要単位と選択必要単位の合計が、卒業必要単位を超えています。",
    );
  }

  const emptyCategories = curriculum.categoryRequirements.filter(
    (requirement) => !requirement.category,
  );

  if (emptyCategories.length > 0) {
    messages.push(
      `科目区分名が未入力の項目が${emptyCategories.length}件あります。`,
    );
  }

  const categoryNames = curriculum.categoryRequirements
    .map((requirement) => requirement.category)
    .filter(Boolean);

  const duplicateCategoryNames = categoryNames.filter(
    (value, index, array) => array.indexOf(value) !== index,
  );

  if (duplicateCategoryNames.length > 0) {
    messages.push("科目区分が重複しています。");
  }

  const invalidCategories = curriculum.categoryRequirements.filter(
    (requirement) =>
      requirement.requiredCredits + requirement.electiveCreditsMinimum >
      requirement.totalCreditsMinimum,
  );

  if (invalidCategories.length > 0) {
    messages.push(
      "区分別要件で、必修と選択の合計が区分合計を超えている項目があります。",
    );
  }

  const emptySpecialRequirements = curriculum.specialRequirements.filter(
    (requirement) => !requirement.requirementTag,
  );

  if (emptySpecialRequirements.length > 0) {
    messages.push(
      `要件タグが未入力の項目が${emptySpecialRequirements.length}件あります。`,
    );
  }

  return {
    valid: messages.length === 0,

    messages,
  };
}

/* ========================================
   削除
======================================== */

function openDeleteCurriculumModal() {
  if (!currentCurriculumId) {
    alert("削除するカリキュラムを選択してください。");

    return;
  }

  setText(
    deleteCurriculumName,
    curriculumName?.value.trim() ||
      currentCurriculum?.name ||
      currentCurriculumId,
  );

  openModal(deleteCurriculumModal);
}

async function deleteSelectedCurriculum() {
  if (!currentCurriculumId) {
    return;
  }

  const deletedId = currentCurriculumId;

  const originalText = confirmDeleteCurriculumButton.textContent;

  try {
    confirmDeleteCurriculumButton.disabled = true;

    confirmDeleteCurriculumButton.textContent = "削除中...";

    await deleteDoc(doc(db, "curricula", deletedId));

    closeModal(deleteCurriculumModal);

    currentCurriculum = null;

    currentCurriculumId = "";

    setUnsavedState(false);

    showToast("カリキュラムを削除しました");

    await reloadAllData();
  } catch (error) {
    console.error("カリキュラム削除エラー:", error);

    alert("カリキュラムを削除できませんでした。");
  } finally {
    confirmDeleteCurriculumButton.disabled = false;

    confirmDeleteCurriculumButton.textContent = originalText;
  }
}

/* ========================================
   科目取得
======================================== */

async function loadSubjects() {
  try {
    const snapshot = await getDocs(collection(db, "subjects"));

    subjects = snapshot.docs
      .map((subjectDocument) =>
        normalizeSubject({
          ...subjectDocument.data(),

          firestoreId: subjectDocument.id,
        }),
      )
      .sort(compareSubjects);
  } catch (error) {
    console.error("科目取得エラー:", error);

    subjects = [];

    renderWarnings([
      {
        level: "error",

        message: "subjectsコレクションを取得できませんでした。",
      },
    ]);
  }
}

/* ========================================
   科目正規化
======================================== */

function normalizeSubject(subject) {
  let requirementType = String(subject.requirementType || "").trim();

  if (!requirementType) {
    if (subject.required === true) {
      requirementType = "required";
    } else if (subject.required === false) {
      requirementType = "elective";
    }
  }

  const curriculumIds = Array.isArray(subject.curriculumIds)
    ? normalizeStringArray(subject.curriculumIds)
    : [];

  if (
    subject.curriculumId &&
    !curriculumIds.includes(String(subject.curriculumId))
  ) {
    curriculumIds.push(String(subject.curriculumId));
  }

  let department = String(subject.department || "").trim();

  let major = String(subject.major || "").trim();

  if (department === "理学療法学専攻") {
    department = "リハビリテーション学科";

    major = "理学療法学専攻";
  }

  if (department === "作業療法学専攻") {
    department = "リハビリテーション学科";

    major = "作業療法学専攻";
  }

  return {
    firestoreId: String(subject.firestoreId || ""),

    name: String(subject.name || "").trim(),

    subjectKey: String(subject.subjectKey || subject.name || "").trim(),

    department,

    major,

    curriculumIds: normalizeStringArray(curriculumIds),

    category: String(
      subject.category ||
        subject.subjectCategory ||
        subject.courseCategory ||
        "",
    ).trim(),

    subcategory: String(
      subject.subcategory || subject.subCategory || "",
    ).trim(),

    requirementType,

    requirementTags: Array.isArray(subject.requirementTags)
      ? normalizeStringArray(subject.requirementTags)
      : splitTags(subject.requirementTags || subject.requirementTag || ""),

    grade: String(subject.grade || "")
      .replace("年", "")
      .trim(),

    semester: normalizeSemester(subject.semester),

    credits: toNonNegativeNumber(subject.credits),

    lectureCount: toNonNegativeNumber(subject.lectureCount),

    isPractical: subject.isPractical === true,

    active: subject.active !== false,
  };
}

/* ========================================
   カリキュラム対象科目
======================================== */

function getCurriculumSubjects() {
  if (!currentCurriculumId) {
    return [];
  }

  const curriculum = readCurriculumForm();

  return subjects
    .map((subject) => {
      const matchType = getSubjectMatchType(subject, curriculum);

      if (!matchType) {
        return null;
      }

      return {
        ...subject,

        matchType,
      };
    })
    .filter(Boolean);
}

function getSubjectMatchType(subject, curriculum) {
  if (subject.curriculumIds.length > 0) {
    return subject.curriculumIds.includes(curriculum.curriculumId)
      ? "explicit"
      : "";
  }

  if (curriculum.major) {
    if (subject.major === curriculum.major) {
      return "legacy";
    }

    if (subject.department === curriculum.major) {
      return "legacy";
    }

    return "";
  }

  return subject.department === curriculum.department ? "legacy" : "";
}

/* ========================================
   自動分析
======================================== */

function analyzeCurriculum() {
  if (!currentCurriculumId) {
    return;
  }

  const analysis = createCurriculumAnalysis();

  updateAnalysisSummary(analysis.summary);

  renderWarnings(analysis.warnings);

  updateCategoryFilter(analysis.subjects);

  renderSubjectList(analysis.subjects);

  updateActionAvailability();
}

function createCurriculumAnalysis() {
  const curriculum = readCurriculumForm();

  const matchedSubjects = getCurriculumSubjects();

  /*
    非公開科目は一覧には出すが、
    学生が履修できないため単位計算には含めない。
    */

  const countedSubjects = matchedSubjects.filter((subject) => subject.active);

  const total = sumCredits(countedSubjects);

  const required = sumCredits(
    countedSubjects.filter((subject) => subject.requirementType === "required"),
  );

  const elective = sumCredits(
    countedSubjects.filter((subject) => subject.requirementType === "elective"),
  );

  const unassigned = matchedSubjects.filter(
    (subject) => !subject.category,
  ).length;

  const incomplete = matchedSubjects.filter(isSubjectIncomplete).length;

  const legacyCount = matchedSubjects.filter(
    (subject) => subject.matchType === "legacy",
  ).length;

  const inactiveCount = matchedSubjects.filter(
    (subject) => !subject.active,
  ).length;

  const warnings = [];

  if (matchedSubjects.length === 0) {
    warnings.push({
      level: "error",

      message: "このカリキュラムに対応する科目がありません。",
    });
  }

  if (legacyCount > 0) {
    warnings.push({
      level: "warning",

      message: `${legacyCount}科目はカリキュラムID未設定のため、学科・専攻で仮照合しています。`,
    });
  }

  if (inactiveCount > 0) {
    warnings.push({
      level: "info",

      message: `${inactiveCount}科目は非公開のため、登録可能単位の集計から除外しています。`,
    });
  }

  if (unassigned > 0) {
    warnings.push({
      level: "warning",

      message: `科目区分が未設定の科目が${unassigned}件あります。`,
    });
  }

  if (incomplete > 0) {
    warnings.push({
      level: "warning",

      message: `カリキュラム判定に必要な情報が不足している科目が${incomplete}件あります。`,
    });
  }

  if (total < curriculum.graduationCredits) {
    warnings.push({
      level: "error",

      message: `登録可能な科目の単位合計が、卒業要件より${formatCredit(
        curriculum.graduationCredits - total,
      )}単位不足しています。`,
    });
  }

  if (required < curriculum.requiredCredits) {
    warnings.push({
      level: "error",

      message: `必修科目の登録単位が${formatCredit(
        curriculum.requiredCredits - required,
      )}単位不足しています。`,
    });
  }

  if (elective < curriculum.electiveCreditsMinimum) {
    warnings.push({
      level: "warning",

      message: `選択科目の登録単位が最低要件より${formatCredit(
        curriculum.electiveCreditsMinimum - elective,
      )}単位少なくなっています。`,
    });
  }

  curriculum.categoryRequirements.forEach((requirement) => {
    if (!requirement.category) {
      return;
    }

    const categorySubjects = countedSubjects.filter(
      (subject) => subject.category === requirement.category,
    );

    const categoryRequired = sumCredits(
      categorySubjects.filter(
        (subject) => subject.requirementType === "required",
      ),
    );

    const categoryElective = sumCredits(
      categorySubjects.filter(
        (subject) => subject.requirementType === "elective",
      ),
    );

    const categoryTotal = sumCredits(categorySubjects);

    if (categoryRequired < requirement.requiredCredits) {
      warnings.push({
        level: "error",

        message: `${requirement.category}の必修科目が${formatCredit(
          requirement.requiredCredits - categoryRequired,
        )}単位不足しています。`,
      });
    }

    if (categoryElective < requirement.electiveCreditsMinimum) {
      warnings.push({
        level: "warning",

        message: `${requirement.category}の選択科目が${formatCredit(
          requirement.electiveCreditsMinimum - categoryElective,
        )}単位不足しています。`,
      });
    }

    if (categoryTotal < requirement.totalCreditsMinimum) {
      warnings.push({
        level: "error",

        message: `${requirement.category}の科目合計が${formatCredit(
          requirement.totalCreditsMinimum - categoryTotal,
        )}単位不足しています。`,
      });
    }
  });

  curriculum.specialRequirements.forEach((requirement) => {
    if (!requirement.requirementTag) {
      return;
    }

    const taggedSubjects = countedSubjects.filter(
      (subject) =>
        subject.requirementTags.includes(requirement.requirementTag) ||
        subject.subcategory === requirement.requirementTag,
    );

    const taggedCredits = sumCredits(taggedSubjects);

    if (taggedCredits < requirement.minimumCredits) {
      warnings.push({
        level: "error",

        message: `${requirement.requirementTag}の科目が${formatCredit(
          requirement.minimumCredits - taggedCredits,
        )}単位不足しています。`,
      });
    }
  });

  const categoryRequiredTotal = curriculum.categoryRequirements.reduce(
    (sum, requirement) => sum + requirement.requiredCredits,
    0,
  );

  const categoryTotalMinimum = curriculum.categoryRequirements.reduce(
    (sum, requirement) => sum + requirement.totalCreditsMinimum,
    0,
  );

  if (
    curriculum.categoryRequirements.length > 0 &&
    categoryRequiredTotal !== curriculum.requiredCredits
  ) {
    warnings.push({
      level: "warning",

      message: `区分別必修単位の合計${formatCredit(
        categoryRequiredTotal,
      )}単位と、全体の必修必要単位${formatCredit(
        curriculum.requiredCredits,
      )}単位が一致していません。`,
    });
  }

  if (
    curriculum.categoryRequirements.length > 0 &&
    categoryTotalMinimum !== curriculum.graduationCredits
  ) {
    warnings.push({
      level: "warning",

      message: `区分別要件の合計${formatCredit(
        categoryTotalMinimum,
      )}単位と、卒業必要単位${formatCredit(
        curriculum.graduationCredits,
      )}単位が一致していません。`,
    });
  }

  const duplicateKeys = findDuplicateSubjectKeys(matchedSubjects);

  if (duplicateKeys.length > 0) {
    warnings.push({
      level: "warning",

      message: `subjectKeyが重複しています：${duplicateKeys.join("、")}`,
    });
  }

  const overlappingCurricula = findOverlappingCurricula(curriculum);

  if (overlappingCurricula.length > 0) {
    warnings.push({
      level: "warning",

      message: `対象入学年度が重複しています：${overlappingCurricula.join(
        "、",
      )}`,
    });
  }

  if (warnings.length === 0) {
    warnings.push({
      level: "success",

      message:
        "現在確認できる範囲では、卒業要件と科目情報の不一致はありません。",
    });
  }

  return {
    curriculum,

    subjects: matchedSubjects,

    countedSubjects,

    warnings,

    summary: {
      count: matchedSubjects.length,

      total,

      required,

      elective,

      unassigned,

      incomplete,

      legacyCount,

      inactiveCount,
    },
  };
}

/* ========================================
   分析数値表示
======================================== */

function updateAnalysisSummary(summary) {
  setText(integratedSubjectCount, summary.count);

  setText(calculatedTotalCredits, formatCredit(summary.total));

  setText(calculatedRequiredCredits, formatCredit(summary.required));

  setText(calculatedElectiveCredits, formatCredit(summary.elective));

  setText(unassignedSubjectCount, summary.unassigned);

  setText(incompleteCurriculumSubjectCount, summary.incomplete);
}

/* ========================================
   警告表示
======================================== */

function renderWarnings(warnings) {
  if (!curriculumWarningList) {
    return;
  }

  curriculumWarningList.innerHTML = warnings
    .map((warning) => {
      const icon =
        {
          success: "✅",

          info: "ℹ️",

          warning: "⚠️",

          error: "🚨",
        }[warning.level] || "ℹ️";

      return `

                        <div
                            class="
                                curriculum-warning-item
                                is-${escapeAttribute(warning.level)}
                            ">

                            <span class="curriculum-warning-icon">

                                ${icon}

                            </span>

                            <span>

                                ${escapeHtml(warning.message)}

                            </span>

                        </div>

                    `;
    })
    .join("");
}

/* ========================================
   科目区分フィルター
======================================== */

function updateCategoryFilter(matchedSubjects) {
  if (!curriculumSubjectCategoryFilter) {
    return;
  }

  const currentValue = curriculumSubjectCategoryFilter.value;

  const categories = new Set();

  categoryRequirements.forEach((requirement) => {
    if (requirement.category) {
      categories.add(requirement.category);
    }
  });

  matchedSubjects.forEach((subject) => {
    if (subject.category) {
      categories.add(subject.category);
    }
  });

  curriculumSubjectCategoryFilter.innerHTML = `

        <option value="">

            すべての区分

        </option>

        <option value="__unset__">

            区分未設定

        </option>

        ${[...categories]
          .sort((categoryA, categoryB) =>
            categoryA.localeCompare(categoryB, "ja"),
          )
          .map(
            (category) => `

                        <option
                            value="${escapeAttribute(category)}">

                            ${escapeHtml(category)}

                        </option>

                    `,
          )
          .join("")}

    `;

  const exists = Array.from(curriculumSubjectCategoryFilter.options).some(
    (option) => option.value === currentValue,
  );

  if (exists) {
    curriculumSubjectCategoryFilter.value = currentValue;
  }
}

/* ========================================
   対象科目一覧
======================================== */

function renderSubjectList(suppliedSubjects = null) {
  if (!curriculumSubjectList) {
    return;
  }

  if (!currentCurriculumId) {
    curriculumSubjectList.innerHTML = `

            <div class="curriculum-loading">

                カリキュラムを選択してください。

            </div>

        `;

    setText(curriculumSubjectFilteredCount, "0科目");

    return;
  }

  const matchedSubjects = Array.isArray(suppliedSubjects)
    ? suppliedSubjects
    : getCurriculumSubjects();

  const keyword = String(curriculumSubjectSearch?.value || "")
    .trim()
    .toLowerCase();

  const categoryFilter = curriculumSubjectCategoryFilter?.value || "";

  const typeFilter = curriculumSubjectTypeFilter?.value || "";

  const filteredSubjects = matchedSubjects.filter((subject) => {
    if (keyword) {
      const searchTarget = (
        `${subject.name} ` +
        `${subject.subjectKey} ` +
        `${subject.category} ` +
        `${subject.subcategory} ` +
        `${subject.requirementTags.join(" ")}`
      ).toLowerCase();

      if (!searchTarget.includes(keyword)) {
        return false;
      }
    }

    if (categoryFilter === "__unset__" && subject.category) {
      return false;
    }

    if (
      categoryFilter &&
      categoryFilter !== "__unset__" &&
      subject.category !== categoryFilter
    ) {
      return false;
    }

    if (typeFilter === "unset" && subject.requirementType) {
      return false;
    }

    if (
      typeFilter &&
      typeFilter !== "unset" &&
      subject.requirementType !== typeFilter
    ) {
      return false;
    }

    return true;
  });

  setText(curriculumSubjectFilteredCount, `${filteredSubjects.length}科目`);

  if (filteredSubjects.length === 0) {
    curriculumSubjectList.innerHTML = `

            <div class="curriculum-empty">

                条件に一致する科目はありません。

            </div>

        `;

    return;
  }

  curriculumSubjectList.innerHTML = filteredSubjects
    .map(createCurriculumSubjectHtml)
    .join("");
}

/* ========================================
   科目カード
======================================== */

function createCurriculumSubjectHtml(subject) {
  const typeLabel =
    {
      required: "必修",

      elective: "選択",

      free: "自由",
    }[subject.requirementType] || "未設定";

  const typeClass = subject.requirementType || "unset";

  const incomplete = isSubjectIncomplete(subject);

  return `

        <article
            class="
                curriculum-subject-item
                ${incomplete ? "has-warning" : ""}
            ">


            <div class="curriculum-subject-heading">

                <div>

                    <h3>

                        ${escapeHtml(subject.name || "科目名未設定")}

                    </h3>

                    <small>

                        ${escapeHtml(subject.subjectKey || "subjectKey未設定")}

                    </small>

                </div>


                <span
                    class="
                        curriculum-subject-type
                        is-${escapeAttribute(typeClass)}
                    ">

                    ${typeLabel}

                </span>

            </div>


            <div class="curriculum-subject-meta">

                <span>

                    🧩
                    ${escapeHtml(subject.category) || "区分未設定"}

                </span>

                ${
                  subject.subcategory
                    ? `

                            <span>

                                🏷️
                                ${escapeHtml(subject.subcategory)}

                            </span>

                        `
                    : ""
                }

                <span>

                    🎓
                    ${
                      subject.grade
                        ? `${escapeHtml(subject.grade)}年`
                        : "学年未設定"
                    }

                </span>

                <span>

                    📅
                    ${escapeHtml(subject.semester) || "学期未設定"}

                </span>

                <span>

                    📘
                    ${formatCredit(subject.credits)}単位

                </span>

                ${
                  subject.isPractical
                    ? `

                            <span>

                                🏥 実習科目

                            </span>

                        `
                    : ""
                }

                ${
                  !subject.active
                    ? `

                            <span>

                                🚫 非公開

                            </span>

                        `
                    : ""
                }

            </div>


            ${
              subject.requirementTags.length > 0
                ? `

                        <div class="curriculum-subject-tags">

                            ${subject.requirementTags
                              .map(
                                (tag) => `

                                            <span>

                                                ${escapeHtml(tag)}

                                            </span>

                                        `,
                              )
                              .join("")}

                        </div>

                    `
                : ""
            }


            ${
              subject.matchType === "legacy"
                ? `

                        <div class="curriculum-subject-notice">

                            ⚠️ カリキュラムID未設定のため、
                            学科・専攻で仮照合しています

                        </div>

                    `
                : `

                        <div class="curriculum-subject-connected">

                            ✅ カリキュラムと接続済み

                        </div>

                    `
            }


            ${
              incomplete
                ? `

                        <div class="curriculum-subject-notice">

                            ⚠️ 科目情報に未設定項目があります

                        </div>

                    `
                : ""
            }


            <button
                type="button"
                class="btn curriculum-edit-subject-button"
                data-subject-key="${escapeAttribute(subject.subjectKey)}">

                履修科目管理で編集

            </button>

        </article>

    `;
}

/* ========================================
   科目カード操作
======================================== */

function handleSubjectListClick(event) {
  const button = event.target.closest(".curriculum-edit-subject-button");

  if (!button) {
    return;
  }

  const parameters = new URLSearchParams();

  parameters.set("curriculumId", currentCurriculumId);

  if (button.dataset.subjectKey) {
    parameters.set("subjectKey", button.dataset.subjectKey);
  }

  navigateWithUnsavedCheck("subjects_admin.html?" + parameters.toString());
}

/* ========================================
   再読み込み
======================================== */

async function refreshSubjects() {
  if (!refreshCurriculumSubjectsButton) {
    return;
  }

  const originalText = refreshCurriculumSubjectsButton.textContent;

  try {
    refreshCurriculumSubjectsButton.disabled = true;

    refreshCurriculumSubjectsButton.textContent = "再読み込み中...";

    await loadSubjects();

    analyzeCurriculum();

    showToast("科目情報を再読み込みしました");
  } finally {
    refreshCurriculumSubjectsButton.disabled = false;

    refreshCurriculumSubjectsButton.textContent = originalText;
  }
}

/* ========================================
   学生画面プレビュー
======================================== */

function previewCourseRegistration() {
  if (!currentCurriculumId) {
    alert("カリキュラムを選択してください。");

    return;
  }

  const parameters = new URLSearchParams({
    preview: "1",

    curriculumId: currentCurriculumId,
  });

  window.open("course_registration.html?" + parameters.toString(), "_blank");
}

function previewCreditProgress() {
  if (!currentCurriculumId) {
    alert("カリキュラムを選択してください。");

    return;
  }

  const parameters = new URLSearchParams({
    preview: "1",

    creditPanel: "1",

    curriculumId: currentCurriculumId,
  });

  window.open("course_registration.html?" + parameters.toString(), "_blank");
}

/* ========================================
   公開・下書き状態
======================================== */

function updateCurriculumStatus() {
  if (!currentCurriculum) {
    return;
  }

  let statusText = "下書き";

  if (currentCurriculum.published && currentCurriculum.hasDraft) {
    statusText = "公開中・下書きあり";
  } else if (currentCurriculum.published) {
    statusText = "公開中";
  } else if (currentCurriculum.hasDraft) {
    statusText = "未公開・下書きあり";
  }

  setText(curriculumStatusBadge, statusText);

  curriculumStatusBadge?.classList.toggle(
    "is-published",
    currentCurriculum.published,
  );

  curriculumStatusBadge?.classList.toggle(
    "is-draft",
    !currentCurriculum.published || currentCurriculum.hasDraft,
  );

  const updatedValue = currentCurriculum.hasDraft
    ? currentCurriculum.draftUpdatedAt
    : currentCurriculum.updatedAt;

  setText(curriculumUpdatedAt, `最終更新：${formatDate(updatedValue)}`);
}

/* ========================================
   未保存状態
======================================== */

function markUnsaved() {
  setUnsavedState(true);
}

function setUnsavedState(unsaved) {
  hasUnsavedChanges = unsaved;

  setText(
    curriculumUnsavedStatus,
    unsaved ? "未保存の変更があります" : "変更なし",
  );

  curriculumUnsavedStatus?.classList.toggle("has-unsaved", unsaved);
}

/* ========================================
   操作可否
======================================== */

function updateActionAvailability() {
  const available = Boolean(currentCurriculumId);

  [
    duplicateCurriculumButton,
    addCategoryRequirementButton,
    addSpecialRequirementButton,
    saveCurriculumDraftButton,
    publishCurriculumButton,
    deleteCurriculumButton,
    previewCourseRegistrationButton,
    previewCreditProgressButton,
  ]
    .filter(Boolean)
    .forEach((button) => {
      button.disabled = !available;
    });
}

/* ========================================
   全データ再読込
======================================== */

async function reloadAllData(preferredCurriculumId = "") {
  await Promise.all([loadSubjects(), loadCurricula()]);

  selectInitialCurriculum(preferredCurriculumId);
}

/* ========================================
   科目分析補助
======================================== */

function isSubjectIncomplete(subject) {
  return (
    !subject.name ||
    !subject.subjectKey ||
    !subject.category ||
    !subject.requirementType ||
    subject.credits <= 0
  );
}

function sumCredits(subjectList) {
  return subjectList.reduce(
    (total, subject) => total + toNonNegativeNumber(subject.credits),
    0,
  );
}

function findDuplicateSubjectKeys(subjectList) {
  const counts = new Map();

  subjectList.forEach((subject) => {
    const key = subject.subjectKey.trim();

    if (!key) {
      return;
    }

    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
}

function findOverlappingCurricula(curriculum) {
  return curricula
    .filter((other) => {
      if (other.curriculumId === curriculum.curriculumId) {
        return false;
      }

      if (other.department !== curriculum.department) {
        return false;
      }

      if (other.major !== curriculum.major) {
        return false;
      }

      return rangesOverlap(
        curriculum.admissionYearFrom,

        curriculum.admissionYearTo,

        other.admissionYearFrom,

        other.admissionYearTo,
      );
    })
    .map((other) => other.name || other.curriculumId);
}

function rangesOverlap(startA, endA, startB, endB) {
  const normalizedEndA = endA || Number.MAX_SAFE_INTEGER;

  const normalizedEndB = endB || Number.MAX_SAFE_INTEGER;

  return startA <= normalizedEndB && startB <= normalizedEndA;
}

/* ========================================
   並び替え
======================================== */

function compareCurricula(curriculumA, curriculumB) {
  const departmentComparison = curriculumA.department.localeCompare(
    curriculumB.department,
    "ja",
  );

  if (departmentComparison !== 0) {
    return departmentComparison;
  }

  const majorComparison = curriculumA.major.localeCompare(
    curriculumB.major,
    "ja",
  );

  if (majorComparison !== 0) {
    return majorComparison;
  }

  return curriculumB.admissionYearFrom - curriculumA.admissionYearFrom;
}

function compareSubjects(subjectA, subjectB) {
  const gradeA = Number(subjectA.grade || 99);

  const gradeB = Number(subjectB.grade || 99);

  if (gradeA !== gradeB) {
    return gradeA - gradeB;
  }

  const semesterOrder = {
    前期: 1,

    後期: 2,

    通期: 3,
  };

  const semesterA = semesterOrder[subjectA.semester] || 99;

  const semesterB = semesterOrder[subjectB.semester] || 99;

  if (semesterA !== semesterB) {
    return semesterA - semesterB;
  }

  return subjectA.name.localeCompare(subjectB.name, "ja");
}

/* ========================================
   画面移動
======================================== */

function openSubjectsAdmin() {
  let url = "subjects_admin.html";

  if (currentCurriculumId) {
    url += "?curriculumId=" + encodeURIComponent(currentCurriculumId);
  }

  navigateWithUnsavedCheck(url);
}

function navigateWithUnsavedCheck(url) {
  if (hasUnsavedChanges) {
    const proceed = confirm(
      "保存していない変更があります。\n\n" + "変更を破棄して移動しますか？",
    );

    if (!proceed) {
      return;
    }
  }

  hasUnsavedChanges = false;

  location.href = url;
}

/* ========================================
   モーダル
======================================== */

function openModal(modal) {
  if (!modal) {
    return;
  }

  modal.hidden = false;

  document.body.classList.add("admin-modal-open");
}

function closeModal(modal) {
  if (!modal || modal.hidden) {
    return;
  }

  modal.hidden = true;

  if (newCurriculumModal?.hidden && deleteCurriculumModal?.hidden) {
    document.body.classList.remove("admin-modal-open");
  }
}

/* ========================================
   共通補助
======================================== */

function createLocalId(prefix, index = 0) {
  return (
    prefix +
    "_" +
    Date.now() +
    "_" +
    index +
    "_" +
    Math.random().toString(36).slice(2, 8)
  );
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function splitTags(value) {
  if (Array.isArray(value)) {
    return normalizeStringArray(value);
  }

  return [
    ...new Set(
      String(value || "")
        .split(/[、,\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function normalizeSemester(value) {
  const semester = String(value || "").trim();

  if (semester.includes("通")) {
    return "通期";
  }

  if (semester.includes("前")) {
    return "前期";
  }

  if (semester.includes("後")) {
    return "後期";
  }

  return semester;
}

function toNonNegativeNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return number;
}

function formatCredit(value) {
  const number = toNonNegativeNumber(value);

  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(1).replace(/\.0$/, "");
}

function formatDate(value) {
  if (!value) {
    return "----";
  }

  try {
    const date =
      typeof value.toDate === "function" ? value.toDate() : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "----";
    }

    return date.toLocaleString("ja-JP");
  } catch {
    return "----";
  }
}

function setText(element, value) {
  if (!element) {
    return;
  }

  element.textContent = String(value ?? "");
}

function setInputValue(element, value) {
  if (!element) {
    return;
  }

  element.value = value ?? "";
}

function setChecked(element, value) {
  if (!element) {
    return;
  }

  element.checked = value === true;
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
