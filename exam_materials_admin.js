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
    orderBy,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const AI_SERVER = "https://caremate-ai-server.onrender.com";

const params = new URLSearchParams(location.search);

const subjectId = params.get("subjectId");
const unitId = params.get("unitId");

const themeButton = document.getElementById("themeButton");
const topProfileImage = document.getElementById("topProfileImage");
const unitInfo = document.getElementById("unitInfo");
const materialFile = document.getElementById("materialFile");
const uploadMaterial = document.getElementById("uploadMaterial");
const materialList = document.getElementById("materialList");
const generateAiQuestions = document.getElementById("generateAiQuestions");

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

                ${material.url ? `
                <p>
                    <a href="${material.url}" target="_blank">
                        📄 資料を開く
                    </a>
                </p>
                ` : ""}

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

    try {

        const formData = new FormData();

        formData.append("file", file);
        formData.append("upload_preset", "caremate_upload");

        const resourceType =
            file.type === "application/pdf"
                ? "raw"
                : "auto";

        const res = await fetch(
            `https://api.cloudinary.com/v1_1/vpctonjf/${resourceType}/upload`,
            {
                method: "POST",
                body: formData
            }
        );

        const data = await res.json();

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
                url: data.secure_url,
                publicId: data.public_id,
                createdAt: new Date(),
                createdBy: studentNumber
            }
        );

        materialFile.value = "";

        await loadMaterials();

        alert("アップロード完了");

    } catch (e) {

        console.error(e);

        alert("アップロード失敗");

    }

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

generateAiQuestions.onclick = async () => {

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
        alert("先に資料をアップロードしてください。");
        return;
    }

    const materials = [];

    snap.forEach(materialDoc => {

        const material = materialDoc.data();

        if (!material.url) return;

        materials.push({
            name: material.name,
            type: material.type,
            url: material.url
        });

    });

    if (materials.length === 0) {
        alert("読み込める資料URLがありません。");
        return;
    }

    console.log("AIに送る資料", materials);

    generateAiQuestions.disabled = true;
    generateAiQuestions.textContent = "AI生成中...";

    try {

        const res = await fetch(
            `${AI_SERVER}/api/generate-exam`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    materials: materials
                })
            }
        );

        const data = await res.json();

        console.log("AI生成結果", data);

        if (!res.ok) {

            const detail =
                typeof data.detail === "string"
                    ? data.detail
                    : JSON.stringify(data.detail);

            throw new Error(
                detail || "AI生成に失敗しました。"
            );
        }

        const generated =
            typeof data === "string"
                ? JSON.parse(data)
                : data;

        await setDoc(
            doc(
                db,
                "examSubjects",
                subjectId,
                "units",
                unitId,
                "ai",
                "generated"
            ),
            {
                ...generated,
                generatedAt: new Date(),
                generatedBy: studentNumber,
                sourceMaterials: materials.map(material => ({
                    name: material.name,
                    type: material.type,
                    url: material.url
                }))
            }
        );

        alert("AI生成結果を保存しました。");

    } catch (e) {

        console.error("AI生成エラー:", e);

        alert(
            "AI生成に失敗しました。\n" +
            e.message
        );

    } finally {

        generateAiQuestions.disabled = false;
        generateAiQuestions.textContent = "AI問題を生成";

    }

};