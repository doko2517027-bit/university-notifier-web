import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getFirestore,
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEtS2NGZKqHFh29kmR9OjEpshbC1yvjFY",
  authDomain: "universitynotifier-67517.firebaseapp.com",
  projectId: "universitynotifier-67517",
  storageBucket: "universitynotifier-67517.firebasestorage.app",
  messagingSenderId: "908622250178",
  appId: "1:908622250178:web:3e355fce8698fcf179bb5b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const manabaPassword = document.getElementById("manabaPassword");
const manabaPasswordConfirm = document.getElementById("manabaPasswordConfirm");
const savePassword = document.getElementById("savePassword");
const studentNumber = document.getElementById("studentNumber");

savePassword.addEventListener("click", async () => {

    const value = studentNumber.value.trim();

    if (!/^\d{7}$/.test(value)) {

        alert("学籍番号は7桁の数字で入力してください。");
        return;

    }

    if (manabaPassword.value.length < 6) {

        alert("アプリ用パスワードは6文字以上で入力してください。");
        return;

    }

    if (manabaPassword.value !== manabaPasswordConfirm.value) {

        alert("アプリ用パスワードが一致しません。");
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

    const manabaPasswordHash =
        await hashPassword(manabaPassword.value);

    await updateDoc(userRef, {
        manabaPasswordHash: manabaPasswordHash
    });

    localStorage.setItem("registered", "true");
    localStorage.setItem("loggedIn", "true");
    localStorage.setItem("studentNumber", value);
    localStorage.setItem("department", user.department || "");
    localStorage.setItem("major", user.major || "");
    localStorage.setItem("grade", user.grade || "");
    localStorage.setItem("manabaId", user.manabaId || "");
    localStorage.setItem("migrated", "true");

    alert("アプリ用パスワードを設定しました。");

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