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
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

/* ========================================
   HTML要素
======================================== */

const userName = document.getElementById("userName");

const myRanking = document.getElementById("myRanking");

const themeButton = document.getElementById("themeButton");

const topProfileImage = document.getElementById("topProfileImage");

const profileButton = document.getElementById("profileButton");

const backButton = document.getElementById("backButton");

const bottomBackButton = document.getElementById("bottomBackButton");

const openCurriculumAdminButton = document.getElementById(
  "openCurriculumAdminButton",
);

const subjectsJsonFile = document.getElementById("subjectsJsonFile");

const loadJsonButton = document.getElementById("loadJsonButton");

const exportSubjectsJsonButton = document.getElementById(
  "exportSubjectsJsonButton",
);

const loadFirestoreSubjects = document.getElementById("loadFirestoreSubjects");

const addSubjectButton = document.getElementById("addSubjectButton");

const saveSubjectsButton = document.getElementById("saveSubjectsButton");

const subjectSaveStatus = document.getElementById("subjectSaveStatus");

const subjectEditorList = document.getElementById("subjectEditorList");

const subjectCount = document.getElementById("subjectCount");

const filteredSubjectCount = document.getElementById("filteredSubjectCount");

const incompleteSubjectCount = document.getElementById(
  "incompleteSubjectCount",
);

const unassignedCurriculumCount = document.getElementById(
  "unassignedCurriculumCount",
);

const inactiveSubjectCount = document.getElementById("inactiveSubjectCount");

const subjectSearchInput = document.getElementById("subjectSearchInput");

const subjectCurriculumFilter = document.getElementById(
  "subjectCurriculumFilter",
);

const subjectDepartmentFilter = document.getElementById(
  "subjectDepartmentFilter",
);

const subjectMajorFilter = document.getElementById("subjectMajorFilter");

const subjectGradeFilter = document.getElementById("subjectGradeFilter");

const subjectSemesterFilter = document.getElementById("subjectSemesterFilter");

const subjectRequirementTypeFilter = document.getElementById(
  "subjectRequirementTypeFilter",
);

const subjectCategoryFilter = document.getElementById("subjectCategoryFilter");

const subjectStatusFilter = document.getElementById("subjectStatusFilter");

const resetSubjectFiltersButton = document.getElementById(
  "resetSubjectFiltersButton",
);

const incompleteNextButton = document.getElementById("incompleteNextButton");

const scrollTopButton = document.getElementById("scrollTopButton");

/* 履修登録公開設定 */

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

  convenienceCardEnabled: document.getElementById(
    "registrationConvenienceCardEnabled",
  ),

  semesterCreditLimit: document.getElementById("semesterCreditLimit"),

  annualCreditLimit: document.getElementById("annualCreditLimit"),
};

const saveRegistrationDraft = document.getElementById("saveRegistrationDraft");

const publishRegistrationSettings = document.getElementById(
  "publishRegistrationSettings",
);

const previewRegistrationPage = document.getElementById(
  "previewRegistrationPage",
);

const registrationPublishStatus = document.getElementById(
  "registrationPublishStatus",
);

/* ========================================
   URLパラメータ
======================================== */

const pageParameters = new URLSearchParams(location.search);

const requestedCurriculumId = pageParameters.get("curriculumId") || "";

const requestedSubjectKey = pageParameters.get("subjectKey") || "";

/* ========================================
   状態
======================================== */

let subjects = [];

let curricula = [];

let deletedDocumentIds = new Set();

let incompleteNavigationIndex = -1;

let hasUnsavedChanges = false;

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

  loadMyRanking(myRanking),

  loadProfileImage(topProfileImage),

  updateAssignmentNavBadge(),

  updateShareNavBadge(),

  updateNewsNavBadge(),
]);

setupEvents();

await loadCurricula();

await loadRegistrationSettings();

await loadSubjectsFromFirestore(false);

/* ========================================
   イベント
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

  if (bottomBackButton) {
    bottomBackButton.onclick = () => {
      navigateWithUnsavedCheck("admin.html");
    };
  }

  if (openCurriculumAdminButton) {
    openCurriculumAdminButton.onclick = openCurriculumAdmin;
  }

  if (loadJsonButton) {
    loadJsonButton.onclick = loadSubjectsFromJsonFile;
  }

  if (exportSubjectsJsonButton) {
    exportSubjectsJsonButton.onclick = exportSubjectsJson;
  }

  if (loadFirestoreSubjects) {
    loadFirestoreSubjects.onclick = () => {
      loadSubjectsFromFirestore(true);
    };
  }

  if (addSubjectButton) {
    addSubjectButton.onclick = addEmptySubject;
  }

  if (saveSubjectsButton) {
    saveSubjectsButton.onclick = saveSubjectsToFirestore;
  }

  if (subjectEditorList) {
    subjectEditorList.addEventListener("input", handleEditorChange);

    subjectEditorList.addEventListener("change", handleEditorChange);

    subjectEditorList.addEventListener("click", handleEditorClick);
  }

  const filterElements = [
    subjectSearchInput,
    subjectCurriculumFilter,
    subjectDepartmentFilter,
    subjectMajorFilter,
    subjectGradeFilter,
    subjectSemesterFilter,
    subjectRequirementTypeFilter,
    subjectCategoryFilter,
    subjectStatusFilter,
  ].filter(Boolean);

  filterElements.forEach((element) => {
    element.addEventListener(
      element.tagName === "INPUT" ? "input" : "change",
      renderSubjects,
    );
  });

  if (resetSubjectFiltersButton) {
    resetSubjectFiltersButton.onclick = resetSubjectFilters;
  }

  if (incompleteNextButton) {
    incompleteNextButton.onclick = jumpToNextIncompleteSubject;
  }

  if (scrollTopButton) {
    scrollTopButton.onclick = () => {
      window.scrollTo({
        top: 0,

        behavior: "smooth",
      });
    };
  }

  if (saveRegistrationDraft) {
    saveRegistrationDraft.onclick = () => {
      saveRegistrationSettings(false);
    };
  }

  if (publishRegistrationSettings) {
    publishRegistrationSettings.onclick = () => {
      saveRegistrationSettings(true);
    };
  }

  if (previewRegistrationPage) {
    previewRegistrationPage.onclick = previewStudentRegistrationPage;
  }

  window.addEventListener("beforeunload", (event) => {
    if (!hasUnsavedChanges) {
      return;
    }

    event.preventDefault();

    event.returnValue = "";
  });
}

/* ========================================
   カリキュラム取得
======================================== */

