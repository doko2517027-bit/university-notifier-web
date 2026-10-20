import { auth, db } from "./auth_core.js";
import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const studentNumber = String((await auth.currentUser.getIdTokenResult()).claims.studentNumber || "");
const clock = document.getElementById("currentDateTime");
const grid = document.getElementById("calendarGrid");
const monthLabel = document.getElementById("calendarMonth");
const dayTitle = document.getElementById("calendarDateTitle");
const dayItems = document.getElementById("calendarDayItems");
const now = new Date();
let month = new Date(now.getFullYear(), now.getMonth(), 1);
let selected = dateKey(now);
let assignments = [];

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
function renderSelectedDay() {
  dayTitle.textContent = `${selected.replaceAll("-", "/")} の課題`;
  dayItems.replaceChildren();
  const matching = assignments.filter((item) => keyFor(item) === selected);
  if (!matching.length) {
    dayItems.append(el("p", "この日の課題はありません。", "cm-subtitle"));
    return;
  }
  for (const item of matching) {
    const card = el("article", "", "cm-item");
    card.append(el("h3", item.title || "課題"), el("p", item.course || "科目名なし"));
    card.append(el("p", `締切：${item.deadlineText || item.deadline || "日付未設定"}`));
    dayItems.append(card);
  }
}
function renderCalendar() {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  monthLabel.textContent = `${year}年${monthIndex + 1}月`;
  grid.replaceChildren();
  for (let i = 0; i < new Date(year, monthIndex, 1).getDay(); i++) grid.append(el("span", "", "cm-calendar-empty"));
  for (let day = 1; day <= new Date(year, monthIndex + 1, 0).getDate(); day++) {
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const count = assignments.filter((item) => keyFor(item) === key).length;
    const button = el("button", day, `cm-calendar-day${key === selected ? " is-selected" : ""}${count ? " has-deadline" : ""}`);
    button.type = "button";
    button.setAttribute("aria-label", `${monthIndex + 1}月${day}日、課題${count}件`);
    if (count) button.append(el("small", `${count}件`));
    button.addEventListener("click", () => { selected = key; renderCalendar(); renderSelectedDay(); });
    grid.append(button);
  }
  renderSelectedDay();
}

function updateClock() {
  const current = new Date();
  clock.dateTime = current.toISOString();
  clock.textContent = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric",
    weekday: "long", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(current);
}
updateClock();
setInterval(updateClock, 1000);
document.getElementById("previousMonth").addEventListener("click", () => { month = new Date(month.getFullYear(), month.getMonth() - 1, 1); renderCalendar(); });
document.getElementById("nextMonth").addEventListener("click", () => { month = new Date(month.getFullYear(), month.getMonth() + 1, 1); renderCalendar(); });

try {
  const [current, archived] = await Promise.all([
    getDoc(doc(db, "assignments", studentNumber)),
    getDocs(collection(db, "calendarAssignments", studentNumber, "items")),
  ]);
  const currentItems = Array.isArray(current.data()?.assignments) ? current.data().assignments : [];
  const historicalItems = archived.docs.map((snapshot) => snapshot.data());
  const unique = new Map();
  [...historicalItems, ...currentItems].forEach((item) => {
    const key = `${item.url || ""}|${item.course || ""}|${item.title || ""}|${keyFor(item)}`;
    unique.set(key, { ...unique.get(key), ...item });
  });
  assignments = [...unique.values()];
} catch (error) {
  console.error("ホームの課題カレンダー読み込みエラー:", error);
  dayItems.replaceChildren(el("p", "課題カレンダーを読み込めませんでした。", "cm-subtitle"));
}
renderCalendar();
