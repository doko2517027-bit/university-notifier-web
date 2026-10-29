// Legacy export name is retained for existing answer screens. The renewed
// CareMate records solved questions but does not grant ranking/shop points.
import { db, studentNumber } from "./common.js?v=20261029-1";
import { doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function awardDailyQuestionPoints({ type, subjectId, unitId, questionId }) {
  if (!studentNumber) return { awarded: false, points: 0 };
  const day = localDateKey();
  const identity = `${day}|${type}|${subjectId}|${unitId}|${questionId}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  const id = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
  const reference = doc(db, "users", studentNumber, "solvedQuestions", id);
  await runTransaction(db, async (transaction) => {
    if ((await transaction.get(reference)).exists()) return;
    transaction.set(reference, { day, type, subjectId, unitId, questionId, correctAt: serverTimestamp() });
  });
  return { awarded: false, points: 0 };
}
