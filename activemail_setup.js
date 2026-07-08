import {
    db,
    studentNumber,
    initializePage,
    encryptData
} from "./common.js";

import {
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const mailAddress = document.getElementById("mailAddress");
const mailPassword = document.getElementById("mailPassword");
const saveButton = document.getElementById("saveButton");
const skipButton = document.getElementById("skipButton");

await initializePage();

if (!studentNumber) {
    location.href = "login.html";
}

mailAddress.value =
    `${studentNumber}@sums.ac.jp`;

saveButton.onclick = async () => {

    const password =
        mailPassword.value.trim();

    if (!password) {
        alert("パスワードを入力してください。");
        return;
    }

    const encrypted =
        await encryptData(password);

    await updateDoc(
        doc(db, "users", studentNumber),
        {
            activeMailPasswordEncrypted: encrypted,
            activeMailSetupSkipped: false,
            activeMailResetRequired: false
        }
    );

    location.href = "index.html";

};

skipButton.onclick = async () => {

    await updateDoc(
        doc(db, "users", studentNumber),
        {
            activeMailSetupSkipped: true
        }
    );

    location.href = "index.html";

};