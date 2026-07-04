import {
    db,
    initializePage
} from "./common.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const message = document.getElementById("message");

const studentNumber =
    localStorage.getItem("studentNumber");

// 開発者ならメンテ中でもホームへ
async function checkDeveloper() {

    if (!studentNumber) return;

    const devSnap = await getDoc(
        doc(db, "developers", studentNumber)
    );

    if (
        devSnap.exists() &&
        devSnap.data().enabled === true
    ) {
        location.href = "index.html";
    }

}

// メンテ情報取得
async function loadMaintenance() {

    const snap = await getDoc(
        doc(db, "system", "app")
    );

    if (!snap.exists()) {
        message.textContent = "メンテナンス情報を取得できませんでした。";
        return;
    }

    const data = snap.data();

    if (!data.maintenance) {
        location.href = "index.html";
        return;
    }

    message.innerHTML =
        (data.message ?? "").replace(/\n/g, "<br>");

}

await checkDeveloper();

await loadMaintenance();

await initializePage();