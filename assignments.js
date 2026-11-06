import { auth, db } from "./auth_core.js?v=20261028-2";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

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
    return url.protocol === "https:" && url.hostname === "sums.manaba.jp" ? url.href : "";
  } catch { return ""; }
}
function dueDate(item) {
  if (item.deadlineAt?.toDate) return item.deadlineAt.toDate().getTime();
  const raw = String(item.deadlineText || item.deadline || "");
  const match = raw.match(/(20\d{2})\D(\d{1,2})\D(\d{1,2})/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const time = raw.match(/(\d{1,2}):(\d{2})/);
  return new Date(`${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}T${time ? `${time[1].padStart(2, "0")}:${time[2]}` : "23:59"}:00+09:00`).getTime();
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
  if (isSubmitted(item)) return "submitted";
  return dueDate(item) < Date.now() ? "overdue" : "pending";
}
function statusLabel(state) {
  if (state === "submitted") return "提出済み";
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
  const sorted = [...current].sort((a, b) => dueDate(a) - dueDate(b));
  list.replaceChildren();
  if (!sorted.length) list.append(text("p", "課題はありません。", "cm-subtitle"));
  else sorted.forEach((item) => list.append(card(item)));
}

let currentItems = [];
const unsubscribe = onSnapshot(doc(db, "assignments", studentNumber), (snapshot) => {
  const data = snapshot.data() || {};
  currentItems = Array.isArray(data.assignments) ? data.assignments : [];
  render(currentItems);
  const updatedAt = data.updatedAt?.toDate?.();
  syncStatus.textContent = updatedAt
    ? `最終確認：${new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(updatedAt)}（新しい取得結果は自動反映）`
    : "新しい取得結果は自動で反映されます。";
}, (error) => {
  console.error("課題取得エラー:", error);
  syncStatus.textContent = "更新を確認できません。通信状態をご確認ください。";
  list.replaceChildren(text("p", "課題を読み込めませんでした。通信状態を確認してください。", "cm-subtitle"));
});

// 画面を開いたまま締切を跨いだ場合も、色と文言を自動更新する。
setInterval(() => render(currentItems), 30 * 1000);
window.addEventListener("pagehide", (event) => { if (!event.persisted) unsubscribe(); });