async function loadCurricula() {
  try {
    const snapshot = await getDocs(collection(db, "curricula"));

    curricula = snapshot.docs
      .map((curriculumDocument) => {
        const data = curriculumDocument.data();

        return {
          id: curriculumDocument.id,

          curriculumId: curriculumDocument.id,

          name: String(data.name || curriculumDocument.id),

          department: String(data.department || ""),

          major: String(data.major || ""),

          admissionYearFrom: toNonNegativeNumber(data.admissionYearFrom),

          admissionYearTo: data.admissionYearTo
            ? toNonNegativeNumber(data.admissionYearTo)
            : null,

          categoryRequirements: Array.isArray(data.categoryRequirements)
            ? data.categoryRequirements
            : [],

          published: data.published === true,
        };
      })
      .sort(compareCurricula);

    renderCurriculumFilter();
  } catch (error) {
    console.error("カリキュラム取得エラー:", error);

    curricula = [];

    renderCurriculumFilter();

    showToast("カリキュラム情報を取得できませんでした");
  }
}

function renderCurriculumFilter() {
  if (!subjectCurriculumFilter) {
    return;
  }

  const currentValue =
    requestedCurriculumId || subjectCurriculumFilter.value || "";

  subjectCurriculumFilter.innerHTML = `

        <option value="">
            すべて
        </option>

        <option value="__unset__">
            カリキュラム未設定
        </option>

        ${curricula
          .map(
            (curriculum) => `

                <option
                    value="${escapeAttribute(curriculum.curriculumId)}">

                    ${escapeHtml(curriculum.name)}

                    ${curriculum.published ? "" : "（下書き）"}

                </option>

            `,
          )
          .join("")}

    `;

  const optionExists = Array.from(subjectCurriculumFilter.options).some(
    (option) => option.value === currentValue,
  );

  if (optionExists) {
    subjectCurriculumFilter.value = currentValue;
  }
}

/* ========================================
   履修登録公開設定
======================================== */

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
  };
}

function readRegistrationForm() {
  return {
    academicYear: Number(registrationFields.academicYear?.value || 0),

    semester: registrationFields.semester?.value || "前期",

    phase: registrationFields.phase?.value || "hidden",

    correctionMode: registrationFields.correctionMode?.value || "delete_only",

    startAt: registrationFields.startAt?.value || "",

    endAt: registrationFields.endAt?.value || "",

    bannerEnabled: registrationFields.bannerEnabled?.checked === true,

    bannerText: registrationFields.bannerText?.value.trim() || "",

    bannerSpeed: registrationFields.bannerSpeed?.value || "normal",

    pageEnabled: registrationFields.pageEnabled?.checked === true,

    convenienceCardEnabled:
      registrationFields.convenienceCardEnabled?.checked === true,

    semesterCreditLimit: toNonNegativeNumber(
      registrationFields.semesterCreditLimit?.value,
    ),

    annualCreditLimit: toNonNegativeNumber(
      registrationFields.annualCreditLimit?.value,
    ),
  };
}

function fillRegistrationForm(settings) {
  const value = {
    ...defaultRegistrationSettings(),

    ...settings,
  };

  setInputValue(registrationFields.academicYear, value.academicYear);

  setInputValue(registrationFields.semester, value.semester);

  setInputValue(registrationFields.phase, value.phase);

  setInputValue(registrationFields.correctionMode, value.correctionMode);

  setInputValue(registrationFields.startAt, value.startAt || "");

  setInputValue(registrationFields.endAt, value.endAt || "");

  setChecked(registrationFields.bannerEnabled, value.bannerEnabled);

  setInputValue(registrationFields.bannerText, value.bannerText || "");

  setInputValue(registrationFields.bannerSpeed, value.bannerSpeed);

  setChecked(registrationFields.pageEnabled, value.pageEnabled);

  setChecked(
    registrationFields.convenienceCardEnabled,
    value.convenienceCardEnabled,
  );

  setInputValue(
    registrationFields.semesterCreditLimit,
    value.semesterCreditLimit,
  );

  setInputValue(registrationFields.annualCreditLimit, value.annualCreditLimit);
}

async function loadRegistrationSettings() {
  try {
    const [draftSnapshot, publishedSnapshot] = await Promise.all([
      getDoc(doc(db, "system", "courseRegistrationDraft")),

      getDoc(doc(db, "system", "courseRegistration")),
    ]);

    const settings = draftSnapshot.exists()
      ? draftSnapshot.data()
      : publishedSnapshot.exists()
        ? publishedSnapshot.data()
        : defaultRegistrationSettings();

    fillRegistrationForm(settings);

    if (registrationPublishStatus) {
      if (publishedSnapshot.exists()) {
        const publishedData = publishedSnapshot.data();

        registrationPublishStatus.textContent =
          `公開済み：` +
          `${publishedData.academicYear}年度 ` +
          `${publishedData.semester}`;
      } else {
        registrationPublishStatus.textContent =
          "学生側にはまだ公開されていません。";
      }
    }
  } catch (error) {
    console.error("履修公開設定取得エラー:", error);

    fillRegistrationForm(defaultRegistrationSettings());

    if (registrationPublishStatus) {
      registrationPublishStatus.textContent =
        "公開設定を取得できませんでした。";
    }
  }
}

async function saveRegistrationSettings(publish) {
  const settings = readRegistrationForm();

  if (!settings.academicYear || settings.academicYear < 2020) {
    alert("対象年度を入力してください。");

    return;
  }

  if (
    settings.startAt &&
    settings.endAt &&
    new Date(settings.startAt).getTime() >= new Date(settings.endAt).getTime()
  ) {
    alert("終了日時は開始日時より後にしてください。");

    return;
  }

  if (
    settings.semesterCreditLimit &&
    settings.annualCreditLimit &&
    settings.semesterCreditLimit > settings.annualCreditLimit
  ) {
    alert("半期の上限単位が年間の上限単位を超えています。");

    return;
  }

  if (publish) {
    const message =
      `${settings.academicYear}年度 ` +
      `${settings.semester}の履修登録設定を` +
      `学生側へ公開しますか？`;

    if (!confirm(message)) {
      return;
    }
  }

  const button = publish ? publishRegistrationSettings : saveRegistrationDraft;

  if (!button) {
    return;
  }

  const originalText = button.textContent;

  try {
    button.disabled = true;

    button.textContent = "保存中...";

    await setDoc(
      doc(
        db,
        "system",
        publish ? "courseRegistration" : "courseRegistrationDraft",
      ),

      {
        ...settings,

        published: publish,

        updatedAt: serverTimestamp(),

        updatedBy: studentNumber || "",
      },

      {
        merge: true,
      },
    );

    if (registrationPublishStatus) {
      registrationPublishStatus.textContent = publish
        ? `${settings.academicYear}年度 ` +
          `${settings.semester}を学生側へ公開しました。`
        : "下書きを保存しました。" + "学生側にはまだ反映されません。";
    }

    showToast(publish ? "学生側へ公開しました" : "下書きを保存しました");
  } catch (error) {
    console.error("履修公開設定保存エラー:", error);

    alert("履修登録の公開設定を保存できませんでした。");
  } finally {
    button.disabled = false;

    button.textContent = originalText;
  }
}

/* ========================================
   科目取得
======================================== */

