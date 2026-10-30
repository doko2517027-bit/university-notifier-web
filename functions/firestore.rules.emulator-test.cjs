"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} = require("firebase/firestore");

const PROJECT_ID = "demo-cmu-security";
const adminUid = "admin-uid";
const studentUid = "student-uid";
const otherUid = "other-uid";
let environment;

function claims(email, verified = true) {
  return { email, email_verified: verified };
}

async function seed() {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, "studyAppUsers", adminUid), { studentNumber: "2510044", role: "admin", active: true }),
      setDoc(doc(db, "studyAppUsers", studentUid), { studentNumber: "2510147", role: "student", active: true }),
      setDoc(doc(db, "studyAppUsers", otherUid), { studentNumber: "2510999", role: "student", active: true }),
      setDoc(doc(db, "studyAppUsers", "inactive-uid"), { studentNumber: "2510888", role: "student", active: false }),
      setDoc(doc(db, "studyAppSubjects", "public-subject"), { name: "公開", published: true }),
      setDoc(doc(db, "studyAppSubjects", "hidden-subject"), { name: "非公開", published: false }),
      setDoc(doc(db, "studyAppSubjects", "public-subject", "units", "public-unit"), {
        name: "公開単元", published: true, fill_blank: [], quiz: [],
      }),
      setDoc(doc(db, "studyAppSubjects", "public-subject", "units", "hidden-unit"), {
        name: "非公開単元", published: false, fill_blank: [], quiz: [],
      }),
      setDoc(doc(db, "studyAppSubjects", "public-subject", "units", "public-unit", "drafts", "edited"), {
        name: "管理者だけの下書き", fill_blank: [], quiz: [],
      }),
    ]);
  });
}

async function run() {
  environment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8") },
  });
  await seed();
  const studentDb = environment.authenticatedContext(studentUid, claims("2510147@sums.ac.jp")).firestore();
  const otherDb = environment.authenticatedContext(otherUid, claims("2510999@sums.ac.jp")).firestore();
  const adminDb = environment.authenticatedContext(adminUid, claims("2510044@admin.caremateuniv.app", false)).firestore();
  const inactiveDb = environment.authenticatedContext("inactive-uid", claims("2510888@sums.ac.jp")).firestore();
  const anonymousDb = environment.unauthenticatedContext().firestore();

  await assertSucceeds(getDoc(doc(studentDb, "studyAppSubjects", "public-subject")));
  await assertSucceeds(getDoc(doc(studentDb, "studyAppSubjects", "public-subject", "units", "public-unit")));
  await assertFails(getDoc(doc(studentDb, "studyAppSubjects", "hidden-subject")));
  await assertFails(getDoc(doc(studentDb, "studyAppSubjects", "public-subject", "units", "hidden-unit")));
  await assertFails(getDoc(doc(studentDb, "studyAppSubjects", "public-subject", "units", "public-unit", "drafts", "edited")));
  await assertSucceeds(getDoc(doc(adminDb, "studyAppSubjects", "public-subject", "units", "public-unit", "drafts", "edited")));
  await assertFails(getDoc(doc(anonymousDb, "studyAppSubjects", "public-subject")));
  await assertFails(getDoc(doc(inactiveDb, "studyAppSubjects", "public-subject")));

  await assertFails(setDoc(doc(studentDb, "studyAppSubjects", "forged"), { name: "不正", published: true }));
  await assertFails(getDocs(collection(studentDb, "studyAppUsers")));
  await assertFails(getDoc(doc(studentDb, "studyAppUsers", otherUid)));

  const progress = {
    subjectId: "public-subject",
    unitId: "public-unit",
    position: 1,
    answered: 1,
    total: 2,
    lastScore: 1,
    attemptCount: 1,
    correctCount: 1,
    questionStats: { "quiz:0": { attempts: 1, correct: 1 } },
    studySession: {
      version: 1,
      active: true,
      position: 1,
      order: ["quiz:id:q1", "fill_blank:id:f1"],
      choiceOrders: { "quiz:id:q1": [1, 0] },
      results: { "quiz:id:q1": true },
      startedAtMs: Date.now(),
    },
    updatedAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(doc(studentDb, "studyAppUsers", studentUid, "progress", "public-subject_public-unit"), progress));
  await assertFails(setDoc(doc(otherDb, "studyAppUsers", studentUid, "progress", "forged"), progress));
  await assertFails(setDoc(doc(studentDb, "studyAppUsers", studentUid, "progress", "invalid"), { ...progress, admin: true }));

  const report = {
    reporterUid: studentUid,
    reporterStudentNumber: "2510147",
    reporterName: "学生",
    subjectId: "public-subject",
    unitId: "public-unit",
    type: "quiz",
    index: 0,
    questionId: "q1",
    reason: "答えが違います",
    details: "確認してください",
    question: "問題文",
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(doc(studentDb, "studyAppReports", "valid-report"), report));
  await assertFails(setDoc(doc(studentDb, "studyAppReports", "forged-report"), { ...report, reporterUid: otherUid }));
  await assertFails(setDoc(doc(studentDb, "studyAppReports", "oversized-report"), { ...report, details: "x".repeat(1201) }));

  const newStudent = environment.authenticatedContext("new-uid", claims("2510777@sums.ac.jp")).firestore();
  await assertFails(setDoc(doc(newStudent, "studyAppUsers", "new-uid"), {
    studentNumber: "2510777", name: "学生", email: "2510777@sums.ac.jp",
    emailVerified: true, role: "student", active: true,
    createdAt: serverTimestamp(), verifiedAt: serverTimestamp(),
  }));

  console.log("Firestore security rules: all authorization scenarios passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (environment) await environment.cleanup();
});
