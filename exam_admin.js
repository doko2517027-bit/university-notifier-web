import {
  db,
  studentNumber,
  setupTheme,
  initializePage,
  loadProfileImage,
  isAdmin,
} from "./common.js";

import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { isSubjectInMode, getModeCategories, groupCatalogItems, parseExamSchedule } from "./exam_catalog.mjs";

const themeButton = document.getElementById("themeButton");

const topProfileImage = document.getElementById("topProfileImage");

const examMode = new URLSearchParams(location.search).get("mode") === "national" ? "national" : "exam";
const isNational = examMode === "national";
const modeTitle = isNational ? "国家試験対策管理" : "テスト管理";
let categories = [];
let currentSubjects = [];
const openAdminGroupIds = new Set();
const openAdminSubjectIds = new Set();

if (isNational) {
  document.title = `${modeTitle} | CareMate`;
  document.querySelector(".top-buttons h2").textContent = `🎓 ${modeTitle}`;
  document.querySelector(".setting-card h2").textContent = `🎓 ${modeTitle}`;
  document.querySelector(".setting-card > p").textContent = "国家試験対策の区分・科目・単元・問題を管理します。";
  document.getElementById("examSettingsCard").hidden = true;
  document.getElementById("nationalVisibilityCard").hidden = false;
}

setupTheme(themeButton);

const admin = await isAdmin();

if (!admin) {
  alert("管理者のみアクセスできます。");

  location.href = "index.html";
}

const examEnabled = document.getElementById("examEnabled");
const examTitle = document.getElementById("examTitle");
const examStartDate = document.getElementById("examStartDate");
const examEndDate = document.getElementById("examEndDate");
const examSchedule = document.getElementById("examSchedule");
const examShowPopup = document.getElementById("examShowPopup");
const examShowCountdown = document.getElementById("examShowCountdown");
const examShowHomeButton = document.getElementById("examShowHomeButton");
const examShowDailyQuestion = document.getElementById("examShowDailyQuestion");
const saveExamSettings = document.getElementById("saveExamSettings");
const subjectName = document.getElementById("subjectName");
const addSubject = document.getElementById("addSubject");
const subjectList = document.getElementById("subjectList");
const categoryName = document.getElementById("categoryName");
const addCategory = document.getElementById("addCategory");
const categoryList = document.getElementById("categoryList");
const newSubjectCategory = document.getElementById("newSubjectCategory");
const nationalExamEnabled = document.getElementById("nationalExamEnabled");

await initializePage([
  loadProfileImage(topProfileImage),
  (isNational ? Promise.resolve() : loadExamSettings()).catch((e) => {
    console.error("テスト設定読み込み失敗", e);
  }),
  loadCatalogAndSubjects(),
]);

document.getElementById("backButton").onclick = () => {
  location.href = "admin.html";
};

document.getElementById("profileButton").onclick = () => {
  location.href = "profile.html";
};

async function loadExamSettings() {
  const snap = await getDoc(doc(db, "system", "exam"));

  if (!snap.exists()) return;

  const data = snap.data();

  examEnabled.checked = data.enabled === true;
  examTitle.value = data.title || "";
  examStartDate.value = data.startDate || "";
  examEndDate.value = data.endDate || "";
  examSchedule.value = Array.isArray(data.schedule)
    ? data.schedule
        .map((item) =>
          [
            item.date || "",
            item.subject || "",
            item.time || "",
            item.room || "",
          ].join("|"),
        )
        .join("\n")
    : "";
  examShowPopup.checked = data.showPopup ?? true;
  examShowCountdown.checked = data.showCountdown ?? true;
  examShowHomeButton.checked = data.showHomeButton ?? true;
  examShowDailyQuestion.checked = data.showDailyQuestion ?? true;
}

