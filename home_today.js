import { auth, db, studentNumber } from "./common.js";
import { asDate, buildTodayAutomaticItems, findNextLecture, hasTimeElapsed, manualTodoIsDimmed, todayKey } from "./home_today_model.mjs";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot,
  query, serverTimestamp, setDoc, updateDoc, where,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { getIdTokenResult } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

const $ = (id) => document.getElementById(id);
const card = $("homeTodayCard");
const form = $("homeTodayForm");
const input = $("homeTodayInput");
const timeInput = $("homeTodayTime");
const saveButton = $("homeTodaySave");
const cancelButton = $("homeTodayCancel");
const status = $("homeTodayStatus");
const list = $("homeTodayItems");
const dateLabel = $("homeTodayDate");
const countLabel = $("homeTodayCount");
const nextLectureLabel = $("homeNextLecture");

let user = {};
let lectures = [];
let lectureDays = [];
let automaticItems = [];
let personalTodos = [];
let currentDate = todayKey();
let editingId = "";
let stopTodos = null;
let stopCompletions = null;
let assignmentCompletions = new Set();
const pendingCompletions = new Set();
let verified = false;
let lastSourceLoad = 0;
let sourcesLoading = false;

const formatTime = (date) => date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
const statusText = (text) => { status.textContent = text; status.hidden = !text; };
const make = (tag, className, text = "") => {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
};

function render() {
  if (!card) return;
  const now = new Date();
  const date = new Date(`${currentDate}T00:00:00`);
  dateLabel.textContent = date.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
  countLabel.textContent = `今日${personalTodos.length + automaticItems.length}件`;
  const nextLecture = findNextLecture(lectureDays, now);
  if (nextLecture) {
    const start = nextLecture.startsAt;
    const dayText = start.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
    const prefix = nextLecture.classSelectionRequired ? "次の講義候補（クラス未選択）" : "次の講義";
    nextLectureLabel.textContent = `${prefix}：${dayText} ${nextLecture.startTime}${nextLecture.endTime ? `–${nextLecture.endTime}` : ""}　${nextLecture.subject}${nextLecture.classGroup ? `（${nextLecture.classGroup}クラス）` : ""}`;
  } else {
    nextLectureLabel.textContent = lectureDays.length ? "次の講義予定はありません" : "次の講義を確認中...";
  }
  list.replaceChildren();

  const manualSection = make("section", "home-today-section");
  const remaining = personalTodos.filter((todo) => todo.completed !== true).length;
  manualSection.append(make("h4", "", `自分のやること・未完了${remaining}/${personalTodos.length}`));
  if (!personalTodos.length) manualSection.append(make("p", "home-today-empty", "まだ登録していません。"));
  for (const todo of [...personalTodos].sort((a, b) => Number(a.completed) - Number(b.completed) || (a.dueTime || "99:99").localeCompare(b.dueTime || "99:99"))) {
    const row = make("div", `home-today-item home-today-personal${manualTodoIsDimmed(todo, now) ? " is-dimmed" : ""}${todo.completed ? " is-complete" : ""}`);
    const checkbox = make("input", "home-today-check");
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed === true;
    checkbox.dataset.todoId = todo.id;
    checkbox.setAttribute("aria-label", `「${todo.title}」を${checkbox.checked ? "未完了に戻す" : "完了にする"}`);
    row.append(checkbox);
    const body = make("div", "home-today-item-body");
    body.append(make("span", "home-today-item-title", todo.title));
    const detail = todo.completed ? "完了" : todo.dueTime && manualTodoIsDimmed(todo, now) ? "時刻経過" : "";
    if (todo.dueTime || detail) body.append(make("small", "home-today-item-detail", [todo.dueTime, detail].filter(Boolean).join("・")));
    row.append(body);
    const edit = make("button", "home-today-item-action", "編集");
    edit.type = "button";
    edit.dataset.editId = todo.id;
    const remove = make("button", "home-today-item-action home-today-delete", "削除");
    remove.type = "button";
    remove.dataset.deleteId = todo.id;
    row.append(edit, remove);
    manualSection.append(row);
  }
  list.append(manualSection);

  const automaticSection = make("section", "home-today-section");
  automaticSection.append(make("h4", "", "今日の講義・締切・予定"));
  automaticSection.append(make("p", "home-today-hint", "課題の提出済みは手動で記録できます。"));
  if (!automaticItems.length) automaticSection.append(make("p", "home-today-empty", "今日の講義・締切・予定はありません。"));
  const labels = { lecture: "講義", assignment: "課題", personal: "予定", shared: "共有" };
  for (const item of automaticItems) {
    const submitted = item.kind === "assignment" && (item.submitted || assignmentCompletions.has(item.completionId));
    const elapsed = submitted || hasTimeElapsed(item.endAt, now);
    const row = make("div", `home-today-item home-today-automatic${elapsed ? " is-dimmed" : ""}${submitted ? " is-complete" : ""}`);
    row.append(make("span", `home-today-kind is-${item.kind}`, labels[item.kind] || "予定"));
    const body = make("div", "home-today-item-body");
    body.append(make("span", "home-today-item-title", item.title));
    const end = item.endAt ? new Date(item.endAt) : null;
    const detail = [item.detail, item.kind === "assignment" && end ? `${formatTime(end)}締切` : "", submitted ? "提出済み" : elapsed ? "時刻経過" : ""].filter(Boolean).join("・");
    if (detail) body.append(make("small", "home-today-item-detail", detail));
    row.append(body);
    if (item.kind === "assignment" && item.completionId && !item.submitted) {
      const completionButton = make("button", "home-today-item-action home-today-submit", submitted ? "解除" : "提出済み");
      completionButton.type = "button";
      completionButton.dataset.completionId = item.completionId;
      completionButton.disabled = pendingCompletions.has(item.completionId);
      completionButton.setAttribute("aria-label", `「${item.title}」の提出済みを${submitted ? "解除" : "記録"}`);
      row.append(completionButton);
    }
    automaticSection.append(row);
  }
  list.append(automaticSection);
}

