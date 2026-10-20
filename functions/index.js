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
const { PRIMARY_ADMIN_NUMBER, isPrimaryAdmin, canManageAccount } = require("./admin_policy.js");


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

async function requireAdmin(request) {
  const studentNumber = authenticatedStudentNumber(request);
  const { uid, role } = await requireApprovedStudent(studentNumber);
  if (role !== "admin") {
    throw new HttpsError("permission-denied", "管理者権限がありません。");
  }
  return { studentNumber, uid };
}

function requireManageableAccount(actorNumber, targetNumber, access) {
  if (!canManageAccount(actorNumber, targetNumber, access?.role)) {
    throw new HttpsError("permission-denied", "この管理者アカウントは変更できません。");
  }
}

// A claim in an old token is not sufficient: check the current allow-list.
exports.checkCareMateAccess = onCall(CALL_OPTIONS, async (request) => {
  const studentNumber = authenticatedStudentNumber(request);
  const { role } = await requireApprovedStudent(studentNumber);
  return { active: true, role };
});

// 管理者が新しい学生アカウントを登録する。管理者権限は画面ではなく
// サーバーで照合し、同一学籍番号の二重登録をトランザクションで防ぐ。
exports.createCareMateAccount = onCall(CALL_OPTIONS, async (request) => {
  const { studentNumber: createdBy } = await requireAdmin(request);
  const studentNumber = String(request.data?.studentNumber || "").trim();
  const name = String(request.data?.name || "").trim();
  const password = request.data?.password;
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    throw new HttpsError("invalid-argument", "学籍番号は7桁で入力してください。");
  }
  if (!name || name.length > 80) {
    throw new HttpsError("invalid-argument", "氏名を入力してください（80文字以内）。");
  }
  if (!isValidNewPassword(password)) {
    throw new HttpsError("invalid-argument", "初期パスワードは6〜128文字で設定してください。");
  }

  const uid = authUidForStudent(studentNumber);
  const accessRef = db.collection("access").doc(uid);
  const userRef = db.collection("users").doc(studentNumber);
  await db.runTransaction(async (transaction) => {
    const [accessSnapshot, userSnapshot] = await Promise.all([
      transaction.get(accessRef), transaction.get(userRef),
    ]);
    if (accessSnapshot.exists || userSnapshot.exists) {
      throw new HttpsError("already-exists", "この学籍番号はすでに登録されています。");
    }
    const now = FieldValue.serverTimestamp();
    transaction.create(userRef, {
      name,
      appPasswordHash: hashPassword(password),
      createdAt: now,
      createdBy,
    });
    transaction.create(accessRef, {
      active: true,
      role: "member",
      createdAt: now,
      createdBy,
    });
  });
  return { created: true, studentNumber, role: "member" };
});

// 管理者によるパスワード再設定。初期・再設定パスワードはFirestoreへ
// ハッシュでのみ保存し、学生には現在のパスワードを求めない。
exports.adminSetStudentAppPassword = onCall(CALL_OPTIONS, async (request) => {
  const { studentNumber: actorNumber } = await requireAdmin(request);
  const studentNumber = String(request.data?.studentNumber || "").trim();
  const password = request.data?.password;
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber) || !isValidNewPassword(password)) {
    throw new HttpsError("invalid-argument", "学籍番号または新しいパスワードを確認してください。");
  }
  const accessRef = db.collection("access").doc(authUidForStudent(studentNumber));
  const userRef = db.collection("users").doc(studentNumber);
  await db.runTransaction(async (transaction) => {
    const [access, user] = await Promise.all([transaction.get(accessRef), transaction.get(userRef)]);
    if (!access.exists || access.data()?.active !== true || !user.exists) {
      throw new HttpsError("not-found", "利用中の学生が見つかりません。");
    }
    requireManageableAccount(actorNumber, studentNumber, access.data());
    transaction.update(userRef, {
      appPasswordHash: hashPassword(password),
      passwordChangedAt: FieldValue.serverTimestamp(),
    });
  });
  return { changed: true };
});

