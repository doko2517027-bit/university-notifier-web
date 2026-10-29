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
  needsPasswordUpgrade,
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
  serviceAccount: "caremate-functions@universitynotifier-67517.iam.gserviceaccount.com",
  maxInstances: 3,
  concurrency: 20,
  timeoutSeconds: 30,
};

const STUDENT_NUMBER_PATTERN = /^\d{7}$/;
// Firebase Web API keys identify a project; they are not privileged secrets.
// Password verification is performed only from this rate-limited backend.
const STUDY_APP_WEB_API_KEY = "AIzaSyAEtS2NGZKqHFh29kmR9OjEpshbC1yvjFY";
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;
const credentialRef = (studentNumber) => db.collection("systemPrivate").doc("careMateCredentials")
  .collection("accounts").doc(studentNumber);
const manabaRef = (studentNumber) => db.collection("systemPrivate").doc("manabaCredentials")
  .collection("accounts").doc(studentNumber);
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

async function resolveExperienceMode(studentNumber, grant) {
  const accessRef = db.collection("access").doc(authUidForStudent(studentNumber));
  const access = await accessRef.get();
  const current = access.data()?.experienceMode;
  if (["assignments", "study-only"].includes(current)) return current;
  // Existing users predate the two-route entry and retain their assignment access.
  if (current !== "pending") return "assignments";
  if (typeof grant !== "string" || grant.length < 32 || grant.length > 128) {
    throw new HttpsError("failed-precondition", "管理者が発行した入口文言から、もう一度ログイン画面を開いてください。");
  }
  const grantHash = crypto.createHash("sha256").update(grant).digest("hex");
  const grantRef = db.collection("systemPrivate").doc("entranceGrants").collection("tokens").doc(grantHash);
  return db.runTransaction(async (transaction) => {
    const [currentAccess, token] = await Promise.all([transaction.get(accessRef), transaction.get(grantRef)]);
    const mode = token.data()?.experienceMode;
    const expiresAt = token.data()?.expiresAt?.toMillis?.() || 0;
    if (currentAccess.data()?.experienceMode !== "pending" || token.data()?.usedAt || expiresAt <= Date.now()
      || !["assignments", "study-only"].includes(mode)) {
      throw new HttpsError("permission-denied", "入口の認証情報が無効です。新しい文言を発行してください。");
    }
    transaction.update(accessRef, { experienceMode: mode, experienceModeSetAt: FieldValue.serverTimestamp() });
    transaction.update(grantRef, { usedAt: FieldValue.serverTimestamp(), usedBy: studentNumber });
    return mode;
  });
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
  const access = await db.collection("access").doc(authUidForStudent(studentNumber)).get();
  const experienceMode = access.data()?.experienceMode === "study-only" ? "study-only" : "assignments";
  return { active: true, role, experienceMode, assignmentAccess: experienceMode === "assignments" };
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
  const secretRef = credentialRef(studentNumber);
  await db.runTransaction(async (transaction) => {
    const [accessSnapshot, userSnapshot, secretSnapshot] = await Promise.all([
      transaction.get(accessRef), transaction.get(userRef), transaction.get(secretRef),
    ]);
    if (accessSnapshot.exists || userSnapshot.exists || secretSnapshot.exists) {
      throw new HttpsError("already-exists", "この学籍番号はすでに登録されています。");
    }
    const now = FieldValue.serverTimestamp();
    transaction.create(userRef, {
      name,
      createdAt: now,
      createdBy,
    });
    transaction.create(secretRef, { hash: hashPassword(password), createdAt: now });
    transaction.create(accessRef, {
      active: true,
      role: "member",
      experienceMode: "pending",
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
  const secretRef = credentialRef(studentNumber);
  await db.runTransaction(async (transaction) => {
    const [access, user] = await Promise.all([transaction.get(accessRef), transaction.get(userRef)]);
    if (!access.exists || access.data()?.active !== true || !user.exists) {
      throw new HttpsError("not-found", "利用中の学生が見つかりません。");
    }
    requireManageableAccount(actorNumber, studentNumber, access.data());
    transaction.set(secretRef, { hash: hashPassword(password), passwordChangedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.update(userRef, { passwordChangedAt: FieldValue.serverTimestamp() });
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
      hasManabaPassword: user.data()?.manabaCredentialConfigured === true,
      experienceMode: access.experienceMode === "study-only" ? "study-only" : access.experienceMode === "pending" ? "pending" : "assignments",
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
  const allAccounts = snapshot.docs.filter((accessDoc) => /^caremate-\d{7}$/.test(accessDoc.id));
  const users = await Promise.all(allAccounts.map((accessDoc) =>
    db.collection("users").doc(accessDoc.id.slice("caremate-".length)).get()
  ));
  const missingUsers = users.filter((doc, index) => active.includes(allAccounts[index]) && !doc.exists).length;
  const readableHashes = users.filter((doc) => doc.exists && typeof doc.data()?.appPasswordHash === "string").length;
  const legacyManaba = users.filter((doc) => doc.exists && typeof doc.data()?.manabaPasswordEncrypted === "string").length;
  const privateHashes = await Promise.all(active.map((doc) => credentialRef(doc.id.slice("caremate-".length)).get()));
  const missingOrWeakHashes = privateHashes.filter((doc) => !/^pbkdf2-v1\$(direct|layered)\$600000\$/.test(String(doc.data()?.hash || ""))).length;
  const privateManaba = await Promise.all(active.map((doc) => manabaRef(doc.id.slice("caremate-".length)).get()));
  const missingManaba = active.filter((doc, index) => {
    const user = users[allAccounts.indexOf(doc)]?.data() || {};
    return user.manabaCredentialConfigured === true && typeof privateManaba[index].data()?.password !== "string";
  }).length;
  const cronHealth = (await db.collection("system").doc("assignmentCronHealth").get()).data() || {};
  const cronAgeMs = Date.now() - Number(cronHealth.updatedAtMs || 0);
  const cronHealthy = cronHealth.status === "success" && cronAgeMs >= 0 && cronAgeMs <= 10 * 60 * 60 * 1000;
  let runtimeServiceAccount = process.env.CAREMATE_RUNTIME_SERVICE_ACCOUNT || "";
  try {
    if (!runtimeServiceAccount) {
    const metadata = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email",
      { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(2000) }
    );
    if (metadata.ok) runtimeServiceAccount = (await metadata.text()).trim();
    }
  } catch {
    runtimeServiceAccount = "";
  }
  const isolatedRuntime = runtimeServiceAccount === "caremate-functions@universitynotifier-67517.iam.gserviceaccount.com";
  return {
    checkedAt: new Date().toISOString(),
    checks: [
      { id: "primary", level: primary?.data()?.active === true && primary?.data()?.role === "admin" ? "pass" : "fail", text: "主管理者2510044の利用権限" },
      { id: "roles", level: invalidAccess.length ? "fail" : "pass", text: `権限データの形式（異常 ${invalidAccess.length} 件）` },
      { id: "users", level: missingUsers ? "fail" : "pass", text: `有効な利用者の登録整合性（不一致 ${missingUsers} 件）` },
      { id: "hashes", level: readableHashes || missingOrWeakHashes ? "fail" : "pass", text: `ログイン認証情報の分離・強度（公開側 ${readableHashes} 件、未移行・不整合 ${missingOrWeakHashes} 件）` },
      { id: "manaba", level: legacyManaba || missingManaba ? "warn" : "pass", text: `manaba認証情報の分離（公開側 ${legacyManaba} 件、保存不整合 ${missingManaba} 件）` },
      { id: "runtime", level: isolatedRuntime ? "pass" : "fail", text: `Firebase関数の専用実行権限（${isolatedRuntime ? "分離済み" : "要確認"}）` },
      { id: "render", level: cronHealthy ? "pass" : "warn", text: `Render課題取得の最終実行（${cronHealth.status === "success" ? "成功" : "未確認または失敗"}）` },
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

async function saveManabaCredential(studentNumber, password) {
  if (typeof password !== "string" || !password || password.length > 256) {
    throw new HttpsError("invalid-argument", "manabaパスワードを確認してください。");
  }
  const userRef = db.collection("users").doc(studentNumber);
  await db.runTransaction(async (transaction) => {
    const user = await transaction.get(userRef);
    if (!user.exists) throw new HttpsError("not-found", "登録情報が見つかりません。");
    transaction.set(manabaRef(studentNumber), { password, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.update(userRef, {
      manabaPasswordEncrypted: FieldValue.delete(), manabaCredentialConfigured: true,
      manabaSetupSkipped: false, manabaResetRequired: false, manabaVerified: null,
      manabaVerifiedAt: null, manabaVerificationError: null,
    });
  });
}

async function removeManabaCredential(studentNumber) {
  const userRef = db.collection("users").doc(studentNumber);
  await db.runTransaction(async (transaction) => {
    const user = await transaction.get(userRef);
    if (!user.exists) throw new HttpsError("not-found", "登録情報が見つかりません。");
    transaction.delete(manabaRef(studentNumber));
    transaction.update(userRef, {
      manabaPasswordEncrypted: FieldValue.delete(), manabaCredentialConfigured: false,
      manabaSetupSkipped: true, manabaResetRequired: false, manabaVerified: null,
      manabaVerifiedAt: null, manabaVerificationError: null,
    });
  });
}

exports.setMyManabaPassword = onCall(CALL_OPTIONS, async (request) => {
  const studentNumber = authenticatedStudentNumber(request);
  await requireApprovedStudent(studentNumber);
  const access = await db.collection("access").doc(authUidForStudent(studentNumber)).get();
  if (access.data()?.experienceMode === "study-only") throw new HttpsError("permission-denied", "この画面ではmanaba連携を利用しません。");
  await saveManabaCredential(studentNumber, request.data?.password);
  return { changed: true };
});

exports.removeMyManabaPassword = onCall(CALL_OPTIONS, async (request) => {
  const studentNumber = authenticatedStudentNumber(request);
  await requireApprovedStudent(studentNumber);
  await removeManabaCredential(studentNumber);
  return { removed: true };
});

exports.adminSetStudentManabaPassword = onCall(CALL_OPTIONS, async (request) => {
  const { studentNumber: actorNumber } = await requireAdmin(request);
  const studentNumber = String(request.data?.studentNumber || "").trim();
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    throw new HttpsError("invalid-argument", "学籍番号またはmanabaパスワードを確認してください。");
  }
  const accessRef = db.collection("access").doc(authUidForStudent(studentNumber));
  const access = await accessRef.get();
  if (!access.exists || access.data()?.active !== true) throw new HttpsError("not-found", "利用中の学生が見つかりません。");
  requireManageableAccount(actorNumber, studentNumber, access.data());
  await saveManabaCredential(studentNumber, request.data?.password);
  return { changed: true };
});

exports.adminRemoveStudentManabaPassword = onCall(CALL_OPTIONS, async (request) => {
  const { studentNumber: actorNumber } = await requireAdmin(request);
  const studentNumber = String(request.data?.studentNumber || "").trim();
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) throw new HttpsError("invalid-argument", "学籍番号を確認してください。");
  const accessRef = db.collection("access").doc(authUidForStudent(studentNumber));
  const access = await accessRef.get();
  if (!access.exists || access.data()?.active !== true) throw new HttpsError("not-found", "利用中の学生が見つかりません。");
  requireManageableAccount(actorNumber, studentNumber, access.data());
  await removeManabaCredential(studentNumber);
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

// CareMateUniv: only the fixed primary administrator may permanently remove
// another study-app account. The browser never receives Admin SDK privileges.
exports.deleteStudyAppUser = onCall(CALL_OPTIONS, async (request) => {
  const actorUid = request.auth?.uid;
  const targetUid = String(request.data?.targetUid || "").trim();
  if (!actorUid) throw new HttpsError("unauthenticated", "ログインが必要です。");
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(targetUid)) {
    throw new HttpsError("invalid-argument", "削除対象を確認してください。");
  }

  const actorSnapshot = await db.collection("studyAppUsers").doc(actorUid).get();
  const actor = actorSnapshot.data() || {};
  if (actor.active !== true || actor.role !== "admin" || actor.studentNumber !== "2510044") {
    throw new HttpsError("permission-denied", "主管理者だけが登録を削除できます。");
  }
  if (targetUid === actorUid) {
    throw new HttpsError("permission-denied", "主管理者は削除できません。");
  }

  const targetRef = db.collection("studyAppUsers").doc(targetUid);
  const targetSnapshot = await targetRef.get();
  if (!targetSnapshot.exists) throw new HttpsError("not-found", "対象ユーザーが見つかりません。");
  const target = targetSnapshot.data() || {};
  if (target.studentNumber === "2510044") {
    throw new HttpsError("permission-denied", "主管理者は削除できません。");
  }

  const [progressSnapshot, reportsSnapshot] = await Promise.all([
    targetRef.collection("progress").get(),
    db.collection("studyAppReports").where("reporterUid", "==", targetUid).get(),
  ]);
  const writer = db.bulkWriter();
  progressSnapshot.docs.forEach((item) => writer.delete(item.ref));
  reportsSnapshot.docs.forEach((item) => writer.delete(item.ref));
  if (typeof target.studentNumber === "string") {
    writer.delete(db.collection("studyAppStudentNumbers").doc(target.studentNumber));
  }
  writer.delete(targetRef);
  await writer.close();

  try {
    await adminAuth.deleteUser(targetUid);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw new HttpsError("internal", "ログイン情報を削除できませんでした。");
  }
  return { deleted: true };
});

async function requireStudyAppAdministrator(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "ログインが必要です。");
  const snapshot = await db.collection("studyAppUsers").doc(uid).get();
  const profile = snapshot.data() || {};
  if (!snapshot.exists || profile.active !== true || profile.role !== "admin") {
    throw new HttpsError("permission-denied", "管理者権限がありません。");
  }
  return { uid, profile };
}

// CareMateUniv: administrators can issue a temporary password without knowing
// the old one. Delegated administrators cannot take over the primary admin or
// another delegated administrator account.
exports.adminResetStudyAppPassword = onCall(CALL_OPTIONS, async (request) => {
  const actor = await requireStudyAppAdministrator(request);
  const targetUid = String(request.data?.targetUid || "").trim();
  const nextPassword = request.data?.nextPassword;
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(targetUid)
    || typeof nextPassword !== "string" || nextPassword.length < 8 || nextPassword.length > 128) {
    throw new HttpsError("invalid-argument", "対象者と8文字以上の仮パスワードを確認してください。");
  }
  const targetSnapshot = await db.collection("studyAppUsers").doc(targetUid).get();
  const target = targetSnapshot.data() || {};
  if (!targetSnapshot.exists || target.active !== true) throw new HttpsError("not-found", "利用中のアカウントが見つかりません。");
  const actorIsPrimary = actor.profile.studentNumber === "2510044";
  const changingSelf = actor.uid === targetUid;
  if (!actorIsPrimary && (target.studentNumber === "2510044" || (target.role === "admin" && !changingSelf))) {
    throw new HttpsError("permission-denied", "この管理者アカウントのパスワードは変更できません。");
  }
  await adminAuth.updateUser(targetUid, { password: nextPassword });
  await adminAuth.revokeRefreshTokens(targetUid);
  await targetSnapshot.ref.set({ mustChangePassword: true, passwordResetAt: FieldValue.serverTimestamp(), passwordResetBy: actor.profile.studentNumber }, { merge: true });
  return { changed: true };
});

// The public form never reveals whether a student number exists. Firebase sends
// its standard one-time reset link directly to the registered Active!Mail inbox;
// passwords are never emailed in plain text.
exports.requestStudyAppPasswordReset = onCall(CALL_OPTIONS, async (request) => {
  const studentNumber = String(request.data?.studentNumber || "").trim();
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    throw new HttpsError("invalid-argument", "学籍番号を確認してください。");
  }
  await reserveLoginAttempt(request, `study-reset-${studentNumber}`);
  const genericResult = { accepted: true };
  const numberSnapshot = await db.collection("studyAppStudentNumbers").doc(studentNumber).get();
  const uid = String(numberSnapshot.data()?.uid || "");
  if (!numberSnapshot.exists || numberSnapshot.data()?.deleted === true || !uid) return genericResult;
  const profileSnapshot = await db.collection("studyAppUsers").doc(uid).get();
  const profile = profileSnapshot.data() || {};
  if (!profileSnapshot.exists || profile.active !== true || profile.role === "admin") return genericResult;
  let user;
  try { user = await adminAuth.getUser(uid); } catch { return genericResult; }
  if (!String(user.email || "").toLowerCase().endsWith("@sums.ac.jp")) return genericResult;
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${STUDY_APP_WEB_API_KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestType: "PASSWORD_RESET", email: user.email }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error("password reset email rejected");
  } catch {
    throw new HttpsError("unavailable", "メール送信サービスへ接続できませんでした。少し待ってからお試しください。");
  }
  return genericResult;
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
// CareMateUniv: 学籍番号とパスワードによるログイン
// ========================================

exports.authenticateStudyApp = onCall(CALL_OPTIONS, async (request) => {
  const studentNumber = String(request.data?.studentNumber || "").trim();
  const password = request.data?.password;
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)
    || typeof password !== "string"
    || password.length < 8
    || password.length > 128) {
    throw new HttpsError("invalid-argument", "学籍番号またはパスワードを確認してください。");
  }

  const attemptRef = await reserveLoginAttempt(request, `study-${studentNumber}`);
  const numberSnapshot = await db.collection("studyAppStudentNumbers").doc(studentNumber).get();
  const uid = String(numberSnapshot.data()?.uid || "");
  if (!numberSnapshot.exists || numberSnapshot.data()?.deleted === true || !uid) throw unauthorized();

  const profileSnapshot = await db.collection("studyAppUsers").doc(uid).get();
  const profile = profileSnapshot.data() || {};
  if (!profileSnapshot.exists || profile.active !== true || profile.studentNumber !== studentNumber) {
    throw unauthorized();
  }

  let authUser;
  try {
    authUser = await adminAuth.getUser(uid);
  } catch {
    throw unauthorized();
  }
  if (!authUser.email || authUser.disabled
    || (profile.role !== "admin" && authUser.emailVerified !== true)) {
    throw unauthorized();
  }

  let verification;
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${STUDY_APP_WEB_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: authUser.email, password, returnSecureToken: true }),
        signal: AbortSignal.timeout(8_000),
      }
    );
    if (!response.ok) throw unauthorized();
    verification = await response.json();
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("unavailable", "認証サービスへ接続できませんでした。少し待ってからお試しください。");
  }
  if (verification?.localId !== uid) throw unauthorized();

  const token = await adminAuth.createCustomToken(uid, {
    studyApp: true,
    studentNumber,
    role: profile.role === "admin" ? "admin" : "student",
  });
  await attemptRef.delete();
  return { token, role: profile.role === "admin" ? "admin" : "student" };
});


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
      !password ||
      password.length > 128
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

    const privateCredential = await credentialRef(studentNumber).get();
    const storedHash = privateCredential.data()?.hash;
    if (!userSnapshot.exists || !matchesPasswordHash(password, storedHash)) {
      throw unauthorized();
    }

    // 管理者による利用許可を確認
    const {
      uid,
      role,
    } = await requireApprovedStudent(studentNumber);

    const experienceMode = await resolveExperienceMode(studentNumber, request.data?.entranceGrant);
    const isAdmin = role === "admin";

    if (needsPasswordUpgrade(storedHash)) {
      const upgradedHash = hashPassword(password);
      await db.runTransaction(async (transaction) => {
        const currentSecret = await transaction.get(credentialRef(studentNumber));
        const currentHash = currentSecret.data()?.hash;
        if (currentHash === storedHash) {
          transaction.set(credentialRef(studentNumber), { hash: upgradedHash, passwordChangedAt: FieldValue.serverTimestamp() }, { merge: true });
        }
      });
    }

    // Firebase Authentication用トークンを発行
    const token = await adminAuth.createCustomToken(
      uid,
      {
        studentNumber,
        admin: isAdmin,
        assignmentAccess: experienceMode === "assignments",
      }
    );

    await attemptRef.delete();

    return {
      token,
      admin: isAdmin,
      role,
      experienceMode,
      assignmentAccess: experienceMode === "assignments",
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
    const secretRef = credentialRef(studentNumber);

    await db.runTransaction(
      async (transaction) => {

        const [userSnapshot, secretSnapshot] = await Promise.all([
          transaction.get(userRef), transaction.get(secretRef),
        ]);

        if (!userSnapshot.exists) {
          throw new HttpsError(
            "not-found",
            "登録情報が見つかりません。"
          );
        }

        const storedHash = secretSnapshot.data()?.hash;

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

        if (matchesPasswordHash(newPassword, storedHash)) {
          throw new HttpsError(
            "invalid-argument",
            "別のパスワードを入力してください。"
          );
        }

        transaction.set(secretRef, { hash: hashPassword(newPassword), passwordChangedAt: FieldValue.serverTimestamp() }, { merge: true });
        transaction.update(userRef, { passwordChangedAt: FieldValue.serverTimestamp() });
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
