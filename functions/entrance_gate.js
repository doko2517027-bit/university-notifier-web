/**
 * CareMate ワンタイム入口認証
 *
 * ・管理者だけが認証文言を発行できる
 * ・文言は1回使用すると無効
 * ・有効期限は10分
 * ・新しい文言を発行すると古い文言は無効
 * ・認証文言はハッシュ化して保存
 */

const { onCall, HttpsError } =
  require("firebase-functions/v2/https");

const { getApps, initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore, Timestamp } = require("firebase-admin/firestore");

const crypto = require("node:crypto");


// ========================================
// Firebase初期化
// ========================================

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();


// ========================================
// 設定
// ========================================

const REGION = "asia-northeast1";

const EXPIRES_MINUTES = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 8;
const GRANT_EXPIRES_MINUTES = 30;
const RUNTIME_SERVICE_ACCOUNT = "caremate-functions@universitynotifier-67517.iam.gserviceaccount.com";

// 認証文言を保存するFirestoreドキュメント
const entranceRef = db
  .collection("systemPrivate")
  .doc("entranceGate");


// ========================================
// ハッシュ化
// ========================================

function hashPhrase(phrase, salt) {
  return crypto.scryptSync(
    phrase,
    salt,
    32
  );
}


// ========================================
// 管理者権限の確認
// ========================================

async function verifyAdmin(uid) {

  if (!uid) {
    throw new HttpsError(
      "unauthenticated",
      "ログインが必要です"
    );
  }

  const snapshot = await db
    .collection("access")
    .doc(uid)
    .get();

  const access = snapshot.data();

  if (
    !snapshot.exists ||
    access?.active !== true ||
    access?.role !== "admin"
  ) {
    throw new HttpsError(
      "permission-denied",
      "管理者権限がありません"
    );
  }

  return true;
}


// ========================================
// ワンタイム文言の発行
// ========================================

exports.issueEntrancePhrase = onCall(
  {
    region: REGION,
    maxInstances: 2,
    concurrency: 20,
    timeoutSeconds: 30,
    serviceAccount: RUNTIME_SERVICE_ACCOUNT,
  },

  async (request) => {

    // 管理者だけ実行可能
    await verifyAdmin(request.auth?.uid);

    const phrase = String(
      request.data?.phrase || ""
    ).trim();
    const experienceMode = request.data?.experienceMode === "study-only" ? "study-only" : "assignments";

    // 文言の長さを確認
    if (
      phrase.length < 16 ||
      phrase.length > 120
    ) {
      throw new HttpsError(
        "invalid-argument",
        "認証文言は16〜120文字で入力してください"
      );
    }

    // ランダムなソルト
    const salt = crypto
      .randomBytes(16)
      .toString("hex");

    // 文言をハッシュ化
    const hash = hashPhrase(
      phrase,
      salt
    ).toString("hex");

    const now = Date.now();

    const expiresAt =
      Timestamp.fromMillis(
        now + EXPIRES_MINUTES * 60 * 1000
      );

    // Firestoreに保存
    // 前の文言は上書きされて無効になる
    await entranceRef.set({
      hash: hash,
      salt: salt,

      usedAt: null,

      createdAt:
        FieldValue.serverTimestamp(),

      expiresAt: expiresAt,

      createdBy: request.auth.uid,
      experienceMode,
    });

    return {
      ok: true,
      expiresInMinutes: EXPIRES_MINUTES
    };
  }
);


// ========================================
// ワンタイム文言の認証
// ========================================

exports.redeemEntrancePhrase = onCall(
  {
    region: REGION,
    maxInstances: 2,
    concurrency: 20,
    timeoutSeconds: 30,
    serviceAccount: RUNTIME_SERVICE_ACCOUNT,
  },

  async (request) => {

    const phrase = String(
      request.data?.phrase || ""
    ).trim();

    if (
      !phrase ||
      phrase.length > 120
    ) {
      return { ok: false };
    }

    // Keep only a digest of the caller address. This is a rate limit, not an
    // identity check: possession of the phrase is still required.
    const address = String(request.rawRequest?.ip || request.rawRequest?.socket?.remoteAddress || "unknown");
    const addressDigest = crypto.createHash("sha256").update(address).digest("hex");
    const attemptRef = db.collection("systemPrivate").doc(`entranceAttempts_${addressDigest}`);

    // 同時使用による二重認証を防止
    return db.runTransaction(
      async (transaction) => {

        const [snapshot, attemptSnapshot] = await Promise.all([
          transaction.get(entranceRef),
          transaction.get(attemptRef),
        ]);

        const now = Date.now();
        const attempt = attemptSnapshot.data() || {};
        if (Number(attempt.blockedUntil || 0) > now) return { ok: false };

        if (!snapshot.exists) {
          return { ok: false };
        }

        const data = snapshot.data();

        // 使用済みなら無効
        if (data.usedAt) {
          return { ok: false };
        }

        // 有効期限を過ぎたら無効
        if (
          !data.expiresAt ||
          now >= data.expiresAt.toMillis()
        ) {
          return { ok: false };
        }

        // 入力された文言をハッシュ化
        const actual = hashPhrase(
          phrase,
          data.salt
        );

        const expected = Buffer.from(
          data.hash,
          "hex"
        );

        // 一致確認
        const valid =
          actual.length === expected.length &&
          crypto.timingSafeEqual(
            actual,
            expected
          );

        if (!valid) {
          const withinWindow = Number(attempt.windowStart || 0) + ATTEMPT_WINDOW_MS > now;
          const failures = (withinWindow ? Number(attempt.failures || 0) : 0) + 1;
          transaction.set(attemptRef, {
            failures,
            windowStart: withinWindow ? attempt.windowStart : now,
            blockedUntil: failures >= MAX_FAILED_ATTEMPTS ? now + ATTEMPT_WINDOW_MS : 0,
            expiresAt: Timestamp.fromMillis(now + 2 * ATTEMPT_WINDOW_MS),
          });
          return { ok: false };
        }

        const grant = crypto.randomBytes(32).toString("base64url");
        const grantHash = crypto.createHash("sha256").update(grant).digest("hex");
        const grantRef = db.collection("systemPrivate").doc("entranceGrants")
          .collection("tokens").doc(grantHash);
        transaction.create(grantRef, {
          experienceMode: data.experienceMode === "study-only" ? "study-only" : "assignments",
          createdAt: FieldValue.serverTimestamp(),
          expiresAt: Timestamp.fromMillis(now + GRANT_EXPIRES_MINUTES * 60 * 1000),
          usedAt: null,
        });

        // 認証成功 → 使用済みに変更
        transaction.update(entranceRef, {
          usedAt:
            FieldValue.serverTimestamp()
        });
        transaction.delete(attemptRef);

        return { ok: true, grant, experienceMode: data.experienceMode === "study-only" ? "study-only" : "assignments" };
      }
    );
  }
);
