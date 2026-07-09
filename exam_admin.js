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
    setDoc
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

await initializePage([
    loadProfileImage(topProfileImage),
    loadExamSettings()
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

};