async function loadCatalogAndSubjects() {
  const snapshot = await getDoc(doc(db, "system", "exam"));
  nationalExamEnabled.checked = snapshot.data()?.nationalEnabled === true;
  categories = Array.isArray(snapshot.data()?.categories)
    ? snapshot.data().categories.filter((item) => item && item.id && item.name)
    : [];
  renderCategories();
  await loadSubjects();
}

document.getElementById("saveNationalVisibility").onclick = async () => {
  try {
    await setDoc(doc(db, "system", "exam"), {
      nationalEnabled: nationalExamEnabled.checked,
      updatedAt: new Date(), updatedBy: studentNumber,
    }, { merge: true });
    alert(nationalExamEnabled.checked ? "国家試験対策を学生に表示します。" : "国家試験対策を学生に表示しません。");
  } catch (error) {
    console.error("国家試験対策の表示設定保存失敗:", error);
    alert("表示設定を保存できませんでした。");
  }
};

function modeCategories() {
  return getModeCategories(categories, examMode);
}

function categoryOptions(selectedId = "") {
  return `<option value="">未分類</option>${modeCategories()
    .map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item.name)}</option>`)
    .join("")}`;
}

function renderCategories() {
  const items = modeCategories();
  newSubjectCategory.innerHTML = categoryOptions();
  categoryList.innerHTML = items.length
    ? items.map((item) => `<div class="exam-admin-category-row" data-category-id="${escapeHtml(item.id)}"><input class="category-edit-name" type="text" maxlength="80" value="${escapeHtml(item.name)}" aria-label="区分名"><span>${currentSubjects.filter((subject) => subject.groupId === item.id).length}科目</span><button class="btn btn-secondary save-category" type="button">保存</button><button class="btn btn-danger delete-category" type="button">削除</button></div>`).join("")
    : "<p>区分はまだありません。まず区分を追加してください。</p>";
}

async function saveCategories(nextCategories) {
  await setDoc(doc(db, "system", "exam"), {
    categories: nextCategories,
    updatedAt: new Date(),
    updatedBy: studentNumber,
  }, { merge: true });
  categories = nextCategories;
  renderCategories();
  await loadSubjects();
}

addCategory.onclick = async () => {
  const name = categoryName.value.trim();
  if (!name) return alert("区分名を入力してください。");
  if (modeCategories().some((item) => item.name === name)) return alert("同じ名前の区分があります。");
  try {
    await saveCategories([...categories, { id: crypto.randomUUID(), name, mode: examMode }]);
    categoryName.value = "";
  } catch (error) {
    console.error("区分追加失敗:", error);
    alert("区分を追加できませんでした。");
  }
};

categoryList.addEventListener("click", async (event) => {
  const row = event.target.closest("[data-category-id]");
  if (!row) return;
  const id = row.dataset.categoryId;
  const item = categories.find((category) => category.id === id);
  if (!item) return;
  try {
    if (event.target.closest(".save-category")) {
      const name = row.querySelector(".category-edit-name").value.trim();
      if (!name) return alert("区分名を入力してください。");
      await saveCategories(categories.map((category) => category.id === id ? { ...category, name } : category));
    } else if (event.target.closest(".delete-category")) {
      if (currentSubjects.some((subject) => subject.groupId === id)) return alert("この区分に科目があります。先に科目を移動してください。");
      if (!confirm(`「${item.name}」を削除しますか？`)) return;
      await saveCategories(categories.filter((category) => category.id !== id));
    }
  } catch (error) {
    console.error("区分更新失敗:", error);
    alert("区分を更新できませんでした。");
  }
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

saveExamSettings.onclick = async () => {
  try {
    const schedule = parseExamSchedule(examSchedule.value);

    await setDoc(
      doc(db, "system", "exam"),
      {
        enabled: examEnabled.checked,
        title: examTitle.value.trim(),
        startDate: examStartDate.value,
        endDate: examEndDate.value,
        showPopup: examShowPopup.checked,
        showCountdown: examShowCountdown.checked,
        showHomeButton: examShowHomeButton.checked,
        showDailyQuestion: examShowDailyQuestion.checked,
        schedule,
        updatedAt: new Date(),
        updatedBy: studentNumber,
      },
      {
        merge: true,
      },
    );

    alert("テスト設定を保存しました。");
  } catch (e) {
    console.error("テスト設定保存失敗", e);
    alert("保存に失敗しました。Firestore Rulesを確認してください。");
  }
};

addSubject.onclick = async () => {
  const name = subjectName.value.trim();
  const groupId = newSubjectCategory.value;

  if (!name) {
    alert("科目名を入力してください。");
    return;
  }

  await addDoc(collection(db, "examSubjects"), {
    name,
    mode: examMode,
    groupId,
    completed: false,
    completedDate: "",
    completedPeriod: "",
    createdAt: new Date(),
    createdBy: studentNumber,
  });

  subjectName.value = "";

  openAdminGroupIds.add(groupId || "unclassified");

  await loadSubjects();
};

function formatCompletedExamDate(dateValue) {
  if (!dateValue) {
    return "";
  }

  const [year, month, day] = dateValue.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

  return `${month}/${day}` + `（${weekdays[date.getDay()]}）`;
}

function createdAtMillis(data) {
  const value = data?.createdAt;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

async function loadSubjects() {
  // Firestore の orderBy は createdAt がない既存文書を結果から除外する。
  // 学生側と同じ全件を取得し、表示順だけクライアントで決める。
  const snap = await getDocs(collection(db, "examSubjects"));

  const subjects = await Promise.all(
    snap.docs.filter((subjectDoc) => isSubjectInMode(subjectDoc.data(), examMode)).map(async (subjectDoc) => {
      const unitSnap = await getDocs(collection(db, "examSubjects", subjectDoc.id, "units"));

      return {
        subjectDoc,
        subject: subjectDoc.data(),
        unitSnap,
      };
    }),
  );
  subjects.sort((a, b) => createdAtMillis(b.subject) - createdAtMillis(a.subject));

  currentSubjects = subjects.map(({ subjectDoc, subject }) => ({ id: subjectDoc.id, ...subject }));
  renderCategories();

  if (subjects.length === 0) {
    subjectList.innerHTML = "科目はまだありません。";
    return;
  }

  subjectList.innerHTML = "";

  const groupedContainers = new Map();
  const groups = groupCatalogItems(subjects, modeCategories(), (item) => item.subject.groupId);
  for (const category of groups) {
    const items = category.items;
    const section = document.createElement("details");
    section.className = "exam-admin-group";
    section.dataset.groupId = category.id;
    section.open = openAdminGroupIds.has(section.dataset.groupId);
    section.addEventListener("toggle", () => {
      if (section.open) openAdminGroupIds.add(section.dataset.groupId);
      else openAdminGroupIds.delete(section.dataset.groupId);
    });
    const summary = document.createElement("summary");
    summary.textContent = `${category.name}　${items.length}科目`;
    section.appendChild(summary);
    const content = document.createElement("div");
    content.className = "exam-admin-group-content";
    section.appendChild(content);
    subjectList.appendChild(section);
    groupedContainers.set(category.id, content);
  }

  for (const { subjectDoc, subject, unitSnap } of subjects) {
    const subjectCard = document.createElement("div");
    subjectCard.className = "card setting-card exam-admin-subject-card";

    const subjectHeader = document.createElement("div");
    subjectHeader.className = "exam-admin-subject-header";
    subjectHeader.setAttribute("role", "button");
    subjectHeader.tabIndex = 0;

    subjectHeader.innerHTML = `
            <h3>
                📚 ${escapeHtml(subject.name)}
                ${subject.completed ? "　✅ 実施済" : ""}
            </h3>

            ${
              subject.completed &&
              subject.completedDate &&
              subject.completedPeriod
                ? `
                        <p>
                            ${formatCompletedExamDate(subject.completedDate)}
                            ${subject.completedPeriod}限目
                            実施済
                        </p>
                    `
                : `
                        <p>
                            ${unitSnap.size}単元 ・ タップして管理
                        </p>
                    `
            }

        `;

    const subjectContent = document.createElement("div");
    subjectContent.className = "exam-admin-subject-content";
    subjectContent.style.display = openAdminSubjectIds.has(subjectDoc.id) ? "block" : "none";
    subjectCard.classList.toggle("is-open", subjectContent.style.display === "block");

    subjectHeader.onclick = () => {
      subjectContent.style.display =
        subjectContent.style.display === "none" ? "block" : "none";
      subjectCard.classList.toggle("is-open", subjectContent.style.display === "block");
      if (subjectContent.style.display === "block") openAdminSubjectIds.add(subjectDoc.id);
      else openAdminSubjectIds.delete(subjectDoc.id);
    };
    subjectHeader.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        subjectHeader.click();
      }
    };

    subjectContent.innerHTML = `
      <div class="exam-admin-subject-tools">
        <details class="exam-admin-detail">
          <summary>科目名・区分・実施日を編集</summary>
          <div class="exam-admin-edit-grid">
            <label>講義・科目名<input class="edit-subject-name" type="text" value="${escapeHtml(subject.name)}"></label>
            <label>区分<select class="edit-subject-category">${categoryOptions(subject.groupId || "")}</select></label>
            <label>実施日<input type="date" class="completed-date" data-subject-id="${subjectDoc.id}" value="${escapeHtml(subject.completedDate || "")}"></label>
            <label>実施時限
              <select class="completed-period" data-subject-id="${subjectDoc.id}">
                <option value="" ${!subject.completedPeriod ? "selected" : ""}>時限を選択</option>
                ${[1, 2, 3, 4, 5, 6].map((period) => `<option value="${period}" ${String(subject.completedPeriod) === String(period) ? "selected" : ""}>${period}限目</option>`).join("")}
              </select>
            </label>
            <label class="exam-admin-check-label"><input type="checkbox" class="completed-toggle" data-subject-id="${subjectDoc.id}" ${subject.completed ? "checked" : ""}>この科目を実施済みにする</label>
            <button type="button" class="btn btn-primary save-subject" data-subject-id="${subjectDoc.id}">科目名・区分を保存</button>
          </div>
          <small class="exam-admin-field-note">実施日・時限・実施済みは変更時に自動保存されます。</small>
        </details>
        <details class="exam-admin-detail">
          <summary>新しい単元を追加</summary>
          <div class="exam-admin-edit-grid">
            <label>単元・講義名<input id="unitName_${subjectDoc.id}" type="text" placeholder="例：循環器"></label>
            <label>試験範囲・補足<input id="unitRange_${subjectDoc.id}" type="text" placeholder="例：第1回〜第3回"></label>
            <button type="button" class="btn btn-primary add-unit" data-subject-id="${subjectDoc.id}">単元を追加</button>
          </div>
        </details>
      </div>
      <h4 class="exam-admin-unit-heading">単元 ${unitSnap.size}件</h4>
    `;

    const unitList = document.createElement("div");
    unitList.className = "exam-admin-unit-list";

    if (unitSnap.empty) {
      unitList.innerHTML = "<p>単元はまだありません。</p>";
    } else {
      [...unitSnap.docs].sort((a, b) => createdAtMillis(b.data()) - createdAtMillis(a.data())).forEach((unitDoc) => {
        const unit = unitDoc.data();

        const unitCard = document.createElement("div");

        unitCard.className = "card setting-card exam-admin-unit-card";

        const unitHeader = document.createElement("div");
        unitHeader.className = "exam-admin-unit-header";
        unitHeader.setAttribute("role", "button");
        unitHeader.tabIndex = 0;

        unitHeader.innerHTML = `
                    <h4>📘 ${escapeHtml(unit.name)}</h4>
                    <small>${escapeHtml(unit.range || "")}</small>
                    <p>タップして操作</p>
                `;

        const unitMenu = document.createElement("div");
        unitMenu.className = "exam-admin-unit-menu";

        unitMenu.style.display = "none";

        unitMenu.innerHTML = `
          <div class="exam-admin-unit-actions">
            <button type="button" class="btn btn-secondary manage-questions" data-subject-id="${subjectDoc.id}" data-unit-id="${unitDoc.id}">📝 問題を管理</button>
            <button type="button" class="btn btn-secondary manage-materials" data-subject-id="${subjectDoc.id}" data-unit-id="${unitDoc.id}">📄 資料を管理</button>
          </div>
          <details class="exam-admin-detail">
            <summary>単元名・範囲を編集</summary>
            <div class="exam-admin-edit-grid">
              <label>単元・講義名<input class="edit-unit-name" type="text" value="${escapeHtml(unit.name)}"></label>
              <label>試験範囲・補足<input class="edit-unit-range" type="text" value="${escapeHtml(unit.range || "")}"></label>
              <button type="button" class="btn btn-primary save-unit" data-subject-id="${subjectDoc.id}" data-unit-id="${unitDoc.id}">単元情報を保存</button>
            </div>
          </details>
          <button type="button" class="btn btn-danger delete-unit exam-admin-delete-action" data-subject-id="${subjectDoc.id}" data-unit-id="${unitDoc.id}">単元を削除</button>
        `;

        unitHeader.onclick = () => {
          unitMenu.style.display =
            unitMenu.style.display === "none" ? "block" : "none";
          unitCard.classList.toggle("is-open", unitMenu.style.display === "block");
        };
        unitHeader.onkeydown = (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            unitHeader.click();
          }
        };

        unitCard.appendChild(unitHeader);
        unitCard.appendChild(unitMenu);
        unitList.appendChild(unitCard);
      });
    }

    subjectContent.appendChild(unitList);

    subjectContent.insertAdjacentHTML(
      "beforeend",
      `<div class="exam-admin-subject-footer"><button type="button" class="btn btn-danger delete-subject" data-id="${subjectDoc.id}">科目を削除</button></div>`,
    );

    subjectCard.appendChild(subjectHeader);
    subjectCard.appendChild(subjectContent);
    (groupedContainers.get(subject.groupId) || groupedContainers.get("unclassified"))?.appendChild(subjectCard);
  }
}

document.addEventListener("change", async (e) => {
  const isCompletedToggle = e.target.classList.contains("completed-toggle");

  const isCompletedDate = e.target.classList.contains("completed-date");

  const isCompletedPeriod = e.target.classList.contains("completed-period");

  if (!isCompletedToggle && !isCompletedDate && !isCompletedPeriod) {
    return;
  }

  const subjectId = e.target.dataset.subjectId;

  const completedToggle = document.querySelector(
    `.completed-toggle[data-subject-id="${subjectId}"]`,
  );

  const completedDate = document.querySelector(
    `.completed-date[data-subject-id="${subjectId}"]`,
  );

  const completedPeriod = document.querySelector(
    `.completed-period[data-subject-id="${subjectId}"]`,
  );

  if (completedToggle.checked && !completedDate.value) {
    alert("実施日を入力してください。");

    completedToggle.checked = false;

    return;
  }

  if (completedToggle.checked && !completedPeriod.value) {
    alert("実施時限を選択してください。");

    completedToggle.checked = false;

    return;
  }

  try {
    await setDoc(
      doc(db, "examSubjects", subjectId),
      {
        completed: completedToggle.checked,

        completedDate: completedDate.value,

        completedPeriod: completedPeriod.value,

        updatedAt: new Date(),

        updatedBy: studentNumber,
      },
      {
        merge: true,
      },
    );
  } catch (error) {
    console.error("実施済み設定保存失敗:", error);

    alert("実施済み設定の保存に失敗しました。");

    await loadSubjects();
  }
});

document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("save-subject")) {
    const subjectId = e.target.dataset.subjectId;
    const card = e.target.closest(".exam-admin-subject-card");
    const name = card.querySelector(".edit-subject-name").value.trim();
    if (!name) return alert("科目名を入力してください。");
    try {
      await setDoc(doc(db, "examSubjects", subjectId), {
        name, groupId: card.querySelector(".edit-subject-category").value,
        updatedAt: new Date(), updatedBy: studentNumber,
      }, { merge: true });
      openAdminGroupIds.add(card.querySelector(".edit-subject-category").value || "unclassified");
      await loadSubjects();
    } catch (error) { console.error("科目更新失敗:", error); alert("科目を更新できませんでした。"); }
    return;
  }

  if (e.target.classList.contains("save-unit")) {
    const subjectId = e.target.dataset.subjectId;
    const unitId = e.target.dataset.unitId;
    const card = e.target.closest(".exam-admin-unit-card");
    const name = card.querySelector(".edit-unit-name").value.trim();
    if (!name) return alert("単元名を入力してください。");
    try {
      await setDoc(doc(db, "examSubjects", subjectId, "units", unitId), {
        name, range: card.querySelector(".edit-unit-range").value.trim(),
        updatedAt: new Date(), updatedBy: studentNumber,
      }, { merge: true });
      await loadSubjects();
    } catch (error) { console.error("単元更新失敗:", error); alert("単元を更新できませんでした。"); }
    return;
  }
  // 単元追加
  if (e.target.classList.contains("add-unit")) {
    const subjectId = e.target.dataset.subjectId;

    const unitNameInput = document.getElementById(`unitName_${subjectId}`);

    const unitRangeInput = document.getElementById(`unitRange_${subjectId}`);

    const name = unitNameInput.value.trim();

    const range = unitRangeInput.value.trim();

    if (!name) {
      alert("単元名を入力してください。");
      return;
    }

    const unitRef = await addDoc(
      collection(db, "examSubjects", subjectId, "units"),
      {
        name,
        range,
        createdAt: new Date(),
        createdBy: studentNumber,
      },
    );

    await setDoc(
      doc(
        db,
        "examSubjects",
        subjectId,
        "units",
        unitRef.id,
        "features",
        "menu",
      ),
      {
        daily_question: true,
        fill_blank: true,
        quiz: true,
        must_remember: true,
        weakness: true,
        createdAt: new Date(),
        createdBy: studentNumber,
      },
    );

    openAdminSubjectIds.add(subjectId);
    await loadSubjects();

    return;
  }

  // 科目削除
  if (e.target.classList.contains("delete-subject")) {
    if (!confirm("この科目を削除しますか？")) return;

    await deleteDoc(doc(db, "examSubjects", e.target.dataset.id));

    await loadSubjects();

    return;
  }

  // 資料管理
  if (e.target.classList.contains("manage-materials")) {
    const subjectId = e.target.dataset.subjectId;

    const unitId = e.target.dataset.unitId;

    location.href = `exam_materials_admin.html?subjectId=${subjectId}&unitId=${unitId}`;

    return;
  }

  // 問題一覧
  if (e.target.classList.contains("manage-questions")) {
    const subjectId = e.target.dataset.subjectId;

    const unitId = e.target.dataset.unitId;

    location.href = `exam_questions_admin.html?subjectId=${subjectId}&unitId=${unitId}`;

    return;
  }

  // 単元削除
  if (e.target.classList.contains("delete-unit")) {
    if (!confirm("この単元を削除しますか？")) return;

    await deleteDoc(
      doc(
        db,
        "examSubjects",
        e.target.dataset.subjectId,
        "units",
        e.target.dataset.unitId,
      ),
    );

    await loadSubjects();

    return;
  }
});
