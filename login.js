/**
 * CareMate ログイン処理
 *
 * ・新しいauth_core.jsを使用
 * ・Firebase Functionsで認証
 * ・許可されたユーザーのみログイン
 * ・ログイン成功後はapp.htmlへ移動
 */

import {
    db,
    signInCareMateAuth
} from "./auth_core.js";
import { loginErrorMessage } from "./login_error.js?v=20261028-1";

import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


// ========================================
// HTML要素
// ========================================

const studentNumberInput =
    document.getElementById("studentNumber");

const appPasswordInput =
    document.getElementById("appPassword");

const loginButton =
    document.getElementById("loginButton");

const loginMessage =
    document.getElementById("loginMessage");


// ========================================
// メッセージ表示
// ========================================

function showLoginMessage(message) {

    if (loginMessage) {
        loginMessage.textContent = message;
    } else if (message) {
        alert(message);
    }

}


// ========================================
// ログイン処理
// ========================================

async function handleLogin() {

    if (loginButton.disabled) {
        return;
    }

    const studentNumber =
        studentNumberInput.value.trim();

    const password =
        appPasswordInput.value;


    // 入力チェック

    if (!/^\d{7}$/.test(studentNumber)) {
        showLoginMessage(
            "学籍番号は7桁の数字で入力してください。"
        );
        return;
    }

    if (!password.trim()) {
        showLoginMessage(
            "パスワードを入力してください。"
        );
        return;
    }


    // ログイン開始

    loginButton.disabled = true;
    loginButton.textContent = "ログイン中…";

    showLoginMessage("");


    try {

        // ====================================
        // ① Firebaseで認証
        // ====================================

        // サーバー側で
        // ・学籍番号
        // ・パスワード
        // ・利用許可
        // を確認する

        await signInCareMateAuth(
            studentNumber,
            password
        );


        // ====================================
        // ② 学生プロフィール取得
        // ====================================

        let user = {};

        const userRef = doc(
            db,
            "users",
            studentNumber
        );

        try {

            const userSnap =
                await getDoc(userRef);

            if (userSnap.exists()) {
                user = userSnap.data();
            }

        } catch (error) {

            console.warn(
                "プロフィール取得エラー:",
                error
            );

        }


        // ====================================
        // ③ ログイン情報保存
        // ====================================

        localStorage.setItem(
            "registered",
            "true"
        );

        localStorage.setItem(
            "loggedIn",
            "true"
        );

        localStorage.setItem(
            "studentNumber",
            studentNumber
        );

        localStorage.setItem(
            "department",
            user.department || ""
        );

        localStorage.setItem(
            "major",
            user.major || ""
        );

        localStorage.setItem(
            "grade",
            user.grade || ""
        );

        localStorage.setItem(
            "manabaId",
            user.manabaId || ""
        );

        localStorage.setItem(
            "migrated",
            "true"
        );


        // ====================================
        // ④ 最終ログイン時刻
        // ====================================

        try {

            await Promise.race([

                updateDoc(userRef, {
                    lastLoginAt: serverTimestamp(),
                    lastActiveAt: serverTimestamp()
                }),

                new Promise((resolve) =>
                    setTimeout(resolve, 1500)
                )

            ]);

        } catch (error) {

            console.warn(
                "ログイン時刻の保存エラー:",
                error
            );

        }


        // ====================================
        // ⑤ ログイン後はホーム画面を最初に表示
        // ====================================

        appPasswordInput.value = "";

        try { sessionStorage.removeItem(`carematePushBannerDeferred:${studentNumber}`); } catch { /* Optional preference. */ }

        location.replace("home.html");


    } catch (error) {

        console.error(
            "ログインエラー:",
            error
        );

        showLoginMessage(loginErrorMessage(error));

    } finally {

        loginButton.disabled = false;
        loginButton.textContent = "ログイン";

    }

}


// ========================================
// ログインボタン
// ========================================

const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
        event.preventDefault();
        void handleLogin();
    });
} else {
    loginButton.addEventListener("click", handleLogin);
}


// ========================================
// Enterキーでログイン
// ========================================

appPasswordInput.addEventListener(
    "keydown",
    (event) => {

        if (event.key === "Enter") {

            event.preventDefault();

            void handleLogin();

        }

    }
);
