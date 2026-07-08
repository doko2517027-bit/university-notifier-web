import {
    db,
    initializePage,
    encryptData
} from "./common.js";

import {
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const manabaPassword = document.getElementById("manabaPassword");
const savePassword = document.getElementById("savePassword");
const studentNumber = document.getElementById("studentNumber");

savePassword.addEventListener("click", async () => {

    const value = localStorage.getItem("studentNumber");

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

    studentNumber.value = user.studentNumber;

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