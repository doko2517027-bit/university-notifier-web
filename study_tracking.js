import {
  doc,
  setDoc,
  addDoc,
  collection,
  deleteDoc,
  serverTimestamp,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const HEARTBEAT_MS = 120_000;
const IDLE_MS = 10 * 60_000;
const MAX_SESSION_MS = 12 * 60 * 60_000;
let context = null;
let timerInterval = null;
let navigationInProgress = false;
let questionShownAt = Date.now();

function storageKey(studentNumber) {
  return `careMateStudyTimer_${studentNumber}`;
}

function deviceId() {
  return localStorage.getItem("careMateDeviceId") || "unknown-device";
}

function readState() {
  if (!context?.studentNumber) return null;
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(context.studentNumber)) || "null");
    return value?.id ? value : null;
  } catch {
    return null;
  }
}

function writeState(state) {
  if (!context?.studentNumber) return;
  if (!state) localStorage.removeItem(storageKey(context.studentNumber));
  else localStorage.setItem(storageKey(context.studentNumber), JSON.stringify(state));
  renderFloatingTimer();
  window.dispatchEvent(new CustomEvent("caremate:study-timer-changed", { detail: state }));
}

function elapsedSeconds(state, now = Date.now()) {
  const base = Math.max(0, Number(state?.elapsedSeconds) || 0);
  if (!state || state.status !== "running") return base;
  return base + Math.max(0, Math.min(now - Number(state.segmentStartedAt || now), IDLE_MS)) / 1000;
}

function formatClock(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return [hours, minutes, secs].map((item) => String(item).padStart(2, "0")).join(":");
}

async function saveSession(state, final = false) {
  if (!context?.db || !context.studentNumber || !state?.id) return;
  const now = Date.now();
  const seconds = Math.min(MAX_SESSION_MS / 1000, elapsedSeconds(state, now));
  const payload = {
    source: state.source,
    subjectId: state.subjectId || "",
    subjectName: state.subjectName || "その他",
    unitId: state.unitId || "",
    unitName: state.unitName || "",
    content: state.content || "",
    startedAt: new Date(state.startedAt),
    endedAt: final ? new Date(now) : null,
    durationSeconds: Math.round(seconds),
    deviceId: state.deviceId,
    status: final ? "completed" : state.status,
    stopReason: final ? state.stopReason || "ended" : "",
    updatedAt: serverTimestamp(),
    createdAt: new Date(state.startedAt),
  };
  await setDoc(
    doc(context.db, "users", context.studentNumber, "studySessions", state.id),
    payload,
    { merge: true },
  );
  await setDoc(
    doc(context.db, "users", context.studentNumber, "studyState", "current"),
    {
      active: !final && state.status === "running",
      sessionId: state.id,
      source: state.source,
      subjectName: state.subjectName || "その他",
      deviceId: state.deviceId,
      updatedAt: serverTimestamp(),
      ...(final ? { endedAt: serverTimestamp() } : {}),
    },
    { merge: true },
  );
}

