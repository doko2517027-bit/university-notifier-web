/**
 * CareMate - Firebase Cloud Functions
 *
 * 新CareMate用の最小構成
 *
 * 残す機能：
 * ・学籍番号とアプリ用パスワードによるログイン
 * ・Firebase Authentication
 * ・管理者が許可したユーザーのみログイン可能
 * ・アプリ用パスワード変更
 * ・ワンタイム認証文言の発行・照合
 *
 * テスト対策の問題データ・公開設定はFirestoreに保存。
 *
 * manaba課題取得・期限通知はRender側で処理。
 *
 * 注意：
 * フロントエンドとFirestoreルールの修正が完了するまで
 * デプロイしないこと。
 */

"use strict";

const crypto = require("node:crypto");

const {
  onCall,
  HttpsError,
} = require("firebase-functions/v2/https");

const {
  initializeApp,
  getApps,
} = require("firebase-admin/app");

const {
  getAuth,
} = require("firebase-admin/auth");

const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");

const {
  hashPassword,
  matchesPasswordHash,
  isValidNewPassword,
} = require("./password_change_policy.js");


// ========================================
// Firebase初期化
// ========================================

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

const adminAuth = getAuth();


// ========================================
// 基本設定
// ========================================

const REGION = "asia-northeast1";

const SITE_ORIGIN =
  "https://doko2517027-bit.github.io";

const CALL_OPTIONS = {
  region: REGION,
  cors: [SITE_ORIGIN],
};

const STUDENT_NUMBER_PATTERN = /^\d{7}$/;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;

async function reserveLoginAttempt(request, studentNumber) {
  const source = String(
    request.rawRequest?.ip ||
    request.rawRequest?.socket?.remoteAddress ||
    "unknown"
  ).slice(0, 128);
  const key = crypto.createHash("sha256")
    .update(`${studentNumber}|${source}`)
    .digest("hex");
  const ref = db.collection("systemPrivate").doc("loginThrottle")
    .collection("clients").doc(key);
  const now = Date.now();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const existing = snapshot.data() || {};
    const activeWindow = Number(existing.windowEndMs || 0) > now;
    const count = activeWindow ? Number(existing.count || 0) : 0;
    if (count >= MAX_LOGIN_ATTEMPTS) {
      throw new HttpsError(
        "resource-exhausted",
        "試行回数が多すぎます。15分後にお試しください。"
      );
    }
    transaction.set(ref, {
      count: count + 1,
      windowEndMs: activeWindow ? existing.windowEndMs : now + LOGIN_ATTEMPT_WINDOW_MS,
    });
  });
  return ref;
}


// ========================================
// 認証エラー
// ========================================

function unauthorized() {
  return new HttpsError(
    "unauthenticated",
    "学籍番号またはパスワードが違います。"
  );
}


// ========================================
// 学籍番号からFirebase UIDを取得
// ========================================

function authUidForStudent(studentNumber) {
  return `caremate-${studentNumber}`;
}


// ========================================
// 利用許可の確認
// ========================================

async function requireApprovedStudent(studentNumber) {

  const uid = authUidForStudent(studentNumber);

  const snapshot = await db
    .collection("access")
    .doc(uid)
    .get();

  const access = snapshot.data();

  if (
    !snapshot.exists ||
    access?.active !== true
  ) {
    throw new HttpsError(
      "permission-denied",
      "このアカウントには利用許可がありません。"
    );
  }

  return {
    uid,
    role:
      access?.role === "admin"
        ? "admin"
        : "member",
  };
}

// A claim in an old token is not sufficient: check the current allow-list.
exports.checkCareMateAccess = onCall(CALL_OPTIONS, async (request) => {
  const studentNumber = authenticatedStudentNumber(request);
  const { role } = await requireApprovedStudent(studentNumber);
  return { active: true, role };
});


// ========================================
// Firebase認証済みユーザーを確認
// ========================================

function authenticatedStudentNumber(request) {

  const studentNumber = String(
    request.auth?.token?.studentNumber || ""
  );

  if (
    !STUDENT_NUMBER_PATTERN.test(studentNumber) ||
    request.auth?.uid !==
      authUidForStudent(studentNumber)
  ) {
    throw new HttpsError(
      "unauthenticated",
      "ログインが必要です。"
    );
  }

  return studentNumber;
}


