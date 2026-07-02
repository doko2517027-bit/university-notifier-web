import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { VERSION } from "./version.js";

document.getElementById("version").textContent = `Version ${VERSION}`;

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

function updateAccentColor() {

    const root = document.documentElement;

    if (department.value === "看護学科") {

        root.style.setProperty("--accent", "#F7EAC5");

    }
    else if (major.value === "理学療法学専攻") {

        root.style.setProperty("--accent", "#DDEBF7");

    }
    else if (major.value === "作業療法学専攻") {

        root.style.setProperty("--accent", "#E2EFDA");

    }
    else {

        root.style.setProperty("--accent", "#2563eb");

    }

}

const PUBLIC_KEY =
"BJk2fKTmfe7AZuXjW-IGMDyis_zN0iZ1B0oiG5MVefZ4n3W9mrBu-xBiWYjG_V6U2b5sGMuVXvKTbrwRKXSAiUs";

const department = document.getElementById("department");
const major = document.getElementById("major");
const grade = document.getElementById("grade");
const studentNumber = document.getElementById("studentNumber");
const manabaId = document.getElementById("manabaId");
const manabaPassword = document.getElementById("manabaPassword");
const appPassword =document.getElementById("appPassword");
const appPasswordConfirm =document.getElementById("appPasswordConfirm");
const button = document.getElementById("subscribe");
const registered = localStorage.getItem("registered");

department.addEventListener("change", () => {

    if (department.value !== "") {
        major.value = "";
    }

    updateState();
    updateAccentColor();

});

major.addEventListener("change", () => {

    if (major.value !== "") {
        department.value = "";
    }

    updateState();
    updateAccentColor();

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

appPassword.addEventListener("input", () => {

    updateState();

});

appPasswordConfirm.addEventListener("input", () => {

    updateState();

});

updateState();
updateAccentColor();


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
        manabaPassword.value.trim() === "" ||
        appPassword.value.trim() === "" ||
        appPasswordConfirm.value.trim() === "";

}

button.addEventListener("click", async () => {

        const value = studentNumber.value.trim();

        if (appPassword.value.length < 6) {

            alert("アプリ用パスワードは6文字以上で入力してください。");
            return;

        }

        if (appPassword.value !== appPasswordConfirm.value) {

            alert("アプリ用パスワードが一致しません。");
            return;

        }

        const selectedDepartment = department.value;
        const selectedMajor = major.value;
        const selectedGrade = grade.value;

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
            "通知が拒否されています。\n\n設定 → 通知 → CareMateApp から通知を許可してください。"
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

    const code = studentNumber.value.substring(2, 4);

    if (code === "10" && selectedDepartment !== "看護学科") {

        alert("学生番号は看護学科のものです。");
        return;

     }

    if (code === "20" && selectedMajor !== "理学療法学専攻") {

        alert("学生番号は理学療法学専攻のものです。");
        return;

    }

    if (code === "30" && selectedMajor !== "作業療法学専攻") {

        alert("学生番号は作業療法学専攻のものです。");
        return;

    }

    const encryptedPassword =
        await encrypt(manabaPassword.value);

    const appPasswordHash =
    await hashPassword(appPassword.value);

try {

    const userRef = doc(
            db,
            "users",
            studentNumber.value
        );

        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {

            alert("この学籍番号は既に登録されています。");

            return;

        }

    await setDoc(
        userRef,
        {
            studentNumber: studentNumber.value,
            department: selectedDepartment,
            major: selectedMajor,
            grade: selectedGrade,
            manabaId: manabaId.value,
            manabaPasswordEncrypted: encryptedPassword,
            appPasswordHash: appPasswordHash,
            subscription: JSON.parse(JSON.stringify(subscription)),
            notificationSettings: {
                schedule: true,
                assignment: true,
                reminder: true,
                courseNews: true
}
        }
    );

    localStorage.setItem("registered", "true");
    localStorage.setItem("department", selectedDepartment);
    localStorage.setItem("major", selectedMajor);
    localStorage.setItem("grade", selectedGrade);
    localStorage.setItem("studentNumber", studentNumber.value);
    localStorage.setItem("manabaId", manabaId.value);

    localStorage.setItem("migrated", "true");

    button.textContent = "登録済み";
    button.disabled = true;

    department.disabled = true;
    major.disabled = true;
    grade.disabled = true;

    alert("登録が完了しました。");
    localStorage.setItem("loggedIn", "true");
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