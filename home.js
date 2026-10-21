import { auth, db } from "./auth_core.js";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const studentNumber = String((await auth.currentUser.getIdTokenResult()).claims.studentNumber || "");
const byId = (id) => document.getElementById(id);
const clock = byId("currentDateTime");
const grid = byId("calendarGrid");
const monthLabel = byId("calendarMonth");
const dayTitle = byId("calendarDateTitle");
const dayItems = byId("calendarDayItems");
const dayOverlay = byId("calendarDayOverlay");
const eventOverlay = byId("personalEventOverlay");
const eventForm = byId("personalEventForm");
const eventStatus = byId("personalEventStatus");
const now = new Date();
let month = new Date(now.getFullYear(), now.getMonth(), 1);
let selected = dateKey(now);
let assignments = [];
let personalEvents = [];
const assignmentAccess = document.documentElement.dataset.assignmentAccess !== "false";

function dateKey(value) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}
function el(tag, content, className = "") {
  const node = document.createElement(tag);
  node.textContent = String(content ?? "");
  node.className = className;
  return node;
}
function deadlineDate(item) {
  if (item.deadlineAt?.toDate) return item.deadlineAt.toDate();
  const raw = String(item.deadlineText || item.deadline || "");
  const date = raw.match(/(20\d{2})\D(\d{1,2})\D(\d{1,2})/);
  const timeMatches = [...raw.matchAll(/(\d{1,2}):(\d{2})/g)];
  const time = timeMatches.at(-1) || null;
  if (date) return new Date(
    Number(date[1]),
    Number(date[2]) - 1,
    Number(date[3]),
    time ? Number(time[1]) : 23,
    time ? Number(time[2]) : 59,
  );
  return null;
}
function keyFor(item) {
  const date = deadlineDate(item);
  return date ? dateKey(date) : "";
}
function safeManabaUrl(raw) {
  try {
    const url = new URL(String(raw || ""), "https://sums.manaba.jp/ct/");
    return url.protocol === "https:" && url.hostname === "sums.manaba.jp" ? url.href : "";
  } catch { return ""; }
}
function assignmentIdentity(item) {
  return `${item.url || ""}|${item.course || ""}|${item.title || ""}|${keyFor(item)}`;
}
function hasSubmittedStatus(item) {
  if (typeof item._isSubmitted === "boolean") return item._isSubmitted;
  if (item.submitted === true || item.isSubmitted === true || item.completed === true) return true;
  const status = String(item.submissionStatus || item.status || "").toLowerCase();
  return ["submitted", "completed", "done", "提出済み"].some((value) => status.includes(value));
}
function assignmentState(item) {
  if (hasSubmittedStatus(item)) return "submitted";
  const deadline = deadlineDate(item);
  return deadline && deadline.getTime() < Date.now() ? "overdue" : "pending";
}
function assignmentStatusLabel(state) {
  if (state === "submitted") return "提出済み";
  if (state === "overdue") return "期限切れ・未提出";
  return "期限内・未提出";
}
function openDay(key) {
  selected = key;
  dayTitle.textContent = `${key.replaceAll("-", "/")} の予定`;
  dayItems.replaceChildren();
  const tasks = assignments.filter((item) => keyFor(item) === key);
  const events = personalEvents.filter((item) => item.date === key).sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
  if (!tasks.length && !events.length) dayItems.append(el("p", assignmentAccess ? "この日の課題・予定はありません。" : "この日の予定はありません。", "cm-subtitle"));
  for (const item of tasks) {
    const state = assignmentState(item);
    const card = el("article", "", `cm-item cm-calendar-task is-${state}`);
    card.append(el("span", assignmentStatusLabel(state), "cm-item-kicker"), el("h3", item.title || "課題"), el("p", item.course || "科目名なし"));
    card.append(el("p", `締切：${item.deadlineText || item.deadline || "日付未設定"}`));
    const url = safeManabaUrl(item.url);
    if (url) {
      const link = el("a", "manabaの課題を開く", "cm-button cm-button-compact cm-button-primary");
      link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer";
      card.append(link);
    }
    dayItems.append(card);
  }
  for (const item of events) {
    const card = el("article", "", "cm-item cm-calendar-personal");
    card.append(el("span", "自分の予定", "cm-item-kicker"), el("h3", item.title));
    if (item.time) card.append(el("p", `時間：${item.time}`));
    if (item.note) card.append(el("p", item.note));
    const remove = el("button", "予定を削除", "cm-button cm-button-compact cm-button-danger");
    remove.type = "button";
    remove.addEventListener("click", async () => {
      if (!confirm(`「${item.title}」を削除しますか？`)) return;
      remove.disabled = true;
      try {
        await deleteDoc(doc(db, "calendarPersonal", studentNumber, "items", item.id));
        personalEvents = personalEvents.filter((entry) => entry.id !== item.id);
        renderCalendar(); openDay(key);
      } catch (error) { console.error("予定の削除に失敗しました:", error); alert("予定を削除できませんでした。"); remove.disabled = false; }
    });
    card.append(remove);
    dayItems.append(card);
  }
  dayOverlay.hidden = false;
  byId("closeCalendarDialog").focus();
}
function renderCalendar() {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  monthLabel.textContent = `${year}年${monthIndex + 1}月`;
  grid.replaceChildren();
  for (let i = 0; i < new Date(year, monthIndex, 1).getDay(); i++) grid.append(el("span", "", "cm-calendar-empty"));
  for (let day = 1; day <= new Date(year, monthIndex + 1, 0).getDate(); day++) {
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const tasks = assignments.filter((item) => keyFor(item) === key);
    const events = personalEvents.filter((item) => item.date === key);
    const button = el("button", "", `cm-calendar-day${key === dateKey(new Date()) ? " is-today" : ""}${tasks.length || events.length ? " has-items" : ""}`);
    button.type = "button";
    button.setAttribute("aria-label", assignmentAccess ? `${monthIndex + 1}月${day}日、課題${tasks.length}件、予定${events.length}件` : `${monthIndex + 1}月${day}日、予定${events.length}件`);
    button.append(el("span", day, "cm-calendar-day-number"));
    const labels = el("span", "", "cm-calendar-day-items");
    for (const task of tasks) {
      const state = assignmentState(task);
      const chip = el("small", task.title || "課題", `cm-calendar-chip assignment is-${state}`);
      chip.title = `${task.title || "課題"}（${assignmentStatusLabel(state)}）`;
      labels.append(chip);
    }
    for (const event of events) labels.append(el("small", event.title, "cm-calendar-chip personal"));
    button.append(labels);
    button.addEventListener("click", () => openDay(key));
    grid.append(button);
  }
}
function updateClock() {
  const current = new Date();
  clock.dateTime = current.toISOString();
  clock.textContent = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(current);
}
function closeOverlay(overlay) { overlay.hidden = true; }

