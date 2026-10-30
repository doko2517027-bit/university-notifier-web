/**
 * CareMate Firebase認証共通モジュール
 *
 * 新CareMate用
 *
 * ・Firebase初期化
 * ・Firebase Authentication
 * ・Firestore
 * ・Cloud Functions
 * ・学籍番号とパスワードによるログイン
 *
 * 旧CareMateの端末管理・ランキング・
 * 出席管理などには依存しない。
 */

import {
    initializeApp,
    getApps,
    getApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getAuth,
    signInWithCustomToken,
    signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { callCareMate } from "./backend_client.js?v=20261030-1";


// ========================================
// Firebase設定
// ========================================

const firebaseConfig = {
    apiKey: "AIzaSyAEtS2NGZKqHFh29kmR9OjEpshbC1yvjFY",
    authDomain: "universitynotifier-67517.firebaseapp.com",
    projectId: "universitynotifier-67517",
    storageBucket: "universitynotifier-67517.firebasestorage.app",
    messagingSenderId: "908622250178",
    appId: "1:908622250178:web:3e355fce8698fcf179bb5b",
    databaseURL: "https://universitynotifier-67517-default-rtdb.firebaseio.com"
};


// ========================================
// Firebase初期化
// ========================================

export const app = getApps().length
    ? getApp()
    : initializeApp(firebaseConfig);


// ========================================
// Firebaseサービス
// ========================================

export const auth = getAuth(app);

export const db = getFirestore(app);




// ========================================
// CareMateログイン
// ========================================

export async function signInCareMateAuth(
    studentNumber,
    password
) {

    const normalizedStudentNumber =
        String(studentNumber || "").trim();

    if (!/^\d{7}$/.test(normalizedStudentNumber)) {
        throw new Error(
            "学籍番号は7桁で入力してください。"
        );
    }

    if (typeof password !== "string" || !password) {
        throw new Error(
            "パスワードを入力してください。"
        );
    }

    // サーバー側で認証と利用許可を確認
    const result = await callCareMate("authenticateCareMate", {
        studentNumber: normalizedStudentNumber,
        password,
        entranceGrant: localStorage.getItem("caremateEntranceGrant") || ""
    });

    // Firebaseカスタムトークン
    const token = result.data?.token;

    if (typeof token !== "string" || !token) {
        throw new Error(
            "認証トークンを取得できませんでした。"
        );
    }

    // Firebase Authenticationにログイン
    await signInWithCustomToken(
        auth,
        token
    );

    localStorage.removeItem("caremateEntranceGrant");
    localStorage.setItem("caremateExperienceMode", result.data?.assignmentAccess === false ? "study-only" : "assignments");

    return result.data;
}


// ========================================
// ログアウト
// ========================================

export async function signOutCareMate() {

    await signOut(auth);

    localStorage.removeItem("loggedIn");

    // 一度通過した入口の状態は維持する
    // caremateLoginEnabled は削除しない

    location.replace("index.html");

}


// ========================================
// 管理者権限の確認
// ========================================

export async function isCareMateAdmin() {

    await auth.authStateReady();

    const user = auth.currentUser;

    if (!user) {
        return false;
    }

    const accessRef = await import(
        "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js"
    );

    const snapshot = await accessRef.getDoc(
        accessRef.doc(
            db,
            "access",
            user.uid
        )
    );

    return (
        snapshot.exists() &&
        snapshot.data()?.active === true &&
        snapshot.data()?.role === "admin"
    );

}
