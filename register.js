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

const department = document.getElementById("department");
const major = document.getElementById("major");
const grade = document.getElementById("grade");
const studentNumber = document.getElementById("studentNumber");
const manabaId = document.getElementById("manabaId");
const manabaPassword = document.getElementById("manabaPassword");
const button = document.getElementById("subscribe");
const registered = localStorage.getItem("registered");

if (registered === "true") {

    location.href = "index.html";

}



department.addEventListener("change", () => {

    if (department.value !== "") {
        major.value = "";
    }

    updateState();

});

major.addEventListener("change", () => {

    if (major.value !== "") {
        department.value = "";
    }

    updateState();

});

grade.addEventListener("change", () => {

    updateState();

});

studentNumber.addEventListener("input", () => {

    updateState();

});

manabaId.addEventListener("input", () => {

    updateState();

});

manabaPassword.addEventListener("input", () => {

    updateState();

});

updateState();


function updateState() {

    if (registered === "true") {
        return;
    }

    const selected =
        department.value !== "" ||
        major.value !== "";

    grade.disabled = !selected;

    if (!selected) {
        grade.value = "";
    }

    button.disabled =
        !selected ||
        grade.value === "" ||
        studentNumber.value.trim() === "" ||
        manabaId.value.trim() === "" ||
        manabaPassword.value.trim() === "";

}

button.addEventListener("click", async () => {

        const value = studentNumber.value.trim();

        if (!/^\d{7}$/.test(value)) {

            alert("学生番号は7桁の数字で入力してください。");
            return;

        }

        const year = value.substring(0, 2);
        const departmentCode = value.substring(2, 4);
        const number = parseInt(value.substring(4));

        if (
            year !== "25" &&
            year !== "26"
        ) {

            alert("学生番号が正しくありません。");
            return;

        }

        if (
            departmentCode !== "10" &&
            departmentCode !== "20" &&
            departmentCode !== "30"
        ) {

            alert("学生番号が正しくありません。");
            return;

        }

        if (
            departmentCode === "10" &&
            (number < 1 || number > 200)
        ) {

            alert("学生番号が正しくありません。");
            return;

        }

        if (
            (
                departmentCode === "20" ||
                departmentCode === "30"
            ) &&
            (number < 1 || number > 60)
        ) {

            alert("学生番号が正しくありません。");
            return;

        }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {

        alert(
            "通知が拒否されています。\n\n設定 → 通知 → University Notifier から通知を許可してください。"
        );

        return;
    }

    const registration = await navigator.serviceWorker.register("sw.js");

    await navigator.serviceWorker.ready;

   const subscription =

        await registration.pushManager.getSubscription() ||
        await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY)
        });

    const selectedDepartment = department.value;
    const selectedMajor = major.value;
    const selectedGrade = grade.value;

try {

    await setDoc(
        doc(db, "users", studentNumber.value),
        {
            studentNumber: studentNumber.value,
            department: selectedDepartment,
            major: selectedMajor,
            grade: selectedGrade,
            manabaId: manabaId.value,
            manabaPasswordEncrypted: manabaPassword.value,
            subscription: JSON.parse(JSON.stringify(subscription))
        }
    );

    localStorage.setItem("registered", "true");
    localStorage.setItem("department", selectedDepartment);
    localStorage.setItem("major", selectedMajor);
    localStorage.setItem("grade", selectedGrade);
    localStorage.setItem("studentNumber", studentNumber.value);
    localStorage.setItem("manabaId", manabaId.value);

    button.textContent = "登録済み";
    button.disabled = true;

    department.disabled = true;
    major.disabled = true;
    grade.disabled = true;

    alert("登録が完了しました。");
    location.href = "index.html";
    } catch (e) {

    alert(e);

}
});

function urlBase64ToUint8Array(base64String) {

    const padding = "=".repeat((4 - base64String.length % 4) % 4);

    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = atob(base64);

    return Uint8Array.from(
        [...rawData].map(c => c.charCodeAt(0))
    );
}