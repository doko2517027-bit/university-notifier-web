import {
    db,
    studentNumber as adminStudentNumber,
    setupTheme,
    initializePage,
    loadProfileImage,
    loadUserName,
    loadMyRanking,
    setupAdminTab,
    isAdmin,
    showToast,
    encryptData,
    updateAccentColor,
    updateAssignmentNavBadge,
    updateShareNavBadge,
    updateNewsNavBadge
} from "./common.js";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/* ========================================
   HTML要素
======================================== */

const userName =
    document.getElementById("userName");

const themeButton =
    document.getElementById("themeButton");

const topProfileImage =
    document.getElementById("topProfileImage");

const backButton =
    document.getElementById("backButton");


const department =
    document.getElementById("department");

const major =
    document.getElementById("major");

const departmentGrade =
    document.getElementById("departmentGrade");

const majorGrade =
    document.getElementById("majorGrade");


const studentNumber =
    document.getElementById("studentNumber");

const studentPageId =
    document.getElementById("studentPageId");

const studentPagePassword =
    document.getElementById("studentPagePassword");

const activeMailPassword =
    document.getElementById("activeMailPassword");

const manabaPassword =
    document.getElementById("manabaPassword");

const appPassword =
    document.getElementById("appPassword");

const appPasswordConfirm =
    document.getElementById("appPasswordConfirm");


const notifySchedule =
    document.getElementById("notifySchedule");

const notifyAssignment =
    document.getElementById("notifyAssignment");

const notifyReminder =
    document.getElementById("notifyReminder");

const notifyCourseNews =
    document.getElementById("notifyCourseNews");

const notifySystemNews =
    document.getElementById("notifySystemNews");

const notifySharePost =
    document.getElementById("notifySharePost");

const notifyLike =
    document.getElementById("notifyLike");

const notifyComment =
    document.getElementById("notifyComment");


const registerButton =
    document.getElementById("subscribe");


/* ========================================
   初期化
======================================== */

setupTheme(themeButton);


const admin =
    await isAdmin();

if (!admin) {

    alert("管理者のみアクセスできます。");

    location.href =
        "index.html";

    throw new Error(
        "管理者権限がありません。"
    );

}


setupEvents();

updateFormState();

updateAccentColor(
    department?.value || "",
    major?.value || ""
);


await initializePage([
    setupAdminTab(),
    loadUserName(userName),
    loadMyRanking(),
    loadProfileImage(topProfileImage),
    updateAssignmentNavBadge(),
    updateShareNavBadge(),
    updateNewsNavBadge()
]);


/* ========================================
   イベント
======================================== */

function setupEvents() {

    if (backButton) {

        backButton.onclick = () => {

            location.href =
                "users_admin.html";

        };

    }


    if (department) {

        department.addEventListener(
            "change",
            () => {

                if (department.value !== "") {

                    if (major) {
                        major.value = "";
                    }

                }

                updateFormState();

                updateAccentColor(
                    department.value,
                    major?.value || ""
                );

            }
        );

    }


    if (major) {

        major.addEventListener(
            "change",
            () => {

                if (major.value !== "") {

                    if (department) {
                        department.value = "";
                    }

                }

                updateFormState();

                updateAccentColor(
                    department?.value || "",
                    major.value
                );

            }
        );

    }


    [
        departmentGrade,
        majorGrade
    ]
    .filter(Boolean)
    .forEach(select => {

        select.addEventListener(
            "change",
            updateFormState
        );

    });


    [
        studentNumber,
        studentPageId,
        studentPagePassword,
        activeMailPassword,
        manabaPassword,
        appPassword,
        appPasswordConfirm
    ]
    .filter(Boolean)
    .forEach(input => {

        input.addEventListener(
            "input",
            updateFormState
        );

    });


    if (studentNumber) {

        studentNumber.addEventListener(
            "input",
            () => {

                studentNumber.value =
                    studentNumber.value
                        .replace(/\D/g, "")
                        .slice(0, 7);

            }
        );

    }


    if (registerButton) {

        registerButton.addEventListener(
            "click",
            registerStudent
        );

    }

}


/* ========================================
   入力状態
======================================== */

function updateFormState() {

    const selectedDepartment =
        department?.value !== "";

    const selectedMajor =
        major?.value !== "";


    if (department) {

        department.disabled =
            selectedMajor;

    }

    if (departmentGrade) {

        departmentGrade.disabled =
            !selectedDepartment;

        if (!selectedDepartment) {

            departmentGrade.value = "";

        }

    }


    if (major) {

        major.disabled =
            selectedDepartment;

    }

    if (majorGrade) {

        majorGrade.disabled =
            !selectedMajor;

        if (!selectedMajor) {

            majorGrade.value = "";

        }

    }


    const selectedGrade =
        selectedDepartment
            ? departmentGrade?.value
            : majorGrade?.value;


    if (registerButton) {

        registerButton.disabled =
            !selectedDepartment &&
            !selectedMajor ||
            !selectedGrade ||
            !studentNumber?.value.trim() ||
            !studentPageId?.value.trim() ||
            !studentPagePassword?.value.trim() ||
            !appPassword?.value.trim() ||
            !appPasswordConfirm?.value.trim();

    }

}


