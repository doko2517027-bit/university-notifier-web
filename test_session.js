import { db, studentNumber } from "./common.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

async function idFor(type, subjectId, unitId) {
  const data = new TextEncoder().encode(`${type}|${subjectId}|${unitId}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
export async function loadTestProgress(type, subjectId, unitId, total) {
  if (!studentNumber) return 0;
  const ref = doc(
    db,
    "users",
    studentNumber,
    "examProgress",
    await idFor(type, subjectId, unitId),
  );
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().completed) return 0;
  const index = Math.max(
    0,
    Math.min(total - 1, Number(snap.data().currentIndex || 0)),
  );
  return confirm(
    `前回は問題${index + 1}まで進みました。\nOK：続きから　キャンセル：最初から`,
  )
    ? index
    : 0;
}
export async function saveTestProgress(
  type,
  subjectId,
  subjectName,
  unitId,
  currentIndex,
  total,
  completed = false,
) {
  if (!studentNumber) return;
  await setDoc(
    doc(
      db,
      "users",
      studentNumber,
      "examProgress",
      await idFor(type, subjectId, unitId),
    ),
    {
      type,
      subjectId,
      subjectName: subjectName || "",
      unitId,
      currentIndex,
      totalQuestions: total,
      completed,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
export function scrubberHtml(index, total) {
  return `<div class="test-scrubber"><output>問題 ${index + 1}</output><input class="test-question-scrubber" type="range" min="1" max="${total}" value="${index + 1}" aria-label="問題を移動"><small>${index + 1} / ${total}</small></div>`;
}
export function setupScrubber(root, onMove) {
  const input = root.querySelector(".test-question-scrubber"),
    output = root.querySelector(".test-scrubber output"),
    small = root.querySelector(".test-scrubber small");
  if (!input) return;
  input.oninput = () => {
    output.textContent = `問題 ${input.value}`;
    small.textContent = `${input.value} / ${input.max}`;
  };
  input.onchange = () => onMove(Number(input.value) - 1);
}
export function finishTest(sessionPoints, retry, back) {
  if (
    confirm(
      `全問終了！\n今回獲得 ${sessionPoints}ポイント\n\nOK：もう一度解く\nキャンセル：問題選択へ`,
    )
  )
    retry();
  else back();
}