async function loadAutomaticItems() {
  if (sourcesLoading) return;
  sourcesLoading = true;
  lastSourceLoad = Date.now();
  try {
    const sources = await Promise.allSettled([
      getDoc(doc(db, "assignments", studentNumber)),
      getDocs(collection(db, "calendarAssignments", studentNumber, "items")),
      getDocs(query(collection(db, "calendarEvents"), where("ownerId", "==", studentNumber))),
      getDocs(collection(db, "calendarSharedEvents")),
    ]);
    const [current, archived, personal, shared] = sources.map((result) => result.status === "fulfilled" ? result.value : null);
    automaticItems = buildTodayAutomaticItems({
      assignments: current?.data()?.assignments || [],
      archivedAssignments: archived?.docs.map((item) => item.data()) || [],
      personalEvents: personal?.docs.map((item) => item.data()) || [],
      sharedEvents: shared?.docs.map((item) => item.data()) || [],
      lectures,
      user,
    });
    await Promise.allSettled(automaticItems.filter((item) => item.kind === "assignment").map(async (item) => {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(item.identity));
      item.completionId = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }));
    const failures = sources.filter((source) => source.status === "rejected").length;
    statusText(failures ? "一部の予定を取得できませんでした。接続後に再表示します。" : "");
    render();
  } finally {
    sourcesLoading = false;
  }
}

function subscribeTodos() {
  stopTodos?.();
  currentDate = todayKey();
  personalTodos = [];
  render();
  stopTodos = onSnapshot(
    query(collection(db, "users", studentNumber, "dailyTodos"), where("date", "==", currentDate)),
    (snapshot) => {
      personalTodos = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      render();
    },
    (error) => {
      console.warn("今日のやること取得エラー:", error);
      statusText("自分のやることを読み込めませんでした。通信状態を確認してください。");
    },
  );
}

function subscribeAssignmentCompletions() {
  stopCompletions?.();
  stopCompletions = onSnapshot(
    collection(db, "users", studentNumber, "assignmentCompletions"),
    (snapshot) => {
      assignmentCompletions = new Set(snapshot.docs.filter((item) => item.data().submitted === true).map((item) => item.id));
      render();
    },
    (error) => console.warn("課題提出状態の取得エラー:", error),
  );
}

function resetForm() {
  editingId = "";
  form.reset();
  saveButton.textContent = "追加";
  cancelButton.hidden = true;
}