/* ========================================
   登録
======================================== */

async function registerStudent() {

    if (!registerButton) {
        return;
    }


    const numberValue =
        studentNumber?.value.trim() || "";

    const selectedDepartment =
        department?.value || "";

    const selectedMajor =
        major?.value || "";

    const selectedGrade =
        selectedDepartment
            ? departmentGrade?.value || ""
            : majorGrade?.value || "";

    const studentPageIdValue =
        studentPageId?.value.trim() || "";

    const studentPagePasswordValue =
        studentPagePassword?.value || "";

    const activeMailPasswordValue =
        activeMailPassword?.value.trim() || "";

    const manabaPasswordValue =
        manabaPassword?.value.trim() || "";

    const appPasswordValue =
        appPassword?.value || "";

    const appPasswordConfirmValue =
        appPasswordConfirm?.value || "";


    if (
        !selectedDepartment &&
        !selectedMajor
    ) {

        alert(
            "学科または専攻を選択してください。"
        );

        return;

    }


    if (!selectedGrade) {

        alert(
            "学年を選択してください。"
        );

        return;

    }


    if (!studentPageIdValue) {

        alert(
            "学生ページIDを入力してください。"
        );

        return;

    }


    if (!studentPagePasswordValue) {

        alert(
            "学生ページパスワードを入力してください。"
        );

        return;

    }


    if (appPasswordValue.length < 6) {

        alert(
            "アプリ用パスワードは6文字以上で入力してください。"
        );

        return;

    }


    if (
        appPasswordValue !==
        appPasswordConfirmValue
    ) {

        alert(
            "アプリ用パスワードが一致しません。"
        );

        return;

    }


    const validationResult =
        validateStudentNumber(
            numberValue,
            selectedDepartment,
            selectedMajor
        );

    if (!validationResult.valid) {

        alert(
            validationResult.message
        );

        return;

    }


    const missingSettings = [];

    if (!manabaPasswordValue) {

        missingSettings.push(
            "Manabaパスワード未入力\n" +
            "・課題取得\n" +
            "・課題通知\n" +
            "・Manaba関連機能"
        );

    }


    if (!activeMailPasswordValue) {

        missingSettings.push(
            "Active!Mailパスワード未入力\n" +
            "・大学メール通知\n" +
            "・未読件数表示"
        );

    }


    if (missingSettings.length > 0) {

        const continueRegistration =
            confirm(
                "一部機能が利用できません。\n\n" +
                missingSettings.join("\n\n") +
                "\n\n学生本人があとから設定できます。\n\n" +
                "このまま登録しますか？"
            );

        if (!continueRegistration) {
            return;
        }

    }


    const userRef =
        doc(
            db,
            "users",
            numberValue
        );


    registerButton.disabled = true;

    registerButton.textContent =
        "登録中...";


    try {

        const existingSnapshot =
            await getDoc(userRef);

        if (existingSnapshot.exists()) {

            alert(
                "この学籍番号はすでに登録されています。"
            );

            return;

        }


        const [
            studentPagePasswordEncrypted,
            activeMailPasswordEncrypted,
            manabaPasswordEncrypted,
            appPasswordHash
        ] = await Promise.all([

            encryptStudentPagePassword(
                studentPagePasswordValue
            ),

            activeMailPasswordValue
                ? encryptData(
                    activeMailPasswordValue
                )
                : Promise.resolve(""),

            manabaPasswordValue
                ? encryptData(
                    manabaPasswordValue
                )
                : Promise.resolve(""),

            hashPassword(
                appPasswordValue
            )

        ]);


        await setDoc(
            userRef,
            {
                studentNumber:
                    numberValue,

                department:
                    selectedDepartment,

                major:
                    selectedMajor,

                grade:
                    selectedGrade,

                admissionYear:
                    2000 +
                    Number(
                        numberValue.substring(
                            0,
                            2
                        )
                    ),

                studentPageId:
                    studentPageIdValue,

                studentPagePasswordEncrypted,

                activeMailPasswordEncrypted,

                manabaId:
                    numberValue,

                manabaPasswordEncrypted,

                appPasswordHash,

                notificationSettings: {
                    schedule:
                        notifySchedule?.checked ??
                        true,

                    assignment:
                        notifyAssignment?.checked ??
                        true,

                    reminder:
                        notifyReminder?.checked ??
                        true,

                    courseNews:
                        notifyCourseNews?.checked ??
                        true,

                    systemNews:
                        notifySystemNews?.checked ??
                        true,

                    sharePost:
                        notifySharePost?.checked ??
                        true,

                    like:
                        notifyLike?.checked ??
                        true,

                    comment:
                        notifyComment?.checked ??
                        true
                },

                manabaVerified:
                    false,

                manabaVerifiedAt:
                    null,

                activeMailSetupSkipped:
                    activeMailPasswordValue === "",

                manabaSetupSkipped:
                    manabaPasswordValue === "",

                activeMailResetRequired:
                    false,

                manabaResetRequired:
                    false,

                subscription:
                    null,

                createdAt:
                    serverTimestamp(),

                createdBy:
                    adminStudentNumber || "",

                createdFrom:
                    "admin"
            }
        );


        showToast(
            "学生を登録しました"
        );


        setTimeout(() => {

            location.href =
                "user_detail_admin.html" +
                "?studentNumber=" +
                encodeURIComponent(
                    numberValue
                );

        }, 700);

    } catch (error) {

        console.error(
            "学生登録エラー:",
            error
        );

        alert(
            "学生の登録に失敗しました。"
        );

    } finally {

        registerButton.disabled =
            false;

        registerButton.textContent =
            "学生を登録する";

        updateFormState();

    }

}


