import { auth, db } from "./auth_core.js";
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const studentNumber = String((await auth.currentUser.getIdTokenResult()).claims.studentNumber || "");
const list = document.getElementById("assignmentList");
const grid = document.getElementById("calendarGrid");
const monthLabel = document.getElementById("calendarMonth");
const dayTitle = document.getElementById("calendarDateTitle");
const dayItems = document.getElementById("calendarDayItems");
const today = new Date();
let shown = new Date(today.getFullYear(), today.getMonth(), 1);
let selected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
let items = [];
let completions = new Set();

function text(tag, value, className = "") {
  const node = document.createElement(tag);
  node.textContent = String(value ?? "");
  node.className = className;
  return node;
}

function safeUrl(raw) {
  try {
    const url = new URL(String(raw || ""), "https://sums.manaba.jp/ct/");
    return url.protocol === "https:" && url.hostname === "sums.manaba.jp" ? url.href : "";
  } catch { return ""; }
}

function dateKey(item) {
  if (item.deadlineAt?.toDate) {
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(item.deadlineAt.toDate());
  }
  return String(item.deadlineText || item.deadline || "").match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "";
}

async function completionId(item) {
  const identity = String(item.url || "").trim() || `${item.course || ""}|${item.title || ""}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function card(item) {
  const article = text("article", "", "cm-item");
  article.append(text("h3", item.title || "課題"), text("p", item.course || "科目名なし"));
  article.append(text("p", `締切: ${item.deadlineText || item.deadline || "不明"}`));
  const label = text("label", "", "cm-completion");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = completions.has(item.completionId) || item.submitted === true;
  checkbox.disabled = item.submitted === true;
  checkbox.addEventListener("change", async () => {
    checkbox.disabled = true;
    const reference = doc(db, "users", studentNumber, "assignmentCompletions", item.completionId);
    try {
      if (checkbox.checked) {
        await setDoc(reference, { submitted: true, updatedAt: serverTimestamp() });
        completions.add(item.completionId);
      } else {
        await deleteDoc(reference);
        completions.delete(item.completionId);
      }
    } catch (error) {
      checkbox.checked = !checkbox.checked;
      console.error("提出状態の保存エラー:", error);
      alert("提出状態を保存できませんでした。");
    } finally { checkbox.disabled = item.submitted === true; renderDay(); }
  });
  label.append(checkbox, document.createTextNode("提出済みにする"));
  article.append(label);
  const url = safeUrl(item.url);
  if (url) {
    const link = text("a", "manabaで開く", "cm-button");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    article.append(link);
  }
  return article;
}

function renderDay() {
  dayTitle.textContent = `${selected.replaceAll("-", "/")} の課題`;
  dayItems.replaceChildren();
  const matches = items.filter((item) => dateKey(item) === selected);
  if (!matches.length) dayItems.append(text("p", "この日の課題はありません。", "cm-subtitle"));
  else matches.forEach((item) => dayItems.append(card(item)));
}

function renderCalendar() {
  const year = shown.getFullYear();
  const month = shown.getMonth();
  monthLabel.textContent = `${year}年${month + 1}月`;
  grid.replaceChildren();
  for (let i = 0; i < new Date(year, month, 1).getDay(); i++) grid.append(text("span", "", "cm-calendar-empty"));
  for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const count = items.filter((item) => dateKey(item) === key).length;
    const button = text("button", day, `cm-calendar-day${key === selected ? " is-selected" : ""}${count ? " has-deadline" : ""}`);
    button.type = "button";
    button.setAttribute("aria-label", `${month + 1}月${day}日、課題${count}件`);
    if (count) button.append(text("small", `${count}件`));
    button.addEventListener("click", () => { selected = key; renderCalendar(); renderDay(); });
    grid.append(button);
  }
}

document.getElementById("previousMonth").addEventListener("click", () => { shown = new Date(shown.getFullYear(), shown.getMonth() - 1, 1); renderCalendar(); });
document.getElementById("nextMonth").addEventListener("click", () => { shown = new Date(shown.getFullYear(), shown.getMonth() + 1, 1); renderCalendar(); });

try {
  const [currentSnap, archivedSnap, completionSnap] = await Promise.all([
    getDoc(doc(db, "assignments", studentNumber)),
    getDocs(collection(db, "calendarAssignments", studentNumber, "items")),
    getDocs(collection(db, "users", studentNumber, "assignmentCompletions")),
  ]);
  completions = new Set(completionSnap.docs.filter((entry) => entry.data().submitted === true).map((entry) => entry.id));
  const current = Array.isArray(currentSnap.data()?.assignments) ? currentSnap.data().assignments : [];
  const archived = archivedSnap.docs.map((entry) => entry.data());
  const combined = await Promise.all([...archived, ...current].map(async (item) => ({ ...item, completionId: await completionId(item) })));
  const unique = new Map();
  combined.forEach((item) => unique.set(item.completionId, { ...unique.get(item.completionId), ...item }));
  items = [...unique.values()];
  list.replaceChildren();
  if (!current.length) list.append(text("p", "現在、未提出の課題はありません。", "cm-subtitle"));
  else for (const item of current) list.append(card({ ...item, completionId: await completionId(item) }));
  renderCalendar();
  renderDay();
} catch (error) {
  console.error("課題取得エラー:", error);
  list.textContent = "課題を取得できませんでした。通信状態を確認してください。";
  grid.textContent = "カレンダーを読み込めませんでした。";
}
