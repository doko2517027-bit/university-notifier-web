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

function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function newSession(items) {
  const questionOrder = shuffle(items.map((item) => item.id));
  const choiceOrders = Object.fromEntries(
    items
      .filter((item) => Number(item.choiceCount) > 0)
      .map((item) => [
        item.id,
        shuffle(Array.from({ length: Number(item.choiceCount) }, (_, index) => index)),
      ]),
  );
  return { questionOrder, choiceOrders, currentIndex: 0 };
}

function validSession(saved, items) {
  const ids = items.map((item) => item.id);
  const order = Array.isArray(saved?.questionOrder)
    ? saved.questionOrder.map(String)
    : [];
  if (order.length !== ids.length || new Set(order).size !== ids.length) return null;
  if (!ids.every((id) => order.includes(id))) return null;
  const choiceOrders = {};
  for (const item of items) {
    if (!Number(item.choiceCount)) continue;
    const choiceOrder = saved?.choiceOrders?.[item.id];
    if (
      !Array.isArray(choiceOrder) ||
      choiceOrder.length !== Number(item.choiceCount) ||
      new Set(choiceOrder).size !== Number(item.choiceCount)
    )
      return null;
    choiceOrders[item.id] = choiceOrder.map(Number);
  }
  return {
    questionOrder: order,
    choiceOrders,
    currentIndex: Math.max(
      0,
      Math.min(order.length - 1, Number(saved?.currentIndex || 0)),
    ),
  };
}

export async function loadTestSession(type, subjectId, subjectName, unitId, items) {
  if (!studentNumber) return newSession(items);
  const ref = doc(
    db,
    "users",
    studentNumber,
    "examProgress",
    await idFor(type, subjectId, unitId),
  );
  const snap = await getDoc(ref);
  const restored = snap.exists() && !snap.data().completed
    ? validSession(snap.data(), items)
    : null;
  if (restored) {
    const continueFromHere = confirm(
      `前回は問題${restored.currentIndex + 1}まで進みました。\nOK：続きから　キャンセル：新しく始める`,
    );
    if (continueFromHere) return restored;
  }
  const session = newSession(items);
  await saveTestProgress(
    type,
    subjectId,
    subjectName,
    unitId,
    session.currentIndex,
    items.length,
    false,
    session,
  );
  return session;
}

export function createNewTestSession(items) {
  return newSession(items);
}
export async function saveTestProgress(
  type,
  subjectId,
  subjectName,
  unitId,
  currentIndex,
  total,
  completed = false,
  session = null,
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
      ...(session
        ? {
            questionOrder: session.questionOrder,
            choiceOrders: session.choiceOrders || {},
          }
        : {}),
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
