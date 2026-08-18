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
  query,
  orderBy,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const themeButton = document.getElementById("themeButton");

const topProfileImage = document.getElementById("topProfileImage");

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

await initializePage([
  loadProfileImage(topProfileImage),
  loadExamSettings().catch((e) => {
    console.error("テスト設定読み込み失敗", e);
  }),
  loadSubjects(),
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

saveExamSettings.onclick = async () => {
  try {
    const schedule = examSchedule.value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "")
      .map((line) => {
        const [date = "", subject = "", time = "", room = ""] = line
          .split("|")
          .map((value) => value.trim());

        return {
          date,
          subject,
          time,
          room,
        };
      });

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

  if (!name) {
    alert("科目名を入力してください。");
    return;
  }

  await addDoc(collection(db, "examSubjects"), {
    name,
    completed: false,
    completedDate: "",
    completedPeriod: "",
    createdAt: new Date(),
    createdBy: studentNumber,
  });

  subjectName.value = "";

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

async function loadSubjects() {
  const q = query(collection(db, "examSubjects"), orderBy("createdAt", "desc"));

  const snap = await getDocs(q);

  const subjects = await Promise.all(
    snap.docs.map(async (subjectDoc) => {
      const unitSnap = await getDocs(
        query(
          collection(db, "examSubjects", subjectDoc.id, "units"),
          orderBy("createdAt", "desc"),
        ),
      );

      return {
        subjectDoc,
        subject: subjectDoc.data(),
        unitSnap,
      };
    }),
  );

  if (snap.empty) {
    subjectList.innerHTML = "科目はまだありません。";
    return;
  }

  subjectList.innerHTML = "";

  for (const { subjectDoc, subject, unitSnap } of subjects) {
    const subjectCard = document.createElement("div");
    subjectCard.className = "card setting-card";

    const subjectHeader = document.createElement("div");

    subjectHeader.innerHTML = `
            <h3>
                📚 ${subject.name}
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
                            タップして単元を表示
                        </p>
                    `
            }

        `;

    const subjectContent = document.createElement("div");
    subjectContent.style.display = "none";

    subjectHeader.onclick = () => {
      subjectContent.style.display =
        subjectContent.style.display === "none" ? "block" : "none";
    };

    subjectContent.innerHTML = `
            <input
                id="unitName_${subjectDoc.id}"
                type="text"
                placeholder="単元名 例：循環器">

            <br><br>

            <input
                id="unitRange_${subjectDoc.id}"
                type="text"
                placeholder="試験範囲 任意 例：第1回〜第3回">

            <br><br>

            <label>
                実施日
            </label>

            <br>

            <input
                type="date"
                class="completed-date"
                data-subject-id="${subjectDoc.id}"
                value="${subject.completedDate || ""}">

            <br><br>

            <label>
                実施時限
            </label>

            <br>

            <select
                class="completed-period"
                data-subject-id="${subjectDoc.id}">

                <option
                    value=""
                    ${!subject.completedPeriod ? "selected" : ""}>
                    時限を選択
                </option>

                <option
                    value="1"
                    ${String(subject.completedPeriod) === "1" ? "selected" : ""}>
                    1限目
                </option>

                <option
                    value="2"
                    ${String(subject.completedPeriod) === "2" ? "selected" : ""}>
                    2限目
                </option>

                <option
                    value="3"
                    ${String(subject.completedPeriod) === "3" ? "selected" : ""}>
                    3限目
                </option>

                <option
                    value="4"
                    ${String(subject.completedPeriod) === "4" ? "selected" : ""}>
                    4限目
                </option>

                <option
                    value="5"
                    ${String(subject.completedPeriod) === "5" ? "selected" : ""}>
                    5限目
                </option>

                <option
                    value="6"
                    ${String(subject.completedPeriod) === "6" ? "selected" : ""}>
                    6限目
                </option>

            </select>

            <br><br>

            <label>
                <input
                    type="checkbox"
                    class="completed-toggle"
                    data-subject-id="${subjectDoc.id}"
                    ${subject.completed ? "checked" : ""}>
                この科目を実施済みにする
            </label>

            <br><br>

            <button
                class="btn btn-primary add-unit"
                data-subject-id="${subjectDoc.id}">
                単元を追加
            </button>

            <br><br>
        `;

    const unitList = document.createElement("div");

    if (unitSnap.empty) {
      unitList.innerHTML = "<p>単元はまだありません。</p>";
    } else {
      unitSnap.forEach((unitDoc) => {
        const unit = unitDoc.data();

        const unitCard = document.createElement("div");

        unitCard.className = "card setting-card";

        const unitHeader = document.createElement("div");

        unitHeader.innerHTML = `
                    <h4>📘 ${unit.name}</h4>
                    <small>${unit.range || ""}</small>
                    <p>タップして管理項目を表示</p>
                `;

        const unitMenu = document.createElement("div");

        unitMenu.style.display = "none";

        unitMenu.innerHTML = `
                    <button
                        class="btn btn-secondary manage-materials"
                        data-subject-id="${subjectDoc.id}"
                        data-unit-id="${unitDoc.id}">
                        📄 資料管理
                    </button>

                    <br><br>

                    <button
                        class="btn btn-secondary manage-questions"
                        data-subject-id="${subjectDoc.id}"
                        data-unit-id="${unitDoc.id}">
                        📝 問題一覧
                    </button>

                    <br><br>

                    <button
                        class="btn btn-danger delete-unit"
                        data-subject-id="${subjectDoc.id}"
                        data-unit-id="${unitDoc.id}">
                        単元を削除
                    </button>
                `;

        unitHeader.onclick = () => {
          unitMenu.style.display =
            unitMenu.style.display === "none" ? "block" : "none";
        };

        unitCard.appendChild(unitHeader);
        unitCard.appendChild(unitMenu);
        unitList.appendChild(unitCard);
      });
    }

    subjectContent.appendChild(unitList);

    subjectContent.insertAdjacentHTML(
      "beforeend",
      `
                <br>

                <button
                    class="btn btn-danger delete-subject"
                    data-id="${subjectDoc.id}">
                    科目を削除
                </button>
            `,
    );

    subjectCard.appendChild(subjectHeader);
    subjectCard.appendChild(subjectContent);
    subjectList.appendChild(subjectCard);
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
