function officialDateMillis(value) {
  const date = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const millis = new Date(`${date}T00:00:00+09:00`).getTime();
  if (!Number.isFinite(millis)) return null;
  const roundTrip = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(millis));
  return roundTrip === date ? millis : null;
}

function isPurgeEligible(profile, now = Date.now()) {
  if (
    profile?.deletionLifecycleVersion !== 1 ||
    !["graduated", "withdrawn"].includes(profile?.academicStatus)
  ) return false;
  const officialDate = profile.academicStatus === "graduated"
    ? profile.graduatedAt
    : profile.withdrawnAt;
  const dateMillis = officialDateMillis(officialDate);
  const scheduledMillis = Date.parse(profile.scheduledDeleteAt || "");
  if (dateMillis === null || !Number.isFinite(scheduledMillis)) return false;
  const expectedDeletion = dateMillis + 30 * 86400000;
  return scheduledMillis === expectedDeletion && now >= expectedDeletion;
}

async function deleteCareMateDataExceptExternalMedia({ db, auth, realtimeDb }, target) {
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
    "mateTalkProfiles", "mateTalkPrivateProfiles", "mateTalkSchedulePrivacy",
    "mateTalkRateLimits", "referralHistory", "referralIdentityRegistry",
  ];
  await Promise.all(directCollections.map((name) =>
    removeDocument(db.collection(name).doc(target))));
  const matches = await Promise.all([
    removeMatches("contacts", "studentNumber"),
    removeMatches("calendarEvents", "ownerId"),
    removeMatches("reports", "reporterStudentNumber"),
    removeMatches("calendarReminderDispatches", "userId"),
    removeMatches("referralCodes", "inviterStudentNumber"),
    removeMatches("referralManualAdjustments", "studentNumber"),
    removeMatches("referralRewardDeletions", "studentNumber"),
    removeMatches("referralRegistrationProofs", "studentNumber"),
    removeMatches("referralRegistrationProofs", "inviterStudentNumber"),
    removeMatches("externalAuthChecks", "studentNumber"),
    removeMatches("mateTalkExchangeIds", "studentNumber"),
    removeMatches("mateTalkQrTokens", "studentNumber"),
  ]);
  // A room belongs to all its participants. Removing a departing account removes
  // the whole room (including nested text/photo messages) for every participant.
  const talkRooms = await db.collection("mateTalkRooms")
    .where("participants", "array-contains", target).get();
  await Promise.all(talkRooms.docs.map((room) => removeDocument(room.ref)));

  // Contact conversations also contain nested messages and possible attachments.
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
  await removeDocument(db.collection("users").doc(target));
  return { deletedMateTalkRooms: talkRooms.size, deletedContacts: matches[0], matchedRecords: matches.reduce((sum, count) => sum + count, 0) };
}

module.exports = {
  deleteCareMateDataExceptExternalMedia,
  isPurgeEligible,
  officialDateMillis,
};
