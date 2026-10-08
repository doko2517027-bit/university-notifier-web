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

const examMode = "exam";
let categories = [];
let currentSubjects = [];
const adminCategoryStorageKey = "caremateExamAdminSelectedCategory_exam";
let activeAdminGroupId = localStorage.getItem(adminCategoryStorageKey) || "";
const openAdminGroupIds = new Set();
const openAdminSubjectIds = new Set();

if (new URLSearchParams(location.search).get("mode") === "national") location.replace("exam_admin.html");

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
const catalogSearch = document.getElementById("examAdminSearch");
const categoryNavigation = document.getElementById("examAdminCategoryNav");

await initializePage([
  loadProfileImage(topProfileImage),
  loadExamSettings().catch((e) => {
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
  categories = Array.isArray(snapshot.data()?.categories)
    ? snapshot.data().categories.filter((item) => item && item.id && item.name)
    : [];
  renderCategories();
  await loadSubjects();
}

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
  document.getElementById("examAdminCategoryCount").textContent = String(items.length);
  newSubjectCategory.innerHTML = categoryOptions();
  categoryList.innerHTML = items.length
    ? items.map((item) => `<div class="exam-admin-category-row" data-category-id="${escapeHtml(item.id)}"><input class="category-edit-name" type="text" maxlength="80" value="${escapeHtml(item.name)}" aria-label="区分名"><span>${currentSubjects.filter((subject) => subject.groupId === item.id).length}科目</span><button class="btn btn-secondary save-category" type="button">保存</button><button class="btn btn-danger delete-category" type="button">削除</button></div>`).join("")
    : "<p>区分はまだありません。まず区分を追加してください。</p>";
  renderAdminCategoryNavigation();
}

function adminCategoryNavigationItems() {
  const registeredCategories = modeCategories();
  const categoryIds = new Set(registeredCategories.map((item) => item.id));
  const counts = new Map(registeredCategories.map((item) => [item.id, 0]));
  let unclassifiedCount = 0;
  currentSubjects.forEach((subject) => {
    const id = String(subject.groupId || "");
    if (categoryIds.has(id)) counts.set(id, (counts.get(id) || 0) + 1);
    else unclassifiedCount += 1;
  });
  const items = registeredCategories.map((item) => ({
    ...item,
    count: counts.get(item.id) || 0,
  }));
  if (unclassifiedCount) {
    items.push({ id: "unclassified", name: "未分類", count: unclassifiedCount });
  }
  return items;
}

function ensureActiveAdminGroup(items) {
  if (activeAdminGroupId === "all" || items.some((item) => item.id === activeAdminGroupId)) return;
  activeAdminGroupId = items[0]?.id || "all";
  localStorage.setItem(adminCategoryStorageKey, activeAdminGroupId);
}

function renderAdminCategoryNavigation() {
  if (!categoryNavigation) return;
  const items = adminCategoryNavigationItems();
  ensureActiveAdminGroup(items);
  const buttons = [
    { id: "all", name: "全区分", count: currentSubjects.length },
    ...items,
  ];
  categoryNavigation.innerHTML = buttons.map((item) => {
    const active = activeAdminGroupId === item.id;
    return `<button type="button" class="exam-admin-category-tab ${active ? "is-active" : ""}" data-admin-category-id="${escapeHtml(item.id)}" role="tab" aria-selected="${active}"><span>${item.id === "all" ? "▦" : "🗂️"}</span><b>${escapeHtml(item.name)}</b><small>${item.count}科目</small></button>`;
  }).join("");
}

categoryNavigation?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-admin-category-id]");
  if (!button) return;
  activeAdminGroupId = button.dataset.adminCategoryId || "all";
  localStorage.setItem(adminCategoryStorageKey, activeAdminGroupId);
  renderAdminCategoryNavigation();
  updateSubjectSearch();
  subjectList.scrollIntoView({ behavior: "smooth", block: "start" });
});

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
    const id = crypto.randomUUID();
    activeAdminGroupId = id;
    localStorage.setItem(adminCategoryStorageKey, activeAdminGroupId);
    await saveCategories([...categories, { id, name, mode: examMode }]);
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

  activeAdminGroupId = groupId || "unclassified";
  localStorage.setItem(adminCategoryStorageKey, activeAdminGroupId);
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
  document.getElementById("examAdminSubjectCount").textContent = String(subjects.length);
  document.getElementById("examAdminUnitCount").textContent = String(subjects.reduce((count, item) => count + item.unitSnap.size, 0));

  if (subjects.length === 0) {
    subjectList.innerHTML = "科目はまだありません。";
    updateSubjectSearch();
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
    section.open = activeAdminGroupId === category.id || openAdminGroupIds.has(section.dataset.groupId);
    section.addEventListener("toggle", () => {
      if (section.open) openAdminGroupIds.add(section.dataset.groupId);
      else openAdminGroupIds.delete(section.dataset.groupId);
    });
    const summary = document.createElement("summary");
    summary.textContent = `${category.name}　${items.length}科目`;
    section.dataset.groupName = category.name;
    section.dataset.totalCount = String(items.length);
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
    subjectCard.dataset.search = `${subject.name || ""} ${[...unitSnap.docs].map((doc) => doc.data().name || "").join(" ")}`.toLocaleLowerCase("ja");

    const subjectHeader = document.createElement("div");
    subjectHeader.className = "exam-admin-subject-header";
    subjectHeader.setAttribute("role", "button");
    subjectHeader.tabIndex = 0;
    subjectHeader.setAttribute("aria-expanded", String(openAdminSubjectIds.has(subjectDoc.id)));

    subjectHeader.innerHTML = `
            <span class="exam-admin-subject-icon" aria-hidden="true">📚</span>
            <span class="exam-admin-subject-label"><strong>${escapeHtml(subject.name)}</strong>
              <small>${unitSnap.size}単元${subject.completed ? " ・ 実施済" : ""}</small></span>
            ${
              subject.completed &&
              subject.completedDate &&
              subject.completedPeriod
                ? `
                        <span class="exam-admin-subject-date">
                            ${formatCompletedExamDate(subject.completedDate)}
                            ${subject.completedPeriod}限目
                        </span>
                    `
                : ""
            }
            <span class="exam-admin-row-arrow" aria-hidden="true">⌄</span>
        `;

    const subjectContent = document.createElement("div");
    subjectContent.className = "exam-admin-subject-content";
    subjectContent.style.display = openAdminSubjectIds.has(subjectDoc.id) ? "block" : "none";
    subjectCard.classList.toggle("is-open", subjectContent.style.display === "block");

    subjectHeader.onclick = () => {
      subjectContent.style.display =
        subjectContent.style.display === "none" ? "block" : "none";
      subjectCard.classList.toggle("is-open", subjectContent.style.display === "block");
      subjectHeader.setAttribute("aria-expanded", String(subjectContent.style.display === "block"));
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
        unitHeader.setAttribute("aria-expanded", "false");

        unitHeader.innerHTML = `
                    <span class="exam-admin-unit-icon" aria-hidden="true">📘</span>
                    <span class="exam-admin-unit-label"><strong>${escapeHtml(unit.name)}</strong><small>${escapeHtml(unit.range || "範囲未設定")}</small></span>
                    <span class="exam-admin-row-arrow" aria-hidden="true">⌄</span>
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
          unitHeader.setAttribute("aria-expanded", String(unitMenu.style.display === "block"));
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
  updateSubjectSearch();
}

function updateSubjectSearch() {
  const query = catalogSearch.value.trim().toLocaleLowerCase("ja");
  let visibleCount = 0;
  subjectList.querySelectorAll(".exam-admin-group").forEach((group) => {
    let groupCount = 0;
    group.querySelectorAll(".exam-admin-subject-card").forEach((card) => {
      const matches = !query || card.dataset.search.includes(query);
      card.hidden = !matches;
      if (matches) groupCount++;
    });
    const categoryMatches = Boolean(query) || activeAdminGroupId === "all" || group.dataset.groupId === activeAdminGroupId;
    group.hidden = groupCount === 0 || !categoryMatches;
    group.querySelector("summary").textContent = `${group.dataset.groupName}　${query ? groupCount : group.dataset.totalCount}科目`;
    if (query && groupCount) group.open = true;
    else if (!query) group.open = activeAdminGroupId === group.dataset.groupId || (activeAdminGroupId === "all" && openAdminGroupIds.has(group.dataset.groupId));
    if (categoryMatches) visibleCount += groupCount;
  });
  document.getElementById("examAdminResultCount").textContent = query
    ? `${visibleCount}件見つかりました`
    : `${visibleCount}科目を表示`;
  const noResults = document.getElementById("examAdminNoResults");
  noResults.textContent = query
    ? "一致する科目・単元がありません。検索語を変えてください。"
    : "この区分には科目がありません。上の入力欄から追加できます。";
  noResults.hidden = visibleCount > 0;
}

catalogSearch.addEventListener("input", updateSubjectSearch);

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
      activeAdminGroupId = card.querySelector(".edit-subject-category").value || "unclassified";
      localStorage.setItem(adminCategoryStorageKey, activeAdminGroupId);
      openAdminGroupIds.add(activeAdminGroupId);
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