updateClock();
setInterval(updateClock, 1000);
byId("previousMonth").addEventListener("click", () => { month = new Date(month.getFullYear(), month.getMonth() - 1, 1); renderCalendar(); });
byId("nextMonth").addEventListener("click", () => { month = new Date(month.getFullYear(), month.getMonth() + 1, 1); renderCalendar(); });
byId("closeCalendarDialog").addEventListener("click", () => closeOverlay(dayOverlay));
byId("closeEventForm").addEventListener("click", () => closeOverlay(eventOverlay));
for (const overlay of [dayOverlay, eventOverlay]) overlay.addEventListener("click", (event) => { if (event.target === overlay) closeOverlay(overlay); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeOverlay(eventOverlay); closeOverlay(dayOverlay); } });
byId("addPersonalEvent").addEventListener("click", () => {
  eventForm.reset(); eventStatus.textContent = "";
  byId("personalEventDate").textContent = selected.replaceAll("-", "/");
  eventOverlay.hidden = false;
  eventForm.elements.title.focus();
});
eventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = eventForm.querySelector('[type="submit"]');
  const data = new FormData(eventForm);
  const title = String(data.get("title") || "").trim();
  if (!title) return;
  submit.disabled = true; eventStatus.textContent = "保存しています…";
  try {
    const reference = await addDoc(collection(db, "calendarPersonal", studentNumber, "items"), {
      title, date: selected, time: String(data.get("time") || ""), note: String(data.get("note") || "").trim(),
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    personalEvents.push({ id: reference.id, title, date: selected, time: String(data.get("time") || ""), note: String(data.get("note") || "").trim() });
    renderCalendar(); closeOverlay(eventOverlay); openDay(selected);
  } catch (error) {
    console.error("予定の保存に失敗しました:", error);
    eventStatus.textContent = "予定を保存できませんでした。通信状態を確認してください。";
  } finally { submit.disabled = false; }
});

const [currentResult, archivedResult, personalResult] = await Promise.allSettled([
    assignmentAccess ? getDoc(doc(db, "assignments", studentNumber)) : Promise.resolve(null),
    assignmentAccess ? getDocs(collection(db, "calendarAssignments", studentNumber, "items")) : Promise.resolve(null),
    getDocs(collection(db, "calendarPersonal", studentNumber, "items")),
]);
for (const result of [currentResult, archivedResult, personalResult]) {
  if (result.status === "rejected") console.error("カレンダーデータの読み込みエラー:", result.reason);
}
const currentItems = currentResult.status === "fulfilled" && Array.isArray(currentResult.value?.data?.()?.assignments)
  ? currentResult.value.data().assignments : [];
const archivedItems = archivedResult.status === "fulfilled"
  ? (archivedResult.value?.docs || []).map((snapshot) => snapshot.data()) : [];
const unique = new Map();
[...archivedItems].forEach((item) => {
  const key = assignmentIdentity(item);
  unique.set(key, { ...unique.get(key), ...item, _isCurrent: false });
});
[...currentItems].forEach((item) => {
  const key = assignmentIdentity(item);
  unique.set(key, { ...unique.get(key), ...item, _isCurrent: true });
});
assignments = [...unique.values()].map((item) => ({
  ...item,
  _isSubmitted:
    typeof item.submitted === "boolean"
      ? item.submitted
      : typeof item.isSubmitted === "boolean"
        ? item.isSubmitted
        : !item._isCurrent,
}));
personalEvents = personalResult.status === "fulfilled"
  ? personalResult.value.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date || ""))
  : [];
renderCalendar();
