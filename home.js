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
  if (date) return new Date(Number(date[1]), Number(date[2]) - 1, Number(date[3]));
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
function openDay(key) {
  selected = key;
  dayTitle.textContent = `${key.replaceAll("-", "/")} の予定`;
  dayItems.replaceChildren();
  const tasks = assignments.filter((item) => keyFor(item) === key);
  const events = personalEvents.filter((item) => item.date === key).sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
  if (!tasks.length && !events.length) dayItems.append(el("p", "この日の課題・予定はありません。", "cm-subtitle"));
  for (const item of tasks) {
    const card = el("article", "", "cm-item cm-calendar-task");
    card.append(el("span", "manaba課題", "cm-item-kicker"), el("h3", item.title || "課題"), el("p", item.course || "科目名なし"));
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
    button.setAttribute("aria-label", `${monthIndex + 1}月${day}日、課題${tasks.length}件、予定${events.length}件`);
    button.append(el("span", day, "cm-calendar-day-number"));
    const labels = el("span", "", "cm-calendar-day-items");
    for (const task of tasks.slice(0, 2)) labels.append(el("small", `課 ${task.title || "課題"}`, "cm-calendar-chip assignment"));
    for (const event of events.slice(0, Math.max(0, 2 - Math.min(tasks.length, 2)))) labels.append(el("small", `予 ${event.title}`, "cm-calendar-chip personal"));
    if (tasks.length + events.length > 2) labels.append(el("small", `ほか ${tasks.length + events.length - 2}件`, "cm-calendar-more"));
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

try {
  const [current, archived, personal] = await Promise.all([
    getDoc(doc(db, "assignments", studentNumber)),
    getDocs(collection(db, "calendarAssignments", studentNumber, "items")),
    getDocs(collection(db, "calendarPersonal", studentNumber, "items")),
  ]);
  const currentItems = Array.isArray(current.data()?.assignments) ? current.data().assignments : [];
  const unique = new Map();
  [...archived.docs.map((snapshot) => snapshot.data()), ...currentItems].forEach((item) => {
    const key = `${item.url || ""}|${item.course || ""}|${item.title || ""}|${keyFor(item)}`;
    unique.set(key, { ...unique.get(key), ...item });
  });
  assignments = [...unique.values()];
  personalEvents = personal.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })).filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date || ""));
} catch (error) {
  console.error("ホームの課題カレンダー読み込みエラー:", error);
}
renderCalendar();
