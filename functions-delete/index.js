const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { getDatabase } = require("firebase-admin/database");

if (!getApps().length) {
  initializeApp({
    databaseURL: "https://universitynotifier-67517-default-rtdb.firebaseio.com",
  });
}

const db = getFirestore();
const auth = getAuth();
const realtimeDb = getDatabase();

exports.deleteCareMateUser = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    const actor = String(request.auth?.token?.studentNumber || "");
    const target = String(request.data?.studentNumber || "").trim();

    if (request.auth?.token?.admin !== true || actor !== "2510044") {
      throw new HttpsError(
        "permission-denied",
        "この操作を実行できる管理者ではありません。",
      );
    }
    if (!/^\d{7}$/.test(target)) {
      throw new HttpsError("invalid-argument", "学籍番号が正しくありません。");
    }
    if (target === actor) {
      throw new HttpsError(
        "failed-precondition",
        "ログイン中の管理者自身は削除できません。",
      );
    }

    const removeDocument = (reference) => db.recursiveDelete(reference);
    const removeMatches = async (collectionName) => {
      const records = await db
        .collection(collectionName)
        .where("studentNumber", "==", target)
        .get();
      await Promise.all(
        records.docs.map((record) => removeDocument(record.ref)),
      );
      return records.size;
    };
    const directCollections = [
      "users",
      "publicUsers",
      "courseLinks",
      "courseNews",
      "userPresence",
      "attendance",
      "attendancePreferences",
      "attendanceRecords",
      "examProgress",
      "subjectPoints",
      "totalRanking",
      "userDeviceSessions",
    ];

    await Promise.all(
      directCollections.map((name) =>
        removeDocument(db.collection(name).doc(target)),
      ),
    );
    const [contacts, featureRequests] = await Promise.all([
      removeMatches("contacts"),
      removeMatches("featureRequests"),
    ]);
    await realtimeDb.ref(`status/${target}`).remove();
    try {
      await auth.deleteUser(`caremate-${target}`);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }
    return { ok: true, contacts, featureRequests };
  },
);
