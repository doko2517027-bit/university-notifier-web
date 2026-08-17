const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();

const auth = getAuth();
const db = getFirestore();
const ROLES = new Set(["administrator", "doctor", "nurse", "pharmacist", "pt", "ot", "st", "clerk", "auditor"]);

function requireClinicalOwner(request) {
  if (request.auth?.token?.admin !== true || request.auth?.token?.studentNumber !== "2510044") {
    throw new HttpsError("permission-denied", "Clinical管理者ではありません。");
  }
}

exports.configureClinicalStaff = onCall({ region: "asia-northeast1" }, async request => {
  requireClinicalOwner(request);
  const uid = String(request.data?.uid || "").trim();
  const hospitalId = String(request.data?.hospitalId || "").trim();
  const role = String(request.data?.role || "").trim();
  const active = request.data?.active !== false;
  if (!uid || !/^[A-Za-z0-9_-]{3,80}$/.test(hospitalId) || !ROLES.has(role)) {
    throw new HttpsError("invalid-argument", "職員・施設・職種の指定が正しくありません。");
  }
  const user = await auth.getUser(uid);
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