exports.adminListCareMateAccounts = onCall(CALL_OPTIONS, async (request) => {
  const { studentNumber: actorNumber } = await requireAdmin(request);
  const snapshot = await db.collection("access").get();
  const accounts = await Promise.all(snapshot.docs.map(async (accessDoc) => {
    const number = accessDoc.id.replace(/^caremate-/, "");
    if (!STUDENT_NUMBER_PATTERN.test(number)) return null;
    const user = await db.collection("users").doc(number).get();
    const access = accessDoc.data() || {};
    return {
      studentNumber: number,
      name: String(user.data()?.name || "（氏名未登録）"),
      role: access.role === "admin" ? "admin" : "member",
      active: access.active === true,
      hasManabaPassword: typeof user.data()?.manabaPasswordEncrypted === "string" && user.data().manabaPasswordEncrypted.length > 0,
    };
  }));
  return {
    canManageRoles: actorNumber === PRIMARY_ADMIN_NUMBER,
    currentStudentNumber: actorNumber,
    accounts: accounts.filter(Boolean).sort((a, b) => a.studentNumber.localeCompare(b.studentNumber)),
  };
});

// Read-only, point-in-time audit. This is not a penetration test or a proof
// that deployed rules, IAM and the Render integration are safe.
exports.adminRunSecurityCheck = onCall(CALL_OPTIONS, async (request) => {
  await requireAdmin(request);
  const snapshot = await db.collection("access").get();
  const primary = snapshot.docs.find((doc) => doc.id === authUidForStudent(PRIMARY_ADMIN_NUMBER));
  const invalidAccess = snapshot.docs.filter((doc) =>
    !/^caremate-\d{7}$/.test(doc.id) || !["admin", "member"].includes(doc.data()?.role)
  );
  const active = snapshot.docs.filter((doc) =>
    /^caremate-\d{7}$/.test(doc.id) && doc.data()?.active === true
  );
  const users = await Promise.all(active.map((accessDoc) =>
    db.collection("users").doc(accessDoc.id.slice("caremate-".length)).get()
  ));
  const missingUsers = users.filter((doc) => !doc.exists).length;
  const readableHashes = users.filter((doc) => doc.exists && typeof doc.data()?.appPasswordHash === "string").length;
  const legacyManaba = users.filter((doc) => doc.exists && typeof doc.data()?.manabaPasswordEncrypted === "string").length;
  return {
    checkedAt: new Date().toISOString(),
    checks: [
      { id: "primary", level: primary?.data()?.active === true && primary?.data()?.role === "admin" ? "pass" : "fail", text: "主管理者2510044の利用権限" },
      { id: "roles", level: invalidAccess.length ? "fail" : "pass", text: `権限データの形式（異常 ${invalidAccess.length} 件）` },
      { id: "users", level: missingUsers ? "fail" : "pass", text: `有効な利用者の登録整合性（不一致 ${missingUsers} 件）` },
      { id: "hashes", level: readableHashes ? "fail" : "pass", text: `パスワードハッシュが利用者ドキュメント内に存在（${readableHashes} 件・権限のあるブラウザから文書全体を取得可能）` },
      { id: "manaba", level: legacyManaba ? "warn" : "pass", text: `旧方式のmanaba認証情報（${legacyManaba} 件・暗号化鍵がWebコード内）` },
      { id: "scope", level: "unknown", text: "Firestore/Storageの本番ルール・IAM・Renderはこのボタンでは検証できません" },
    ],
  };
});

// Only the designated primary administrator may grant or revoke admin access.
// Firestore client rules deny access writes, so this is the sole role editor.
exports.adminSetCareMateRole = onCall(CALL_OPTIONS, async (request) => {
  const { studentNumber: actorNumber } = await requireAdmin(request);
  if (!isPrimaryAdmin(actorNumber, "admin")) {
    throw new HttpsError("permission-denied", "管理者権限の設定は主管理者のみ可能です。");
  }
  const studentNumber = String(request.data?.studentNumber || "").trim();
  const role = request.data?.role;
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber) || !["admin", "member"].includes(role)) {
    throw new HttpsError("invalid-argument", "学籍番号または権限を確認してください。");
  }
  if (studentNumber === PRIMARY_ADMIN_NUMBER) {
    throw new HttpsError("failed-precondition", "主管理者の権限は変更できません。");
  }
  const accessRef = db.collection("access").doc(authUidForStudent(studentNumber));
  const userRef = db.collection("users").doc(studentNumber);
  await db.runTransaction(async (transaction) => {
    const [access, user] = await Promise.all([transaction.get(accessRef), transaction.get(userRef)]);
    if (!access.exists || access.data()?.active !== true || !user.exists) {
      throw new HttpsError("not-found", "利用中の学生が見つかりません。");
    }
    transaction.update(accessRef, {
      role,
      roleChangedAt: FieldValue.serverTimestamp(),
      roleChangedBy: actorNumber,
    });
  });
  return { changed: true, role };
});

