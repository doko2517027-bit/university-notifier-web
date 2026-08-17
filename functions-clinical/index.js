const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const crypto = require("crypto");

if (!getApps().length) initializeApp();

const auth = getAuth();
const db = getFirestore();
const ROLES = new Set(["administrator", "doctor", "nurse", "pharmacist", "pt", "ot", "st", "clerk", "auditor"]);

exports.authenticateClinical = onCall({ region: "asia-northeast1" }, async request => {
  const staffId = String(request.data?.studentNumber || "").trim();
  const password = String(request.data?.password || "");
  if (!/^\d{7}$/.test(staffId) || !password) {
    throw new HttpsError("invalid-argument", "職員IDとパスワードを入力してください。");
  }
  const staff = await db.doc(`users/${staffId}`).get();
  const storedHash = String(staff.data()?.appPasswordHash || "");
  const suppliedHash = crypto.createHash("sha256").update(password, "utf8").digest("hex");
  if (!staff.exists || storedHash.length !== suppliedHash.length || !crypto.timingSafeEqual(Buffer.from(storedHash, "utf8"), Buffer.from(suppliedHash, "utf8"))) {
    throw new HttpsError("unauthenticated", "職員IDまたはパスワードが違います。");
  }
  const user = await auth.getUser(`caremate-${staffId}`);
  const claims = user.customClaims || {};
  if (claims.clinical !== true || !ROLES.has(String(claims.clinicalRole || ""))) {
    throw new HttpsError("permission-denied", "Clinical権限が設定されていません。");
  }
  const token = await auth.createCustomToken(user.uid, {
    studentNumber: staffId,
    clinical: true,
    clinicalRole: claims.clinicalRole,
    clinicalHospitalId: claims.clinicalHospitalId
  });
  return { token, role: claims.clinicalRole, hospitalId: claims.clinicalHospitalId };
});

function requireClinicalOwner(request) {
  if (request.auth?.token?.admin !== true || request.auth?.token?.studentNumber !== "2510044") {
    throw new HttpsError("permission-denied", "Clinical管理者ではありません。");
  }
}

exports.configureClinicalStaff = onCall({ region: "asia-northeast1" }, async request => {
  requireClinicalOwner(request);
  const staffId = String(request.data?.staffId || request.data?.uid || "").trim();
  const uid = /^\d{7}$/.test(staffId) ? `caremate-${staffId}` : staffId;
  const hospitalId = String(request.data?.hospitalId || "").trim();
  const role = String(request.data?.role || "").trim();
  const active = request.data?.active !== false;
  if (!uid || !/^[A-Za-z0-9_-]{3,80}$/.test(hospitalId) || !ROLES.has(role)) {
    throw new HttpsError("invalid-argument", "職員・施設・職種の指定が正しくありません。");
  }
  let user;
  try {
    user = await auth.getUser(uid);
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      throw new HttpsError("not-found", "指定した職員IDのCareMateアカウントが見つかりません。");
    }
    throw error;
  }
  const claims = { ...(user.customClaims || {}) };
  claims.clinical = Boolean(active);
  claims.clinicalHospitalId = active ? hospitalId : null;
  claims.clinicalRole = active ? role : null;
  await auth.setCustomUserClaims(uid, claims);
  await db.doc(`clinicalControl/${hospitalId}/staff/${uid}`).set({
    uid, role, active, updatedAt: FieldValue.serverTimestamp(), updatedBy: "2510044"
  }, { merge: true });
  await db.collection(`clinicalControl/${hospitalId}/audit`).add({
    action: active ? "staff_granted" : "staff_revoked", targetUid: uid, role,
    occurredAt: FieldValue.serverTimestamp(), actorStudentNumber: "2510044"
  });
  return { ok: true };
});
