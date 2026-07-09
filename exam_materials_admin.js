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
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const params = new URLSearchParams(location.search);

const subjectId = params.get("subjectId");
const unitId = params.get("unitId");

const themeButton = document.getElementById("themeButton");
const topProfileImage = document.getElementById("topProfileImage");
const unitInfo = document.getElementById("unitInfo");
const materialFile = document.getElementById("materialFile");
const uploadMaterial = document.getElementById("uploadMaterial");
const materialList = document.getElementById("materialList");

setupTheme(themeButton);

const admin = await isAdmin();

if (!admin) {
    alert("管理者のみアクセスできます。");
    location.href = "index.html";
}

await initializePage([
    loadProfileImage(topProfileImage),
    loadUnitInfo(),
    loadMaterials()
]);

document.getElementById("backButton").onclick = () => {
    history.back();
};

document.getElementById("profileButton").onclick = () => {
    location.href = "profile.html";
};

async function loadUnitInfo() {

    const subjectSnap = await getDoc(
        doc(db, "examSubjects", subjectId)
    );

    const unitSnap = await getDoc(
        doc(db, "examSubjects", subjectId, "units", unitId)
    );

    if (!subjectSnap.exists() || !unitSnap.exists()) {
        unitInfo.textContent = "科目または単元が見つかりません。";
        return;
    }

    unitInfo.textContent =
        `${subjectSnap.data().name} / ${unitSnap.data().name}`;
}

async function loadMaterials() {

    const q = query(
        collection(
            db,
            "examSubjects",
            subjectId,
            "units",
            unitId,
            "materials"
        ),
        orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);

    if (snap.empty) {
        materialList.innerHTML = "資料はまだありません。";
        return;
    }

    materialList.innerHTML = "";

    snap.forEach(materialDoc => {

        const material = materialDoc.data();

        materialList.innerHTML += `
            <div class="card setting-card">

                <p><b>${material.name}</b></p>

                <p>
                    <small>${material.type || ""}</small>
                </p>

                <button
                    class="btn btn-danger delete-material"
                    data-id="${materialDoc.id}">
                    削除
                </button>

            </div>
        `;

    });

}

uploadMaterial.onclick = async () => {

    const file = materialFile.files[0];

    if (!file) {
        alert("資料を選択してください。");
        return;
    }

    await addDoc(
        collection(
            db,
            "examSubjects",
            subjectId,
            "units",
            unitId,
            "materials"
        ),
        {
            name: file.name,
            type: file.type,
            size: file.size,
            createdAt: new Date(),
            createdBy: studentNumber
        }
    );

    materialFile.value = "";

    await loadMaterials();

    alert("資料情報を登録しました。次にファイルアップロード本体を実装します。");

};

document.addEventListener("click", async (e) => {

    if (!e.target.classList.contains("delete-material")) return;

    if (!confirm("この資料を削除しますか？")) return;

    await deleteDoc(
        doc(
            db,
            "examSubjects",
            subjectId,
            "units",
            unitId,
            "materials",
            e.target.dataset.id
        )
    );

    await loadMaterials();

});