// ========================================
// ① CareMateログイン認証
// ========================================

exports.authenticateCareMate = onCall(
  CALL_OPTIONS,

  async (request) => {

    const studentNumber = String(
      request.data?.studentNumber || ""
    ).trim();

    const password = request.data?.password;

    // 入力内容を確認
    if (
      !STUDENT_NUMBER_PATTERN.test(studentNumber) ||
      typeof password !== "string" ||
      !password
    ) {
      throw new HttpsError(
        "invalid-argument",
        "ログイン情報が不足しています。"
      );
    }

    const attemptRef = await reserveLoginAttempt(request, studentNumber);

    // Firestoreから既存の登録情報を取得
    const userSnapshot = await db
      .collection("users")
      .doc(studentNumber)
      .get();

    const storedHash = String(
      userSnapshot.data()?.appPasswordHash || ""
    );

    // 入力されたパスワードをSHA-256でハッシュ化
    const inputHash = crypto
      .createHash("sha256")
      .update(password, "utf8")
      .digest("hex");

    // パスワード照合
    if (
      !userSnapshot.exists ||
      !/^[a-f0-9]{64}$/i.test(storedHash) ||
      !crypto.timingSafeEqual(
        Buffer.from(storedHash.toLowerCase(), "hex"),
        Buffer.from(inputHash, "hex")
      )
    ) {
      throw unauthorized();
    }

    // 管理者による利用許可を確認
    const {
      uid,
      role,
    } = await requireApprovedStudent(studentNumber);

    const isAdmin = role === "admin";

    // Firebase Authentication用トークンを発行
    const token = await adminAuth.createCustomToken(
      uid,
      {
        studentNumber,
        admin: isAdmin,
      }
    );

    await attemptRef.delete();

    return {
      token,
      admin: isAdmin,
      role,
    };
  }
);


// ========================================
// ② アプリ用パスワード変更
// ========================================

exports.changeCareMatePassword = onCall(
  CALL_OPTIONS,

  async (request) => {

    // Firebase認証を確認
    const studentNumber =
      authenticatedStudentNumber(request);

    // 利用許可を確認
    await requireApprovedStudent(studentNumber);

    const currentPassword =
      request.data?.currentPassword;

    const newPassword =
      request.data?.newPassword;

    if (
      typeof currentPassword !== "string" ||
      !isValidNewPassword(newPassword)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "パスワードの入力を確認してください。"
      );
    }

    const userRef = db
      .collection("users")
      .doc(studentNumber);

    await db.runTransaction(
      async (transaction) => {

        const userSnapshot =
          await transaction.get(userRef);

        if (!userSnapshot.exists) {
          throw new HttpsError(
            "not-found",
            "登録情報が見つかりません。"
          );
        }

        const storedHash =
          userSnapshot.data()?.appPasswordHash;

        // 現在のパスワードを照合
        if (
          !matchesPasswordHash(
            currentPassword,
            storedHash
          )
        ) {
          throw new HttpsError(
            "permission-denied",
            "現在のパスワードが違います。"
          );
        }

        // 新しいパスワードをハッシュ化
        const newHash = hashPassword(newPassword);

        if (newHash === storedHash) {
          throw new HttpsError(
            "invalid-argument",
            "別のパスワードを入力してください。"
          );
        }

        // パスワードを更新
        transaction.update(userRef, {
          appPasswordHash: newHash,

          passwordChangedAt:
            FieldValue.serverTimestamp(),
        });
      }
    );

    return {
      changed: true,
    };
  }
);


// ========================================
// ③ ワンタイム入口認証
// ========================================

// entrance_gate.jsから認証関数を読み込む
const {
  issueEntrancePhrase,
  redeemEntrancePhrase,
} = require("./entrance_gate.js");


// 管理者による認証文言の発行
exports.issueEntrancePhrase =
  issueEntrancePhrase;


// 認証文言の照合・使用済み処理
exports.redeemEntrancePhrase =
  redeemEntrancePhrase;
