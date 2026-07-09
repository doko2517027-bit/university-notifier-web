import {
    db,
    initializePage,
    setupOfflineAlert
} from "./common.js";

import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const studentNumber = document.getElementById("studentNumber");
const appPassword = document.getElementById("appPassword");
const loginButton = document.getElementById("loginButton");
const registerButton = document.getElementById("registerButton");

await initializePage();

registerButton.addEventListener("click", () => {
    location.href = "register.html";
});

loginButton.addEventListener("click", async () => {

    const value = studentNumber.value.trim();

    if (!/^\d{7}$/.test(value)) {
        alert("学籍番号は7桁の数字で入力してください。");
        return;
    }

    if (appPassword.value.trim() === "") {
        alert("パスワードを入力してください。");
        return;
    }

    const userRef = doc(db, "users", value);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        alert("登録されていません。");
        return;
    }

    const user = userSnap.data();

    const inputHash = await hashPassword(appPassword.value);

    if (inputHash !== user.appPasswordHash) {
        alert("学籍番号またはパスワードが違います。");
        return;
    }

    localStorage.setItem("registered", "true");
    localStorage.setItem("loggedIn", "true");
    localStorage.setItem("studentNumber", value);
    localStorage.setItem("department", user.department || "");
    localStorage.setItem("major", user.major || "");
    localStorage.setItem("grade", user.grade || "");
    localStorage.setItem("manabaId", user.manabaId || "");
    localStorage.setItem("migrated", "true");

    await updateDoc(userRef, {

        lastLoginAt: serverTimestamp(),

        lastActiveAt: serverTimestamp()

    });

    location.href = "index.html";

});

async function hashPassword(password) {

    const encoder = new TextEncoder();
    const data = encoder.encode(password);

    const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        data
    );

    const hashArray = Array.from(
        new Uint8Array(hashBuffer)
    );

    return hashArray
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

}