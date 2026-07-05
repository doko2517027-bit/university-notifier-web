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
        return;
    }

}

async function loadMaintenance() {

    const snap = await getDoc(
        doc(db, "system", "app")
    );

    if (!snap.exists()) {
        message.textContent =
            "メンテナンス情報を取得できませんでした。";
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

async function start() {

    try {

        await checkDeveloper();
        await loadMaintenance();

    } catch (e) {

        console.error(e);

        message.textContent =
            "メンテナンス情報の取得に失敗しました。";

    } finally {

        await initializePage();

    }

}

await start();