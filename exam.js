import {
    db,
    setupTheme,
    initializePage,
    loadProfileImage
} from "./common.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const themeButton =
    document.getElementById("themeButton");

const topProfileImage =
    document.getElementById("topProfileImage");

const examTitle =
    document.getElementById("examTitle");

const examCountdown =
    document.getElementById("examCountdown");

setupTheme(themeButton);

await initializePage([
    loadProfileImage(topProfileImage),
    loadExam()
]);

document
.getElementById("backButton")
.onclick = () => {

    history.back();

};

document
.getElementById("profileButton")
.onclick = () => {

    location.href = "profile.html";

};

async function loadExam() {

    const snap = await getDoc(
        doc(db, "system", "exam")
    );

    if (!snap.exists()) {

        examTitle.textContent =
            "テスト対策";

        examCountdown.textContent =
            "テスト情報はまだ登録されていません。";

        return;

    }

    const exam = snap.data();

    if (exam.enabled !== true) {

        examTitle.textContent =
            "テスト対策";

        examCountdown.textContent =
            "現在、テストモードはOFFです。";

        return;

    }

    examTitle.textContent =
        exam.title || "テスト対策";

    const today = new Date();
    const start = new Date(exam.startDate);
    const end = new Date(exam.endDate);

    const diffToStart =
        Math.ceil((start - today) / (1000 * 60 * 60 * 24));

    const diffToEnd =
        Math.ceil((end - today) / (1000 * 60 * 60 * 24));

    if (today < start) {

        examCountdown.textContent =
            `開始まであと${diffToStart}日です。`;

    } else if (today <= end) {

        examCountdown.textContent =
            `終了まであと${diffToEnd}日です。`;

    } else {

        examCountdown.textContent =
            "テスト期間は終了しました。";

    }

}