async function acquireStudyLock(state) {
  const ref = doc(context.db, "users", context.studentNumber, "studyState", "current");
  return runTransaction(context.db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const existing = snapshot.data() || {};
    const updatedAt = existing.updatedAt?.toMillis?.() || 0;
    const busyElsewhere = existing.active === true &&
      existing.deviceId && existing.deviceId !== state.deviceId &&
      Date.now() - updatedAt < IDLE_MS + HEARTBEAT_MS;
    if (busyElsewhere) return false;
    transaction.set(ref, {
      active: true,
      sessionId: state.id,
      source: state.source,
      subjectName: state.subjectName || "その他",
      deviceId: state.deviceId,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return true;
  });
}

export async function startStudyTimer(details = {}) {
  if (!context?.studentNumber || !context?.db) return { started: false, reason: "not-authenticated" };
  const current = readState();
  if (current?.status === "running") {
    if (current.source === "manual" && details.source === "exam") {
      return { started: false, reason: "manual-priority", state: current };
    }
    if (current.source === details.source && current.subjectId === details.subjectId && current.unitId === details.unitId) {
      return { started: true, reused: true, state: current };
    }
    await stopStudyTimer("switched");
  }
  const now = Date.now();
  const state = {
    id: crypto.randomUUID(),
    source: details.source === "exam" ? "exam" : "manual",
    subjectId: String(details.subjectId || ""),
    subjectName: String(details.subjectName || "その他").slice(0, 100),
    unitId: String(details.unitId || ""),
    unitName: String(details.unitName || "").slice(0, 100),
    content: String(details.content || "").slice(0, 300),
    route: location.pathname.split("/").pop() || "index.html",
    startedAt: now,
    segmentStartedAt: now,
    lastActivityAt: now,
    elapsedSeconds: 0,
    status: "running",
    deviceId: deviceId(),
  };
  const locked = await acquireStudyLock(state);
  if (!locked) return { started: false, reason: "another-device" };
  writeState(state);
  await saveSession(state, false);
  return { started: true, state };
}

export async function pauseStudyTimer(reason = "paused") {
  const state = readState();
  if (!state || state.status !== "running") return null;
  state.elapsedSeconds = elapsedSeconds(state);
  state.status = "paused";
  state.stopReason = reason;
  state.segmentStartedAt = null;
  writeState(state);
  await saveSession(state, false).catch((error) => console.warn("学習時間の一時保存に失敗:", error));
  return state;
}

export async function resumeStudyTimer() {
  const state = readState();
  if (!state || state.status !== "paused") return null;
  state.status = "running";
  state.segmentStartedAt = Date.now();
  state.lastActivityAt = Date.now();
  state.stopReason = "";
  const locked = await acquireStudyLock(state);
  if (!locked) return null;
  writeState(state);
  await saveSession(state, false);
  return state;
}

export async function stopStudyTimer(reason = "ended") {
  const state = readState();
  if (!state) return null;
  if (state.status === "running") state.elapsedSeconds = elapsedSeconds(state);
  state.status = "completed";
  state.stopReason = reason;
  state.endedAt = Date.now();
  const pendingKey = `${storageKey(context.studentNumber)}_pending`;
  // 終了イベントの通信が完了する前にPWAが閉じられても、次回起動時に必ず回収する。
  localStorage.setItem(pendingKey, JSON.stringify(state));
  writeState(null);
  await saveSession(state, true)
    .then(() => localStorage.removeItem(pendingKey))
    .catch((error) => console.warn("学習時間の終了保存に失敗:", error));
  return state;
}

export async function stopExamStudyTimer(reason = "exam-ended") {
  const state = readState();
  if (!state || state.source !== "exam") return null;
  return stopStudyTimer(reason);
}

export function getStudyTimerState() {
  const state = readState();
  return state ? { ...state, currentElapsedSeconds: elapsedSeconds(state) } : null;
}

export function markQuestionShown() {
  questionShownAt = Date.now();
}

export async function recordQuestionAttempt(details = {}) {
  if (!context?.studentNumber || !context?.db || !details.questionId) return null;
  const answerTime = Date.now();
  const questionId = String(details.questionId);
  const questionKey = [details.type || "quiz", details.subjectId || "", details.unitId || "", questionId].join(":");
  const attemptId = crypto.randomUUID();
  const payload = {
    attemptId,
    questionKey,
    type: String(details.type || "quiz"),
    subjectId: String(details.subjectId || ""),
    subjectName: String(details.subjectName || "科目").slice(0, 100),
    unitId: String(details.unitId || ""),
    unitName: String(details.unitName || "").slice(0, 100),
    questionId,
    question: String(details.question || "").slice(0, 2000),
    choices: Array.isArray(details.choices) ? details.choices.map((item) => String(item).slice(0, 500)).slice(0, 12) : [],
    correctAnswer: details.correctAnswer ?? null,
    selectedAnswer: details.selectedAnswer ?? null,
    correct: typeof details.correct === "boolean" ? details.correct : null,
    responseSeconds: Math.max(0, Math.min(3600, Number(details.responseSeconds) || (answerTime - questionShownAt) / 1000)),
    answeredAt: new Date(answerTime),
    createdAt: serverTimestamp(),
    deviceId: deviceId(),
  };
  await setDoc(doc(context.db, "users", context.studentNumber, "questionAttempts", attemptId), payload);
  return payload;
}

export async function updateManualStudySession(sessionId, changes = {}) {
  if (!context?.studentNumber || !sessionId) return;
  const durationSeconds = Math.max(60, Math.min(43_200, Number(changes.durationSeconds) || 60));
  await setDoc(doc(context.db, "users", context.studentNumber, "studySessions", sessionId), {
    subjectName: String(changes.subjectName || "その他").slice(0, 100),
    content: String(changes.content || "").slice(0, 300),
    durationSeconds,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function deleteManualStudySession(sessionId) {
  if (!context?.studentNumber || !sessionId) return;
  await deleteDoc(doc(context.db, "users", context.studentNumber, "studySessions", sessionId));
}

function renderFloatingTimer() {
  let button = document.getElementById("careMateStudyFloatingTimer");
  const state = readState();
  if (!state || !["running", "paused"].includes(state.status)) {
    button?.remove();
    return;
  }
  if (!button) {
    button = document.createElement("button");
    button.id = "careMateStudyFloatingTimer";
    button.type = "button";
    button.className = "study-floating-timer";
    button.addEventListener("click", () => { location.href = "study_analytics.html#timer"; });
    document.body.appendChild(button);
  }
  const isPaused = state.status === "paused";
  button.dataset.state = state.status;
  button.dataset.source = state.source;
  button.textContent = `${isPaused ? "⏸ 一時停止中" : "📚 学習中"} ${formatClock(elapsedSeconds(state))}`;
}

async function flushPending() {
  const key = `${storageKey(context.studentNumber)}_pending`;
  try {
    const pending = JSON.parse(localStorage.getItem(key) || "null");
    if (!pending?.id) return;
    await saveSession(pending, true);
    localStorage.removeItem(key);
  } catch (error) {
    console.warn("保留中の学習記録を保存できませんでした:", error);
  }
}

export function initializeGlobalStudyTracking(options = {}) {
  if (context) return;
  if (!options.studentNumber || options.loggedIn !== true) return;
  context = options;
  const currentPage = location.pathname.split("/").pop() || "index.html";
  const state = readState();
  if (state?.source === "exam" && state.route !== currentPage) {
    void stopStudyTimer("left-exam-page");
  }
  void flushPending();
  renderFloatingTimer();
  timerInterval = setInterval(() => {
    const active = readState();
    if (!active || active.status !== "running") return renderFloatingTimer();
    if (Date.now() - Number(active.lastActivityAt || active.segmentStartedAt) >= IDLE_MS) {
      void pauseStudyTimer("idle");
      return;
    }
    renderFloatingTimer();
    if (Date.now() - Number(active.lastCheckpointAt || 0) >= HEARTBEAT_MS) {
      active.lastCheckpointAt = Date.now();
      writeState(active);
      void saveSession(active, false).catch((error) => console.warn("学習時間の定期保存に失敗:", error));
    }
  }, 1000);
  const activity = () => {
    const active = readState();
    if (!active || active.status !== "running") return;
    if (Date.now() - Number(active.lastActivityAt || 0) < 5000) return;
    active.lastActivityAt = Date.now();
    writeState(active);
  };
  ["pointerdown", "keydown", "scroll"].forEach((type) => document.addEventListener(type, activity, { passive: true }));
  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a[href]");
    if (anchor) {
      try {
        const target = new URL(anchor.href, location.href);
        navigationInProgress = target.origin === location.origin && !anchor.target;
      } catch { navigationInProgress = false; }
      return;
    }
    // CareMate内にはbuttonのクリック処理でlocation.hrefを変更する画面も多い。
    // 直後のpagehideだけを内部遷移として扱い、通常のバックグラウンド化は停止する。
    if (event.target.closest("button, [role='button'], .home-card")) {
      navigationInProgress = true;
      setTimeout(() => {
        if (document.hidden) void stopStudyTimer("background");
        navigationInProgress = false;
      }, 1500);
    }
  }, true);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !navigationInProgress) void stopStudyTimer("background");
    if (!document.hidden) navigationInProgress = false;
  });
  window.addEventListener("pagehide", () => {
    if (!navigationInProgress) void stopStudyTimer("page-closed");
  });
  window.addEventListener("pageshow", () => { navigationInProgress = false; });
}

export function destroyStudyTrackingForTests() {
  clearInterval(timerInterval);
  timerInterval = null;
  context = null;
}