async function loadSubjectsFromFirestore(askBeforeDiscard = true) {
  if (askBeforeDiscard && hasUnsavedChanges) {
    const discard = confirm(
      "保存していない科目変更があります。\n\n" +
        "変更を破棄してFirestoreから読み込みますか？",
    );

    if (!discard) {
      return;
    }
  }

  if (loadFirestoreSubjects) {
    loadFirestoreSubjects.disabled = true;

    loadFirestoreSubjects.textContent = "読み込み中...";
  }

  try {
    const snapshot = await getDocs(collection(db, "subjects"));

    subjects = snapshot.docs.map((subjectDocument, index) => {
      return normalizeSubject(
        {
          ...subjectDocument.data(),

          firestoreId: subjectDocument.id,
        },

        index,
      );
    });

    subjects.sort(compareSubjects);

    deletedDocumentIds.clear();

    setUnsavedState(false);

    updateFilterOptions();

    renderSubjects();

    showToast(`${subjects.length}科目を取得しました`);

    scrollToRequestedSubject();
  } catch (error) {
    console.error("科目取得エラー:", error);

    alert("Firestoreから科目を取得できませんでした。");

    if (subjectEditorList) {
      subjectEditorList.innerHTML = `

                <div class="card setting-card subject-empty">

                    科目情報を取得できませんでした。

                </div>

            `;
    }
  } finally {
    if (loadFirestoreSubjects) {
      loadFirestoreSubjects.disabled = false;

      loadFirestoreSubjects.textContent = "↻ Firestoreから読み込む";
    }
  }
}

/* ========================================
   JSON読込・書出
======================================== */

async function loadSubjectsFromJsonFile() {
  const file = subjectsJsonFile?.files?.[0];

  if (!file) {
    alert("subjects.jsonを選択してください。");

    return;
  }

  if (hasUnsavedChanges) {
    const discard = confirm("現在の未保存変更を破棄してJSONを読み込みますか？");

    if (!discard) {
      return;
    }
  }

  try {
    const text = await file.text();

    const parsed = JSON.parse(text);

    const sourceArray = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.subjects)
        ? parsed.subjects
        : null;

    if (!sourceArray) {
      throw new Error(
        "JSONの一番外側を配列にするか、subjects配列を含めてください。",
      );
    }

    subjects = sourceArray.map((subject, index) =>
      normalizeSubject(subject, index),
    );

    subjects.sort(compareSubjects);

    deletedDocumentIds.clear();

    setUnsavedState(true);

    updateFilterOptions();

    renderSubjects();

    showToast(`${subjects.length}科目を読み込みました`);
  } catch (error) {
    console.error("JSON読込エラー:", error);

    alert("JSONを読み込めませんでした。\n\n" + error.message);
  }
}

