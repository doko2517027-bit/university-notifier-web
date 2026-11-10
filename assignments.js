import { auth, db } from "./auth_core.js?v=20261107-1";
import { collection, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const studentNumber = String((await auth.currentUser.getIdTokenResult()).claims.studentNumber || "");
const list = document.getElementById("assignmentList");
const syncStatus = document.getElementById("assignmentSyncStatus");

function text(tag, value, className = "") {
  const node = document.createElement(tag);
  node.textContent = String(value ?? "");
  node.className = className;
  return node;
}
function safeUrl(raw) {
  try {
    const url = new URL(String(raw || ""), "https://sums.manaba.jp/ct/");
    if (/^\/(?:course_\d|page_\d|home(?:_|$))/.test(url.pathname)) url.pathname = "/ct" + url.pathname;
    return url.protocol === "https:" && url.hostname === "sums.manaba.jp" ? url.href : "";
  } catch { return ""; }
}
function dueDate(item) {
  return dateValue(item.deadlineAt, false)
    || dateValue(item.deadlineText || item.deadline, false)
    || Number.MAX_SAFE_INTEGER;
}
function startDate(item) {
  return dateValue(item.startAt, true)
    || dateValue(item.startText || item.start, true)
    || 0;
}
function dateValue(value, isStart) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (Number.isFinite(value?.seconds)) return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value < 10_000_000_000 ? value * 1000 : value;
  const raw = String(value).trim();
  const match = raw.match(/(20\d{2})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!match) return 0;
  const tail = raw.slice((match.index || 0) + match[0].length);
  const time = tail.match(/(\d{1,2})\s*[:：]\s*(\d{2})/);
  const clock = time ? `${time[1].padStart(2, "0")}:${time[2]}` : (isStart ? "00:00" : "23:59");
  const parsed = new Date(`${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}T${clock}:00+09:00`).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}
function isSubmitted(item) {
  if (item.submissionConfirmed === true || item.submissionConfirmedAt) return true;
  for (const field of ["submitted", "isSubmitted", "completed"]) {
    if (item[field] === true) return true;
  }
  return ["submitted", "completed", "done", "提出済み", "提出済"].includes(
    String(item.submissionStatus || item.status || "").toLowerCase(),
  );
}
function assignmentState(item) {
  const start = startDate(item);
  if (start > Date.now() || (!start && item.published === false)) return "upcoming";
  if (isSubmitted(item)) return "submitted";
  return dueDate(item) < Date.now() ? "overdue" : "pending";
}
function statusLabel(state) {
  if (state === "submitted") return "提出済み";
  if (state === "upcoming") return "公開前";
  if (state === "overdue") return "締切済み・未提出";
  return "受付中・未提出";
}
function card(item) {
  const state = assignmentState(item);
  const article = text("article", "", `cm-item cm-assignment-card is-${state}`);
  article.append(text("span", item.course || "科目名なし", "cm-item-kicker"));
  article.append(text("h2", item.title || "課題"));
  if (item.content || item.description) article.append(text("p", item.content || item.description, "cm-assignment-content"));
  article.append(text("strong", statusLabel(state), "cm-assignment-state"));
  article.append(text("p", `締切：${item.deadlineText || item.deadline || "日付未設定"}`, "cm-assignment-deadline"));
  const href = safeUrl(item.url);
  if (href) {
    const link = text("a", "課題を開く　↗", "cm-button cm-button-primary");
    link.href = href; link.target = "_blank"; link.rel = "noopener noreferrer";
    article.append(link);
  }
  return article;
}

function render(current) {
  const order = { pending: 0, upcoming: 1, overdue: 2, submitted: 3 };
  const sorted = [...current].sort((a, b) => order[assignmentState(a)] - order[assignmentState(b)] || dueDate(a) - dueDate(b));
  list.replaceChildren();
  if (!sorted.length) list.append(text("p", "課題はありません。", "cm-subtitle"));
  else sorted.forEach((item) => list.append(card(item)));
}

let currentItems = [];
let archivedItems = [];
function identity(item) { return String(item.url || `${item.course || ""}|${item.title || ""}`); }
function visibleItems() {
  const merged = new Map(currentItems.map((item) => [identity(item), item]));
  for (const item of archivedItems) {
    if (assignmentState(item) === "upcoming" && !merged.has(identity(item))) merged.set(identity(item), item);
  }
  return [...merged.values()];
}
const unsubscribeCurrent = onSnapshot(doc(db, "assignments", studentNumber), (snapshot) => {
  const data = snapshot.data() || {};
  currentItems = Array.isArray(data.assignments) ? data.assignments : [];
  render(visibleItems());
  const updatedAt = data.updatedAt?.toDate?.();
  syncStatus.textContent = updatedAt
    ? `最終確認：${new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(updatedAt)}（新しい取得結果は自動反映）`
    : "新しい取得結果は自動で反映されます。";
}, (error) => {
  console.error("課題取得エラー:", error);
  syncStatus.textContent = "更新を確認できません。通信状態をご確認ください。";
  list.replaceChildren(text("p", "課題を読み込めませんでした。通信状態を確認してください。", "cm-subtitle"));
});
const unsubscribeArchive = onSnapshot(collection(db, "calendarAssignments", studentNumber, "items"), (snapshot) => {
  archivedItems = snapshot.docs.map((entry) => entry.data());
  render(visibleItems());
}, (error) => console.warn("公開前課題の読み込みに失敗しました:", error));

// 画面を開いたまま締切を跨いだ場合も、色と文言を自動更新する。
setInterval(() => render(visibleItems()), 30 * 1000);
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) { unsubscribeCurrent(); unsubscribeArchive(); }
});