function bindEvents() {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!verified) return;
    const title = input.value.trim();
    if (!title) return;
    saveButton.disabled = true;
    try {
      const fields = { title, dueTime: timeInput.value || "", updatedAt: serverTimestamp() };
      if (editingId) await updateDoc(doc(db, "users", studentNumber, "dailyTodos", editingId), fields);
      else await addDoc(collection(db, "users", studentNumber, "dailyTodos"), { ...fields, date: currentDate, completed: false, createdAt: serverTimestamp() });
      resetForm();
      statusText("");
    } catch (error) {
      console.error("やること保存エラー:", error);
      statusText("保存できませんでした。通信状態を確認してください。");
    } finally {
      saveButton.disabled = false;
    }
  });
  cancelButton.addEventListener("click", resetForm);
  list.addEventListener("change", async (event) => {
    const id = event.target.dataset?.todoId;
    if (!id || !verified) return;
    event.target.disabled = true;
    try {
      await updateDoc(doc(db, "users", studentNumber, "dailyTodos", id), { completed: event.target.checked, updatedAt: serverTimestamp() });
    } catch (error) {
      event.target.checked = !event.target.checked;
      statusText("完了状態を保存できませんでした。");
    } finally {
      event.target.disabled = false;
    }
  });
  list.addEventListener("click", async (event) => {
    const completionId = event.target.dataset?.completionId;
    if (completionId && verified && !pendingCompletions.has(completionId)) {
      const wasSubmitted = assignmentCompletions.has(completionId);
      pendingCompletions.add(completionId);
      if (wasSubmitted) assignmentCompletions.delete(completionId);
      else assignmentCompletions.add(completionId);
      render();
      try {
        const reference = doc(db, "users", studentNumber, "assignmentCompletions", completionId);
        if (wasSubmitted) await deleteDoc(reference);
        else await setDoc(reference, { submitted: true, updatedAt: serverTimestamp() });
        statusText("");
      } catch (error) {
        if (wasSubmitted) assignmentCompletions.add(completionId);
        else assignmentCompletions.delete(completionId);
        statusText("提出状態を保存できませんでした。通信状態を確認してください。");
      } finally {
        pendingCompletions.delete(completionId);
        render();
      }
      return;
    }
    const editId = event.target.dataset?.editId;
    if (editId) {
      const todo = personalTodos.find((item) => item.id === editId);
      if (!todo) return;
      editingId = editId;
      input.value = todo.title;
      timeInput.value = todo.dueTime || "";
      saveButton.textContent = "保存";
      cancelButton.hidden = false;
      input.focus();
      return;
    }
    const deleteId = event.target.dataset?.deleteId;
    if (!deleteId || !verified) return;
    const todo = personalTodos.find((item) => item.id === deleteId);
    if (!todo || !confirm(`「${todo.title}」を削除しますか？`)) return;
    event.target.disabled = true;
    try {
      await deleteDoc(doc(db, "users", studentNumber, "dailyTodos", deleteId));
      if (editingId === deleteId) resetForm();
    } catch (error) {
      event.target.disabled = false;
      statusText("削除できませんでした。通信状態を確認してください。");
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshWhenNeeded();
  });
  setInterval(() => {
    if (!document.hidden) refreshWhenNeeded();
  }, 60_000);
}

function refreshWhenNeeded() {
  if (!verified) return;
  if (currentDate !== todayKey()) {
    resetForm();
    lectures = lectureDays.filter((day) => day.date === todayKey()).flatMap((day) => day.schedules || []);
    automaticItems = [];
    subscribeTodos();
    void loadAutomaticItems();
  } else {
    render();
    if (Date.now() - lastSourceLoad > 5 * 60_000) void loadAutomaticItems();
  }
}

export function setHomeTodaySchedule(days) {
  lectureDays = Array.isArray(days) ? days : [];
  lectures = lectureDays.filter((day) => day.date === todayKey()).flatMap((day) => day.schedules || []);
  automaticItems = [
    ...automaticItems.filter((item) => item.kind !== "lecture"),
    ...buildTodayAutomaticItems({ lectures }).filter((item) => item.kind === "lecture"),
  ].sort((left, right) => (asDate(left.sortAt)?.getTime() || 0) - (asDate(right.sortAt)?.getTime() || 0));
  render();
}

export async function startHomeToday(userData) {
  if (!card || verified) return;
  user = userData || {};
  bindEvents();
  try {
    await auth.authStateReady();
    if (!studentNumber || auth.currentUser?.uid !== `caremate-${studentNumber}`) throw new Error("ログイン情報が一致しません");
    const token = await getIdTokenResult(auth.currentUser);
    if (token.claims?.studentNumber !== studentNumber) throw new Error("学籍番号が一致しません");
    verified = true;
    subscribeTodos();
    subscribeAssignmentCompletions();
    void loadAutomaticItems();
  } catch (error) {
    console.warn("今日のやること本人確認エラー:", error);
    statusText("ログイン情報を確認できません。再ログイン後に表示します。");
    form.hidden = true;
  }
}
