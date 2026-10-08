const { onRequest } = require("firebase-functions/v2/https");

const { onCall, HttpsError } = require("firebase-functions/v2/https");

const { onDocumentCreated, onDocumentDeleted } = require("firebase-functions/v2/firestore");

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");

const { onSchedule } = require("firebase-functions/v2/scheduler");

const { defineSecret } = require("firebase-functions/params");

const { initializeApp } = require("firebase-admin/app");

const { getAuth } = require("firebase-admin/auth");

const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const {
  deleteCareMateDataExceptExternalMedia,
  isPurgeEligible,
} = require("./account_cleanup.js");

const webpush = require("web-push");

const crypto = require("node:crypto");

const { hashPassword, matchesPasswordHash, isValidNewPassword } = require("./password_change_policy");

const { reminderMinutes, isReminderDue, matchesAudience } = require("./calendar_reminders");

const {
  PERIOD_TIMES,
  normalizeCourseName,
  normalizeGrade,
  attendanceNotificationType,
  canRetryAttendanceDispatch,
  effectiveClassSelections,
  slotId,
} = require("./attendance_policy");

const {
  createDeviceSessionStore,
  normalizeDeviceId,
  isPrimaryDeviceAuditAdminIdentity,
} = require("./device_sessions");

initializeApp();

const db = getFirestore();

const adminAuth = getAuth();

const deviceSessionStore = createDeviceSessionStore(db, FieldValue);

const { buildOrphanedPresenceUpdates } = require("./presence_cleanup.js");
const { manualUpdateDecision } = require("./manual_update_policy.js");
const {
  targetedSystemNewsMatchesStudent,
  targetedSystemNewsPredatesRegistration,
  targetedSystemNewsCopy,
  targetedSystemNewsContentSignature,
} = require("./system_news_audience.js");
const {
  REFERRAL_MAX_INVITES,
  REFERRAL_CODE_TTL_DAYS,
  REFERRAL_PROOF_TTL_MINUTES,
  REFERRAL_RATE_LIMIT_WINDOW_MINUTES,
  REFERRAL_RATE_LIMIT_ATTEMPTS,
  REFERRAL_MILESTONES,
  normalizeReferralCode,
  createReferralCode,
  createProofToken,
  sha256,
  isReferralCodeUsable,
  milestoneState,
  nextMilestone,
  validGiftUrl,
} = require("./referral_policy.js");

const PRESENCE_DEVICE_MIGRATION_VERSION = 1;

async function pruneLegacyPresenceDevices(studentNumber) {
  const sessionRef = db.collection("userDeviceSessions").doc(studentNumber);
  const markerSnapshot = await sessionRef.get();
  if (
    Number(markerSnapshot.data()?.presenceDeviceMigrationVersion || 0) >=
    PRESENCE_DEVICE_MIGRATION_VERSION
  ) {
    return;
  }

  const [deviceSnapshot, presenceSnapshot] = await Promise.all([
    sessionRef.collection("loginDevices").get(),
    require("firebase-admin/database")
      .getDatabase()
      .ref(`status/${studentNumber}`)
      .get(),
  ]);
  const updates = buildOrphanedPresenceUpdates(
    { [studentNumber]: presenceSnapshot.val() || {} },
    { [studentNumber]: deviceSnapshot.docs.map((item) => item.id) },
  );

  if (Object.keys(updates).length) {
    await require("firebase-admin/database").getDatabase().ref().update(updates);
  }
  await sessionRef.set(
    {
      presenceDeviceMigrationVersion: PRESENCE_DEVICE_MIGRATION_VERSION,
      presenceDeviceMigratedAt: new Date(),
    },
    { merge: true },
  );
}

const SITE_URL = "https://doko2517027-bit.github.io/university-notifier-web";

const WEB_PUSH_PUBLIC_KEY = defineSecret("WEB_PUSH_PUBLIC_KEY");
const WEB_PUSH_PRIVATE_KEY = defineSecret("WEB_PUSH_PRIVATE_KEY");
const GITHUB_ACTIONS_TOKEN = defineSecret("GITHUB_ACTIONS_TOKEN");

