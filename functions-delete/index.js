const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { getDatabase } = require("firebase-admin/database");

let services;

function getServices() {
  if (services) return services;
  if (!getApps().length) {
    initializeApp({
      databaseURL: "https://universitynotifier-67517-default-rtdb.firebaseio.com",
    });
  }
  services = {
    db: getFirestore(),
    auth: getAuth(),
    realtimeDb: getDatabase(),
  };
  return services;
}

async function deleteUserData(target) {
  const { db, auth, realtimeDb } = getServices();
  // Cloudinary画像は管理者が手動削除し、それ以外のCareMateデータを削除する。
  const removeDocument = (reference) => db.recursiveDelete(reference);
  const removeMatches = async (collectionName, fieldName) => {
    const records = await db.collection(collectionName).where(fieldName, "==", target).get();
    await Promise.all(records.docs.map((record) => removeDocument(record.ref)));
    return records.size;
  };
  const directCollections = [
    "publicUsers", "admins", "developers", "assignments",
    "courseLinks", "courseNews", "userPresence", "attendance",
    "attendancePreferences", "attendanceRecords", "examProgress",
    "subjectPoints", "totalRanking", "userDeviceSessions",
    "userDeviceAccess", "calendarAssignments",
    "calendarReminderPreferences", "digitalNotes", "clinicalTraining",
    "referralAccounts", "referralPrivateRewards",
  ];
  await Promise.all(directCollections.map((name) => removeDocument(db.collection(name).doc(target))));
  const [contacts, featureRequests, calendarEvents, reports, calendarDispatches, referralCodes] = await Promise.all([
    removeMatches("contacts", "studentNumber"),
    removeMatches("featureRequests", "studentNumber"),
    removeMatches("calendarEvents", "ownerId"),
    removeMatches("reports", "reporterStudentNumber"),
    removeMatches("calendarReminderDispatches", "userId"),
    removeMatches("referralCodes", "inviterStudentNumber"),
  ]);
  // 日別ランキングは日付を親文書、学籍番号を子文書IDとして保持している。
  const rankingDays = await db.collection("dailyRanking").listDocuments();
  for (let index = 0; index < rankingDays.length; index += 25) {
    await Promise.all(rankingDays.slice(index, index + 25)
      .map((dayRef) => removeDocument(dayRef.collection("users").doc(target))));
  }
  await realtimeDb.ref(`status/${target}`).remove();
  try {
    await auth.deleteUser(`caremate-${target}`);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
  }
  // 再試行の起点となるusers文書は最後に消す。
  await removeDocument(db.collection("users").doc(target));
  return { contacts, featureRequests, calendarEvents, reports, calendarDispatches, referralCodes };
}

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

    return { ok: true, ...(await deleteUserData(target)) };
  },
);