function exportSubjectsJson() {
  syncAllEditors();

  if (subjects.length === 0) {
    alert("書き出す科目がありません。");

    return;
  }

  const exportData = subjects.map(serializeSubject).sort(compareSubjects);

  const json = JSON.stringify(exportData, null, 2);

  const blob = new Blob([json], {
    type: "application/json;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");

  anchor.href = url;

  anchor.download = `subjects_${formatFileDate(new Date())}.json`;

  document.body.appendChild(anchor);

  anchor.click();

  anchor.remove();

  URL.revokeObjectURL(url);

  showToast(`${subjects.length}科目を書き出しました`);
}

/* ========================================
   科目正規化
======================================== */

function normalizeSubject(source, index = 0) {
  const sourceData = {
    ...source,
  };

  delete sourceData.localId;

  delete sourceData.firestoreId;

  const name = String(source?.name || "").trim();

  let department = String(source?.department || "").trim();

  let major = String(source?.major || "").trim();

  /*
    旧データ互換：
    departmentに専攻名が入っていた場合
    */

  if (department === "理学療法学専攻") {
    major = "理学療法学専攻";

    department = "リハビリテーション学科";
  }

  if (department === "作業療法学専攻") {
    major = "作業療法学専攻";

    department = "リハビリテーション学科";
  }

  if (!department) {
    department = major ? "リハビリテーション学科" : "看護学科";
  }

  let requirementType = String(source?.requirementType || "").trim();

  if (!requirementType) {
    if (source?.required === true) {
      requirementType = "required";
    } else if (source?.required === false) {
      requirementType = "elective";
    }
  }

  const curriculumIds = normalizeStringArray(source?.curriculumIds);

  if (
    source?.curriculumId &&
    !curriculumIds.includes(String(source.curriculumId))
  ) {
    curriculumIds.push(String(source.curriculumId));
  }

  const inferredCurriculumIds =
    curriculumIds.length > 0
      ? curriculumIds
      : inferCurriculumIds(department, major);

  const requirementTags = Array.isArray(source?.requirementTags)
    ? normalizeStringArray(source.requirementTags)
    : splitRequirementTags(
        source?.requirementTags || source?.requirementTag || "",
      );

  return {
    localId: source?.localId || createLocalId(index),

    firestoreId: String(
      source?.firestoreId || source?.subjectKey || name || "",
    ),

    rawData: sourceData,

    name,

    subjectKey: String(source?.subjectKey || name).trim(),

    department,

    major,

    curriculumIds: inferredCurriculumIds,

    curriculumInferred:
      curriculumIds.length === 0 && inferredCurriculumIds.length > 0,

    category: String(
      source?.category ||
        source?.subjectCategory ||
        source?.courseCategory ||
        "",
    ).trim(),

    subcategory: String(
      source?.subcategory || source?.subCategory || "",
    ).trim(),

    requirementType,

    requirementTags,

    grade: String(source?.grade || "")
      .replace("年", "")
      .trim(),

    semester: normalizeSemester(source?.semester),

    credits: toNonNegativeNumber(source?.credits),

    lectureCount: toNonNegativeNumber(source?.lectureCount),

    isPractical:
      typeof source?.isPractical === "boolean"
        ? source.isPractical
        : String(source?.classFormat || "").includes("実習"),

    active: source?.active !== false,

    attendanceNotificationDefaultEnabled:
      source?.attendanceNotificationDefaultEnabled !== false,

    attendanceReminderMinutes: toNonNegativeNumber(
      source?.attendanceReminderMinutes ?? 10,
    ),
  };
}

function inferCurriculumIds(department, major) {
  const matchingCurricula = curricula.filter((curriculum) => {
    if (curriculum.department !== department) {
      return false;
    }

    if (major) {
      return curriculum.major === major;
    }

    return !curriculum.major;
  });

  if (matchingCurricula.length === 1) {
    return [matchingCurricula[0].curriculumId];
  }

  return [];
}

/* ========================================
   新規科目
======================================== */

function createEmptySubject() {
  const selectedCurriculumId = getSelectedCurriculumFilter();

  const selectedCurriculum = curricula.find(
    (curriculum) => curriculum.curriculumId === selectedCurriculumId,
  );

  return {
    localId: createLocalId(subjects.length),

    firestoreId: "",

    rawData: {},

    name: "",

    subjectKey: "",

    department:
      selectedCurriculum?.department ||
      subjectDepartmentFilter?.value ||
      "看護学科",

    major:
      selectedCurriculum?.major ||
      (subjectMajorFilter?.value && subjectMajorFilter.value !== "__none__"
        ? subjectMajorFilter.value
        : ""),

    curriculumIds: selectedCurriculum ? [selectedCurriculum.curriculumId] : [],

    curriculumInferred: false,

    category: "",

    subcategory: "",

    requirementType: "",

    requirementTags: [],

    grade: isNormalFilterValue(subjectGradeFilter?.value)
      ? subjectGradeFilter.value
      : "",

    semester: isNormalFilterValue(subjectSemesterFilter?.value)
      ? subjectSemesterFilter.value
      : "",

    credits: 0,

    lectureCount: 0,

    isPractical: false,

    active: true,

    attendanceNotificationDefaultEnabled: true,

    attendanceReminderMinutes: 10,
  };
}

function addEmptySubject() {
  const newSubject = createEmptySubject();

  subjects.push(newSubject);

  clearFiltersThatHideSubject(newSubject);

  markUnsaved();

  updateFilterOptions();

  renderSubjects();

  scrollToSubject(newSubject.localId);
}

function insertEmptySubjectAfter(localId) {
  const index = subjects.findIndex((subject) => subject.localId === localId);

  const insertIndex = index >= 0 ? index + 1 : subjects.length;

  const newSubject = createEmptySubject();

  subjects.splice(insertIndex, 0, newSubject);

  clearFiltersThatHideSubject(newSubject);

  markUnsaved();

  updateFilterOptions();

  renderSubjects();

  scrollToSubject(newSubject.localId);
}

function duplicateSubject(localId) {
  syncAllEditors();

  const index = subjects.findIndex((subject) => subject.localId === localId);

  if (index < 0) {
    return;
  }

  const source = subjects[index];

  const duplicate = {
    ...source,

    localId: createLocalId(subjects.length),

    firestoreId: "",

    rawData: {
      ...source.rawData,
    },

    name: source.name ? `${source.name} コピー` : "",

    subjectKey: source.subjectKey ? `${source.subjectKey}_copy` : "",

    curriculumIds: [...source.curriculumIds],

    requirementTags: [...source.requirementTags],
  };

  subjects.splice(index + 1, 0, duplicate);

  markUnsaved();

  renderSubjects();

  scrollToSubject(duplicate.localId);
}

/* ========================================
   科目一覧表示
======================================== */

function renderSubjects() {
  updateSummary();

  if (!subjectEditorList) {
    return;
  }

  const filteredSubjects = getFilteredSubjects();

  setText(filteredSubjectCount, filteredSubjects.length);

  if (subjects.length === 0) {
    subjectEditorList.innerHTML = `

            <div class="card setting-card subject-empty">

                登録する科目がありません。

            </div>

        `;

    return;
  }

  if (filteredSubjects.length === 0) {
    subjectEditorList.innerHTML = `

            <div class="card setting-card subject-empty">

                条件に一致する科目はありません。

            </div>

        `;

    return;
  }

  subjectEditorList.innerHTML = filteredSubjects
    .map((subject, index) => {
      return (
        createSubjectEditorHtml(subject, index) +
        createInsertSubjectButtonHtml(subject.localId)
      );
    })
    .join("");

  incompleteNavigationIndex = -1;
}

function createSubjectEditorHtml(subject, index) {
  const warnings = getSubjectWarnings(subject);

  const warningHtml = createSubjectWarningHtml(warnings);

  const requirementTypeLabel =
    {
      required: "必修",

      elective: "選択",

      free: "自由",
    }[subject.requirementType] || "未設定";

  return `

        <article
            class="
                card
                setting-card
                subject-editor-card
                ${warnings.length > 0 ? "has-warning" : ""}
                ${subject.active ? "" : "is-inactive"}
            "
            data-local-id="${escapeAttribute(subject.localId)}">


            <div class="subject-editor-heading">


                <div>

                    <span class="subject-editor-number">

                        科目 ${index + 1}

                    </span>


                    <h3 class="subject-editor-title">

                        ${escapeHtml(subject.name) || "新しい科目"}

                    </h3>


                    <div class="subject-editor-heading-meta">

                        <span
                            class="
                                subject-editor-type-badge
                                is-${escapeAttribute(
                                  subject.requirementType || "unset",
                                )}
                            ">

                            ${requirementTypeLabel}

                        </span>

                        <span>

                            ${formatCredit(subject.credits)}単位

                        </span>

                        ${
                          subject.active
                            ? `
                                    <span class="subject-active-badge">
                                        公開
                                    </span>
                                `
                            : `
                                    <span class="subject-inactive-badge">
                                        非公開
                                    </span>
                                `
                        }

                    </div>

                </div>


                <div class="subject-editor-heading-actions">

                    <button
                        type="button"
                        class="btn"
                        data-action="duplicate-subject">

                        複製

                    </button>

                    <button
                        type="button"
                        class="btn btn-danger"
                        data-action="delete-subject">

                        削除

                    </button>

                </div>

            </div>


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

                    <small class="subject-editor-help">

                        Firestoreの識別に使用します。
                        同じ値は登録できません。

                    </small>

                </label>


                <label>

                    <span class="subject-editor-label">

                        学科

                    </span>

                    <select data-field="department">

                        ${createOption("", "未設定", subject.department)}

                        ${createOption(
                          "看護学科",
                          "看護学科",
                          subject.department,
                        )}

                        ${createOption(
                          "リハビリテーション学科",
                          "リハビリテーション学科",
                          subject.department,
                        )}

                    </select>

                </label>


                <label>

                    <span class="subject-editor-label">

                        専攻

                    </span>

                    <select
                        data-field="major"
                        ${
                          subject.department === "リハビリテーション学科"
                            ? ""
                            : "disabled"
                        }>

                        ${createOption("", "専攻なし", subject.major)}

                        ${createOption(
                          "理学療法学専攻",
                          "理学療法学専攻",
                          subject.major,
                        )}

                        ${createOption(
                          "作業療法学専攻",
                          "作業療法学専攻",
                          subject.major,
                        )}

                    </select>

                </label>


                <div class="full-width subject-curriculum-field">

                    <span class="subject-editor-label">

                        対象カリキュラム

                    </span>

                    ${createCurriculumCheckboxes(subject)}

                    ${
                      subject.curriculumInferred
                        ? `
                                <small class="subject-inferred-note">

                                    ℹ️ 学科・専攻から自動で仮設定しました。
                                    保存すると正式に反映されます。

                                </small>
                            `
                        : ""
                    }

                </div>


                <label>

                    <span class="subject-editor-label">

                        学年

                    </span>

                    <select data-field="grade">

                        ${createOption("", "未設定", subject.grade)}

                        ${createOption("1", "1年", subject.grade)}

                        ${createOption("2", "2年", subject.grade)}

                        ${createOption("3", "3年", subject.grade)}

                        ${createOption("4", "4年", subject.grade)}

                    </select>

                </label>


                <label>

                    <span class="subject-editor-label">

                        学期

                    </span>

                    <select data-field="semester">

                        ${createOption("", "未設定", subject.semester)}

                        ${createOption("前期", "前期", subject.semester)}

                        ${createOption("後期", "後期", subject.semester)}

                        ${createOption("通期", "通期", subject.semester)}

                    </select>

                </label>


                <label>

                    <span class="subject-editor-label">

                        必修・選択・自由

                    </span>

                    <select data-field="requirementType">

                        ${createOption("", "未設定", subject.requirementType)}

                        ${createOption(
                          "required",
                          "必修",
                          subject.requirementType,
                        )}

                        ${createOption(
                          "elective",
                          "選択",
                          subject.requirementType,
                        )}

                        ${createOption("free", "自由", subject.requirementType)}

                    </select>

                </label>


                <label>

                    <span class="subject-editor-label">

                        単位数

                    </span>

                    <input
                        type="number"
                        min="0"
                        step="0.5"
                        data-field="credits"
                        value="${formatCredit(subject.credits)}">

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

                        科目区分

                    </span>

                    <input
                        type="text"
                        data-field="category"
                        value="${escapeAttribute(subject.category)}"
                        placeholder="専門科目">

                    <small class="subject-editor-help">

                        例：総合教育科目・専門基礎科目・専門科目

                    </small>

                </label>


                <label>

                    <span class="subject-editor-label">

                        詳細区分

                    </span>

                    <input
                        type="text"
                        data-field="subcategory"
                        value="${escapeAttribute(subject.subcategory)}"
                        placeholder="健康状態に応じた看護">

                </label>


                <label class="full-width">

                    <span class="subject-editor-label">

                        要件タグ

                    </span>

                    <input
                        type="text"
                        data-field="requirementTags"
                        value="${escapeAttribute(
                          subject.requirementTags.join("、"),
                        )}"
                        placeholder="専門共通、地域理学療法学">

                    <small class="subject-editor-help">

                        複数設定する場合は「、」またはカンマで区切ります。

                    </small>

                </label>


                <label class="subject-toggle-field">

                    <span>

                        <b>
                            実習科目
                        </b>

                        <br>

                        <small>
                            出席判定や実習表示に使用します
                        </small>

                    </span>

                    <input
                        type="checkbox"
                        data-field="isPractical"
                        ${subject.isPractical ? "checked" : ""}>

                </label>


                <label class="subject-toggle-field">

                    <span>

                        <b>
                            学生側へ表示
                        </b>

                        <br>

                        <small>
                            OFFにすると履修登録の候補から除外します
                        </small>

                    </span>

                    <input
                        type="checkbox"
                        data-field="active"
                        ${subject.active ? "checked" : ""}>

                </label>


                <label class="subject-toggle-field">

                    <span>

                        <b>
                            出席打刻通知の初期値
                        </b>

                        <br>

                        <small>
                            開講情報作成時の初期設定として使用します
                        </small>

                    </span>

                    <input
                        type="checkbox"
                        data-field="attendanceNotificationDefaultEnabled"
                        ${
                          subject.attendanceNotificationDefaultEnabled
                            ? "checked"
                            : ""
                        }>

                </label>


                <label>

                    <span class="subject-editor-label">

                        出席通知・開始何分前

                    </span>

                    <input
                        type="number"
                        min="0"
                        max="120"
                        step="1"
                        data-field="attendanceReminderMinutes"
                        value="${subject.attendanceReminderMinutes}">

                    <small class="subject-editor-help">

                        実際の曜日・時限は後で開講情報側に設定します。

                    </small>

                </label>

            </div>


            <div class="subject-warning-container">

                ${warningHtml}

            </div>

        </article>

    `;
}

function createCurriculumCheckboxes(subject) {
  if (curricula.length === 0) {
    return `

            <div class="subject-curriculum-empty">

                カリキュラムがありません。
                先にカリキュラム管理で作成してください。

            </div>

        `;
  }

  const matchingCurricula = curricula.filter((curriculum) => {
    if (curriculum.department !== subject.department) {
      return false;
    }

    if (subject.major) {
      return curriculum.major === subject.major;
    }

    return !curriculum.major;
  });

  const displayCurricula =
    matchingCurricula.length > 0 ? matchingCurricula : curricula;

  return `

        <div class="subject-curriculum-checkbox-grid">

            ${displayCurricula
              .map((curriculum) => {
                const checked = subject.curriculumIds.includes(
                  curriculum.curriculumId,
                );

                return `

                            <label class="subject-curriculum-option">

                                <input
                                    type="checkbox"
                                    data-field="curriculumIds"
                                    data-curriculum-id="${escapeAttribute(
                                      curriculum.curriculumId,
                                    )}"
                                    ${checked ? "checked" : ""}>

                                <span>

                                    <b>
                                        ${escapeHtml(curriculum.name)}
                                    </b>

                                    <small>

                                        ${
                                          curriculum.published
                                            ? "公開中"
                                            : "下書き"
                                        }

                                    </small>

                                </span>

                            </label>

                        `;
              })
              .join("")}

        </div>

    `;
}

