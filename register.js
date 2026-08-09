import {
    db,
    initializePage,
    updateAccentColor,
    encryptData,
} from "./common.js";

import {
    doc,
    setDoc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { VERSION } from "./version.js";

import {
    ensurePushSubscription,
    savePushSubscription
} from "./push_subscription.js";

const version = document.getElementById("version");

if (version) {
    version.textContent = `Version ${VERSION}`;
}

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

document
    .getElementById("backButton")
    .onclick = () => {

    location.href = "login.html";

};

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

studentPageId.addEventListener("input", () => {

    updateState();

});

studentPagePassword.addEventListener("input", () => {

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

    const missing = [];

    if (!manabaPassword.value.trim()) {
        missing.push(
            "Manabaパスワード未入力\n・課題取得\n・課題通知\n・Manaba関連機能"
        );
    }

    if (!activeMailPassword.value.trim()) {
        missing.push(
            "Active!Mailパスワード未入力\n・大学メール通知\n・未読件数表示"
        );
    }

    if (missing.length > 0) {

        const ok = confirm(
            "一部機能が利用できません。\n\n" +
            missing.join("\n\n") +
            "\n\nあとからホーム画面で設定できます。\n\nこのまま登録しますか？"
        );

        if (!ok) {
            return;
        }

    }

    let subscription;

    try {
        subscription = await ensurePushSubscription("sw.js");
    } catch (error) {
        alert(error.message);
        return;
    }

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

    const [
        studentPagePasswordEncrypted,
        activeMailPasswordEncrypted,
        manabaPasswordEncrypted,
        appPasswordHash
    ] = await Promise.all([
        encrypt(studentPagePassword.value),

        activeMailPassword.value.trim()
            ? encryptData(activeMailPassword.value.trim())
            : Promise.resolve(""),

        manabaPassword.value.trim()
            ? encryptData(manabaPassword.value.trim())
            : Promise.resolve(""),

        hashPassword(appPassword.value)
    ]);


    /*
     学生ページへ実際にログインできた場合だけ、
     CareMateの登録を続行する。
    */
    button.disabled = true;

    try {

        const verificationResponse =
            await fetch(
                "https://asia-northeast1-universitynotifier-67517.cloudfunctions.net/verifyStudentPageCredentials",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        studentPageId:
                            studentPageId.value.trim(),
                        studentPagePassword:
                            studentPagePassword.value
                    })
                }
            );

        const verification =
            await verificationResponse.json();

        if (!verificationResponse.ok || !verification.verified) {

            alert(
                "学生ページIDまたはパスワードを確認できませんでした。"
            );

            button.disabled = false;

            return;

        }

    } catch (error) {

        console.error(
            "学生ページ認証エラー:",
            error
        );

        alert(
            "学生ページの認証に失敗しました。時間をおいて再度お試しください。"
        );

        button.disabled = false;

        return;

    }

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
                    subscription: JSON.parse(JSON.stringify(subscription)),

                    studentPageId:
                        studentPageId.value.trim(),

                    studentPagePasswordEncrypted,

                    manabaPasswordEncrypted,
                    activeMailPasswordEncrypted,

                    manabaSetupSkipped:
                        manabaPassword.value.trim() === "",

                    activeMailSetupSkipped:
                        activeMailPassword.value.trim() === "",

                    manabaResetRequired: false,
                    activeMailResetRequired: false,

                    manabaVerified: false,
                    manabaVerifiedAt: null,
                    studentPageVerified: true,
                    studentPageVerifiedAt: new Date().toISOString()
                }
            );

            await savePushSubscription(
                db,
                studentNumber.value,
                subscription,
                "register"
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
            manabaVerifiedAt: null,

            studentPageVerified: true,
            studentPageVerifiedAt: new Date().toISOString(),
            activeMailSetupSkipped:
                activeMailPassword.value.trim() === "",

            manabaSetupSkipped:
                manabaPassword.value.trim() === "",

            activeMailResetRequired: false,
            manabaResetRequired: false

        }
            
    );

    await savePushSubscription(
        db,
        studentNumber.value,
        subscription,
        "register"
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
