import {
    db,
    studentNumber,
    setupTheme,
    initializePage,
    loadProfileImage,
    isAdmin
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
    deleteDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const themeButton =
    document.getElementById("themeButton");

const topProfileImage =
    document.getElementById("topProfileImage");

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
    loadExamSettings().catch(e => {
        console.error("テスト設定読み込み失敗", e);
    }),
    loadSubjects()
]);

document
.getElementById("backButton")
.onclick = () => {

    location.href = "admin.html";

};

document
.getElementById("profileButton")
.onclick = () => {

    location.href = "profile.html";

};

async function loadExamSettings() {

    const snap = await getDoc(
        doc(db, "system", "exam")
    );

    if (!snap.exists()) return;

    const data = snap.data();

    examEnabled.checked = data.enabled === true;
    examTitle.value = data.title || "";
    examStartDate.value = data.startDate || "";
    examEndDate.value = data.endDate || "";
    examShowPopup.checked = data.showPopup ?? true;
    examShowCountdown.checked = data.showCountdown ?? true;
    examShowHomeButton.checked = data.showHomeButton ?? true;
    examShowDailyQuestion.checked = data.showDailyQuestion ?? true;

}

saveExamSettings.onclick = async () => {

    try {

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
                updatedAt: new Date(),
                updatedBy: studentNumber
            },
            {
                merge: true
            }
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

    await addDoc(
        collection(db, "examSubjects"),
        {
            name,
            createdAt: new Date(),
            createdBy: studentNumber
        }
    );

    subjectName.value = "";

    await loadSubjects();

};

async function loadSubjects() {

    const q = query(
        collection(db, "examSubjects"),
        orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);

    if (snap.empty) {
        subjectList.innerHTML = "科目はまだありません。";
        return;
    }

    subjectList.innerHTML = "";

    for (const subjectDoc of snap.docs) {

        const subject = subjectDoc.data();

        const unitSnap = await getDocs(
            query(
                collection(db, "examSubjects", subjectDoc.id, "units"),
                orderBy("createdAt", "desc")
            )
        );

        let unitHtml = "";

        unitSnap.forEach(unitDoc => {

            const unit = unitDoc.data();

            unitHtml += `
                <div class="setting-row">
                    <span>
                        <b>${unit.name}</b><br>
                        <small>${unit.range || ""}</small>
                    </span>

                    <button
                        class="btn btn-danger delete-unit"
                        data-subject-id="${subjectDoc.id}"
                        data-unit-id="${unitDoc.id}">
                        削除
                    </button>
                </div>
            `;

        });

        subjectList.innerHTML += `
            <div class="card setting-card">

                <h3>${subject.name}</h3>

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

                <button
                    class="btn btn-primary add-unit"
                    data-subject-id="${subjectDoc.id}">
                    単元を追加
                </button>

                <br><br>

                ${unitHtml || "<p>単元はまだありません。</p>"}

                <br>

                <button
                    class="btn btn-danger delete-subject"
                    data-id="${subjectDoc.id}">
                    科目を削除
                </button>

            </div>
        `;

    }

}

document.addEventListener("click", async (e) => {

    // 単元追加
    if (e.target.classList.contains("add-unit")) {

        const subjectId =
            e.target.dataset.subjectId;

        const unitNameInput =
            document.getElementById(`unitName_${subjectId}`);

        const unitRangeInput =
            document.getElementById(`unitRange_${subjectId}`);

        const name =
            unitNameInput.value.trim();

        const range =
            unitRangeInput.value.trim();

        if (!name) {
            alert("単元名を入力してください。");
            return;
        }

        await addDoc(
            collection(
                db,
                "examSubjects",
                subjectId,
                "units"
            ),
            {
                name,
                range,
                createdAt: new Date(),
                createdBy: studentNumber
            }
        );

        await loadSubjects();

        return;

    }

    // 科目削除
    if (e.target.classList.contains("delete-subject")) {

        if (!confirm("この科目を削除しますか？")) return;

        await deleteDoc(
            doc(
                db,
                "examSubjects",
                e.target.dataset.id
            )
        );

        await loadSubjects();

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
                e.target.dataset.unitId
            )
        );

        await loadSubjects();

        return;

    }

});