/* ========================================
   学籍番号チェック
======================================== */

function validateStudentNumber(
    numberValue,
    selectedDepartment,
    selectedMajor
) {

    if (!/^\d{7}$/.test(numberValue)) {

        return {
            valid: false,
            message:
                "学生番号は7桁の数字で入力してください。"
        };

    }


    const year =
        numberValue.substring(0, 2);

    const departmentCode =
        numberValue.substring(2, 4);

    const studentSequence =
        Number.parseInt(
            numberValue.substring(4),
            10
        );


    /*
    現在のregister.jsと同じく
    2025年度・2026年度入学生を対象にする
    */

    if (
        year !== "25" &&
        year !== "26"
    ) {

        return {
            valid: false,
            message:
                "学生番号の入学年度が正しくありません。"
        };

    }


    if (
        departmentCode !== "10" &&
        departmentCode !== "20" &&
        departmentCode !== "30"
    ) {

        return {
            valid: false,
            message:
                "学生番号の所属コードが正しくありません。"
        };

    }


    if (
        departmentCode === "10" &&
        (
            studentSequence < 1 ||
            studentSequence > 200
        )
    ) {

        return {
            valid: false,
            message:
                "看護学科の学生番号が正しくありません。"
        };

    }


    if (
        (
            departmentCode === "20" ||
            departmentCode === "30"
        ) &&
        (
            studentSequence < 1 ||
            studentSequence > 60
        )
    ) {

        return {
            valid: false,
            message:
                "リハビリテーション学科の学生番号が正しくありません。"
        };

    }


    if (
        departmentCode === "10" &&
        selectedDepartment !== "看護学科"
    ) {

        return {
            valid: false,
            message:
                "この学生番号は看護学科の番号です。"
        };

    }


    if (
        departmentCode === "20" &&
        selectedMajor !==
            "理学療法学専攻"
    ) {

        return {
            valid: false,
            message:
                "この学生番号は理学療法学専攻の番号です。"
        };

    }


    if (
        departmentCode === "30" &&
        selectedMajor !==
            "作業療法学専攻"
    ) {

        return {
            valid: false,
            message:
                "この学生番号は作業療法学専攻の番号です。"
        };

    }


    return {
        valid: true,
        message: ""
    };

}


/* ========================================
   学生ページパスワード暗号化
======================================== */

const STUDENT_PAGE_SECRET =
    "UniversityNotifier2026";


async function encryptStudentPagePassword(
    plainText
) {

    const encoder =
        new TextEncoder();

    const key =
        await crypto.subtle.importKey(
            "raw",
            encoder.encode(
                STUDENT_PAGE_SECRET.padEnd(
                    32,
                    "0"
                )
            ),
            "AES-GCM",
            false,
            ["encrypt"]
        );


    const iv =
        crypto.getRandomValues(
            new Uint8Array(12)
        );


    const encrypted =
        await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv
            },
            key,
            encoder.encode(
                plainText
            )
        );


    const result =
        new Uint8Array(
            iv.length +
            encrypted.byteLength
        );


    result.set(iv);

    result.set(
        new Uint8Array(encrypted),
        iv.length
    );


    return btoa(
        String.fromCharCode(
            ...result
        )
    );

}


/* ========================================
   アプリパスワードハッシュ化
======================================== */

async function hashPassword(
    password
) {

    const encoder =
        new TextEncoder();

    const passwordData =
        encoder.encode(
            password
        );


    const hashBuffer =
        await crypto.subtle.digest(
            "SHA-256",
            passwordData
        );


    const hashArray =
        Array.from(
            new Uint8Array(
                hashBuffer
            )
        );


    return hashArray
        .map(byte =>
            byte
                .toString(16)
                .padStart(2, "0")
        )
        .join("");

}