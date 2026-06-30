import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getFirestore,
    doc,
    setDoc
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

const PUBLIC_KEY =
"BJk2fKTmfe7AZuXjW-IGMDyis_zN0iZ1B0oiG5MVefZ4n3W9mrBu-xBiWYjG_V6U2b5sGMuVXvKTbrwRKXSAiUs";

const studentNumber =
    document.getElementById("studentNumber");

const manabaId =
    document.getElementById("manabaId");

const manabaPassword =
    document.getElementById("manabaPassword");

document
.getElementById("register")
.addEventListener("click", async () => {

    const value = studentNumber.value.trim();

        if (value === "") {

        alert("学籍番号を入力してください。");
        return;

    }

    if (!/^\d{7}$/.test(value)) {

        alert("学籍番号は7桁の数字で入力してください。");
        return;

    }

    const year = value.substring(0, 2);
    const department = value.substring(2, 4);
    const number = parseInt(value.substring(4));

    if (
        year !== "25" &&
        year !== "26"
    ) {

        alert("学籍番号が正しくありません。");
        return;

    }

    if (
        department !== "10" &&
        department !== "20" &&
        department !== "30"
    ) {

        alert("学籍番号が正しくありません。");
        return;

    }

    if (
        department === "10" &&
        (number < 1 || number > 200)
    ) {

        alert("学籍番号が正しくありません。");
        return;

    }

    if (
        department === "20" &&
        (number < 1 || number > 60)
    ) {

        alert("学籍番号が正しくありません。");
        return;

    }

    if (
        department === "30" &&
        (number < 1 || number > 60)
    ) {

        alert("学籍番号が正しくありません。");
        return;

    }

    const registration =
    await navigator.serviceWorker.ready;

    const subscription =
        await registration.pushManager.getSubscription();

        console.log(subscription.endpoint);

    if (!subscription) {

        alert("通知情報が取得できません。");

        return;

    }

    const encryptedPassword =
        await encrypt(manabaPassword.value);

        console.log(
            subscription.endpoint.replace(/\//g, "_")
        );

    await setDoc(
        doc(db, "users", subscription.endpoint.replace(/\//g, "_")),
        {
            studentNumber: value,
            manabaId: manabaId.value,
            manabaPasswordEncrypted: encryptedPassword
        },
        {
            merge: true
        }
    );

    localStorage.setItem("studentNumber", value);
    localStorage.setItem("manabaId", manabaId.value);

    // アップデート済みフラグ
    localStorage.setItem("migrated", "true");

    alert("登録が完了しました。");

    location.href = "index.html";

});

const SECRET = "UniversityNotifier2026";

async function encrypt(text) {

    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(SECRET.padEnd(32, "0")),
        "AES-GCM",
        false,
        ["encrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv
        },
        key,
        encoder.encode(text)
    );

    const result = new Uint8Array(iv.length + encrypted.byteLength);

    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...result));

}