function createInsertSubjectButtonHtml(localId) {
  return `

        <div class="subject-insert-area">

            <button
                type="button"
                class="btn subject-insert-button"
                data-action="insert-subject"
                data-after-local-id="${escapeAttribute(localId)}">

                ＋ ここに科目を追加

            </button>

        </div>

    `;
}

function createSubjectWarningHtml(warnings) {
  if (warnings.length === 0) {
    return `

            <div class="subject-complete">

                ✅ カリキュラム判定に必要な項目が入力されています

            </div>

        `;
  }

  return `

        <div class="subject-warning">

            ⚠️ 未入力・確認：

            ${escapeHtml(warnings.join("・"))}

        </div>

    `;
}

/* ========================================
   科目入力変更
======================================== */

function handleEditorChange(event) {
  const field = event.target.dataset.field;

  if (!field) {
    return;
  }

  const card = event.target.closest(".subject-editor-card");

  if (!card) {
    return;
  }

  const subject = subjects.find(
    (item) => item.localId === card.dataset.localId,
  );

  if (!subject) {
    return;
  }

  updateSubjectFromInput(subject, event.target);

  if (field === "name" && !subject.subjectKey) {
    subject.subjectKey = subject.name;

    const subjectKeyInput = card.querySelector('[data-field="subjectKey"]');

    if (subjectKeyInput) {
      subjectKeyInput.value = subject.subjectKey;
    }
  }

  if (field === "department") {
    if (subject.department !== "リハビリテーション学科") {
      subject.major = "";
    }

    renderSubjects();
  } else {
    updateSubjectCardDisplay(card, subject);
  }

  subject.curriculumInferred = false;

  markUnsaved();

  updateSummary();

  updateFilterOptions();
}