// 管理者はmanaba連携情報を保存・削除できる。値はクライアントで既存方式
// (AES-GCM)により暗号化して渡し、Render側のデータ形式を維持する。
exports.adminSetStudentManabaPassword = onCall(CALL_OPTIONS, async (request) => {
  const { studentNumber: actorNumber } = await requireAdmin(request);
  const studentNumber = String(request.data?.studentNumber || "").trim();
  const encrypted = request.data?.encryptedPassword;
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber) || typeof encrypted !== "string" || encrypted.length < 20 || encrypted.length > 4096) {
    throw new HttpsError("invalid-argument", "学籍番号またはmanabaパスワードを確認してください。");
  }
  const accessRef = db.collection("access").doc(authUidForStudent(studentNumber));
  const userRef = db.collection("users").doc(studentNumber);
  await db.runTransaction(async (transaction) => {
    const [access, user] = await Promise.all([transaction.get(accessRef), transaction.get(userRef)]);
    if (!access.exists || access.data()?.active !== true || !user.exists) {
      throw new HttpsError("not-found", "利用中の学生が見つかりません。");
    }
    requireManageableAccount(actorNumber, studentNumber, access.data());
    transaction.update(userRef, {
      manabaPasswordEncrypted: encrypted,
      manabaSetupSkipped: false,
      manabaResetRequired: false,
      manabaVerified: null,
      manabaVerifiedAt: null,
      manabaVerificationError: null,
    });
  });
  return { changed: true };
});

exports.adminRemoveStudentManabaPassword = onCall(CALL_OPTIONS, async (request) => {
  const { studentNumber: actorNumber } = await requireAdmin(request);
  const studentNumber = String(request.data?.studentNumber || "").trim();
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) throw new HttpsError("invalid-argument", "学籍番号を確認してください。");
  const accessRef = db.collection("access").doc(authUidForStudent(studentNumber));
  const userRef = db.collection("users").doc(studentNumber);
  await db.runTransaction(async (transaction) => {
    const [access, user] = await Promise.all([transaction.get(accessRef), transaction.get(userRef)]);
    if (!access.exists || access.data()?.active !== true || !user.exists) throw new HttpsError("not-found", "利用中の学生が見つかりません。");
    requireManageableAccount(actorNumber, studentNumber, access.data());
    transaction.update(userRef, {
      manabaPasswordEncrypted: FieldValue.delete(),
      manabaSetupSkipped: true,
      manabaResetRequired: false,
      manabaVerified: null,
      manabaVerifiedAt: null,
      manabaVerificationError: null,
    });
  });
  return { removed: true };
});

// 登録解除は復元可能なアクセス停止として扱い、履修・課題・学習履歴を
// 即時消去しない。既存番号の再登録も重複チェックにより防止する。
exports.adminDeactivateStudent = onCall(CALL_OPTIONS, async (request) => {
  const { studentNumber: adminNumber } = await requireAdmin(request);
  const studentNumber = String(request.data?.studentNumber || "").trim();
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) throw new HttpsError("invalid-argument", "学籍番号を確認してください。");
  if (studentNumber === adminNumber) throw new HttpsError("failed-precondition", "管理者本人はこの操作で解除できません。");
  const accessRef = db.collection("access").doc(authUidForStudent(studentNumber));
  await db.runTransaction(async (transaction) => {
    const access = await transaction.get(accessRef);
    if (!access.exists || access.data()?.active !== true) throw new HttpsError("not-found", "利用中の学生が見つかりません。");
    requireManageableAccount(adminNumber, studentNumber, access.data());
    transaction.update(accessRef, { active: false, revokedAt: FieldValue.serverTimestamp(), revokedBy: adminNumber });
  });
  return { deactivated: true };
});

exports.deactivateMyCareMateAccount = onCall(CALL_OPTIONS, async (request) => {
  const studentNumber = authenticatedStudentNumber(request);
  await requireApprovedStudent(studentNumber);
  if (studentNumber === PRIMARY_ADMIN_NUMBER) {
    throw new HttpsError("failed-precondition", "主管理者は自分の登録を解除できません。");
  }
  const accessRef = db.collection("access").doc(authUidForStudent(studentNumber));
  await db.runTransaction(async (transaction) => {
    const access = await transaction.get(accessRef);
    if (!access.exists || access.data()?.active !== true) throw new HttpsError("failed-precondition", "登録解除済みです。");
    transaction.update(accessRef, { active: false, revokedAt: FieldValue.serverTimestamp(), selfRevoked: true });
  });
  return { deactivated: true };
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
