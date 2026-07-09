import {
    db,
    initializePage,
    encryptData,
    setupOfflineAlert
} from "./common.js";

import {
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const manabaPassword = document.getElementById("manabaPassword");
const savePassword = document.getElementById("savePassword");
const studentNumber = document.getElementById("studentNumber");
const skipButton = document.getElementById("skipButton");

await initializePage();

const value = localStorage.getItem("studentNumber");

if (!value) {
    location.href = "login.html";
}

studentNumber.value = value;

savePassword.addEventListener("click", async () => {

    if (manabaPassword.value.trim() === "") {
        alert("Manabaパスワードを入力してください。");
        return;
    }

    const userRef = doc(db, "users", value);

    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        alert("登録情報が見つかりません。");
        location.href = "login.html";
        return;
    }

    const user = userSnap.data();

    const encrypted = await encryptData(
    manabaPassword.value.trim()
);

    await updateDoc(userRef, {
        manabaPasswordEncrypted: encrypted,
        manabaSetupSkipped: false,
        manabaResetRequired: false,
        manabaVerified: false,
        manabaVerifiedAt: null
    });

    localStorage.setItem("registered", "true");
    localStorage.setItem("loggedIn", "true");
    localStorage.setItem("studentNumber", value);
    localStorage.setItem("department", user.department || "");
    localStorage.setItem("major", user.major || "");
    localStorage.setItem("grade", user.grade || "");
    localStorage.setItem("manabaId", user.manabaId || "");
    localStorage.setItem("migrated", "true");

    alert("manabaパスワードを設定しました。");

    location.href = "index.html";

});

skipButton.onclick = async () => {

    await updateDoc(
        doc(db, "users", value),
        {
            manabaSetupSkipped: true,
            manabaResetRequired: false
        }
    );

    location.href = "index.html";

};