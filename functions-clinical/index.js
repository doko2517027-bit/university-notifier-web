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
    admin: claims.admin === true,
    clinical: true,
    clinicalRole: claims.clinicalRole,
    clinicalHospitalId: claims.clinicalHospitalId
  });
  return { token, role: claims.clinicalRole, hospitalId: claims.clinicalHospitalId };
});

function requireClinicalOwner(request) {
  if (request.auth?.token?.studentNumber !== "2510044") {
    throw new HttpsError("permission-denied", "Clinical管理者ではありません。");
  }
}

function requireCareMateRegistrant(request) {
  const staffId = String(request.auth?.token?.studentNumber || "");
  if (!request.auth || !/^\d{7}$/.test(staffId)) {
    throw new HttpsError("unauthenticated", "CareMateへログインしてから病院登録を行ってください。");
  }
  return staffId;
}

async function requireHospitalAdministrator(request, hospitalId) {
  const actor = request.auth?.token || {};
  const hospitalOwner = actor.clinical === true && actor.clinicalRole === "administrator" && actor.clinicalHospitalId === hospitalId;
  if (!hospitalOwner) {
    throw new HttpsError("permission-denied", "この病院の管理者ではありません。");
  }
  return String(actor.studentNumber || "");
}

exports.createClinicalHospital = onCall({ region: "asia-northeast1" }, async request => {
  const administratorId = requireCareMateRegistrant(request);
  const hospitalId = String(request.data?.hospitalId || "").trim();
  const hospitalName = String(request.data?.hospitalName || "").trim();
  if (!/^[A-Za-z0-9_-]{3,80}$/.test(hospitalId) || !hospitalName) {
    throw new HttpsError("invalid-argument", "病院名または病院IDが正しくありません。");
  }
  const configRef = db.doc("clinicalControl/config");
  if ((await configRef.get()).exists) {
    throw new HttpsError("already-exists", "病院アカウントはすでに作成されています。");
  }
  let administrator;
  try {
    administrator = await auth.getUser(`caremate-${administratorId}`);
  } catch (error) {
    if (error?.code === "auth/user-not-found") throw new HttpsError("not-found", "病院管理者のCareMateアカウントが見つかりません。");
    throw error;
  }
  await auth.setCustomUserClaims(administrator.uid, { ...(administrator.customClaims || {}), clinical: true, clinicalRole: "administrator", clinicalHospitalId: hospitalId });
  const now = FieldValue.serverTimestamp();
  await db.doc(`clinicalHospitals/${hospitalId}`).set({ hospitalId, hospitalName, administratorId, administratorUid: administrator.uid, status: "active", createdAt: now, createdBy: administratorId, updatedAt: now });
  await db.doc(`clinicalHospitals/${hospitalId}/staff/${administrator.uid}`).set({ uid: administrator.uid, staffId: administratorId, role: "administrator", active: true, updatedAt: now, updatedBy: administratorId });
  await db.doc(`clinicalHospitals/${hospitalId}/audit/hospital_created`).set({ action: "hospital_created", hospitalName, administratorId, occurredAt: now, actorStudentNumber: administratorId });
  await configRef.set({ hospitalId, hospitalName, createdAt: now, status: "active" });
  return { ok: true, hospitalId };
});

exports.configureClinicalStaff = onCall({ region: "asia-northeast1" }, async request => {
  const staffId = String(request.data?.staffId || request.data?.uid || "").trim();
  const uid = /^\d{7}$/.test(staffId) ? `caremate-${staffId}` : staffId;
  const hospitalId = String(request.data?.hospitalId || "").trim();
  const role = String(request.data?.role || "").trim();
  const active = request.data?.active !== false;
  if (!uid || !/^[A-Za-z0-9_-]{3,80}$/.test(hospitalId) || !ROLES.has(role)) {
    throw new HttpsError("invalid-argument", "職員・施設・職種の指定が正しくありません。");
  }
  if (role === "administrator") {
    throw new HttpsError("failed-precondition", "病院管理者は病院作成時に設定した一人だけです。");
  }
  const actorStudentNumber = await requireHospitalAdministrator(request, hospitalId);
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
  await db.doc(`clinicalHospitals/${hospitalId}/staff/${uid}`).set({
    uid, staffId, role, active, updatedAt: FieldValue.serverTimestamp(), updatedBy: actorStudentNumber
  }, { merge: true });
  await db.collection(`clinicalHospitals/${hospitalId}/audit`).add({
    action: active ? "staff_granted" : "staff_revoked", targetUid: uid, role,
    occurredAt: FieldValue.serverTimestamp(), actorStudentNumber
  });
  return { ok: true };
});

exports.listClinicalStaff = onCall({ region: "asia-northeast1" }, async request => {
  const hospitalId = String(request.data?.hospitalId || "").trim();
  if (!/^[A-Za-z0-9_-]{3,80}$/.test(hospitalId)) {
    throw new HttpsError("invalid-argument", "病院IDが正しくありません。");
  }
  await requireHospitalAdministrator(request, hospitalId);
  const snapshot = await db.collection(`clinicalHospitals/${hospitalId}/staff`).get();
  return {
    staff: snapshot.docs.map(item => {
      const data = item.data();
      return { staffId: String(data.staffId || ""), role: String(data.role || ""), active: data.active !== false };
    }).sort((a, b) => a.staffId.localeCompare(b.staffId))
  };
});

exports.resetClinicalFoundation = onCall({ region: "asia-northeast1" }, async request => {
  requireClinicalOwner(request);
  const configRef = db.doc("clinicalControl/config");
  const config = await configRef.get();
  if (!config.exists) return { ok: true, reset: false };

  const hospitalId = String(config.data()?.hospitalId || "");
  if (!hospitalId) {
    await configRef.delete();
    return { ok: true, reset: true };
  }

  const hospitalRef = db.doc(`clinicalHospitals/${hospitalId}`);
  const staffSnapshot = await hospitalRef.collection("staff").get();
  for (const staff of staffSnapshot.docs) {
    const uid = String(staff.data()?.uid || staff.id);
    try {
      const user = await auth.getUser(uid);
      const claims = { ...(user.customClaims || {}) };
      delete claims.clinical;
      delete claims.clinicalRole;
      delete claims.clinicalHospitalId;
      await auth.setCustomUserClaims(uid, claims);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }
  }
  await db.recursiveDelete(hospitalRef);
  await configRef.delete();
  return { ok: true, reset: true };
});