function updateSubjectFromInput(subject, input) {
  const field = input.dataset.field;

  if (field === "curriculumIds") {
    const curriculumId = input.dataset.curriculumId;

    if (!curriculumId) {
      return;
    }

    if (input.checked) {
      if (!subject.curriculumIds.includes(curriculumId)) {
        subject.curriculumIds.push(curriculumId);
      }

      const selectedCurriculum = curricula.find(
        (curriculum) => curriculum.curriculumId === curriculumId,
      );

      if (selectedCurriculum) {
        if (!subject.department) {
          subject.department = selectedCurriculum.department;
        }

        if (!subject.major && selectedCurriculum.major) {
          subject.major = selectedCurriculum.major;
        }
      }
    } else {
      subject.curriculumIds = subject.curriculumIds.filter(
        (id) => id !== curriculumId,
      );
    }

    return;
  }

  if (
    field === "isPractical" ||
    field === "active" ||
    field === "attendanceNotificationDefaultEnabled"
  ) {
    subject[field] = input.checked;

    return;
  }

  if (
    field === "credits" ||
    field === "lectureCount" ||
    field === "attendanceReminderMinutes"
  ) {
    subject[field] = toNonNegativeNumber(input.value);

    return;
  }

  if (field === "requirementTags") {
    subject.requirementTags = splitRequirementTags(input.value);

    return;
  }

  subject[field] = input.value.trim();
}

function updateSubjectCardDisplay(card, subject) {
  const title = card.querySelector(".subject-editor-title");

  if (title) {
    title.textContent = subject.name || "新しい科目";
  }

  const warningContainer = card.querySelector(".subject-warning-container");

  if (warningContainer) {
    warningContainer.innerHTML = createSubjectWarningHtml(
      getSubjectWarnings(subject),
    );
  }

  card.classList.toggle("has-warning", isSubjectIncomplete(subject));

  card.classList.toggle("is-inactive", !subject.active);
}

/* ========================================
   科目操作
======================================== */

function handleEditorClick(event) {
  const insertButton = event.target.closest('[data-action="insert-subject"]');

  if (insertButton) {
    insertEmptySubjectAfter(insertButton.dataset.afterLocalId);

    return;
  }

  const duplicateButton = event.target.closest(
    '[data-action="duplicate-subject"]',
  );

  if (duplicateButton) {
    const card = duplicateButton.closest(".subject-editor-card");

    if (card) {
      duplicateSubject(card.dataset.localId);
    }

    return;
  }

  const deleteButton = event.target.closest('[data-action="delete-subject"]');

  if (!deleteButton) {
    return;
  }

  const card = deleteButton.closest(".subject-editor-card");

  if (!card) {
    return;
  }

  deleteSubject(card.dataset.localId);
}

function deleteSubject(localId) {
  const subject = subjects.find((item) => item.localId === localId);

  if (!subject) {
    return;
  }

  const ok = confirm(
    `${subject.name || "この科目"}を削除しますか？\n\n` +
      "Firestoreへ保存するまで削除は確定しません。",
  );

  if (!ok) {
    return;
  }

  if (subject.firestoreId) {
    deletedDocumentIds.add(subject.firestoreId);
  }

  subjects = subjects.filter((item) => item.localId !== localId);

  markUnsaved();

  updateFilterOptions();

  renderSubjects();
}

/* ========================================
   検索・絞り込み
======================================== */

