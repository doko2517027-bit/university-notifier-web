import {
    db,
    initializePage,
    updateAccentColor
} from "./common.js";

import {
    doc,
    setDoc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { VERSION } from "./version.js";

const version = document.getElementById("version");

if (version) {
    version.textContent = `Version ${VERSION}`;
}

const PUBLIC_KEY =
"BJk2fKTmfe7AZuXjW-IGMDyis_zN0iZ1B0oiG5MVefZ4n3W9mrBu-xBiWYjG_V6U2b5sGMuVXvKTbrwRKXSAiUs";

const department = document.getElementById("department");
const major = document.getElementById("major");
const departmentGrade = document.getElementById("departmentGrade");
const majorGrade = document.getElementById("majorGrade");
const studentNumber = document.getElementById("studentNumber");
const studentPageId = document.getElementById("studentPageId");
const studentPagePassword = document.getElementById("studentPagePassword");
const activeMailPassword = document.getElementById("activeMailPassword");
const manabaPassword = document.getElementById("manabaPassword");
const appPassword = document.getElementById("appPassword");
const appPasswordConfirm = document.getElementById("appPasswordConfirm");
const button = document.getElementById("subscribe");
const registered = localStorage.getItem("registered");

department.addEventListener("change", () => {

    if (department.value !== "") {
        major.value = "";
    }

    updateState();

    updateAccentColor(
        department.value,
        major.value
    );

});

major.addEventListener("change", () => {

    if (major.value !== "") {
        department.value = "";
    }

    updateState();

    updateAccentColor(
        department.value,
        major.value
    );

});

departmentGrade.addEventListener("change", () => {

    updateState();

});

majorGrade.addEventListener("change", () => {

    updateState();

});

studentNumber.addEventListener("input", () => {

    updateState();

});

activeMailPassword.addEventListener("input", () => {

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

updateAccentColor(
    department.value,
    major.value
);

await initializePage();

function updateState() {

    if (registered === "true") {
        return;
    }

    const selectedDepartment =
        department.value !== "";

    const selectedMajor =
        major.value !== "";

    department.disabled = selectedMajor;
    departmentGrade.disabled = !selectedDepartment;

    major.disabled = selectedDepartment;
    majorGrade.disabled = !selectedMajor;

    if (!selectedDepartment) {
        departmentGrade.value = "";
    }

    if (!selectedMajor) {
        majorGrade.value = "";
    }

    const selected =
        selectedDepartment || selectedMajor;

    const selectedGrade =
        selectedDepartment
            ? departmentGrade.value
            : majorGrade.value;

    button.disabled =
        !selected ||
        selectedGrade === "" ||
        studentNumber.value.trim() === "" ||
        studentPageId.value.trim() === "" ||
        studentPagePassword.value.trim() === "" ||
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
        const selectedGrade =
            selectedDepartment
                ? departmentGrade.value
                : majorGrade.value;

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

    const studentPagePasswordEncrypted =
        await encrypt(studentPagePassword.value);

    const activeMailPasswordEncrypted =
        activeMailPassword.value.trim()
            ? await encryptData(activeMailPassword.value.trim())
            : "";

    const manabaPasswordEncrypted =
        manabaPassword.value.trim()
            ? await encryptData(manabaPassword.value.trim())
            : "";

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

            await updateDoc(
                userRef,
                {
                    subscription: JSON.parse(JSON.stringify(subscription))
                }
            );

            localStorage.setItem("registered", "true");
            localStorage.setItem("department", selectedDepartment);
            localStorage.setItem("major", selectedMajor);
            localStorage.setItem("grade", selectedGrade);
            localStorage.setItem("manabaId",studentNumber.value);
            localStorage.setItem("studentNumber", studentNumber.value);
            localStorage.setItem("migrated", "true");
            localStorage.setItem("loggedIn", "true");

            alert("通知情報を更新しました。");
            location.href = "index.html";

            return;

        }

    await setDoc(
        userRef,
        {
            studentNumber: studentNumber.value,
            department: selectedDepartment,
            major: selectedMajor,
            grade: selectedGrade,

            studentPageId: studentPageId.value,
            studentPagePasswordEncrypted,

            activeMailPasswordEncrypted,

            manabaId: studentNumber.value,
            manabaPasswordEncrypted,

            appPasswordHash: appPasswordHash,
            subscription: JSON.parse(JSON.stringify(subscription)),

            notificationSettings: {
                schedule: true,
                assignment: true,
                reminder: true,
                courseNews: true,
                systemNews: true,
                sharePost: true,
                like: true,
                comment: true
            },

            manabaVerified: false,
            manabaVerifiedAt: null
        }
            
    );

    localStorage.setItem("registered", "true");
    localStorage.setItem("department", selectedDepartment);
    localStorage.setItem("major", selectedMajor);
    localStorage.setItem("grade", selectedGrade);
    localStorage.setItem("studentNumber", studentNumber.value);
    localStorage.setItem("manabaId",studentNumber.value);

    localStorage.setItem("migrated", "true");

    alert("登録が完了しました。");
    localStorage.setItem("loggedIn", "true");
    location.href = "index.html";
    } catch (e) {

        console.error(e);
        alert("登録に失敗しました。");

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