async function dispatchStudentRefreshWorkflow(studentNumber, requestId) {
  const response = await fetch(
    "https://api.github.com/repos/doko2517027-bit/university-notifier-server/actions/workflows/manual_student_refresh.yml/dispatches",
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_ACTIONS_TOKEN.value()}`,
        "Content-Type": "application/json",
        "User-Agent": "CareMate-Firebase-Functions",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          student_number: studentNumber,
          request_id: requestId,
        },
      }),
    },
  );
  if (response.status !== 204) {
    throw new Error(`GitHub workflow dispatch failed: ${response.status}`);
  }
}

// 学生専用機能リクエスト。累計ポイントに応じた最大3枠をサーバー側で保証する。
exports.submitFeatureRequest = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    const studentNumber = String(request.auth?.token?.studentNumber || "");
    if (!studentNumber) {
      throw new HttpsError("unauthenticated", "ログインが必要です。");
    }

    const title = String(request.data?.title || "")
      .trim()
      .slice(0, 100);
    const description = String(request.data?.description || "")
      .trim()
      .slice(0, 2000);
    const useCase = String(request.data?.useCase || "")
      .trim()
      .slice(0, 1000);
    if (!title || !description) {
      throw new HttpsError(
        "invalid-argument",
        "機能名と内容を入力してください。",
      );
    }

    const [rankingSnapshot, existingSnapshot] = await Promise.all([
      db.collection("totalRanking").doc(studentNumber).get(),
      db
        .collection("featureRequests")
        .where("studentNumber", "==", studentNumber)
        .get(),
    ]);
    const totalPoints = Number(rankingSnapshot.data()?.point || 0);
    const unlockedSlots = totalPoints >= 5000 ? 3 : totalPoints >= 800 ? 2 : 1;
    const usedSlots = existingSnapshot.docs.filter((item) =>
      ["submitted", "reviewing", "developing", "implemented"].includes(
        item.data().status || "submitted",
      ),
    ).length;
    if (usedSlots >= unlockedSlots) {
      throw new HttpsError(
        "resource-exhausted",
        "利用できるリクエスト枠がありません。",
      );
    }

    const created = await db.collection("featureRequests").add({
      studentNumber,
      title,
      description,
      useCase,
      status: "submitted",
      slotIndex: usedSlots,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { id: created.id, unlockedSlots };
  },
);

// 学生本人は送信済みの間だけ取り下げられる。検討中以降と実装済みは枠を保持する。
exports.withdrawFeatureRequest = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    const studentNumber = String(request.auth?.token?.studentNumber || "");
    const requestId = String(request.data?.requestId || "").trim();
    if (!studentNumber)
      throw new HttpsError("unauthenticated", "ログインが必要です。");
    if (!requestId)
      throw new HttpsError(
        "invalid-argument",
        "リクエストを指定してください。",
      );
    const reference = db.collection("featureRequests").doc(requestId);
    const snapshot = await reference.get();
    if (!snapshot.exists || snapshot.data().studentNumber !== studentNumber) {
      throw new HttpsError(
        "permission-denied",
        "このリクエストは操作できません。",
      );
    }
    if ((snapshot.data().status || "submitted") !== "submitted") {
      throw new HttpsError(
        "failed-precondition",
        "送信済み以外のリクエストは取り下げできません。",
      );
    }
    await reference.update({
      status: "withdrawn",
      withdrawnAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { ok: true };
  },
);

/*
 * 登録テスト専用の照合値。
 * 値そのものはコード・Firestore・ブラウザへ保存しない。
 */
const REGISTRATION_TEST_STUDENT_PAGE_ID = defineSecret(
  "REGISTRATION_TEST_STUDENT_PAGE_ID",
);

const REGISTRATION_TEST_STUDENT_PAGE_PASSWORD = defineSecret(
  "REGISTRATION_TEST_STUDENT_PAGE_PASSWORD",
);

const SITE_ORIGIN = "https://doko2517027-bit.github.io";

// =====================
// CareMate ログイン
// =====================
// ブラウザが管理者権限を自己申告できないよう、アプリ用パスワードの
// 照合とFirebaseのカスタムトークン発行は必ずサーバー側で行う。
exports.authenticateCareMate = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    const studentNumber = String(request.data?.studentNumber || "").trim();
    const password = String(request.data?.password || "");
    const deviceId = normalizeDeviceId(request.data?.deviceId);

    if (!/^\d{7}$/.test(studentNumber) || !password) {
      throw new HttpsError(
        "invalid-argument",
        "ログイン情報が不足しています。",
      );
    }

    const userSnap = await db.collection("users").doc(studentNumber).get();
    const storedHash = String(userSnap.data()?.appPasswordHash || "");
    const suppliedHash = crypto
      .createHash("sha256")
      .update(password, "utf8")
      .digest("hex");

    if (
      !userSnap.exists ||
      storedHash.length !== suppliedHash.length ||
      !crypto.timingSafeEqual(
        Buffer.from(storedHash, "utf8"),
        Buffer.from(suppliedHash, "utf8"),
      )
    ) {
      throw new HttpsError(
        "unauthenticated",
        "学籍番号またはパスワードが違います。",
      );
    }

    const adminSnap = await db.collection("admins").doc(studentNumber).get();
    const admin = adminSnap.exists && adminSnap.data().enabled === true;

    const token = await adminAuth.createCustomToken(
      `caremate-${studentNumber}`,
      {
        admin,
        studentNumber,
      },
    );

    if (deviceId) {
      try {
        await deviceSessionStore.recordDeviceSession({
          studentNumber,
          deviceId,
          rawRequest: request.rawRequest,
          eventType: "login",
        });
        await pruneLegacyPresenceDevices(studentNumber);
      } catch (error) {
        console.warn(
          "ログイン端末記録失敗:",
          error?.message || "unknown",
        );
      }
    }

    return { token, admin };
  },
);

function requireAuthenticatedCareMateStudent(request) {
  const studentNumber = String(request.auth?.token?.studentNumber || "");
  const expectedUid = `caremate-${studentNumber}`;

  if (
    !/^\d{7}$/.test(studentNumber) ||
    !request.auth?.uid ||
    request.auth.uid !== expectedUid
  ) {
    throw new HttpsError("unauthenticated", "ログインが必要です。");
  }

  return studentNumber;
}

exports.changeCareMatePassword = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    const studentNumber = requireAuthenticatedCareMateStudent(request);
    const currentPassword = request.data?.currentPassword;
    const newPassword = request.data?.newPassword;

    if (typeof currentPassword !== "string" || !isValidNewPassword(newPassword)) {
      throw new HttpsError("invalid-argument", "パスワードの入力を確認してください。");
    }

    const userRef = db.collection("users").doc(studentNumber);
    await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new HttpsError("not-found", "登録情報が見つかりません。");
      }

      const storedHash = userSnap.data()?.appPasswordHash;
      if (!matchesPasswordHash(currentPassword, storedHash)) {
        throw new HttpsError("permission-denied", "現在のパスワードが違います。");
      }
      const newHash = hashPassword(newPassword);
      if (newHash === storedHash) {
        throw new HttpsError("invalid-argument", "別のパスワードを入力してください。");
      }

      transaction.update(userRef, {
        appPasswordHash: newHash,
        passwordChangedAt: FieldValue.serverTimestamp(),
      });
    });

    return { changed: true };
  },
);

async function requirePrimaryDeviceAuditAdmin(request) {
  const studentNumber = requireAuthenticatedCareMateStudent(request);

  if (
    studentNumber !== "2510044" ||
    request.auth?.uid !== "caremate-2510044" ||
    request.auth?.token?.admin !== true
  ) {
    throw new HttpsError(
      "permission-denied",
      "端末情報を確認できるアカウントではありません。",
    );
  }

  const [adminSnapshot, profileSnapshot] = await Promise.all([
    db.collection("admins").doc(studentNumber).get(),
    db.collection("users").doc(studentNumber).get(),
  ]);
  const profileStudentNumber = String(
    profileSnapshot.data()?.studentNumber || studentNumber,
  );

  if (
    !isPrimaryDeviceAuditAdminIdentity({
      uid: request.auth?.uid,
      tokenStudentNumber: studentNumber,
      adminClaim: request.auth?.token?.admin,
      adminEnabled: adminSnapshot.exists && adminSnapshot.data()?.enabled,
      profileExists: profileSnapshot.exists,
      profileStudentNumber,
    })
  ) {
    throw new HttpsError(
      "permission-denied",
      "管理者権限を確認できませんでした。",
    );
  }

  return studentNumber;
}

async function requireEnabledCareMateAdmin(request) {
  const studentNumber = requireAuthenticatedCareMateStudent(request);
  if (request.auth?.token?.admin !== true) {
    throw new HttpsError("permission-denied", "管理者権限が必要です。");
  }
  const adminSnapshot = await db.collection("admins").doc(studentNumber).get();
  if (!adminSnapshot.exists || adminSnapshot.data()?.enabled !== true) {
    throw new HttpsError("permission-denied", "管理者権限を確認できませんでした。");
  }
  return studentNumber;
}

function referralAccountRef(studentNumber) {
  return db.collection("referralAccounts").doc(studentNumber);
}

function referralIdentityRef(studentNumber) {
  return db.collection("referralIdentityRegistry").doc(studentNumber);
}

function referralCodeRefFromValue(code) {
  return db.collection("referralCodes").doc(sha256(normalizeReferralCode(code)));
}

async function ensureReferralIdentityForCurrentUser(studentNumber) {
  const identityRef = referralIdentityRef(studentNumber);
  const identitySnapshot = await identityRef.get();
  if (identitySnapshot.exists) return;
  const userSnapshot = await db.collection("users").doc(studentNumber).get();
  if (!userSnapshot.exists) return;
  try {
    await identityRef.create({
      studentNumber,
      everRegistered: true,
      firstRegisteredAt: new Date(),
      referralEverCounted: false,
      inviterStudentNumber: null,
      referralCountedAt: null,
      registrySource: "existing-user-referral-access",
    });
  } catch (error) {
    if (error?.code !== 6 && error?.code !== "already-exists") throw error;
  }
}

function referralRequestIp(request) {
  return String(
    request.rawRequest?.headers?.["x-forwarded-for"] ||
      request.rawRequest?.ip ||
      "unknown",
  )
    .split(",")[0]
    .trim();
}

async function enforceReferralRateLimit(request, studentNumber) {
  const now = Date.now();
  const ref = db
    .collection("referralRateLimits")
    .doc(sha256(`${referralRequestIp(request)}:${studentNumber}`));
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() || {};
    const windowStart = timestampMillis(data.windowStartedAt);
    const sameWindow =
      windowStart > 0 &&
      now - windowStart < REFERRAL_RATE_LIMIT_WINDOW_MINUTES * 60_000;
    const attempts = sameWindow ? Number(data.attempts || 0) : 0;
    if (attempts >= REFERRAL_RATE_LIMIT_ATTEMPTS) {
      throw new HttpsError(
        "resource-exhausted",
        "確認回数が多すぎます。15分ほど待ってからお試しください。",
      );
    }
    transaction.set(
      ref,
      {
        attempts: attempts + 1,
        windowStartedAt: sameWindow ? data.windowStartedAt : new Date(now),
        expiresAt: new Date(
          now + REFERRAL_RATE_LIMIT_WINDOW_MINUTES * 2 * 60_000,
        ),
      },
      { merge: true },
    );
  });
}

function serializeReferralMilestones(stored = {}, invitedCount = 0, suppressions = {}) {
  return REFERRAL_MILESTONES.map((item) => {
    const state = stored[`m${item.count}`] || {};
    const suppression = suppressions[`m${item.count}`] || {};
    return {
      ...item,
      unlocked: Boolean(state.unlockedAt) && !suppression.deletedAt,
      unlockedAt: timestampMillis(state.unlockedAt),
      claimedAt: timestampMillis(state.claimedAt),
      deleted: Boolean(suppression.deletedAt),
      deletedAt: timestampMillis(suppression.deletedAt),
    };
  });
}

const REFERRAL_THEME_IDS = new Set([
  "light",
  "dark",
  "pink",
  "green",
  "blue",
  "yellow",
  "red",
  "purple",
  "brown",
]);
const REFERRAL_BACKGROUND_POSITIONS = new Set(["center", "top", "bottom"]);

function validReferralBackgroundUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname.startsWith("/vpctonjf/image/upload/")
    );
  } catch {
    return false;
  }
}

function serializeReferralBackground(value) {
  if (!value || !validReferralBackgroundUrl(value.url)) return null;
  return {
    url: String(value.url),
    publicId: String(value.publicId || "").slice(0, 220),
    blur: Math.max(0, Math.min(18, Number(value.blur || 0))),
    brightness: Math.max(40, Math.min(100, Number(value.brightness || 82))),
    position: REFERRAL_BACKGROUND_POSITIONS.has(value.position) ? value.position : "center",
    uploadedAt: timestampMillis(value.uploadedAt),
    updatedAt: timestampMillis(value.updatedAt),
  };
}

function referralRewardGrantState(account = {}, invitedCount = 0, now = new Date()) {
  const rewardGrants = { ...(account.rewardGrants || {}) };
  const shouldGrantPoints =
    invitedCount >= 2 &&
    !account.rewardSuppressions?.m2?.deletedAt &&
    !rewardGrants.m2LearningPoints?.grantedAt;
  if (shouldGrantPoints) {
    rewardGrants.m2LearningPoints = { grantedAt: now, points: 100 };
  }
  return { rewardGrants, shouldGrantPoints };
}

async function ensureReferralPointReward(studentNumber) {
  const accountRef = referralAccountRef(studentNumber);
  await db.runTransaction(async (transaction) => {
    const accountSnapshot = await transaction.get(accountRef);
    if (!accountSnapshot.exists) return;
    const account = accountSnapshot.data() || {};
    const invitedCount = Math.max(0, Number(account.invitedCount || 0));
    const state = referralRewardGrantState(account, invitedCount, new Date());
    if (!state.shouldGrantPoints) return;
    transaction.set(
      accountRef,
      { rewardGrants: state.rewardGrants, updatedAt: new Date() },
      { merge: true },
    );
    transaction.set(
      db.collection("totalRanking").doc(studentNumber),
      { point: FieldValue.increment(100), updatedAt: new Date() },
      { merge: true },
    );
  });
}

exports.getReferralDashboard = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    const studentNumber = requireAuthenticatedCareMateStudent(request);
    await ensureReferralIdentityForCurrentUser(studentNumber);
    await ensureReferralPointReward(studentNumber);
    const accountRef = referralAccountRef(studentNumber);
    const rewardRef = db.collection("referralPrivateRewards").doc(studentNumber);
    const settingsRef = db.collection("system").doc("referralProgram");
    const [accountSnapshot, rewardSnapshot, settingsSnapshot] = await Promise.all([
      accountRef.get(),
      rewardRef.get(),
      settingsRef.get(),
    ]);
    const account = accountSnapshot.data() || {};
    const settings = settingsSnapshot.data() || {};
    const invitedCount = Math.min(
      REFERRAL_MAX_INVITES,
      Math.max(0, Number(account.invitedCount || 0)),
    );
    let activeCode = null;
    if (account.activeCodeHash && invitedCount < REFERRAL_MAX_INVITES) {
      const codeSnapshot = await db
        .collection("referralCodes")
        .doc(String(account.activeCodeHash))
        .get();
      const code = codeSnapshot.data();
      if (isReferralCodeUsable(code)) {
        activeCode = {
          code: String(code.code || ""),
          expiresAt: timestampMillis(code.expiresAt),
        };
      }
    }
    const next = nextMilestone(invitedCount);
    const reward = rewardSnapshot.data() || {};
    return {
      invitedCount,
      maxInvites: REFERRAL_MAX_INVITES,
      homeVisible: settings.homeVisible !== false,
      nextMilestone: next
        ? { ...next, remaining: next.count - invitedCount }
        : null,
      milestones: serializeReferralMilestones(
        account.milestones,
        invitedCount,
        account.rewardSuppressions,
      ),
      entitlements: {
        learningPoints100: Boolean(account.rewardGrants?.m2LearningPoints?.grantedAt) && !account.rewardSuppressions?.m2?.deletedAt,
        themes: Boolean(account.milestones?.m4?.unlockedAt) && !account.rewardSuppressions?.m4?.deletedAt,
        photoBackground: Boolean(account.milestones?.m6?.unlockedAt) && !account.rewardSuppressions?.m6?.deletedAt,
        backgroundEffects: Boolean(account.milestones?.m8?.unlockedAt) && !account.rewardSuppressions?.m8?.deletedAt,
      },
      personalization: {
        theme: REFERRAL_THEME_IDS.has(account.personalization?.theme)
          ? account.personalization.theme
          : null,
        background: serializeReferralBackground(account.personalization?.background),
      },
      activeCode,
      codeTtlDays: REFERRAL_CODE_TTL_DAYS,
      gift:
        reward.status === "granted" && validGiftUrl(reward.giftUrl)
          ? {
              available: true,
              url: reward.giftUrl,
              grantedAt: timestampMillis(reward.grantedAt),
              claimedAt: timestampMillis(reward.claimedAt),
            }
          : { available: false },
    };
  },
);

exports.issueReferralCode = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    const studentNumber = requireAuthenticatedCareMateStudent(request);
    await ensureReferralIdentityForCurrentUser(studentNumber);
    const accountRef = referralAccountRef(studentNumber);
    const newCode = createReferralCode();
    const newHash = sha256(newCode);
    const newCodeRef = db.collection("referralCodes").doc(newHash);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + REFERRAL_CODE_TTL_DAYS * 86_400_000,
    );
    return db.runTransaction(async (transaction) => {
      const accountSnapshot = await transaction.get(accountRef);
      const account = accountSnapshot.data() || {};
      const invitedCount = Math.max(0, Number(account.invitedCount || 0));
      if (invitedCount >= REFERRAL_MAX_INVITES) {
        throw new HttpsError(
          "failed-precondition",
          "10人達成後は新しい招待コードを発行できません。",
        );
      }
      let currentRef = null;
      let currentSnapshot = null;
      if (account.activeCodeHash) {
        currentRef = db
          .collection("referralCodes")
          .doc(String(account.activeCodeHash));
        currentSnapshot = await transaction.get(currentRef);
        if (isReferralCodeUsable(currentSnapshot.data())) {
          return {
            code: String(currentSnapshot.data().code || ""),
            expiresAt: timestampMillis(currentSnapshot.data().expiresAt),
            reused: true,
          };
        }
      }
      const collisionSnapshot = await transaction.get(newCodeRef);
      if (collisionSnapshot.exists) {
        throw new HttpsError(
          "aborted",
          "コードを作成できませんでした。もう一度お試しください。",
        );
      }
      if (currentRef && currentSnapshot?.exists) {
        transaction.set(
          currentRef,
          { revoked: true, revokedAt: now },
          { merge: true },
        );
      }
      transaction.create(newCodeRef, {
        code: newCode,
        inviterStudentNumber: studentNumber,
        issuedAt: now,
        expiresAt,
        used: false,
        usedByStudentNumber: null,
        usedAt: null,
        revoked: false,
      });
      transaction.set(
        accountRef,
        {
          studentNumber,
          invitedCount,
          activeCodeHash: newHash,
          updatedAt: now,
        },
        { merge: true },
      );
      return { code: newCode, expiresAt: expiresAt.getTime(), reused: false };
    });
  },
);

exports.saveReferralPersonalization = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    const studentNumber = requireAuthenticatedCareMateStudent(request);
    const action = String(request.data?.action || "");
    const accountRef = referralAccountRef(studentNumber);
    return db.runTransaction(async (transaction) => {
      const accountSnapshot = await transaction.get(accountRef);
      const account = accountSnapshot.data() || {};
      const personalization = { ...(account.personalization || {}) };
      if (action === "theme") {
        const theme = String(request.data?.theme || "");
        const coloredTheme = !["light", "dark"].includes(theme);
        if (
          !REFERRAL_THEME_IDS.has(theme) ||
          (coloredTheme &&
            (!account.milestones?.m4?.unlockedAt ||
              account.rewardSuppressions?.m4?.deletedAt))
        ) {
          throw new HttpsError("permission-denied", "このテーマはまだ解放されていません。");
        }
        personalization.theme = theme;
      } else if (action === "background") {
        const url = String(request.data?.url || "").trim();
        const publicId = String(request.data?.publicId || "").trim();
        if (
          !account.milestones?.m6?.unlockedAt ||
          account.rewardSuppressions?.m6?.deletedAt
        ) {
          throw new HttpsError("permission-denied", "写真背景はまだ解放されていません。");
        }
        if (
          !validReferralBackgroundUrl(url) ||
          publicId.length > 220 ||
          /[^a-zA-Z0-9_./-]/.test(publicId)
        ) {
          throw new HttpsError("invalid-argument", "背景画像を確認してください。");
        }
        personalization.background = {
          url,
          publicId,
          blur: Number(personalization.background?.blur || 0),
          brightness: Number(personalization.background?.brightness || 82),
          position: REFERRAL_BACKGROUND_POSITIONS.has(personalization.background?.position)
            ? personalization.background.position
            : "center",
          uploadedAt: new Date(),
          updatedAt: new Date(),
        };
        delete personalization.pet;
        delete personalization.petVisible;
      } else if (action === "background_effects") {
        const blur = Number(request.data?.blur);
        const brightness = Number(request.data?.brightness);
        const position = String(request.data?.position || "");
        if (
          !account.milestones?.m8?.unlockedAt ||
          account.rewardSuppressions?.m8?.deletedAt ||
          !validReferralBackgroundUrl(personalization.background?.url) ||
          !Number.isFinite(blur) ||
          blur < 0 ||
          blur > 18 ||
          !Number.isFinite(brightness) ||
          brightness < 40 ||
          brightness > 100 ||
          !REFERRAL_BACKGROUND_POSITIONS.has(position)
        ) {
          throw new HttpsError("permission-denied", "背景の詳細調整を利用できません。");
        }
        personalization.background = {
          ...personalization.background,
          blur,
          brightness,
          position,
          updatedAt: new Date(),
        };
      } else if (action === "background_remove") {
        if (
          !account.milestones?.m6?.unlockedAt ||
          account.rewardSuppressions?.m6?.deletedAt
        ) {
          throw new HttpsError("permission-denied", "写真背景を変更できません。");
        }
        delete personalization.background;
      } else {
        throw new HttpsError("invalid-argument", "設定内容が正しくありません。");
      }
      transaction.set(
        accountRef,
        {
          studentNumber,
          personalization,
          petCare: FieldValue.delete(),
          updatedAt: new Date(),
        },
        { merge: true },
      );
      return {
        saved: true,
        personalization: {
          theme: personalization.theme || "light",
          background: serializeReferralBackground(personalization.background),
        },
      };
    });
  },
);

exports.prepareReferralRegistration = onCall(
  {
    region: "asia-northeast1",
    cors: [SITE_ORIGIN],
    timeoutSeconds: 60,
    memory: "1GiB",
  },
  async (request) => {
    const studentNumber = String(request.data?.studentNumber || "").trim();
    const code = normalizeReferralCode(request.data?.referralCode);
    const activeMailPassword = String(
      request.data?.activeMailPassword || "",
    );
    const studentPageProofToken = String(
      request.data?.studentPageVerificationToken || "",
    );
    if (!/^\d{7}$/.test(studentNumber) || !code || !studentPageProofToken) {
      throw new HttpsError(
        "invalid-argument",
        "招待コードまたは本人確認情報が不足しています。",
      );
    }
    await enforceReferralRateLimit(request, studentNumber);
    const pageProofRef = db
      .collection("registrationVerificationProofs")
      .doc(sha256(studentPageProofToken));
    const [pageProofSnapshot, identitySnapshot, userSnapshot] =
      await Promise.all([
        pageProofRef.get(),
        referralIdentityRef(studentNumber).get(),
        db.collection("users").doc(studentNumber).get(),
      ]);
    const pageProof = pageProofSnapshot.data() || {};
    if (
      !pageProofSnapshot.exists ||
      pageProof.studentNumber !== studentNumber ||
      pageProof.used === true ||
      timestampMillis(pageProof.expiresAt) <= Date.now()
    ) {
      throw new HttpsError(
        "failed-precondition",
        "学生本人の確認期限が切れました。もう一度登録操作を行ってください。",
      );
    }
    if (identitySnapshot.exists || userSnapshot.exists) {
      return { previouslyRegistered: true, eligible: false };
    }
    const codeRef = referralCodeRefFromValue(code);
    const codeSnapshot = await codeRef.get();
    const codeData = codeSnapshot.data() || {};
    if (
      !codeSnapshot.exists ||
      !isReferralCodeUsable(codeData) ||
      codeData.inviterStudentNumber === studentNumber
    ) {
      throw new HttpsError(
        "failed-precondition",
        "招待コードを利用できません。コードと有効期限を確認してください。",
      );
    }
    const inviterAccount = await referralAccountRef(
      codeData.inviterStudentNumber,
    ).get();
    if (Number(inviterAccount.data()?.invitedCount || 0) >= REFERRAL_MAX_INVITES) {
      throw new HttpsError(
        "failed-precondition",
        "この招待コードは受付上限に達しています。",
      );
    }
    if (!activeMailPassword) {
      throw new HttpsError(
        "invalid-argument",
        "招待制度を利用する場合は大学メールのパスワードが必要です。",
      );
    }

    let browser;
    try {
      const chromium = require("@sparticuz/chromium");
      const { chromium: playwrightChromium } = require("playwright-core");
      const { verifyActiveMailPassword } = require("./external_auth_check.js");
      browser = await playwrightChromium.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
      const result = await verifyActiveMailPassword({
        browser,
        studentNumber,
        password: activeMailPassword,
        updateProgress: async () => {},
      });
      if (!result.verified) {
        throw new HttpsError(
          "permission-denied",
          `${studentNumber}@sums.ac.jp の本人確認に失敗しました。`,
        );
      }
    } finally {
      if (browser) await browser.close();
    }

    const proofToken = createProofToken();
    await db
      .collection("referralRegistrationProofs")
      .doc(sha256(proofToken))
      .set({
        studentNumber,
        codeHash: codeSnapshot.id,
        inviterStudentNumber: codeData.inviterStudentNumber,
        universityEmail: `${studentNumber}@sums.ac.jp`,
        universityEmailVerifiedAt: new Date(),
        userExistedAtVerification: false,
        identityExistedAtVerification: false,
        createdAt: new Date(),
        expiresAt: new Date(
          Date.now() + REFERRAL_PROOF_TTL_MINUTES * 60_000,
        ),
        used: false,
      });
    return {
      previouslyRegistered: false,
      eligible: true,
      referralProofToken: proofToken,
    };
  },
);

exports.completeReferralRegistration = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    const studentNumber = requireAuthenticatedCareMateStudent(request);
    const pageToken = String(
      request.data?.studentPageVerificationToken || "",
    );
    const referralProofToken = String(
      request.data?.referralProofToken || "",
    );
    if (!pageToken) {
      throw new HttpsError(
        "invalid-argument",
        "登録時の本人確認情報がありません。",
      );
    }
    const pageProofRef = db
      .collection("registrationVerificationProofs")
      .doc(sha256(pageToken));
    const identityRef = referralIdentityRef(studentNumber);
    const userRef = db.collection("users").doc(studentNumber);
    return db.runTransaction(async (transaction) => {
      const [pageProofSnapshot, identitySnapshot, userSnapshot] =
        await Promise.all([
          transaction.get(pageProofRef),
          transaction.get(identityRef),
          transaction.get(userRef),
        ]);
      const pageProof = pageProofSnapshot.data() || {};
      if (
        !pageProofSnapshot.exists ||
        pageProof.studentNumber !== studentNumber ||
        timestampMillis(pageProof.expiresAt) <= Date.now() ||
        !userSnapshot.exists ||
        String(userSnapshot.data()?.studentNumber || "") !== studentNumber
      ) {
        throw new HttpsError(
          "failed-precondition",
          "登録完了を確認できませんでした。",
        );
      }
      if (identitySnapshot.exists) {
        transaction.set(
          pageProofRef,
          { used: true, usedAt: new Date() },
          { merge: true },
        );
        return { counted: false, firstRegistration: false };
      }
      const now = new Date();
      const baseIdentity = {
        studentNumber,
        everRegistered: true,
        firstRegisteredAt: now,
        referralEverCounted: false,
        inviterStudentNumber: null,
        referralCountedAt: null,
      };
      if (!referralProofToken) {
        transaction.create(identityRef, baseIdentity);
        transaction.set(
          pageProofRef,
          { used: true, usedAt: now },
          { merge: true },
        );
        return { counted: false, firstRegistration: true };
      }

      const referralProofRef = db
        .collection("referralRegistrationProofs")
        .doc(sha256(referralProofToken));
      const referralProofSnapshot = await transaction.get(referralProofRef);
      const referralProof = referralProofSnapshot.data() || {};
      if (
        !referralProofSnapshot.exists ||
        referralProof.studentNumber !== studentNumber ||
        referralProof.used === true ||
        referralProof.userExistedAtVerification !== false ||
        referralProof.identityExistedAtVerification !== false ||
        timestampMillis(referralProof.expiresAt) <= Date.now()
      ) {
        throw new HttpsError(
          "failed-precondition",
          "招待の本人確認期限が切れました。紹介人数には反映されません。",
        );
      }
      const codeRef = db
        .collection("referralCodes")
        .doc(String(referralProof.codeHash || "invalid"));
      const inviter = String(referralProof.inviterStudentNumber || "");
      const accountRef = referralAccountRef(inviter);
      const historyRef = db.collection("referralHistory").doc(studentNumber);
      const [codeSnapshot, accountSnapshot, historySnapshot] =
        await Promise.all([
          transaction.get(codeRef),
          transaction.get(accountRef),
          transaction.get(historyRef),
        ]);
      const code = codeSnapshot.data() || {};
      const account = accountSnapshot.data() || {};
      const invitedCount = Math.max(0, Number(account.invitedCount || 0));
      if (
        !codeSnapshot.exists ||
        !isReferralCodeUsable(code) ||
        code.inviterStudentNumber !== inviter ||
        inviter === studentNumber ||
        invitedCount >= REFERRAL_MAX_INVITES ||
        historySnapshot.exists
      ) {
        throw new HttpsError(
          "failed-precondition",
          "招待コードは使用できません。紹介人数には反映されません。",
        );
      }
      const nextCount = invitedCount + 1;
      const milestones = milestoneState(account.milestones || {}, nextCount, now);
      const rewardGrantState = referralRewardGrantState(account, nextCount, now);
      transaction.create(identityRef, {
        ...baseIdentity,
        referralEverCounted: true,
        inviterStudentNumber: inviter,
        referralCountedAt: now,
      });
      transaction.create(historyRef, {
        inviterStudentNumber: inviter,
        invitedStudentNumber: studentNumber,
        codeHash: codeSnapshot.id,
        codePreview: String(code.code || "").slice(-4),
        establishedAt: now,
      });
      transaction.set(
        codeRef,
        {
          used: true,
          usedByStudentNumber: studentNumber,
          usedAt: now,
        },
        { merge: true },
      );
      transaction.set(
        accountRef,
        {
          studentNumber: inviter,
          invitedCount: nextCount,
          milestones,
          rewardGrants: rewardGrantState.rewardGrants,
          activeCodeHash: null,
          updatedAt: now,
        },
        { merge: true },
      );
      if (rewardGrantState.shouldGrantPoints) {
        transaction.set(
          db.collection("totalRanking").doc(inviter),
          { point: FieldValue.increment(100), updatedAt: now },
          { merge: true },
        );
      }
      transaction.set(
        referralProofRef,
        { used: true, usedAt: now },
        { merge: true },
      );
      transaction.set(
        pageProofRef,
        { used: true, usedAt: now },
        { merge: true },
      );
      if (nextCount === REFERRAL_MAX_INVITES) {
        transaction.set(
          db.collection("referralPrivateRewards").doc(inviter),
          {
            studentNumber: inviter,
            reachedAt: now,
            status: "pending",
            giftUrl: null,
            grantedAt: null,
            grantedBy: null,
            claimedAt: null,
          },
          { merge: true },
        );
      }
      return {
        counted: true,
        firstRegistration: true,
        inviterStudentNumber: inviter,
        invitedCount: nextCount,
      };
    });
  },
);

exports.getReferralRewardAdmin = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    await requirePrimaryDeviceAuditAdmin(request);
    const [userSnapshot, accountSnapshot, codeSnapshot, historySnapshot, rewardSnapshot, adjustmentSnapshot, settingsSnapshot] =
      await Promise.all([
        db.collection("users").get(),
        db.collection("referralAccounts").get(),
        db.collection("referralCodes").get(),
        db.collection("referralHistory").get(),
        db.collection("referralPrivateRewards").get(),
        db.collection("referralManualAdjustments").get(),
        db.collection("system").doc("referralProgram").get(),
      ]);
    const accounts = new Map(accountSnapshot.docs.map((item) => [item.id, item.data() || {}]));
    const rewards = new Map(rewardSnapshot.docs.map((item) => [item.id, item.data() || {}]));
    const codesByInviter = new Map();
    codeSnapshot.docs.forEach((item) => {
      const data = item.data() || {};
      const inviter = String(data.inviterStudentNumber || "");
      if (!inviter) return;
      const current = codesByInviter.get(inviter);
      if (!current || timestampMillis(data.issuedAt) > timestampMillis(current.issuedAt)) {
        codesByInviter.set(inviter, data);
      }
    });
    const historiesByInviter = new Map();
    historySnapshot.docs.forEach((item) => {
      const data = item.data() || {};
      const inviter = String(data.inviterStudentNumber || "");
      if (!inviter) return;
      const histories = historiesByInviter.get(inviter) || [];
      histories.push({
        invitedStudentNumber: String(data.invitedStudentNumber || item.id),
        codePreview: String(data.codePreview || ""),
        establishedAt: timestampMillis(data.establishedAt),
      });
      historiesByInviter.set(inviter, histories);
    });
    const adjustmentsByStudent = new Map();
    adjustmentSnapshot.docs.forEach((item) => {
      const data = item.data() || {};
      const target = String(data.studentNumber || "");
      if (!target) return;
      const adjustments = adjustmentsByStudent.get(target) || [];
      adjustments.push({
        fromCount: Number(data.fromCount || 0),
        toCount: Number(data.toCount || 0),
        reason: String(data.reason || ""),
        adjustedBy: String(data.adjustedBy || ""),
        adjustedAt: timestampMillis(data.adjustedAt),
      });
      adjustmentsByStudent.set(target, adjustments);
    });
    const students = userSnapshot.docs
      .map((item) => {
        const user = item.data() || {};
        const account = accounts.get(item.id) || {};
        const reward = rewards.get(item.id) || {};
        const invitedCount = Math.min(
          REFERRAL_MAX_INVITES,
          Math.max(0, Number(account.invitedCount || 0)),
        );
        const latestCode = codesByInviter.get(item.id) || null;
        const activeCode = isReferralCodeUsable(latestCode)
          ? {
              code: String(latestCode.code || ""),
              issuedAt: timestampMillis(latestCode.issuedAt),
              expiresAt: timestampMillis(latestCode.expiresAt),
            }
          : null;
        return {
          studentNumber: item.id,
          name: String(user.name || user.displayName || user.fullName || ""),
          department: String(user.department || ""),
          grade: String(user.grade || ""),
          invitedCount,
          manualAdjustment: Number(account.manualAdjustment || 0),
          milestones: serializeReferralMilestones(
            account.milestones,
            invitedCount,
            account.rewardSuppressions,
          ),
          activeCode,
          histories: (historiesByInviter.get(item.id) || []).sort(
            (left, right) => right.establishedAt - left.establishedAt,
          ),
          adjustments: (adjustmentsByStudent.get(item.id) || [])
            .sort((left, right) => right.adjustedAt - left.adjustedAt)
            .slice(0, 20),
          reward: {
            reachedAt: timestampMillis(reward.reachedAt),
            status: String(reward.status || "none"),
            giftUrl: String(reward.giftUrl || ""),
            grantedAt: timestampMillis(reward.grantedAt),
            claimedAt: timestampMillis(reward.claimedAt),
          },
        };
      })
      .sort((left, right) =>
        right.invitedCount - left.invitedCount ||
        left.studentNumber.localeCompare(right.studentNumber),
      );
    return {
      students,
      settings: {
        homeVisible: settingsSnapshot.data()?.homeVisible !== false,
        updatedAt: timestampMillis(settingsSnapshot.data()?.updatedAt),
        updatedBy: String(settingsSnapshot.data()?.updatedBy || ""),
      },
      totals: {
        students: students.length,
        referrals: historySnapshot.size,
        activeCodes: students.filter((item) => item.activeCode).length,
        reachedTen: students.filter((item) => item.invitedCount >= REFERRAL_MAX_INVITES).length,
        pendingRewards: students.filter(
          (item) =>
            item.invitedCount >= REFERRAL_MAX_INVITES &&
            !["granted", "deleted"].includes(item.reward.status),
        ).length,
      },
    };
  },
);

exports.updateReferralHomeVisibilityAdmin = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    const updatedBy = await requirePrimaryDeviceAuditAdmin(request);
    if (typeof request.data?.homeVisible !== "boolean") {
      throw new HttpsError("invalid-argument", "表示設定を確認してください。");
    }
    const homeVisible = request.data.homeVisible;
    const updatedAt = new Date();
    await db.collection("system").doc("referralProgram").set(
      { homeVisible, updatedAt, updatedBy },
      { merge: true },
    );
    return { saved: true, homeVisible, updatedAt: updatedAt.getTime() };
  },
);

exports.setReferralRewardDeletedAdmin = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    const updatedBy = await requirePrimaryDeviceAuditAdmin(request);
    const target = String(request.data?.studentNumber || "").trim();
    const milestoneCount = Number(request.data?.milestoneCount);
    const deleted = request.data?.deleted;
    const reason = String(request.data?.reason || "").trim();
    if (
      !/^\d{7}$/.test(target) ||
      ![2, 4, 6, 8, 10].includes(milestoneCount) ||
      typeof deleted !== "boolean" ||
      reason.length < 4 ||
      reason.length > 120
    ) {
      throw new HttpsError("invalid-argument", "対象特典または理由を確認してください。");
    }
    const key = `m${milestoneCount}`;
    const accountRef = referralAccountRef(target);
    const rewardRef = db.collection("referralPrivateRewards").doc(target);
    const rankingRef = db.collection("totalRanking").doc(target);
    const auditRef = db.collection("referralRewardDeletions").doc();
    await db.runTransaction(async (transaction) => {
      const [userSnapshot, accountSnapshot, rewardSnapshot, rankingSnapshot] = await Promise.all([
        transaction.get(db.collection("users").doc(target)),
        transaction.get(accountRef),
        transaction.get(rewardRef),
        transaction.get(rankingRef),
      ]);
      if (!userSnapshot.exists || !accountSnapshot.exists) {
        throw new HttpsError("not-found", "対象学生または紹介情報が見つかりません。");
      }
      const account = accountSnapshot.data() || {};
      const suppressions = { ...(account.rewardSuppressions || {}) };
      const wasDeleted = Boolean(suppressions[key]?.deletedAt);
      if (deleted === wasDeleted) {
        throw new HttpsError("already-exists", deleted ? "この特典は削除済みです。" : "この特典は有効です。");
      }
      if (deleted && !account.milestones?.[key]?.unlockedAt) {
        throw new HttpsError("failed-precondition", "未解放の特典は削除できません。");
      }

      const now = new Date();
      const personalization = { ...(account.personalization || {}) };
      const rewardGrants = { ...(account.rewardGrants || {}) };
      if (deleted) {
        suppressions[key] = { deletedAt: now, deletedBy: updatedBy, reason };
        if (milestoneCount === 2 && rewardGrants.m2LearningPoints?.grantedAt && !rewardGrants.m2LearningPoints?.reversedAt) {
          const currentPoints = Math.max(0, Number(rankingSnapshot.data()?.point || 0));
          transaction.set(rankingRef, { point: Math.max(0, currentPoints - 100), updatedAt: now }, { merge: true });
          rewardGrants.m2LearningPoints = { ...rewardGrants.m2LearningPoints, reversedAt: now, reversedBy: updatedBy };
        }
        if (milestoneCount === 4 && !["light", "dark"].includes(personalization.theme)) personalization.theme = "light";
        if (milestoneCount === 6) {
          delete personalization.background;
          delete personalization.pet;
          delete personalization.petVisible;
          transaction.set(accountRef, { petCare: FieldValue.delete() }, { merge: true });
        }
        if (milestoneCount === 8 && personalization.background) {
          personalization.background = {
            ...personalization.background,
            blur: 0,
            brightness: 82,
            position: "center",
            updatedAt: now,
          };
        }
        if (milestoneCount === 10 && rewardSnapshot.exists) {
          transaction.set(
            rewardRef,
            {
              status: "deleted",
              giftUrl: null,
              grantedAt: null,
              grantedBy: null,
              claimedAt: null,
              deletedAt: now,
              deletedBy: updatedBy,
            },
            { merge: true },
          );
        }
      } else {
        delete suppressions[key];
        if (milestoneCount === 2 && Number(account.invitedCount || 0) >= 2) {
          const currentPoints = Math.max(0, Number(rankingSnapshot.data()?.point || 0));
          transaction.set(rankingRef, { point: currentPoints + 100, updatedAt: now }, { merge: true });
          rewardGrants.m2LearningPoints = { grantedAt: now, points: 100, restoredAt: now, restoredBy: updatedBy };
        }
        if (milestoneCount === 10 && Number(account.invitedCount || 0) >= 10) {
          transaction.set(
            rewardRef,
            {
              studentNumber: target,
              status: "pending",
              giftUrl: null,
              deletedAt: FieldValue.delete(),
              deletedBy: FieldValue.delete(),
              restoredAt: now,
              restoredBy: updatedBy,
            },
            { merge: true },
          );
        }
      }
      if (deleted) {
        transaction.set(
          accountRef,
          { rewardSuppressions: suppressions, rewardGrants, personalization, updatedAt: now },
          { merge: true },
        );
      } else {
        transaction.update(accountRef, {
          [`rewardSuppressions.${key}`]: FieldValue.delete(),
          rewardGrants,
          personalization,
          updatedAt: now,
        });
      }
      transaction.create(auditRef, {
        studentNumber: target,
        milestoneCount,
        action: deleted ? "delete" : "restore",
        reason,
        updatedBy,
        updatedAt: now,
      });
    });
    return { updated: true, deleted, milestoneCount };
  },
);

exports.grantReferralReward = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    const grantedBy = await requirePrimaryDeviceAuditAdmin(request);
    const target = String(request.data?.studentNumber || "").trim();
    const giftUrl = String(request.data?.giftUrl || "").trim();
    if (!/^\d{7}$/.test(target) || !validGiftUrl(giftUrl)) {
      throw new HttpsError(
        "invalid-argument",
        "学籍番号またはHTTPSのギフトURLを確認してください。",
      );
    }
    const rewardRef = db.collection("referralPrivateRewards").doc(target);
    const accountRef = referralAccountRef(target);
    await db.runTransaction(async (transaction) => {
      const [rewardSnapshot, accountSnapshot] = await Promise.all([
        transaction.get(rewardRef),
        transaction.get(accountRef),
      ]);
      if (
        !rewardSnapshot.exists ||
        Number(accountSnapshot.data()?.invitedCount || 0) <
          REFERRAL_MAX_INVITES ||
        accountSnapshot.data()?.rewardSuppressions?.m10?.deletedAt
      ) {
        throw new HttpsError(
          "failed-precondition",
          "10人達成を確認できません。",
        );
      }
      transaction.set(
        rewardRef,
        {
          giftUrl,
          status: "granted",
          grantedAt: new Date(),
          grantedBy,
        },
        { merge: true },
      );
    });
    return { granted: true };
  },
);

exports.adjustReferralCountAdmin = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    const adjustedBy = await requirePrimaryDeviceAuditAdmin(request);
    const target = String(request.data?.studentNumber || "").trim();
    const targetCount = Number(request.data?.targetCount);
    const reason = String(request.data?.reason || "").trim();
    if (
      !/^\d{7}$/.test(target) ||
      !Number.isInteger(targetCount) ||
      targetCount < 0 ||
      targetCount > REFERRAL_MAX_INVITES ||
      reason.length < 4 ||
      reason.length > 120
    ) {
      throw new HttpsError("invalid-argument", "達成人数または修正理由を確認してください。");
    }
    const accountRef = referralAccountRef(target);
    const rewardRef = db.collection("referralPrivateRewards").doc(target);
    const adjustmentRef = db.collection("referralManualAdjustments").doc();
    await db.runTransaction(async (transaction) => {
      const [userSnapshot, accountSnapshot, rewardSnapshot] = await Promise.all([
        transaction.get(db.collection("users").doc(target)),
        transaction.get(accountRef),
        transaction.get(rewardRef),
      ]);
      if (!userSnapshot.exists) {
        throw new HttpsError("not-found", "対象学生が見つかりません。");
      }
      const account = accountSnapshot.data() || {};
      const fromCount = Math.min(
        REFERRAL_MAX_INVITES,
        Math.max(0, Number(account.invitedCount || 0)),
      );
      if (fromCount === targetCount) {
        throw new HttpsError("already-exists", "達成人数は変更されていません。");
      }
      const previousAdjustment = Number(account.manualAdjustment || 0);
      const verifiedCount = Math.max(0, fromCount - previousAdjustment);
      const now = new Date();
      const milestones = milestoneState(account.milestones || {}, targetCount, now);
      const rewardGrantState = referralRewardGrantState(account, targetCount, now);
      transaction.set(
        accountRef,
        {
          studentNumber: target,
          invitedCount: targetCount,
          manualAdjustment: targetCount - verifiedCount,
          milestones,
          rewardGrants: rewardGrantState.rewardGrants,
          updatedAt: now,
          lastAdjustedAt: now,
          lastAdjustedBy: adjustedBy,
        },
        { merge: true },
      );
      if (rewardGrantState.shouldGrantPoints) {
        transaction.set(
          db.collection("totalRanking").doc(target),
          { point: FieldValue.increment(100), updatedAt: now },
          { merge: true },
        );
      }
      transaction.create(adjustmentRef, {
        studentNumber: target,
        fromCount,
        toCount: targetCount,
        previousManualAdjustment: previousAdjustment,
        nextManualAdjustment: targetCount - verifiedCount,
        reason,
        adjustedBy,
        adjustedAt: now,
      });
      if (targetCount === REFERRAL_MAX_INVITES) {
        transaction.set(
          rewardRef,
          {
            studentNumber: target,
            reachedAt: rewardSnapshot.data()?.reachedAt || now,
            status:
              rewardSnapshot.data()?.status === "granted" ? "granted" : "pending",
            giftUrl: rewardSnapshot.data()?.giftUrl || null,
            grantedAt: rewardSnapshot.data()?.grantedAt || null,
            grantedBy: rewardSnapshot.data()?.grantedBy || null,
            claimedAt: rewardSnapshot.data()?.claimedAt || null,
            reachedByManualAdjustment: true,
          },
          { merge: true },
        );
      } else if (
        targetCount < REFERRAL_MAX_INVITES &&
        rewardSnapshot.exists &&
        rewardSnapshot.data()?.status === "pending"
      ) {
        transaction.set(
          rewardRef,
          { status: "not_eligible", eligibilityRemovedAt: now },
          { merge: true },
        );
      }
    });
    return { updated: true, invitedCount: targetCount };
  },
);

exports.claimReferralGift = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    const studentNumber = requireAuthenticatedCareMateStudent(request);
    const rewardRef = db.collection("referralPrivateRewards").doc(studentNumber);
    const accountRef = referralAccountRef(studentNumber);
    return db.runTransaction(async (transaction) => {
      const [rewardSnapshot, accountSnapshot] = await Promise.all([
        transaction.get(rewardRef),
        transaction.get(accountRef),
      ]);
      const reward = rewardSnapshot.data() || {};
      if (
        reward.status !== "granted" ||
        !validGiftUrl(reward.giftUrl)
      ) {
        throw new HttpsError("failed-precondition", "受け取れるギフトがありません。");
      }
      const now = new Date();
      transaction.set(
        rewardRef,
        { claimedAt: reward.claimedAt || now },
        { merge: true },
      );
      const account = accountSnapshot.data() || {};
      const milestones = { ...(account.milestones || {}) };
      milestones.m10 = {
        ...(milestones.m10 || {}),
        claimedAt: milestones.m10?.claimedAt || now,
      };
      transaction.set(accountRef, { milestones, updatedAt: now }, { merge: true });
      return { url: reward.giftUrl };
    });
  },
);

const ADMIN_ATTENDANCE_STATUSES = Object.freeze({
  present: "出席",
  late: "遅刻",
  early_leave: "早退",
  late_and_early_leave: "遅刻・早退",
  absent: "欠席",
  unrecorded: "未打刻",
});

function normalizeAdminEnrollmentStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return ["removed", "not_enrolled", "dropped", "cancelled"].includes(status)
    ? "not_enrolled"
    : "enrolled";
}

function normalizeAdminAttendanceStatus(data) {
  const candidates = [
    data?.status,
    data?.finalResult?.status,
    data?.judgement?.status,
    data?.finalResult?.value,
    data?.judgement?.value,
  ];
  for (const candidate of candidates) {
    const value = String(candidate || "").trim().toLowerCase();
    if (Object.hasOwn(ADMIN_ATTENDANCE_STATUSES, value)) return value;
    if (value === "出席") return "present";
    if (value === "遅刻") return "late";
    if (value === "早退") return "early_leave";
    if (value === "欠席") return "absent";
  }
  return "unrecorded";
}

exports.getStudentFeatureAdmin = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    await requireEnabledCareMateAdmin(request);
    const target = String(request.data?.studentNumber || "").trim();
    if (!/^\d{7}$/.test(target)) {
      throw new HttpsError("invalid-argument", "対象学生が正しくありません。");
    }
    const userRef = db.collection("users").doc(target);
    const [user, enrollment, attendance, progress, solved, referral, referralHistory, referralAdjustments] = await Promise.all([
      userRef.get(),
      userRef.collection("enrolledSubjects").get(),
      userRef.collection("attendanceRecords").get(),
      userRef.collection("examProgress").get(),
      userRef.collection("solvedQuestions").get(),
      referralAccountRef(target).get(),
      db.collection("referralHistory").where("invitedStudentNumber", "==", target).get(),
      db.collection("referralManualAdjustments").where("studentNumber", "==", target).get(),
    ]);
    if (!user.exists) {
      throw new HttpsError("not-found", "対象学生が見つかりません。");
    }
    const enrollments = enrollment.docs
      .map((item) => {
        const data = item.data() || {};
        return {
          id: item.id,
          name: String(data.name || data.subject || data.subjectKey || item.id),
          status: normalizeAdminEnrollmentStatus(data.status),
          rawStatus: String(data.status || ""),
          required: data.required === true || data.isRequired === true,
          academicYear: Number(data.academicYear || 0),
          semester: String(data.registeredSemester || data.semester || ""),
          credits: Number(data.credits || 0),
          updatedAt: timestampMillis(data.updatedAt || data.registeredAt),
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name, "ja"));
    const attendanceRecords = attendance.docs
      .map((item) => {
        const data = item.data() || {};
        return {
          id: item.id,
          subject: String(data.subject || "科目未設定"),
          date: String(data.date || ""),
          period: Number(data.period || 0),
          classGroup: String(data.classGroup || ""),
          status: normalizeAdminAttendanceStatus(data),
          statusLabel: String(
            data.statusLabel || data.finalResult?.label || data.judgement?.label ||
              ADMIN_ATTENDANCE_STATUSES[normalizeAdminAttendanceStatus(data)] || "",
          ),
          judgementSource: String(data.judgementSource || ""),
          adminEditedAt: timestampMillis(data.adminEditedAt),
          updatedAt: timestampMillis(data.updatedAt),
        };
      })
      .sort(
        (left, right) =>
          right.date.localeCompare(left.date) || right.period - left.period,
      );
    const testProgress = (await Promise.all(progress.docs
      .map(async (item) => {
        const data = item.data() || {};
        const currentIndex = Math.max(0, Number(
          data.currentIndex ?? data.currentQuestionIndex ?? data.index ?? 0,
        ));
        const questionOrder = Array.isArray(data.questionOrder)
          ? data.questionOrder.map(String)
          : [];
        const currentQuestionId = String(questionOrder[currentIndex] || "");
        let currentQuestionText = String(data.currentQuestionText || data.questionText || "").slice(0, 500);
        if (data.subjectId && data.unitId && currentQuestionId) {
          const published = await db
            .collection("examSubjects")
            .doc(String(data.subjectId))
            .collection("units")
            .doc(String(data.unitId))
            .collection("publishedQuestions")
            .doc("published")
            .get();
          const publishedData = published.data() || {};
          const questionKey =
            data.type === "fillBlank" ? "fill_blank" :
              data.type === "quiz" ? "quiz" :
                data.type === "qa" ? "qa" : "";
          const prefix =
            data.type === "fillBlank" ? "fill" :
              data.type === "quiz" ? "quiz" : "qa";
          const questions = questionKey && Array.isArray(publishedData[questionKey])
            ? publishedData[questionKey]
            : [];
          const currentQuestion = questions.find(
            (question, index) =>
              String(question?.id ?? `${prefix}-${index}`) === currentQuestionId,
          );
          currentQuestionText = String(currentQuestion?.question || "").slice(0, 500);
        }
        return {
          id: item.id,
          type: String(data.type || ""),
          subjectId: String(data.subjectId || ""),
          subjectName: String(data.subjectName || data.subjectTitle || data.subject || "名称未設定"),
          unitId: String(data.unitId || ""),
          currentIndex,
          totalQuestions: Math.max(0, Number(
            data.totalQuestions || questionOrder.length || data.questionCount || 0,
          )),
          currentQuestionId,
          currentQuestionText,
          completed: data.completed === true,
          updatedAt: timestampMillis(data.updatedAt || data.completedAt),
        };
      }))).sort((left, right) => right.updatedAt - left.updatedAt);
    const solvedQuestions = solved.docs
      .map((item) => {
        const data = item.data() || {};
        return {
          id: item.id,
          day: String(data.day || ""),
          type: String(data.type || ""),
          subjectId: String(data.subjectId || ""),
          unitId: String(data.unitId || ""),
          questionId: String(data.questionId || ""),
          points: Number(data.points || 0),
          correctAt: timestampMillis(data.correctAt),
        };
      })
      .sort((left, right) => right.correctAt - left.correctAt)
      .slice(0, 100);
    const referralData = referral.data() || {};
    const invitedCount = Math.min(
      REFERRAL_MAX_INVITES,
      Math.max(0, Number(referralData.invitedCount || 0)),
    );
    return {
      enrollments,
      attendanceRecords,
      testProgress,
      solvedQuestions,
      referral: {
        invitedCount,
        manualAdjustment: Number(referralData.manualAdjustment || 0),
        milestones: serializeReferralMilestones(referralData.milestones, invitedCount),
        histories: referralHistory.docs.map((item) => {
          const data = item.data() || {};
          return {
            id: item.id,
            inviterStudentNumber: String(data.inviterStudentNumber || ""),
            codePreview: String(data.codePreview || ""),
            establishedAt: timestampMillis(data.establishedAt),
          };
        }).sort((left, right) => right.establishedAt - left.establishedAt),
        adjustments: referralAdjustments.docs.map((item) => {
          const data = item.data() || {};
          return {
            id: item.id,
            fromCount: Number(data.fromCount || 0),
            toCount: Number(data.toCount || 0),
            reason: String(data.reason || ""),
            adjustedBy: String(data.adjustedBy || ""),
            adjustedAt: timestampMillis(data.adjustedAt),
          };
        }).sort((left, right) => right.adjustedAt - left.adjustedAt).slice(0, 20),
      },
    };
  },
);

exports.updateStudentFeatureAdmin = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    const updatedBy = await requireEnabledCareMateAdmin(request);
    const target = String(request.data?.studentNumber || "").trim();
    const feature = String(request.data?.feature || "");
    const documentId = String(request.data?.documentId || "").trim();
    if (!/^\d{7}$/.test(target) || !documentId || documentId.includes("/")) {
      throw new HttpsError("invalid-argument", "更新対象が正しくありません。");
    }
    const userRef = db.collection("users").doc(target);
    if (!(await userRef.get()).exists) {
      throw new HttpsError("not-found", "対象学生が見つかりません。");
    }
    if (feature === "enrollment") {
      const status = String(request.data?.status || "");
      const enrollmentRef = userRef.collection("enrolledSubjects").doc(documentId);
      if (status === "not_enrolled") {
        await enrollmentRef.delete();
      } else if (status === "enrolled") {
        const enrollment = await enrollmentRef.get();
        if (!enrollment.exists) {
          throw new HttpsError("not-found", "履修科目が見つかりません。");
        }
        await enrollmentRef.set(
          {
            status: "enrolled",
            adminEditedAt: new Date(),
            adminEditedBy: updatedBy,
            updatedAt: new Date(),
          },
          { merge: true },
        );
      } else {
        throw new HttpsError("invalid-argument", "履修状態が正しくありません。");
      }
      return { updated: true };
    }
    if (feature === "attendance") {
      const status = String(request.data?.status || "");
      if (!Object.hasOwn(ADMIN_ATTENDANCE_STATUSES, status)) {
        throw new HttpsError("invalid-argument", "出席状態が正しくありません。");
      }
      const attendanceRef = userRef.collection("attendanceRecords").doc(documentId);
      if (!(await attendanceRef.get()).exists) {
        throw new HttpsError("not-found", "出席記録が見つかりません。");
      }
      await attendanceRef.set(
        {
          status,
          statusLabel: ADMIN_ATTENDANCE_STATUSES[status],
          statusFinalized: true,
          adminEditedAt: new Date(),
          adminEditedBy: updatedBy,
          updatedAt: new Date(),
        },
        { merge: true },
      );
      return { updated: true };
    }
    if (feature === "examProgress") {
      const currentIndex = Number(request.data?.currentIndex);
      const completed = request.data?.completed === true;
      if (!Number.isInteger(currentIndex) || currentIndex < 0) {
        throw new HttpsError("invalid-argument", "問題番号が正しくありません。");
      }
      const progressRef = userRef.collection("examProgress").doc(documentId);
      const progress = await progressRef.get();
      if (!progress.exists) {
        throw new HttpsError("not-found", "テスト進捗が見つかりません。");
      }
      const totalQuestions = Math.max(0, Number(progress.data()?.totalQuestions || 0));
      if (totalQuestions > 0 && currentIndex >= totalQuestions) {
        throw new HttpsError("invalid-argument", "問題番号が問題数を超えています。");
      }
      await progressRef.set(
        {
          currentIndex,
          completed,
          adminEditedAt: new Date(),
          adminEditedBy: updatedBy,
          updatedAt: new Date(),
        },
        { merge: true },
      );
      return { updated: true };
    }
    throw new HttpsError("invalid-argument", "更新できない機能です。");
  },
);

// 管理者が指定した学生1人だけの確認処理を、その場で起動する。
exports.requestStudentUpdateCheck = onCall(
  {
    region: "asia-northeast1",
    cors: [SITE_ORIGIN],
    secrets: [GITHUB_ACTIONS_TOKEN],
  },
  async (request) => {
    const requestedBy = await requireEnabledCareMateAdmin(request);
    const targetStudentNumber = String(request.data?.studentNumber || "").trim();
    if (!/^\d{7}$/.test(targetStudentNumber)) {
      throw new HttpsError("invalid-argument", "対象学生が正しくありません。");
    }

    const targetRef = db.collection("users").doc(targetStudentNumber);
    const requestRef = db
      .collection("studentUpdateChecks")
      .doc(targetStudentNumber);
    const requestId = crypto.randomUUID();

    await db.runTransaction(async (transaction) => {
      const [targetSnapshot, existingSnapshot] = await Promise.all([
        transaction.get(targetRef),
        transaction.get(requestRef),
      ]);
      if (!targetSnapshot.exists) {
        throw new HttpsError("not-found", "対象学生が見つかりません。");
      }

      const decision = manualUpdateDecision(existingSnapshot.data());
      if (!decision.allowed) {
        throw new HttpsError(
          "resource-exhausted",
          decision.reason === "already-running"
            ? "この学生は現在更新確認中です。"
            : "完了後5分経ってから再実行できます。",
        );
      }

      transaction.set(requestRef, {
        requestId,
        targetStudentNumber,
        requestedBy,
        status: "queued",
        progress: 5,
        message: "対象学生だけの更新を開始しています",
        requestedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        startedAt: null,
        completedAt: null,
      });
    });

    try {
      await dispatchStudentRefreshWorkflow(targetStudentNumber, requestId);
    } catch (error) {
      console.error("学生別更新の起動エラー:", error);
      await requestRef.set(
        {
          status: "dispatch-failed",
          progress: 0,
          message: "更新処理を開始できませんでした。もう一度お試しください",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      throw new HttpsError(
        "unavailable",
        "更新処理を開始できませんでした。もう一度お試しください。",
      );
    }

    return { requestId, status: "queued", progress: 5 };
  },
);

// 管理者の追加は、既存管理者全員ではなく2510044本人だけが行える。
// 対象学生の現在のログイン状態は変更せず、次回ログイン時に管理権限を反映する。
exports.listCareMateAdmins = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    await requirePrimaryDeviceAuditAdmin(request);
    const snapshot = await db.collection("admins").get();
    return {
      studentNumbers: snapshot.docs
        .filter((item) => item.data()?.enabled === true)
        .map((item) => item.id)
        .filter((item) => /^\d{7}$/.test(item)),
    };
  },
);

exports.registerCareMateAdmin = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    const registeredBy = await requirePrimaryDeviceAuditAdmin(request);
    const targetStudentNumber = String(
      request.data?.studentNumber || "",
    ).trim();

    if (!/^\d{7}$/.test(targetStudentNumber)) {
      throw new HttpsError("invalid-argument", "学籍番号を確認してください。");
    }

    const targetSnapshot = await db
      .collection("users")
      .doc(targetStudentNumber)
      .get();
    if (!targetSnapshot.exists) {
      throw new HttpsError("not-found", "対象の学生が見つかりません。");
    }

    const adminRef = db.collection("admins").doc(targetStudentNumber);
    const adminSnapshot = await adminRef.get();
    await adminRef.set(
      {
        enabled: true,
        registeredBy,
        registeredAt: adminSnapshot.exists
          ? adminSnapshot.data()?.registeredAt || FieldValue.serverTimestamp()
          : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // すでにFirebase Auth利用者が存在する場合は、次のトークン更新でも反映する。
    // 未作成の場合もauthenticateCareMateがadminsを確認するため、次回ログインで有効になる。
    try {
      const uid = `caremate-${targetStudentNumber}`;
      const authUser = await adminAuth.getUser(uid);
      await adminAuth.setCustomUserClaims(uid, {
        ...(authUser.customClaims || {}),
        admin: true,
        studentNumber: targetStudentNumber,
      });
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }

    return {
      registered: true,
      studentNumber: targetStudentNumber,
    };
  },
);

exports.revokeCareMateAdmin = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    const revokedBy = await requirePrimaryDeviceAuditAdmin(request);
    const targetStudentNumber = String(request.data?.studentNumber || "").trim();
    if (!/^\d{7}$/.test(targetStudentNumber)) {
      throw new HttpsError("invalid-argument", "学籍番号を確認してください。");
    }
    if (targetStudentNumber === "2510044") {
      throw new HttpsError("failed-precondition", "主管理者は解除できません。");
    }

    await db.collection("admins").doc(targetStudentNumber).set(
      {
        enabled: false,
        revokedBy,
        revokedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    try {
      const uid = `caremate-${targetStudentNumber}`;
      const authUser = await adminAuth.getUser(uid);
      await adminAuth.setCustomUserClaims(uid, {
        ...(authUser.customClaims || {}),
        admin: false,
        studentNumber: targetStudentNumber,
      });
      await adminAuth.revokeRefreshTokens(uid);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }
    return { revoked: true, studentNumber: targetStudentNumber };
  },
);

const costDashboardSettingsRef = db
  .collection("privateAdminSettings")
  .doc("costDashboard");

function timestampMillis(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  const date = value instanceof Date ? value : new Date(value || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

async function countCostUsageDocuments(reference) {
  try {
    const snapshot = await reference.count().get();
    return Number(snapshot.data()?.count || 0);
  } catch (error) {
    console.warn("料金画面の利用件数を取得できません", {
      code: error?.code || "unavailable",
    });
    return null;
  }
}

async function fetchPublicGitHubUsage() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "CareMate-Cost-Dashboard",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  try {
    const [repositoryResponse, actionsResponse] = await Promise.all([
      fetch("https://api.github.com/repos/doko2517027-bit/university-notifier-web", {
        headers,
        signal: AbortSignal.timeout(5000),
      }),
      fetch("https://api.github.com/repos/doko2517027-bit/university-notifier-web/actions/runs?per_page=1", {
        headers,
        signal: AbortSignal.timeout(5000),
      }),
    ]);
    if (!repositoryResponse.ok) throw new Error(`github-${repositoryResponse.status}`);
    const repository = await repositoryResponse.json();
    const actions = actionsResponse.ok ? await actionsResponse.json() : {};
    return {
      available: true,
      repositoryPublic: repository.private === false,
      repositorySizeKb: Number(repository.size || 0),
      workflowRuns: Number(actions.total_count || 0),
      updatedAt: String(repository.updated_at || ""),
    };
  } catch (error) {
    console.warn("GitHub公開利用状況を取得できません", {
      message: String(error?.message || "unavailable").slice(0, 100),
    });
    return { available: false, repositoryPublic: false };
  }
}

async function collectFreeCareMateUsage() {
  const [
    userCount,
    deviceCount,
    pushCount,
    assignmentCount,
    systemNewsCount,
    solvedQuestionCount,
    github,
  ] = await Promise.all([
    countCostUsageDocuments(db.collection("users")),
    countCostUsageDocuments(db.collectionGroup("loginDevices")),
    countCostUsageDocuments(db.collectionGroup("pushSubscriptions")),
    countCostUsageDocuments(db.collection("assignments")),
    countCostUsageDocuments(db.collection("systemNews")),
    countCostUsageDocuments(db.collectionGroup("solvedQuestions")),
    fetchPublicGitHubUsage(),
  ]);
  const metrics = [
    { id: "users", label: "登録学生", value: userCount, unit: "人", note: "Firestore users" },
    { id: "devices", label: "登録端末", value: deviceCount, unit: "台", note: "ログイン端末" },
    { id: "push", label: "通知登録", value: pushCount, unit: "件", note: "Push購読" },
    { id: "assignments", label: "課題データ", value: assignmentCount, unit: "人分", note: "課題ドキュメント" },
    { id: "news", label: "運営お知らせ", value: systemNewsCount, unit: "件", note: "CareMateお知らせ" },
    { id: "solved", label: "解答記録", value: solvedQuestionCount, unit: "件", note: "テスト対策" },
    { id: "actions", label: "更新実行履歴", value: github.available ? github.workflowRuns : null, unit: "回", note: "GitHub Actions" },
  ];
  const providerDetections = {};
  if (github.repositoryPublic) {
    providerDetections.github = {
      detectedFreeReason: "公開リポジトリと標準GitHub-hosted runnerを検出（公開リポジトリのActionsは無料対象）",
    };
  }
  return {
    status: metrics.some((item) => item.value !== null) ? "connected" : "unavailable",
    checkedAt: new Date().toISOString(),
    metrics,
    github,
    providerDetections,
    mode: "free-capped",
    note: "無料範囲を守るため6時間キャッシュし、Firestore件数と公開GitHub情報だけを自動集計しています。",
  };
}

async function loadFreeCareMateUsage(config, force) {
  const cached = config.freeUsageCache || {};
  const cacheAge = Date.now() - timestampMillis(cached.checkedAt);
  const shouldRefresh = !cached.status || cacheAge > 6 * 60 * 60 * 1000 || (force && cacheAge > 10 * 60 * 1000);
  if (!shouldRefresh) {
    return {
      ...cached,
      checkedAt: cached.checkedAt?.toDate?.()?.toISOString?.() || cached.checkedAt || null,
    };
  }
  const usage = await collectFreeCareMateUsage();
  await costDashboardSettingsRef.set({
    freeUsageCache: {
      ...usage,
      checkedAt: FieldValue.serverTimestamp(),
    },
  }, { merge: true });
  return usage;
}

async function loadCareMateCostDashboard({ force = false, configSnapshot = null } = {}) {
  const {
    buildDashboard,
    queryGoogleCosts,
  } = require("./cost_dashboard.js");
  const snapshot = configSnapshot || await costDashboardSettingsRef.get();
  const config = snapshot.data() || {};
  const freeUsage = await loadFreeCareMateUsage(config, force);
  const cached = config.automaticCache || {};
  const cacheAge = Date.now() - timestampMillis(cached.checkedAt);
  let automatic = cached;

  if (!cached.status || cacheAge > 6 * 60 * 60 * 1000 || (force && cacheAge > 10 * 60 * 1000)) {
    try {
      automatic = await queryGoogleCosts({
        table: config.billingTable,
        projectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "universitynotifier-67517",
      });
    } catch (error) {
      console.warn("料金ダッシュボードのGoogle Cloud集計を利用できません", {
        code: error?.code || "unavailable",
      });
      automatic = {
        status: "unavailable",
        message: "Google Cloud請求データを自動取得できません。課金エクスポート設定を確認してください。",
        table: "",
        costs: {},
        services: {},
        currency: "JPY",
      };
    }
    const cacheForStorage = {
      status: automatic.status,
      message: automatic.message,
      costs: automatic.costs || {},
      services: automatic.services || {},
      currency: automatic.currency || "JPY",
      checkedAt: FieldValue.serverTimestamp(),
    };
    const update = { automaticCache: cacheForStorage };
    if (automatic.table) update.billingTable = automatic.table;
    await costDashboardSettingsRef.set(update, { merge: true });
  }

  const dashboard = buildDashboard({
    automaticGoogleCosts: automatic.costs || {},
    automaticGoogleServices: automatic.services || {},
    automaticCurrency: automatic.currency || "JPY",
    automaticStatus: automatic.status || "not-connected",
    automaticMessage: automatic.message || "請求データ連携が未設定です。",
    freeUsage,
    providerDetections: freeUsage.providerDetections || {},
    config,
  });
  return {
    ...dashboard,
    refreshedAt: new Date().toISOString(),
  };
}

exports.getCareMateCostDashboard = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN], timeoutSeconds: 60 },
  async (request) => {
    await requirePrimaryDeviceAuditAdmin(request);
    return loadCareMateCostDashboard({ force: request.data?.force === true });
  },
);

exports.saveCareMateCostSettings = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    const updatedBy = await requirePrimaryDeviceAuditAdmin(request);
    const { sanitizeSettingsInput } = require("./cost_dashboard.js");
    let settings;
    try {
      settings = sanitizeSettingsInput(request.data);
    } catch {
      throw new HttpsError("invalid-argument", "料金または対象月を確認してください。");
    }
    await costDashboardSettingsRef.set({
      budgetAmount: settings.budgetAmount,
      alertAmount: settings.alertAmount,
      notificationsEnabled: settings.notificationsEnabled,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy,
    }, { merge: true });
    await costDashboardSettingsRef.update({
      [`monthlyCosts.${settings.month}`]: settings.costs,
    });
    return loadCareMateCostDashboard();
  },
);

exports.runExternalAuthCheck = onCall(
  {
    region: "asia-northeast1",
    cors: [SITE_ORIGIN],
    timeoutSeconds: 120,
    memory: "1GiB",
  },
  async (request) => {
    const requestedBy = await requireEnabledCareMateAdmin(request);
    const targetStudentNumber = String(request.data?.studentNumber || "").trim();
    const service = String(request.data?.service || "").trim();
    const requestId = String(request.data?.requestId || "").trim();
    if (!/^\d{7}$/.test(targetStudentNumber)) {
      throw new HttpsError("invalid-argument", "学生番号が正しくありません。");
    }
    if (!['manaba', 'activeMail'].includes(service)) {
      throw new HttpsError("invalid-argument", "認証先が正しくありません。");
    }
    if (!/^[a-zA-Z0-9_-]{20,100}$/.test(requestId)) {
      throw new HttpsError("invalid-argument", "実行IDが正しくありません。");
    }

    const jobRef = db.collection("externalAuthChecks").doc(requestId);
    const userRef = db.collection("users").doc(targetStudentNumber);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const updateProgress = async (progress, message) => {
      await jobRef.set({
        requestedBy,
        targetStudentNumber,
        service,
        status: "running",
        progress: Math.max(0, Math.min(99, Number(progress || 0))),
        message: String(message || "認証を確認しています"),
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt,
      }, { merge: true });
    };

    await jobRef.set({
      requestedBy,
      targetStudentNumber,
      service,
      status: "running",
      progress: 5,
      message: "認証確認を開始しています",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt,
    });

    let browser;
    try {
      const userSnapshot = await userRef.get();
      if (!userSnapshot.exists) throw new HttpsError("not-found", "学生が見つかりません。");
      await updateProgress(15, "保存済みの設定を確認しています");
      const chromium = require("@sparticuz/chromium");
      const { chromium: playwrightChromium } = require("playwright-core");
      const { verifyActiveMail, verifymanaba } = require("./external_auth_check.js");
      browser = await playwrightChromium.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
      const user = userSnapshot.data() || {};
      const result = service === "manaba"
        ? await verifymanaba({ browser, user, updateProgress })
        : await verifyActiveMail({
            browser,
            studentNumber: targetStudentNumber,
            user,
            updateProgress,
          });
      const checkedAt = FieldValue.serverTimestamp();
      if (result.configured) {
        const prefix = service;
        await userRef.set({
          [`${prefix}Verified`]: result.verified,
          [`${prefix}VerifiedAt`]: result.verified ? checkedAt : null,
          [`${prefix}LastCheckedAt`]: checkedAt,
          [`${prefix}ResetRequired`]: !result.verified,
          [`${prefix}VerificationError`]: result.verified ? null : "invalid_credentials",
        }, { merge: true });
      }
      await jobRef.set({
        status: result.configured ? (result.verified ? "success" : "failed") : "not-configured",
        progress: 100,
        message: result.message,
        verified: result.verified,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { verified: result.verified, configured: result.configured };
    } catch (error) {
      console.warn("管理画面の外部認証確認失敗", {
        targetStudentNumber,
        service,
        code: error?.code || "unknown",
      });
      await jobRef.set({
        status: "error",
        progress: 100,
        message: "一時的なエラーで確認できませんでした。時間をおいて再実行してください。",
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("unavailable", "認証確認を実行できませんでした。");
    } finally {
      if (browser) await browser.close();
    }
  },
);

exports.touchCareMateDevice = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    const studentNumber = requireAuthenticatedCareMateStudent(request);
    const deviceId = normalizeDeviceId(request.data?.deviceId);

    if (!deviceId) {
      throw new HttpsError("invalid-argument", "端末IDが正しくありません。");
    }

    try {
      const result = await deviceSessionStore.recordDeviceSession({
        studentNumber,
        deviceId,
        rawRequest: request.rawRequest,
        eventType: "activity",
        authTimeMillis:
          Number(request.auth?.token?.auth_time || 0) * 1000,
      });

      await pruneLegacyPresenceDevices(studentNumber);

      if (result.forceLogout === true) {
        return {
          ok: false,
          forceLogout: true,
          requestedAt: result.forceLogoutRequestedAt || 0,
        };
      }
    } catch (error) {
      console.warn("端末利用時刻更新失敗:", error?.message || "unknown");
      return { ok: false };
    }

    return { ok: true };
  },
);

// 既存のローカルログイン状態など、Firestoreのリアルタイム監視を
// 開始できない端末にも強制ログアウトを届ける読み取り専用フォールバック。
// 未認証時も、推測困難な端末IDと学籍番号が一致する既存端末だけを確認する。
exports.checkCareMateDeviceLogout = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    const targetStudentNumber = String(
      request.data?.studentNumber || "",
    ).trim();
    const deviceId = normalizeDeviceId(request.data?.deviceId);

    if (!/^\d{7}$/.test(targetStudentNumber) || !deviceId) {
      throw new HttpsError(
        "invalid-argument",
        "端末情報が正しくありません。",
      );
    }

    if (request.auth) {
      const authenticatedStudentNumber =
        requireAuthenticatedCareMateStudent(request);
      if (authenticatedStudentNumber !== targetStudentNumber) {
        throw new HttpsError(
          "permission-denied",
          "他の学生の端末状態は確認できません。",
        );
      }
    }

    const result = await deviceSessionStore.checkDeviceLogout(
      targetStudentNumber,
      deviceId,
      Number(request.auth?.token?.auth_time || 0) * 1000,
    );

    return { forceLogout: result.forceLogout === true };
  },
);

exports.listUserLoginDevices = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    await requirePrimaryDeviceAuditAdmin(request);
    const targetStudentNumber = String(
      request.data?.studentNumber || "",
    ).trim();

    if (!/^\d{7}$/.test(targetStudentNumber)) {
      throw new HttpsError("invalid-argument", "学籍番号が正しくありません。");
    }

    return deviceSessionStore.listUserDevices(targetStudentNumber);
  },
);

exports.listDeviceRiskSummaries = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    await requirePrimaryDeviceAuditAdmin(request);
    return { summaries: await deviceSessionStore.listRiskSummaries() };
  },
);

exports.deleteUserLoginDevice = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    await requirePrimaryDeviceAuditAdmin(request);
    const targetStudentNumber = String(
      request.data?.studentNumber || "",
    ).trim();
    const deviceId = normalizeDeviceId(request.data?.deviceId);

    if (!/^\d{7}$/.test(targetStudentNumber) || !deviceId) {
      throw new HttpsError("invalid-argument", "削除対象が正しくありません。");
    }

    return deviceSessionStore.deleteUserDevice(
      targetStudentNumber,
      deviceId,
    );
  },
);

exports.forceLogoutUserDevice = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    await requirePrimaryDeviceAuditAdmin(request);
    const targetStudentNumber = String(
      request.data?.studentNumber || "",
    ).trim();
    const deviceId = normalizeDeviceId(request.data?.deviceId);

    if (!/^\d{7}$/.test(targetStudentNumber) || !deviceId) {
      throw new HttpsError(
        "invalid-argument",
        "ログアウト対象が正しくありません。",
      );
    }

    const result = await deviceSessionStore.requestDeviceLogout(
      targetStudentNumber,
      deviceId,
    );

    if (result.requested !== true) {
      throw new HttpsError(
        "not-found",
        "対象端末の履歴が見つかりません。",
      );
    }

    return result;
  },
);

exports.forceLogoutAllUserDevices = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    await requirePrimaryDeviceAuditAdmin(request);
    const targetStudentNumber = String(
      request.data?.studentNumber || "",
    ).trim();

    if (!/^\d{7}$/.test(targetStudentNumber)) {
      throw new HttpsError(
        "invalid-argument",
        "ログアウト対象が正しくありません。",
      );
    }

    const result = await deviceSessionStore.requestAllDevicesLogout(
      targetStudentNumber,
    );

    try {
      await adminAuth.revokeRefreshTokens(`caremate-${targetStudentNumber}`);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }

    return result;
  },
);

exports.cleanupStaleLoginDevices = onSchedule(
  {
    region: "asia-northeast1",
    schedule: "every day 04:20",
    timeZone: "Asia/Tokyo",
  },
  async () => {
    const result = await deviceSessionStore.cleanupExpiredRecords();
    console.log("古いログイン端末情報を削除しました", result);

    const realtimeDb = require("firebase-admin/database").getDatabase();
    // 新しいジョブを増やさず、既存の日次処理で卒業・退学後30日の保持期限を適用する。
    const now = new Date();
    const snapshot = await db.collection("users")
      .where("scheduledDeleteAt", "<=", now.toISOString())
      .get();
    for (const userDoc of snapshot.docs) {
      if (!isPurgeEligible(userDoc.data(), now.getTime())) continue;
      try {
        await deleteCareMateDataExceptExternalMedia(
          { db, auth: adminAuth, realtimeDb },
          userDoc.id,
        );
        console.log(`卒業・退学後30日を経過したアカウントを削除: ${userDoc.id}`);
      } catch (error) {
        console.error(`アカウント自動削除失敗: ${userDoc.id}`, error);
      }
    }

    const expiredChecks = await db.collection("externalAuthChecks")
      .where("expiresAt", "<=", now)
      .limit(400)
      .get();
    if (!expiredChecks.empty) {
      const batch = db.batch();
      expiredChecks.docs.forEach((document) => batch.delete(document.ref));
      await batch.commit();
      console.log(`期限切れ認証確認履歴を削除: ${expiredChecks.size}件`);
    }

    // 現在登録中の学生を、生涯1回だけ数える紹介不正防止台帳へ補完する。
    // 通常アカウント削除時もこの最小台帳は削除しない。
    const allUsers = await db.collection("users").get();
    const identityWrites = [];
    for (const userDoc of allUsers.docs) {
      const identityRef = referralIdentityRef(userDoc.id);
      const identitySnapshot = await identityRef.get();
      if (!identitySnapshot.exists) {
        identityWrites.push({ ref: identityRef, studentNumber: userDoc.id });
      }
    }
    for (let index = 0; index < identityWrites.length; index += 400) {
      const batch = db.batch();
      identityWrites.slice(index, index + 400).forEach((item) => {
        batch.create(item.ref, {
          studentNumber: item.studentNumber,
          everRegistered: true,
          firstRegisteredAt: now,
          referralEverCounted: false,
          inviterStudentNumber: null,
          referralCountedAt: null,
          registrySource: "existing-user-backfill",
        });
      });
      await batch.commit();
    }

    for (const collectionName of [
      "registrationVerificationProofs",
      "referralRegistrationProofs",
      "referralRateLimits",
    ]) {
      const expired = await db
        .collection(collectionName)
        .where("expiresAt", "<=", now)
        .limit(400)
        .get();
      if (!expired.empty) {
        const batch = db.batch();
        expired.docs.forEach((document) => batch.delete(document.ref));
        await batch.commit();
      }
    }
  },
);

// ======================
// 学生ページ認証
// ======================

async function createStudentPageRegistrationProof(studentNumber) {
  if (!/^\d{7}$/.test(studentNumber)) return "";
  const token = createProofToken();
  const [userSnapshot, identitySnapshot] = await Promise.all([
    db.collection("users").doc(studentNumber).get(),
    referralIdentityRef(studentNumber).get(),
  ]);
  await db
    .collection("registrationVerificationProofs")
    .doc(sha256(token))
    .set({
      studentNumber,
      verifiedAt: new Date(),
      expiresAt: new Date(
        Date.now() + REFERRAL_PROOF_TTL_MINUTES * 60_000,
      ),
      userExistedAtVerification: userSnapshot.exists,
      identityExistedAtVerification: identitySnapshot.exists,
      used: false,
    });
  return token;
}

exports.verifyStudentPageCredentials = onRequest(
  {
    region: "asia-northeast1",
    timeoutSeconds: 60,
    memory: "1GiB",
    cors: [SITE_ORIGIN],
    secrets: [
      REGISTRATION_TEST_STUDENT_PAGE_ID,
      REGISTRATION_TEST_STUDENT_PAGE_PASSWORD,
    ],
  },

  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).json({
        verified: false,
        message: "POSTで送信してください。",
      });

      return;
    }

    const studentPageId = String(request.body?.studentPageId || "").trim();

    const studentPagePassword = String(request.body?.studentPagePassword || "");
    const studentNumber = String(request.body?.studentNumber || "").trim();

    if (!studentPageId || !studentPagePassword) {
      response.status(400).json({
        verified: false,
        message: "学生ページIDとパスワードを入力してください。",
      });

      return;
    }

    /*
     * テスト用の値が秘密管理に設定されている場合は、
     * その値と一致したときだけ登録を許可する。
     * 秘密値はレスポンスやログへ一切出さない。
     */
    const testId = REGISTRATION_TEST_STUDENT_PAGE_ID.value();

    const testPassword = REGISTRATION_TEST_STUDENT_PAGE_PASSWORD.value();

    if (testId && testPassword) {
      const verified =
        studentPageId === testId && studentPagePassword === testPassword;
      response.json({
        verified,
        mode: "test",
        registrationVerificationToken: verified
          ? await createStudentPageRegistrationProof(studentNumber)
          : "",
      });

      return;
    }

    let browser;

    try {
      // 大きなブラウザ依存は、この認証確認を実行する時だけ読み込む。
      // 他の関数やデプロイ解析の起動を遅らせない。
      const chromium = require("@sparticuz/chromium");
      const { chromium: playwrightChromium } = require("playwright-core");

      browser = await playwrightChromium.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });

      const context = await browser.newContext();

      const page = await context.newPage();

      await page.goto("https://sums.ac.jp/", {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });

      const popupPromise = context.waitForEvent("page");

      await page
        .locator("#cn_01")
        .getByRole("link", { name: "在学生の皆様へ" })
        .click();

      const studentPage = await popupPromise;

      await studentPage.waitForLoadState("domcontentloaded");

      await studentPage
        .getByRole("textbox", { name: "ログインＩＤを入力" })
        .fill(studentPageId);

      await studentPage
        .getByRole("textbox", { name: "パスワードを入力" })
        .fill(studentPagePassword);

      await studentPage.getByRole("button", { name: "Submit" }).click();

      await studentPage.waitForLoadState("networkidle", { timeout: 30_000 });

      const verified =
        (await studentPage
          .getByRole("link", { name: "授業について。" })
          .count()) > 0;

      response.json({
        verified,
        registrationVerificationToken: verified
          ? await createStudentPageRegistrationProof(studentNumber)
          : "",
      });
    } catch (error) {
      console.warn("学生ページ認証失敗:", error?.message || "unknown");

      response.json({ verified: false });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  },
);

function scheduleDocumentId(user) {
  if (String(user.department || "").trim() === "看護学科") return "ns_yamate";
  if (String(user.major || "").includes("理学療法")) return "pt";
  if (String(user.major || "").includes("作業療法")) return "ot";
  return "";
}

async function sendToUserDevices(
  userId,
  payload,
  { excludeDeviceIds = [] } = {},
) {
  const excluded = new Set(excludeDeviceIds);
  const devices = await db
    .collection("users")
    .doc(userId)
    .collection("pushSubscriptions")
    .get();
  const targets = devices.docs
    .filter((device) => !excluded.has(device.id))
    .map((device) => ({
      deviceId: device.id,
      subscription: device.data(),
      ref: device.ref,
    }));

  // 端末別購読へ移行する前に登録した利用者にも通知を届ける。
  if (devices.empty && !excluded.has("legacy")) {
    const userSnapshot = await db.collection("users").doc(userId).get();
    const legacySubscription =
      userSnapshot.data()?.pushSubscription ||
      userSnapshot.data()?.subscription;

    if (legacySubscription?.endpoint) {
      targets.push({
        deviceId: "legacy",
        subscription: legacySubscription,
        ref: null,
      });
    }
  }

  const results = [];
  for (const device of targets) {
    try {
      await webpush.sendNotification(
        device.subscription,
        JSON.stringify(payload),
      );
      results.push({ deviceId: device.deviceId, result: "sent" });
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await device.ref?.delete();
      }
      results.push({
        deviceId: device.deviceId,
        result: "failed",
        statusCode: error?.statusCode || null,
      });
    }
  }
  return results;
}

// 端末を開いていない学生のホーム画面アイコンは正確に判定できないため、
// 旧判定APIは安全のため無効化する。
exports.notifyStudentsNeedingAppReinstall = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async () => {
    throw new HttpsError(
      "failed-precondition",
      "再インストール対象を正確に判定できないため、この通知機能は無効です。",
    );
  },
);

// 2510044が設定した月額アラートを1日1回確認する。
// 同じ月・同じ金額では重複通知せず、未設定時は外部請求データを照会しない。
exports.monitorCareMateCosts = onSchedule(
  {
    schedule: "every day 09:00",
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
    timeoutSeconds: 90,
    secrets: [WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY],
  },
  async () => {
    const settingsSnapshot = await costDashboardSettingsRef.get();
    const settings = settingsSnapshot.data() || {};
    const alertAmount = Number(settings.alertAmount);
    if (
      settings.notificationsEnabled !== true ||
      !Number.isFinite(alertAmount) ||
      alertAmount <= 0
    ) {
      return;
    }

    const dashboard = await loadCareMateCostDashboard({
      force: true,
      configSnapshot: settingsSnapshot,
    });
    if (!dashboard.alertTriggered) return;

    const alertKey = `${dashboard.currentMonth}:${dashboard.currentTotal}:${alertAmount}`;
    if (settings.lastAlertKey === alertKey) return;

    webpush.setVapidDetails(
      "mailto:kidokohei.shonaniryo2517027@gmail.com",
      WEB_PUSH_PUBLIC_KEY.value(),
      WEB_PUSH_PRIVATE_KEY.value(),
    );
    const formatter = new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: dashboard.currency || "JPY",
      maximumFractionDigits: 0,
    });
    await sendToUserDevices("2510044", {
      title: "CareMate料金アラート",
      body: `${dashboard.currentMonth}の確認済み料金が${formatter.format(dashboard.currentTotal)}になり、設定額を超えました。`,
      url: `${SITE_URL}/cost_admin.html`,
      notificationSource: "firebase",
    });
    await costDashboardSettingsRef.set({
      lastAlertKey: alertKey,
      lastAlertAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  },
);

// 個人予定・学年共有予定・課題の通知を、登録済みの端末へ重複なく送る。
exports.sendCalendarReminders = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
    timeoutSeconds: 180,
    secrets: [WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY],
  },
  async () => {
    webpush.setVapidDetails(
      "mailto:kidokohei.shonaniryo2517027@gmail.com",
      WEB_PUSH_PUBLIC_KEY.value(),
      WEB_PUSH_PRIVATE_KEY.value(),
    );
    const now = new Date();
    const earliest = new Date(now.getTime() - 30 * 60000);
    const latest = new Date(now.getTime() + 1440 * 60000);
    const [users, personal, shared] = await Promise.all([
      db.collection("users").get(),
      db.collection("calendarEvents").where("startAt", ">=", earliest).where("startAt", "<=", latest).get(),
      db.collection("calendarSharedEvents").where("startAt", ">=", earliest).where("startAt", "<=", latest).get(),
    ]);
    const pending = [];
    function queue(userId, kind, id, item, url, minutes) {
      for (const advance of reminderMinutes(minutes)) {
        if (!isReminderDue(item.startAt || item.deadlineAt, advance, now)) continue;
        pending.push({ userId, kind, id, item, url, advance });
      }
    }
    for (const event of personal.docs) {
      const item = event.data();
      if (users.docs.some((user) => user.id === item.ownerId)) {
        queue(item.ownerId, "personal", event.id, item, `${SITE_URL}/calendar.html`, item.reminderMinutes);
      }
    }
    for (const user of users.docs) {
      for (const event of shared.docs) {
        const item = event.data();
        if (matchesAudience(item, user.data() || {})) {
          queue(user.id, "shared", event.id, item, `${SITE_URL}/calendar.html`, item.reminderMinutes);
        }
      }
    }
    // 課題は本人が通知を選んだ項目だけを参照する。過去の課題履歴は削除しない。
    await Promise.all(users.docs.map(async (user) => {
      const preferences = await db.collection("calendarReminderPreferences").doc(user.id).collection("items").get();
      for (const preference of preferences.docs) {
        const minutes = reminderMinutes(preference.data().reminderMinutes);
        if (!minutes.length) continue;
        const archived = await db.collection("calendarAssignments").doc(user.id).collection("items").doc(preference.id).get();
        if (archived.exists) queue(user.id, "assignment", preference.id, archived.data(),
          `${SITE_URL}/assignments.html`, minutes);
      }
    }));
    for (let index = 0; index < pending.length; index += 10) {
      const batch = pending.slice(index, index + 10);
      const results = await Promise.allSettled(batch.map(async ({ userId, kind, id, item, url, advance }) => {
        const start = (item.startAt || item.deadlineAt)?.toDate?.() || new Date(item.startAt || item.deadlineAt);
        const key = crypto.createHash("sha256").update(`${userId}|${kind}|${id}|${advance}|${start.getTime()}`).digest("hex");
        const ref = db.collection("calendarReminderDispatches").doc(key);
        try {
          await ref.create({ userId, kind, eventId: id, advance, createdAt: now,
            expiresAt: new Date(now.getTime() + 45 * 86400000) });
        } catch (error) {
          if (error.code === 6 || error.code === "already-exists") return;
          throw error;
        }
        try {
          const prefix = advance === 1440 ? "明日" : advance === 60 ? "1時間後" : advance === 10 ? "10分後" : "まもなく";
          const results = await sendToUserDevices(userId, {
            title: `📅 ${item.title || "予定"}`,
            body: `${prefix}です${item.course ? `（${item.course}）` : ""}`,
            url,
            tag: `calendar-${key}`,
          });
          if (results.some((result) => result.result === "sent")) {
            await ref.update({ sentAt: new Date(), results });
          } else {
            await ref.delete();
          }
        } catch (error) {
          await ref.delete();
          throw error;
        }
      }));
      results.forEach((result) => { if (result.status === "rejected") console.error("カレンダー通知失敗", result.reason); });
    }
    // 送達記録は重複防止用。45日経過分だけ少量ずつ整理する。
    if (now.getUTCHours() === 18 && now.getUTCMinutes() < 5) {
      const expired = await db.collection("calendarReminderDispatches")
        .where("expiresAt", "<=", now).limit(200).get();
      await Promise.all(expired.docs.map((item) => item.ref.delete()));
    }
  },
);

function attendanceDeadline(date, time, extraMinutes) {
  const base = new Date(`${date}T${time}:00+09:00`);
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() + extraMinutes * 60 * 1000);
}

/*
 * 開始・終了いずれかの打刻期限を過ぎた未打刻記録を、
 * サーバー側でも欠席として確定する。画面を開かなくても
 * 今日の集計と管理画面が同じ状態になるようにする。
 */
async function finalizeExpiredAttendanceRecords(
  userDoc,
  date,
  now = new Date(),
) {
  const snapshot = await userDoc.ref
    .collection("attendanceRecords")
    .where("date", "==", date)
    .get();
  const updates = [];

  for (const recordDoc of snapshot.docs) {
    const record = recordDoc.data() || {};
    if (
      record.absenceTapped ||
      record.manualEdited ||
      record.endStampedAt ||
      record.endKind
    )
      continue;

    const startDeadline = attendanceDeadline(record.date, record.startTime, 30);
    const endDeadline = attendanceDeadline(record.date, record.endTime, 10);
    const hasStart = Boolean(
      record.startStampedAt || record.startClientAt || record.startKind,
    );
    const expired = !hasStart
      ? startDeadline && now > startDeadline
      : endDeadline && now > endDeadline;

    if (!expired) continue;

    updates.push(
      recordDoc.ref.update({
        status: "absent",
        finalLabel: "欠席",
        finalized: true,
        autoFinalizedReason: hasStart
          ? "end_stamp_expired"
          : "start_stamp_expired",
        autoFinalizedAt: now,
        updatedAt: now,
      }),
    );
  }

  await Promise.all(updates);
}

function tokyoParts(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function timeMinutes(value) {
  const [hour, minute] = String(value || "")
    .split(":")
    .map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute)
    ? hour * 60 + minute
    : -1;
}

const CLASS_SELECTION_NONE = "__NONE__";

function normalizePeriodNumber(value) {
  const match = String(value || "")
    .normalize("NFKC")
    .match(/\d+/);

  return match ? Number(match[0]) : 0;
}

function toHalfWidthAlphabet(value) {
  return String(value || "").replace(/[Ａ-Ｚａ-ｚ]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0xfee0),
  );
}

function extractClassGroups(value) {
  if (!value) {
    return [];
  }

  const original = toHalfWidthAlphabet(String(value)).toUpperCase().trim();

  if (/^(全員|共通|合同|指定なし|なし|ALL)$/i.test(original)) {
    return [];
  }

  const text = original
    .replaceAll("クラス", "")
    .replaceAll("組", "")
    .replaceAll("班", "")
    .trim();

  if (!text) {
    return [];
  }

  const groups = [];

  /*
    A-D
    A〜D
    A～D
    */

  for (const match of text.matchAll(/([A-Z])\s*[-–—〜～]\s*([A-Z])/g)) {
    const start = match[1].charCodeAt(0);

    const end = match[2].charCodeAt(0);

    if (start <= end) {
      for (let code = start; code <= end; code++) {
        groups.push(String.fromCharCode(code));
      }
    }
  }

  /*
    Aクラス
    A/B
    A・B
    A,B
    */

  groups.push(...(text.match(/[A-Z]/g) || []));

  return [...new Set(groups)].sort();
}

function createClassSelectionKey(subject, date, period) {
  return (
    `${String(subject || "").trim()}_` +
    `${date}_` +
    `${normalizePeriodNumber(period)}`
  );
}

function normalizeClassSelection(value) {
  if (value && typeof value === "object") {
    return normalizeClassSelection(
      value.classGroup || value.class || value.value,
    );
  }

  const raw = String(value || "").trim();

  if (raw === CLASS_SELECTION_NONE) {
    return CLASS_SELECTION_NONE;
  }

  return extractClassGroups(raw)[0] || "";
}

function resolveClassSelection(selections, subject, date, period) {
  const periodNumber = normalizePeriodNumber(period);

  /*
    新形式を最優先。
    下は過去データ互換。
    */

  const keys = [
    createClassSelectionKey(subject, date, periodNumber),

    `${subject}_${date}_${periodNumber}限`,

    `${date}_${subject}_${periodNumber}`,
  ];

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(selections || {}, key)) {
      continue;
    }

    const selected = normalizeClassSelection(selections[key]);

    if (selected) {
      return selected;
    }
  }

  return "";
}

function mergeScheduleRows(rows, preferred) {
  if (!rows.length) {
    return null;
  }

  const merged = {
    ...rows[0],

    ...(preferred || {}),
  };

  const fields = [
    "subjectId",
    "subjectKey",
    "startTime",
    "endTime",
    "teacher",
    "building",
    "room",
    "testId",
  ];

  for (const field of fields) {
    if (String(merged[field] || "").trim()) {
      continue;
    }

    const row = rows.find((item) => String(item[field] || "").trim());

    if (row) {
      merged[field] = row[field];
    }
  }

  return merged;
}

async function sendClassSelectionNotification(
  userDoc,
  { date, subject, period, options },
) {
  const normalizedSubject = normalizeCourseName(subject);

  const dispatchId =
    `${userDoc.id}_` +
    `${date}_` +
    `${period}_` +
    `${encodeURIComponent(normalizedSubject || subject)}_class_selection`;

  const dispatchRef = db
    .collection("classSelectionNotificationDispatches")
    .doc(dispatchId);

  let claimed = false;

  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(dispatchRef);

    /*
            同じ日・科目・時限について
            1回だけ通知
            */

    if (existing.exists) {
      return;
    }

    transaction.create(dispatchRef, {
      userId: userDoc.id,

      date,

      subject,

      period,

      options,

      createdAt: new Date(),
    });

    claimed = true;
  });

  if (!claimed) {
    return;
  }

  const optionText = options.map((value) => `${value}クラス`).join("・");

  const query = new URLSearchParams({
    classSelection: "1",
    date,
    subject,
    period: String(period),
  }).toString();

  const payload = {
    title: "🏫 クラス選択が必要です",

    body:
      `${subject}（${period}限）でクラス分けがあります。` +
      `${optionText}・クラスなし から選択してください。`,

    url: `${SITE_URL}/index.html?${query}`,

    tag: `class-selection-${date}-${period}-${encodeURIComponent(subject)}`,
  };

  const results = await sendToUserDevices(userDoc.id, payload);

  await dispatchRef.update({
    results,
    sentAt: new Date(),
  });
}

// 個人時間割（公式PDF×履修科目）からだけ出席・退席通知を生成する。
async function processAttendanceNotifications() {
  webpush.setVapidDetails(
    "mailto:kidokohei.shonaniryo2517027@gmail.com",
    WEB_PUSH_PUBLIC_KEY.value(),
    WEB_PUSH_PRIVATE_KEY.value(),
  );
  const realClock = tokyoParts();
  const scheduleCache = new Map();
  const appSettings =
    (await db.collection("system").doc("app").get()).data() || {};
  const attendanceOverrides = appSettings.attendanceOverrides || {};
  const users = await db.collection("users").get();

  const processUser = async (userDoc) => {
    const user = userDoc.data() || {};
    await finalizeExpiredAttendanceRecords(userDoc, realClock.date);
    const testClock = user.attendanceTestClock || {};
    const testClockActive =
      userDoc.id === "2510044" &&
      testClock.enabled === true &&
      /^\d{4}-\d{2}-\d{2}$/.test(testClock.date || "") &&
      /^\d{2}:\d{2}$/.test(testClock.time || "") &&
      Date.parse(testClock.expiresAt || "") > Date.now();
    const clock = testClockActive
      ? {
          date: testClock.date,
          minutes: timeMinutes(testClock.time),
          test: true,
        }
      : realClock;
    const scheduleId = scheduleDocumentId(user);
    if (!scheduleId) return;
    if (!scheduleCache.has(scheduleId)) {
      scheduleCache.set(
        scheduleId,
        db.collection("schedule").doc(scheduleId).get().then(
          (snapshot) => snapshot.data() || {},
        ),
      );
    }
    const scheduleData = await scheduleCache.get(scheduleId);
    const enrolledSnap = await userDoc.ref.collection("enrolledSubjects").get();
    const enrolled = new Set();
    enrolledSnap.docs.forEach((doc) => {
      const item = doc.data();
      if (item.status === "removed") return;
      [doc.id, item.name, item.subjectKey, item.subjectId].forEach((value) => {
        const normalized = normalizeCourseName(value);
        if (normalized) enrolled.add(normalized);
      });
    });
    if (!enrolled.size) return;

    const day = (scheduleData.allDays || []).find(
      (item) => item.date === clock.date,
    );
    const schedules = [...(day?.schedules || [])];
    const notificationTest = user.attendanceNotificationTest || {};
    const notificationTestLectures = Array.isArray(notificationTest.lectures)
      ? notificationTest.lectures
      : [notificationTest];
    const notificationTestActive =
      userDoc.id === "2510044" &&
      notificationTest.enabled === true &&
      notificationTest.date === realClock.date &&
      Date.parse(notificationTest.expiresAt || "") > Date.now() &&
      notificationTestLectures.some((test) =>
        enrolled.has(normalizeCourseName(test.subject)),
      );
    if (notificationTestActive) {
      for (const test of notificationTestLectures) {
        if (!enrolled.has(normalizeCourseName(test.subject))) continue;
        schedules.push({
          subject: test.subject,
          grade: user.grade || "",
          period: test.period || 1,
          classGroup: test.classGroup || "",
          startTime: test.startTime,
          endTime: test.endTime,
          attendanceNotificationTest: true,
          testId: `${notificationTest.testId || "today"}_${test.period}_${test.classGroup || "all"}`,
        });
      }
    }

    const grade = normalizeGrade(user.grade);

    const classSelections = effectiveClassSelections(user);

    /*
        まず

        ・履修済み
        ・本人の学年

        だけにする。
        */

    const eligibleSchedules = schedules.filter((item) => {
      if (!enrolled.has(normalizeCourseName(item.subject))) {
        return false;
      }

      const itemGrade = normalizeGrade(item.grade);

      if (grade && itemGrade && itemGrade !== grade) {
        return false;
      }

      return true;
    });

    /*
        日付 × 科目 × 時限
        で講義をまとめる。

        同じ科目・同じ時限の
        A/B/Cクラスを1つの選択単位にする。
        */

    const lectureGroups = new Map();

    for (const rawItem of eligibleSchedules) {
      const subject = String(rawItem.subject || "").trim();

      const periodNumber = normalizePeriodNumber(rawItem.period);

      if (!subject || !periodNumber) {
        continue;
      }

      const lectureKey = `${clock.date}|${subject}|${periodNumber}`;

      if (!lectureGroups.has(lectureKey)) {
        lectureGroups.set(lectureKey, {
          date: clock.date,

          subject,

          period: periodNumber,

          rows: [],

          options: new Set(),
        });
      }

      const lectureGroup = lectureGroups.get(lectureKey);

      lectureGroup.rows.push(rawItem);

      extractClassGroups(rawItem.classGroup).forEach((value) =>
        lectureGroup.options.add(value),
      );
    }

    /*
        各「日付 × 科目 × 時限」を判定
        */

    for (const lectureGroup of lectureGroups.values()) {
      const options = [...lectureGroup.options].sort();

      const selectedClass = resolveClassSelection(
        classSelections,

        lectureGroup.subject,

        lectureGroup.date,

        lectureGroup.period,
      );

      /*
            classGroupが書かれている講義。

            候補がAだけでも
            クラス選択必須。
            */

      if (options.length > 0 && !selectedClass) {
        /*
                出席・退席通知はまだ送らない。

                先に
                「クラスを選んでください」
                Pushを送る。
                */

        await sendClassSelectionNotification(userDoc, {
          date: lectureGroup.date,

          subject: lectureGroup.subject,

          period: lectureGroup.period,

          options,
        });

        continue;
      }

      /*
            「クラスなし」

            → 本人は今日この講義を受けない。

            出席通知も退席通知も送らない。
            */

      if (selectedClass === CLASS_SELECTION_NONE) {
        continue;
      }

      let matchingRows = lectureGroup.rows;

      /*
            クラス分けされている場合は
            選択されたクラスだけ残す。
            */

      if (options.length > 0) {
        matchingRows = lectureGroup.rows.filter((row) => {
          const rowGroups = extractClassGroups(row.classGroup);

          /*
                            classGroupなしの補助情報行
                            */

          if (rowGroups.length === 0) {
            return true;
          }

          return rowGroups.includes(selectedClass);
        });
      }

      if (!matchingRows.length) {
        continue;
      }

      /*
            選択クラスの行を優先
            */

      const preferred =
        matchingRows.find((row) =>
          extractClassGroups(row.classGroup).includes(selectedClass),
        ) || matchingRows[0];

      const item = mergeScheduleRows(matchingRows, preferred);

      if (!item) {
        continue;
      }

      const periodNumber = lectureGroup.period;

      /*
            通知テストの場合は
            テスト専用scheduleIdを使う。
            */

      const recordScheduleId = item.attendanceNotificationTest
        ? `${scheduleId}_test_${item.testId}`
        : scheduleId;

      const recordId = slotId(
        recordScheduleId,
        clock.date,
        periodNumber,
        lectureGroup.subject,
      );

      const override = attendanceOverrides[recordId] || {};

      const defaults = PERIOD_TIMES[periodNumber] || {};

      const startTime =
        override.startTime || item.startTime || defaults.startTime;

      const endTime = override.endTime || item.endTime || defaults.endTime;

      if (!startTime || !endTime) {
        continue;
      }

      /*
            選択済みクラスを通知・打刻側へ渡す。

            クラス指定なしなら空欄。
            */

      const group = options.length > 0 ? selectedClass : "";

      const notificationType = attendanceNotificationType(
        clock.minutes,
        timeMinutes(startTime),
        timeMinutes(endTime),
      );

      if (!notificationType) {
        continue;
      }

      /*
             学生画面が保存する attendanceRecords を確認する。
             定時前に終了打刻済みなら、終了5分前通知は送らない。
            */
      const recordSnapshots = await userDoc.ref
        .collection("attendanceRecords")
        .where("date", "==", clock.date)
        .get();

      const record = recordSnapshots.docs.find((snapshot) => {
        const data = snapshot.data() || {};

        return (
          Number(data.period) === periodNumber &&
          data.subject === lectureGroup.subject &&
          Boolean(data.attendanceNotificationTest) ===
            Boolean(item.attendanceNotificationTest) &&
          (!item.attendanceNotificationTest || data.testId === item.testId)
        );
      });

      if (
        record &&
        (notificationType === "arrival" ||
          record.data().endStampedAt ||
          record.data().endKind)
      ) {
        continue;
      }

      const dispatchId =
        `${userDoc.id}_` +
        `${recordId}_` +
        `${notificationType}_` +
        `${encodeURIComponent(group || "all")}`;

      const dispatchRef = db
        .collection("attendanceNotificationDispatches")
        .doc(dispatchId);

      let claimed = false;
      let previousResults = [];

      await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(dispatchRef);

        if (existing.exists) {
          const previous = existing.data() || {};
          previousResults = Array.isArray(previous.results)
            ? previous.results
            : [];
          const lastAttemptAt =
            previous.claimedAt?.toMillis?.() ||
            previous.createdAt?.toMillis?.() ||
            0;
          if (!canRetryAttendanceDispatch(previousResults, lastAttemptAt, Date.now())) {
            return;
          }

          transaction.update(dispatchRef, {
            claimedAt: new Date(),
            attemptCount: FieldValue.increment(1),
          });
          claimed = true;
          return;
        }

        transaction.create(dispatchRef, {
          userId: userDoc.id,

          recordId,

          notificationType,

          group,

          testClock: clock.test === true,

          evaluatedDate: clock.date,

          evaluatedMinutes: clock.minutes,

          createdAt: new Date(),
          claimedAt: new Date(),
          attemptCount: 1,
        });

        claimed = true;
      });

      if (!claimed) {
        continue;
      }

      const query = new URLSearchParams({
        action: notificationType,

        recordId,

        scheduleId: recordScheduleId,

        date: clock.date,

        period: String(periodNumber),

        subject: lectureGroup.subject,

        classGroup: group,

        startTime,

        endTime,

        /*
                     テストの開始・終了打刻を同じ記録へ保存するため、
                     通知URLにもテストIDを渡す。
                    */
        testId: item.testId || "",

        notificationTest: item.attendanceNotificationTest ? "1" : "",
      }).toString();

      const label = group ? `（${group}クラス）` : "";

      const payload =
        notificationType === "arrival"
          ? {
              title: `📚 出席確認 ${label}`,

              body: `${lectureGroup.subject}：出席または欠席を選択してください`,

              url: `${SITE_URL}/attendance_check.html?${query}`,

              tag: `attendance-${recordId}-${encodeURIComponent(
                group || "all",
              )}`,
            }
          : {
              title: `🚪 退席確認 ${label}`,

              body: `${lectureGroup.subject}：退席または早退を選択してください`,

              url: `${SITE_URL}/attendance_check.html?${query}`,

              tag: `departure-${recordId}`,
            };

      const sentResults = previousResults.filter(
        (result) => result.result === "sent",
      );
      const attemptedResults = await sendToUserDevices(userDoc.id, payload, {
        excludeDeviceIds: sentResults.map((result) => result.deviceId),
      });
      const results = [...sentResults, ...attemptedResults];

      await dispatchRef.update({
        results,
        sentAt: new Date(),
      });

      /*
            テスト通知の場合は
            結果をユーザーdocへ保存
            */

      if (item.attendanceNotificationTest) {
        const testUpdate = {
          "attendanceNotificationTest.lastSentAt": new Date(),

          "attendanceNotificationTest.lastResults": results,
        };

        /*
         * テスト表示は、退席通知を送った瞬間から20分後に消す。
         */
        if (notificationType === "departure") {
          testUpdate["attendanceNotificationTest.departureSentAt"] = new Date();
        }

        await userDoc.ref.update(testUpdate);
      }
    }
  };

  // 学生ごとの通信を並行させ、後続学生の通知が予定時刻を過ぎないようにする。
  // 1人の処理失敗も他の学生へ波及させない。
  for (let index = 0; index < users.docs.length; index += 6) {
    const batch = users.docs.slice(index, index + 6);
    const outcomes = await Promise.allSettled(batch.map(processUser));
    outcomes.forEach((outcome, offset) => {
      if (outcome.status === "rejected") {
        console.error(
          `出席通知処理失敗: ${batch[offset].id}`,
          outcome.reason,
        );
      }
    });
  }
}

exports.sendAttendanceNotifications = onSchedule(
  {
    schedule: "* * * * *",
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
    timeoutSeconds: 180,
    secrets: [WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY],
  },
  processAttendanceNotifications,
);

// ======================
// 出席通知テスト
// 2510044だけに送信
// ======================

const { officialStartDate, statusRetentionDate } = require("./academic_lifecycle.js");

// 年度末確認は反映予定日まで回答だけを保存し、以降は未回答者の分を毎日適用する。
exports.applyAnnualTransitions = onSchedule(
  {
    schedule: "0 2 * * *",
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
  },
  async () => {
    const systemRef = db.collection("system").doc("app");
    const systemSnap = await systemRef.get();
    const transition = systemSnap.data()?.annualTransition;

    // 受付を停止しても、停止前に本人が確定した回答は予定日に反映する。
    if (!transition?.activationDate) return;

    const dateParts = new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const part = (type) => dateParts.find((item) => item.type === type)?.value;
    const japanToday = `${part("year")}-${part("month")}-${part("day")}`;

    if (String(transition.activationDate) > japanToday) return;

    const academicYear = Number(transition.academicYear);

    if (!Number.isInteger(academicYear)) {
      console.error("年度末確認の年度が不正です", transition);
      return;
    }

    const usersSnap = await db.collection("users").get();
    const commits = [];
    let batch = db.batch();
    let operations = 0;
    let appliedCount = 0;

    for (const userDoc of usersSnap.docs) {
      const user = userDoc.data();
      const response = user.annualTransitionResponse;

      if (
        Number(response?.academicYear) !== academicYear ||
        response?.decisionVersion !== 2 ||
        !["promote", "repeat", "graduate", "withdraw", "leave"].includes(
          response?.action,
        ) ||
        Number(user.annualProgression?.academicYear) === academicYear
      )
        continue;

      if ((!response.recommendedAction || response.action !== response.recommendedAction) &&
          !String(response.overrideReason || "").trim()) continue;

      const grade = Number(String(user.grade || "").replace("年", ""));
      const action = response.action;
      const entry = {
        academicYear,
        action,
        leaveStartDate: action === "leave" ? response.leaveStartDate : null,
        effectiveDate: ["graduate", "withdraw"].includes(action) ? response.effectiveDate : null,
        appliedAt: new Date().toISOString(),
        source: "student_annual_transition",
      };
      const changes = {
        annualProgression: entry,
        academicProgressionHistory: FieldValue.arrayUnion(entry),
        annualTransitionAppliedAt: new Date().toISOString(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (
        action === "promote" &&
        Number.isInteger(grade) &&
        grade >= 1 &&
        grade < 4
      ) {
        changes.grade = String(user.grade).includes("年")
          ? `${grade + 1}年`
          : String(grade + 1);
        changes.academicStatus = "active";
      } else if (action === "repeat") {
        changes.academicStatus = "repeat";
      } else if (action === "leave") {
        const leaveSince = officialStartDate(response.leaveStartDate);
        if (!leaveSince) continue;
        changes.academicStatus = "leave";
        changes.leaveSince = leaveSince;
        changes.leaveStartDate = response.leaveStartDate;
        changes.leaveAcademicYear = academicYear + 1;
        changes.leaveSemester = "前期";
      } else if (action === "graduate" && grade === 4) {
        const retention = statusRetentionDate(response.effectiveDate);
        if (!retention) continue;
        changes.academicStatus = "graduated";
        changes.graduatedAt = retention.officialAt;
        changes.scheduledDeleteAt = retention.deleteAt;
        changes.deletionLifecycleVersion = 1;
      } else if (action === "withdraw") {
        const retention = statusRetentionDate(response.effectiveDate);
        if (!retention) continue;
        changes.academicStatus = "withdrawn";
        changes.withdrawnAt = retention.officialAt;
        changes.scheduledDeleteAt = retention.deleteAt;
        changes.deletionLifecycleVersion = 1;
      } else continue;

      // 回答の変更と同時に反映処理が走っても、古い回答を適用しない。
      batch.update(userDoc.ref, changes, { lastUpdateTime: userDoc.updateTime });
      operations += 1;
      appliedCount += 1;

      if (operations === 450) {
        commits.push(batch.commit());
        batch = db.batch();
        operations = 0;
      }
    }

    if (operations > 0) commits.push(batch.commit());

    await Promise.all(commits);

    await systemRef.update({
      "annualTransition.appliedAt": new Date().toISOString(),
      "annualTransition.appliedCount": FieldValue.increment(appliedCount),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(
      `年度末確認を反映しました: ${academicYear}年度 ${appliedCount}件（未回答者のため受付継続）`,
    );
  },
);

exports.sendAttendanceTest = onRequest(
  {
    secrets: [WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY],
  },

  async (request, response) => {
    try {
      const studentNumber = "2510044";

      webpush.setVapidDetails(
        "mailto:kidokohei.shonaniryo2517027@gmail.com",
        WEB_PUSH_PUBLIC_KEY.value(),
        WEB_PUSH_PRIVATE_KEY.value(),
      );

      const payload = {
        title: "📅 出席打刻テスト",

        body: "成人看護学 打刻可能時間です\n出席しますか？",

        url: "https://doko2517027-bit.github.io/university-notifier-web/index.html?attendance=1&subject=成人看護学",
      };

      const results = await sendToUserDevices(studentNumber, payload);

      if (!results.length) {
        response.status(400).json({
          message: "通知を受け取れる登録端末がありません",
          results,
        });

        return;
      }

      response.json({
        message: "端末別Web Push送信完了",
        results,
      });
    } catch (error) {
      console.error("標準Web Push送信エラー:", error);

      response.status(500).send(error.message || "通知送信に失敗しました");
    }
  },
);

// ======================
// 出席確認待ちを管理者へ通知
// ======================

exports.notifyAttendanceReviewRequired = onDocumentUpdated(
  {
    document: "users/{studentNumber}/attendanceRecords/{recordId}",

    region: "asia-northeast1",

    secrets: [WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY],
  },

  async (event) => {
    const before = event.data.before.data() || {};

    const after = event.data.after.data() || {};

    if (
      after.earlyEndReviewRequired !== true ||
      after.earlyEndReviewStatus !== "pending" ||
      before.earlyEndReviewStatus === "pending"
    ) {
      return;
    }

    webpush.setVapidDetails(
      "mailto:kidokohei.shonaniryo2517027@gmail.com",
      WEB_PUSH_PUBLIC_KEY.value(),
      WEB_PUSH_PRIVATE_KEY.value(),
    );

    const payload = {
      title: "⚠️ 出席確認待ち",

      body:
        `${after.studentNumber || event.params.studentNumber}：` +
        `${after.subject || "科目未設定"} の確認が必要です`,

      url: `${SITE_URL}/attendance_admin.html`,
    };

    const admins = await db.collection("admins").get();

    await Promise.all(
      admins.docs.map((admin) => sendToUserDevices(admin.id, payload)),
    );
  },
);

// ======================
// テスト問題の答え違い報告
// 管理者全員へWeb Pushを送信
// ======================

exports.notifyQuestionAnswerReport = onDocumentCreated(
  {
    document: "reports/{reportId}",
    region: "asia-northeast1",
    secrets: [WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY],
  },

  async (event) => {
    const snapshot = event.data;

    if (!snapshot) {
      return;
    }

    const report = snapshot.data();

    if (report.type !== "questionAnswer") {
      return;
    }

    webpush.setVapidDetails(
      "mailto:kidokohei.shonaniryo2517027@gmail.com",
      WEB_PUSH_PUBLIC_KEY.value(),
      WEB_PUSH_PRIVATE_KEY.value(),
    );

    const adminSnapshot = await db.collection("admins").get();

    const payload = JSON.stringify({
      title: "⚠️ テスト問題の答え違い報告",
      body:
        `${report.questionType || "問題"}：` +
        `${String(report.question || "").slice(0, 80)}`,
      url: "https://doko2517027-bit.github.io/university-notifier-web/admin.html",
    });

    const notificationTargets = [];

    for (const adminDoc of adminSnapshot.docs) {
      const userRef = db.collection("users").doc(adminDoc.id);
      const deviceSnapshot = await userRef
        .collection("pushSubscriptions")
        .get();
      const seenEndpoints = new Set();

      for (const deviceDoc of deviceSnapshot.docs) {
        const subscription = deviceDoc.data();

        if (
          subscription?.endpoint &&
          !seenEndpoints.has(subscription.endpoint)
        ) {
          seenEndpoints.add(subscription.endpoint);
          notificationTargets.push({
            adminId: adminDoc.id,
            deviceId: deviceDoc.id,
            subscription,
            deviceRef: deviceDoc.ref,
          });
        }
      }

      // 端末別データがまだない利用者は旧形式を利用する。
      if (
        notificationTargets.every((target) => target.adminId !== adminDoc.id)
      ) {
        const userSnapshot = await userRef.get();
        const legacySubscription =
          userSnapshot.data()?.pushSubscription ||
          userSnapshot.data()?.subscription;

        if (legacySubscription?.endpoint) {
          notificationTargets.push({
            adminId: adminDoc.id,
            deviceId: "legacy",
            subscription: legacySubscription,
            deviceRef: null,
          });
        }
      }
    }

    const results = await Promise.all(
      notificationTargets.map(async (target) => {
        const { adminId, deviceId, subscription, deviceRef } = target;

        if (
          !subscription?.endpoint ||
          !subscription?.keys?.p256dh ||
          !subscription?.keys?.auth
        ) {
          return {
            adminId,
            deviceId,
            result: "invalid",
          };
        }

        try {
          await webpush.sendNotification(subscription, payload);
          return { adminId, deviceId, result: "sent" };
        } catch (error) {
          const statusCode = error?.statusCode || null;

          if (deviceRef && (statusCode === 404 || statusCode === 410)) {
            await deviceRef.delete();
          }

          return {
            adminId,
            deviceId,
            result:
              statusCode === 404 || statusCode === 410 ? "expired" : "failed",
            statusCode,
          };
        }
      }),
    );

    await snapshot.ref.update({
      notificationSentAt: new Date(),
      notificationResults: results,
    });
  },
);

// ======================
// CareMate お知らせの即時通知
// ======================

exports.notifySystemNews = onDocumentCreated(
  {
    document: "systemNews/{newsId}",
    region: "asia-northeast1",
    secrets: [WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY],
  },

  async (event) => {
    const snapshot = event.data;

    if (!snapshot) {
      return;
    }

    const news = snapshot.data() || {};

    if (
      news.notifyTarget !== "allUsers" ||
      news.notificationRequested === false ||
      news.notificationSentAt
    ) {
      return;
    }

    webpush.setVapidDetails(
      "mailto:kidokohei.shonaniryo2517027@gmail.com",
      WEB_PUSH_PUBLIC_KEY.value(),
      WEB_PUSH_PRIVATE_KEY.value(),
    );

    const title = String(news.title || "CareMateからのお知らせ").trim();

    const body = String(news.body || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140);

    const users = await db.collection("users").get();
    const userResults = [];

    for (const userDoc of users.docs) {
      const user = userDoc.data() || {};

      if (user.notificationSettings?.systemNews === false) {
        userResults.push({
          studentNumber: userDoc.id,
          result: "skipped",
        });
        continue;
      }

      const results = await sendToUserDevices(userDoc.id, {
        title: `💙 ${title}`,
        body: body || "CareMateから新しいお知らせがあります。",
        url: `${SITE_URL}/news.html?systemNews=${encodeURIComponent(event.params.newsId)}`,
        tag: `system-news-${event.params.newsId}`,
      });

      userResults.push({
        studentNumber: userDoc.id,
        results,
      });
    }

    await snapshot.ref.update({
      notificationSentAt: new Date(),
      notificationResults: userResults,
      notificationSource: "firebase",
    });
  },
);

// お知らせの本文・タイトル・重要設定が編集された場合も即時に知らせる。
exports.notifySystemNewsUpdated = onDocumentUpdated(
  {
    document: "systemNews/{newsId}",
    region: "asia-northeast1",
    secrets: [WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY],
  },
  async (event) => {
    const before = event.data?.before.data() || {};
    const after = event.data?.after.data() || {};
    const changed =
      before.title !== after.title ||
      before.body !== after.body ||
      before.important !== after.important;

    if (
      !changed ||
      after.notifyTarget !== "allUsers" ||
      after.notificationRequested === false
    ) {
      return;
    }

    webpush.setVapidDetails(
      "mailto:kidokohei.shonaniryo2517027@gmail.com",
      WEB_PUSH_PUBLIC_KEY.value(),
      WEB_PUSH_PRIVATE_KEY.value(),
    );

    const title = String(after.title || "CareMateからのお知らせ").trim();
    const body = String(after.body || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140);
    const users = await db.collection("users").get();
    const userResults = [];

    for (const userDoc of users.docs) {
      const user = userDoc.data() || {};
      if (user.notificationSettings?.systemNews === false) {
        userResults.push({ studentNumber: userDoc.id, result: "skipped" });
        continue;
      }
      userResults.push({
        studentNumber: userDoc.id,
        results: await sendToUserDevices(userDoc.id, {
          title: `💙 更新：${title}`,
          body: body || "CareMateのお知らせが更新されました。",
          url: `${SITE_URL}/news.html?systemNews=${encodeURIComponent(event.params.newsId)}`,
          tag: `system-news-update-${event.params.newsId}`,
        }),
      });
    }

    await event.data.after.ref.update({
      lastEditNotificationSentAt: new Date(),
      lastEditNotificationResults: userResults,
      notificationSource: "firebase",
    });
  },
);

async function syncTargetedSystemNewsForStudent(studentNumber, user = null) {
  const userData = user || (await db.collection("users").doc(studentNumber).get()).data() || {};
  const [newsSnapshot, inboxSnapshot] = await Promise.all([
    db.collection("targetedSystemNews").get(),
    db.collection("users").doc(studentNumber).collection("targetedSystemNews").get(),
  ]);
  const existingIds = new Set(inboxSnapshot.docs.map((item) => item.id));
  const matchedIds = new Set();
  const writes = [];

  newsSnapshot.docs.forEach((newsDocument) => {
    const news = newsDocument.data() || {};
    if (
      !targetedSystemNewsMatchesStudent(news, studentNumber, userData) &&
      !targetedSystemNewsPredatesRegistration(news, userData)
    ) return;
    matchedIds.add(newsDocument.id);
    if (!existingIds.has(newsDocument.id)) {
      writes.push(
        db.collection("users").doc(studentNumber)
          .collection("targetedSystemNews").doc(newsDocument.id)
          .set(targetedSystemNewsCopy(news, newsDocument.id)),
      );
    }
  });

  inboxSnapshot.docs.forEach((inboxDocument) => {
    if (!matchedIds.has(inboxDocument.id)) writes.push(inboxDocument.ref.delete());
  });
  await Promise.all(writes);
  return { addedCount: writes.length, visibleCount: matchedIds.size };
}

// 登録直後や過去に一時的な配信失敗があった学生も、自分宛のお知らせを復元できる。
exports.syncTargetedSystemNewsInbox = onCall(
  { region: "asia-northeast1", cors: [SITE_ORIGIN] },
  async (request) => {
    const studentNumber = requireAuthenticatedCareMateStudent(request);
    return syncTargetedSystemNewsForStudent(studentNumber);
  },
);

// 投稿後に登録した学生でも、学年・除外条件に一致すれば受信箱へ追加する。
exports.backfillTargetedSystemNewsForNewUser = onDocumentCreated(
  { document: "users/{studentNumber}", region: "asia-northeast1" },
  async (event) => {
    const studentNumber = String(event.params.studentNumber || "");
    if (!/^\d{7}$/.test(studentNumber) || !event.data) return;
    await syncTargetedSystemNewsForStudent(studentNumber, event.data.data() || {});
  },
);

// 指定学生向けCareMateお知らせは、対象学生の専用受信箱へだけ複製して通知する。
exports.deliverTargetedSystemNews = onDocumentCreated(
  {
    document: "targetedSystemNews/{newsId}",
    region: "asia-northeast1",
    secrets: [WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const news = snapshot.data() || {};
    const users = await db.collection("users").get();
    const recipients = users.docs.filter((userDocument) =>
      targetedSystemNewsMatchesStudent(
        news,
        userDocument.id,
        userDocument.data() || {},
      ),
    );
    webpush.setVapidDetails(
      "mailto:kidokohei.shonaniryo2517027@gmail.com",
      WEB_PUSH_PUBLIC_KEY.value(),
      WEB_PUSH_PRIVATE_KEY.value(),
    );
    const title = String(news.title || "CareMateからのお知らせ").trim();
    const body = String(news.body || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140);
    const results = [];
    await Promise.all(
      recipients.map(async (userDocument) => {
        const userId = userDocument.id;
        await db
          .collection("users")
          .doc(userId)
          .collection("targetedSystemNews")
          .doc(event.params.newsId)
          .set(targetedSystemNewsCopy(news, event.params.newsId));
        const user = userDocument.data() || {};
        if (
          news.notificationRequested !== false &&
          user.notificationSettings?.systemNews !== false
        ) {
          results.push({
            studentNumber: userId,
            results: await sendToUserDevices(userId, {
              title: `💙 ${title}`,
              body: body || "CareMateから新しいお知らせがあります。",
              url: `${SITE_URL}/news.html?systemNews=${encodeURIComponent(event.params.newsId)}`,
              tag: `targeted-system-news-${event.params.newsId}`,
            }),
          });
        }
      }),
    );
    await snapshot.ref.update({
      notificationSentAt: new Date(),
      notificationResults: results,
      notificationSource: "firebase",
    });
  },
);

// 本文や対象条件を編集した時も学生側のコピーを同じ内容・対象へ同期する。
exports.syncUpdatedTargetedSystemNews = onDocumentUpdated(
  {
    document: "targetedSystemNews/{newsId}",
    region: "asia-northeast1",
    secrets: [WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY],
  },
  async (event) => {
    const before = event.data?.before.data() || {};
    const after = event.data?.after.data() || {};
    const contentUnchanged =
      targetedSystemNewsContentSignature(before) ===
      targetedSystemNewsContentSignature(after);
    const editNotificationRequested =
      timestampMillis(after.editNotificationRequestedAt) > 0 &&
      timestampMillis(after.editNotificationRequestedAt) !==
        timestampMillis(before.editNotificationRequestedAt) &&
      after.notificationRequested !== false;
    if (contentUnchanged && !editNotificationRequested) return;

    const users = await db.collection("users").get();
    const recipients = [];
    await Promise.all(users.docs.map(async (userDocument) => {
      const destination = userDocument.ref
        .collection("targetedSystemNews")
        .doc(event.params.newsId);
      const userData = userDocument.data() || {};
      if (
        targetedSystemNewsMatchesStudent(
          after,
          userDocument.id,
          userData,
        ) || targetedSystemNewsPredatesRegistration(after, userData)
      ) {
        await destination.set(
          targetedSystemNewsCopy(after, event.params.newsId),
          { merge: true },
        );
        if (targetedSystemNewsMatchesStudent(after, userDocument.id, userData)) {
          recipients.push(userDocument);
        }
      } else {
        await destination.delete();
      }
    }));

    if (editNotificationRequested) {
      webpush.setVapidDetails(
        "mailto:kidokohei.shonaniryo2517027@gmail.com",
        WEB_PUSH_PUBLIC_KEY.value(),
        WEB_PUSH_PRIVATE_KEY.value(),
      );
      const title = String(after.title || "CareMateからのお知らせ").trim();
      const body = String(after.body || "").replace(/\s+/g, " ").trim().slice(0, 140);
      const results = [];
      for (const userDocument of recipients) {
        const userData = userDocument.data() || {};
        if (userData.notificationSettings?.systemNews === false) {
          results.push({ studentNumber: userDocument.id, result: "skipped" });
          continue;
        }
        results.push({
          studentNumber: userDocument.id,
          results: await sendToUserDevices(userDocument.id, {
            title: `💙 更新：${title}`,
            body: body || "CareMateのお知らせが更新されました。",
            url: `${SITE_URL}/news.html?systemNews=${encodeURIComponent(event.params.newsId)}`,
            tag: `targeted-system-news-update-${event.params.newsId}`,
          }),
        });
      }
      await event.data.after.ref.update({
        lastEditNotificationSentAt: new Date(),
        lastEditNotificationResults: results,
        notificationSource: "firebase",
      });
    }
  },
);

// 指定先お知らせを削除した時は、学生ごとの受信箱からも表示を消す。
exports.removeTargetedSystemNewsCopies = onDocumentDeleted(
  { document: "targetedSystemNews/{newsId}", region: "asia-northeast1" },
  async (event) => {
    const users = await db.collection("users").get();
    await Promise.all(users.docs.map((userDocument) => userDocument.ref
      .collection("targetedSystemNews").doc(event.params.newsId).delete()));
  },
);

// 新規お問い合わせは担当者 2510044 の全登録端末にだけ通知する。
exports.notifyContactMessage = onDocumentCreated(
  {
    document: "contacts/{contactId}",
    region: "asia-northeast1",
    secrets: [WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const contact = snapshot.data();
    webpush.setVapidDetails(
      "mailto:kidokohei.shonaniryo2517027@gmail.com",
      WEB_PUSH_PUBLIC_KEY.value(),
      WEB_PUSH_PRIVATE_KEY.value(),
    );
    const results = await sendToUserDevices("2510044", {
      title: "📨 CareMate お問い合わせ",
      body: `${contact.category || "お問い合わせ"}：${String(contact.message || "添付ファイル").slice(0, 80)}`,
      url: `${SITE_URL}/contact_admin.html?contactId=${event.params.contactId}`,
    });
    await snapshot.ref.update({
      notificationSentAt: new Date(),
      notificationResults: results,
    });
  },
);

// 個別チャットの新着を、学生または担当管理者へ即時に知らせる。
exports.notifyContactChatMessage = onDocumentCreated(
  {
    document: "contacts/{contactId}/messages/{messageId}",
    region: "asia-northeast1",
    secrets: [WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const message = snapshot.data();
    const contactSnap = await db
      .collection("contacts")
      .doc(event.params.contactId)
      .get();
    const contact = contactSnap.data();
    if (!contact?.studentNumber) return;
    webpush.setVapidDetails(
      "mailto:kidokohei.shonaniryo2517027@gmail.com",
      WEB_PUSH_PUBLIC_KEY.value(),
      WEB_PUSH_PRIVATE_KEY.value(),
    );
    const isAdminMessage = message.senderRole === "admin";
    const recipient = isAdminMessage
      ? String(contact.studentNumber)
      : "2510044";
    const url = isAdminMessage
      ? `${SITE_URL}/contact_chat.html?contactId=${event.params.contactId}`
      : `${SITE_URL}/contact_admin.html?contactId=${event.params.contactId}`;
    const results = await sendToUserDevices(recipient, {
      title: isAdminMessage
        ? "💬 CareMate お問い合わせ"
        : "📨 CareMate お問い合わせ",
      body: isAdminMessage
        ? "管理者から返信があります"
        : `学生から返信があります：${String(message.body || "添付ファイル").slice(0, 80)}`,
      url,
    });
    await snapshot.ref.update({
      notificationSentAt: new Date(),
      notificationResults: results,
    });
  },
);