function getFilteredSubjects() {
  const keyword = String(subjectSearchInput?.value || "")
    .trim()
    .toLowerCase();

  const curriculumFilter = subjectCurriculumFilter?.value || "";

  const departmentFilter = subjectDepartmentFilter?.value || "";

  const majorFilter = subjectMajorFilter?.value || "";

  const gradeFilter = subjectGradeFilter?.value || "";

  const semesterFilter = subjectSemesterFilter?.value || "";

  const requirementFilter = subjectRequirementTypeFilter?.value || "";

  const categoryFilter = subjectCategoryFilter?.value || "";

  const statusFilter = subjectStatusFilter?.value || "";

  return subjects.filter((subject) => {
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

    if (curriculumFilter === "__unset__" && subject.curriculumIds.length > 0) {
      return false;
    }

    if (
      curriculumFilter &&
      curriculumFilter !== "__unset__" &&
      !subject.curriculumIds.includes(curriculumFilter)
    ) {
      return false;
    }

    if (departmentFilter && subject.department !== departmentFilter) {
      return false;
    }

    if (majorFilter === "__none__" && subject.major) {
      return false;
    }

    if (
      majorFilter &&
      majorFilter !== "__none__" &&
      subject.major !== majorFilter
    ) {
      return false;
    }

    if (gradeFilter === "__unset__" && subject.grade) {
      return false;
    }

    if (
      gradeFilter &&
      gradeFilter !== "__unset__" &&
      subject.grade !== gradeFilter
    ) {
      return false;
    }

    if (semesterFilter === "__unset__" && subject.semester) {
      return false;
    }

    if (
      semesterFilter &&
      semesterFilter !== "__unset__" &&
      subject.semester !== semesterFilter
    ) {
      return false;
    }

    if (requirementFilter === "__unset__" && subject.requirementType) {
      return false;
    }

    if (
      requirementFilter &&
      requirementFilter !== "__unset__" &&
      subject.requirementType !== requirementFilter
    ) {
      return false;
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

    if (statusFilter === "active" && !subject.active) {
      return false;
    }

    if (statusFilter === "inactive" && subject.active) {
      return false;
    }

    return true;
  });
}

function resetSubjectFilters() {
  [
    subjectSearchInput,
    subjectCurriculumFilter,
    subjectDepartmentFilter,
    subjectMajorFilter,
    subjectGradeFilter,
    subjectSemesterFilter,
    subjectRequirementTypeFilter,
    subjectCategoryFilter,
    subjectStatusFilter,
  ]
    .filter(Boolean)
    .forEach((element) => {
      element.value = "";
    });

  renderSubjects();

  showToast("絞り込みを解除しました");
}

function updateFilterOptions() {
  updateCategoryFilterOptions();
}

function updateCategoryFilterOptions() {
  if (!subjectCategoryFilter) {
    return;
  }

  const currentValue = subjectCategoryFilter.value;

  const categories = new Set();

  subjects.forEach((subject) => {
    if (subject.category) {
      categories.add(subject.category);
    }
  });

  curricula.forEach((curriculum) => {
    curriculum.categoryRequirements.forEach((requirement) => {
      const category = String(requirement.category || "").trim();

      if (category) {
        categories.add(category);
      }
    });
  });

  subjectCategoryFilter.innerHTML = `

        <option value="">
            すべて
        </option>

        <option value="__unset__">
            未設定
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

  const exists = Array.from(subjectCategoryFilter.options).some(
    (option) => option.value === currentValue,
  );

  if (exists) {
    subjectCategoryFilter.value = currentValue;
  }
}

/* ========================================
   登録状況
======================================== */

function updateSummary() {
  setText(subjectCount, subjects.length);

  const incompleteCount = subjects.filter(isSubjectIncomplete).length;

  const unassignedCount = subjects.filter(
    (subject) => subject.curriculumIds.length === 0,
  ).length;

  const inactiveCount = subjects.filter((subject) => !subject.active).length;

  setText(incompleteSubjectCount, incompleteCount);

  setText(unassignedCurriculumCount, unassignedCount);

  setText(inactiveSubjectCount, inactiveCount);

  if (incompleteNextButton) {
    incompleteNextButton.disabled = incompleteCount === 0;
  }

  if (incompleteCount === 0) {
    incompleteNavigationIndex = -1;
  }
}

function isSubjectIncomplete(subject) {
  return getSubjectWarnings(subject).length > 0;
}

function getSubjectWarnings(subject) {
  const warnings = [];

  if (!subject.name) {
    warnings.push("科目名");
  }

  if (!subject.subjectKey) {
    warnings.push("subjectKey");
  }

  if (!subject.department) {
    warnings.push("学科");
  }

  if (subject.department === "リハビリテーション学科" && !subject.major) {
    warnings.push("専攻");
  }

  if (subject.curriculumIds.length === 0) {
    warnings.push("対象カリキュラム");
  }

  if (!subject.grade) {
    warnings.push("学年");
  }

  if (!subject.semester) {
    warnings.push("学期");
  }

  if (!subject.requirementType) {
    warnings.push("必修・選択・自由");
  }

  if (!subject.category) {
    warnings.push("科目区分");
  }

  if (subject.credits <= 0) {
    warnings.push("単位数");
  }

  if (subject.lectureCount <= 0) {
    warnings.push("講義回数");
  }

  return warnings;
}

/* ========================================
   未入力科目への移動
======================================== */

function getIncompleteSubjects() {
  return subjects.filter(isSubjectIncomplete);
}

function jumpToNextIncompleteSubject() {
  syncAllEditors();

  const incompleteSubjects = getIncompleteSubjects();

  if (incompleteSubjects.length === 0) {
    incompleteNavigationIndex = -1;

    showToast("未入力の科目はありません");

    return;
  }

  resetSubjectFilters();

  if (
    incompleteNavigationIndex < 0 ||
    incompleteNavigationIndex >= incompleteSubjects.length - 1
  ) {
    incompleteNavigationIndex = 0;
  } else {
    incompleteNavigationIndex++;
  }

  const target = incompleteSubjects[incompleteNavigationIndex];

  if (!target) {
    return;
  }

  scrollToSubject(target.localId);

  showToast(
    `未入力科目 ` +
      `${incompleteNavigationIndex + 1}` +
      ` / ${incompleteSubjects.length}`,
  );
}

function scrollToSubject(localId) {
  requestAnimationFrame(() => {
    const targetCard = subjectEditorList?.querySelector(
      `.subject-editor-card` + `[data-local-id="${cssEscape(localId)}"]`,
    );

    if (!targetCard) {
      return;
    }

    targetCard.scrollIntoView({
      behavior: "smooth",

      block: "center",
    });

    targetCard.classList.remove("subject-jump-highlight");

    void targetCard.offsetWidth;

    targetCard.classList.add("subject-jump-highlight");

    setTimeout(() => {
      targetCard.classList.remove("subject-jump-highlight");
    }, 1600);
  });
}

function scrollToRequestedSubject() {
  if (!requestedSubjectKey) {
    return;
  }

  resetSubjectFilters();

  const target = subjects.find(
    (subject) =>
      subject.subjectKey === requestedSubjectKey ||
      subject.firestoreId === requestedSubjectKey,
  );

  if (!target) {
    showToast("指定された科目が見つかりませんでした");

    return;
  }

  setTimeout(() => {
    scrollToSubject(target.localId);
  }, 200);
}

/* ========================================
   Firestore保存
======================================== */

async function saveSubjectsToFirestore() {
  syncAllEditors();

  const criticalInvalidSubjects = subjects.filter(
    (subject) =>
      !subject.name ||
      !subject.subjectKey ||
      !subject.department ||
      !subject.grade ||
      !subject.semester,
  );

  if (criticalInvalidSubjects.length > 0) {
    alert(
      "科目名・subjectKey・学科・学年・学期は必須です。\n\n" +
        `未入力の科目が` +
        `${criticalInvalidSubjects.length}件あります。`,
    );

    return;
  }

  const duplicateKeys = findDuplicateSubjectKeys();

  if (duplicateKeys.length > 0) {
    alert("subjectKeyが重複しています。\n\n" + duplicateKeys.join("\n"));

    return;
  }

  const integrationIncomplete = subjects.filter(isSubjectIncomplete);

  if (integrationIncomplete.length > 0) {
    const continueSave = confirm(
      `カリキュラム判定に必要な項目が不足している科目が` +
        `${integrationIncomplete.length}件あります。\n\n` +
        "保存はできますが、学生側の卒業要件判定や" +
        "単位集計が正しく動かない可能性があります。\n\n" +
        "このまま保存しますか？",
    );

    if (!continueSave) {
      return;
    }
  }

  const ok = confirm(`${subjects.length}科目をFirestoreへ保存しますか？`);

  if (!ok) {
    return;
  }

  if (!saveSubjectsButton) {
    return;
  }

  const originalText = saveSubjectsButton.textContent;

  try {
    saveSubjectsButton.disabled = true;

    saveSubjectsButton.textContent = "保存中...";

    const newDocumentIds = new Set();

    const renamedOldIds = new Set();

    const serializedSubjects = subjects.map((subject) => {
      const documentId = createFirestoreDocumentId(subject.subjectKey);

      newDocumentIds.add(documentId);

      if (subject.firestoreId && subject.firestoreId !== documentId) {
        renamedOldIds.add(subject.firestoreId);
      }

      return {
        subject,

        documentId,

        data: serializeSubject(subject),
      };
    });

    const deleteIds = new Set([...deletedDocumentIds, ...renamedOldIds]);

    const operations = [];

    for (const documentId of deleteIds) {
      if (newDocumentIds.has(documentId)) {
        continue;
      }

      operations.push({
        type: "delete",

        reference: doc(db, "subjects", documentId),
      });
    }

    serializedSubjects.forEach((item) => {
      operations.push({
        type: "set",

        reference: doc(db, "subjects", item.documentId),

        data: {
          ...item.data,

          updatedAt: serverTimestamp(),

          updatedBy: studentNumber || "",
        },
      });
    });

    await commitOperationsInChunks(operations);

    serializedSubjects.forEach((item) => {
      item.subject.firestoreId = item.documentId;

      item.subject.rawData = {
        ...item.data,
      };

      item.subject.curriculumInferred = false;
    });

    deletedDocumentIds.clear();

    setUnsavedState(false);

    showToast(`${subjects.length}科目を保存しました`);

    updateFilterOptions();

    renderSubjects();
  } catch (error) {
    console.error("科目保存エラー:", error);

    alert("Firestoreへの保存に失敗しました。");
  } finally {
    saveSubjectsButton.disabled = false;

    saveSubjectsButton.textContent = originalText;
  }
}

async function commitOperationsInChunks(operations) {
  const chunkSize = 450;

  for (let index = 0; index < operations.length; index += chunkSize) {
    const chunk = operations.slice(index, index + chunkSize);

    const batch = writeBatch(db);

    chunk.forEach((operation) => {
      if (operation.type === "delete") {
        batch.delete(operation.reference);
      } else {
        batch.set(
          operation.reference,

          operation.data,

          {
            merge: true,
          },
        );
      }
    });

    await batch.commit();
  }
}

/* ========================================
   科目保存形式
======================================== */

function serializeSubject(subject) {
  const curriculumIds = [
    ...new Set(
      subject.curriculumIds
        .map(String)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];

  const requirementTags = [
    ...new Set(
      subject.requirementTags
        .map(String)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];

  return {
    ...subject.rawData,

    name: subject.name,

    subjectKey: subject.subjectKey,

    department: subject.department,

    major: subject.major,

    curriculumIds,

    /*
        旧処理との互換性のため
        先頭のカリキュラムIDも保存
        */

    curriculumId: curriculumIds[0] || "",

    category: subject.category,

    subcategory: subject.subcategory,

    requirementType: subject.requirementType,

    requirementTags,

    /*
        course_registration.jsを
        新形式へ置き換えるまでの互換用
        */

    required: subject.requirementType === "required",

    grade: subject.grade,

    semester: subject.semester,

    credits: subject.credits,

    lectureCount: subject.lectureCount,

    isPractical: subject.isPractical,

    active: subject.active,

    attendanceNotificationDefaultEnabled:
      subject.attendanceNotificationDefaultEnabled,

    attendanceReminderMinutes: subject.attendanceReminderMinutes,
  };
}

/* ========================================
   全入力欄同期
======================================== */

function syncAllEditors() {
  if (!subjectEditorList) {
    return;
  }

  const cards = subjectEditorList.querySelectorAll(".subject-editor-card");

  cards.forEach((card) => {
    const subject = subjects.find(
      (item) => item.localId === card.dataset.localId,
    );

    if (!subject) {
      return;
    }

    card.querySelectorAll("[data-field]").forEach((input) => {
      updateSubjectFromInput(subject, input);
    });
  });
}

/* ========================================
   重複チェック
======================================== */

function findDuplicateSubjectKeys() {
  const counts = new Map();

  subjects.forEach((subject) => {
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

/* ========================================
   カリキュラム管理・プレビュー
======================================== */

function openCurriculumAdmin() {
  let url = "curriculum_admin.html";

  const selectedCurriculumId = getSelectedCurriculumFilter();

  if (selectedCurriculumId) {
    url += "?curriculumId=" + encodeURIComponent(selectedCurriculumId);
  }

  navigateWithUnsavedCheck(url);
}

function previewStudentRegistrationPage() {
  const parameters = new URLSearchParams();

  parameters.set("preview", "1");

  const selectedCurriculumId = getSelectedCurriculumFilter();

  if (selectedCurriculumId) {
    parameters.set("curriculumId", selectedCurriculumId);
  }

  window.open("course_registration.html?" + parameters.toString(), "_blank");
}

/* ========================================
   未保存状態
======================================== */

function markUnsaved() {
  setUnsavedState(true);
}

function setUnsavedState(unsaved) {
  hasUnsavedChanges = unsaved;

  if (!subjectSaveStatus) {
    return;
  }

  subjectSaveStatus.textContent = unsaved
    ? "未保存の変更があります"
    : "変更なし";

  subjectSaveStatus.classList.toggle("has-unsaved", unsaved);
}

/* ========================================
   ページ移動
======================================== */

function navigateWithUnsavedCheck(url) {
  if (hasUnsavedChanges) {
    const proceed = confirm(
      "保存していない科目変更があります。\n\n" + "変更を破棄して移動しますか？",
    );

    if (!proceed) {
      return;
    }
  }

  hasUnsavedChanges = false;

  location.href = url;
}

/* ========================================
   補助処理
======================================== */

function createOption(value, label, currentValue) {
  const selected = String(value) === String(currentValue) ? "selected" : "";

  return `

        <option
            value="${escapeAttribute(value)}"
            ${selected}>

            ${escapeHtml(label)}

        </option>

    `;
}

function createLocalId(index = 0) {
  return (
    "subject_" +
    Date.now() +
    "_" +
    index +
    "_" +
    Math.random().toString(36).slice(2, 8)
  );
}

function createFirestoreDocumentId(subjectKey) {
  return String(subjectKey).trim().replace(/\//g, "／");
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

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map(String)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function splitRequirementTags(value) {
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
  const departmentComparison = subjectA.department.localeCompare(
    subjectB.department,
    "ja",
  );

  if (departmentComparison !== 0) {
    return departmentComparison;
  }

  const majorComparison = subjectA.major.localeCompare(subjectB.major, "ja");

  if (majorComparison !== 0) {
    return majorComparison;
  }

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

function formatFileDate(date) {
  return (
    `${date.getFullYear()}` +
    `${String(date.getMonth() + 1).padStart(2, "0")}` +
    `${String(date.getDate()).padStart(2, "0")}` +
    "_" +
    `${String(date.getHours()).padStart(2, "0")}` +
    `${String(date.getMinutes()).padStart(2, "0")}`
  );
}

function getSelectedCurriculumFilter() {
  const value = subjectCurriculumFilter?.value || "";

  if (!value || value.startsWith("__")) {
    return "";
  }

  return value;
}

function isNormalFilterValue(value) {
  return Boolean(value && !String(value).startsWith("__"));
}

function clearFiltersThatHideSubject(subject) {
  if (
    subjectCurriculumFilter &&
    subjectCurriculumFilter.value === "__unset__" &&
    subject.curriculumIds.length > 0
  ) {
    subjectCurriculumFilter.value = "";
  }

  if (
    subjectDepartmentFilter &&
    subjectDepartmentFilter.value &&
    subjectDepartmentFilter.value !== subject.department
  ) {
    subjectDepartmentFilter.value = "";
  }

  if (
    subjectMajorFilter &&
    subjectMajorFilter.value &&
    subjectMajorFilter.value !== subject.major
  ) {
    subjectMajorFilter.value = "";
  }
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(String(value));
  }

  return String(value).replace(/["\\]/g, "\\$&");
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
