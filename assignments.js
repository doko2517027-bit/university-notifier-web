import { auth, db } from "./auth_core.js";
import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const studentNumber = String((await auth.currentUser.getIdTokenResult()).claims.studentNumber || "");
const list = document.getElementById("assignmentList");

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
function card(item) {
  const article = text("article", "", "cm-item cm-assignment-card");
  article.append(text("span", item.course || "科目名なし", "cm-item-kicker"));
  article.append(text("h2", item.title || "課題"));
  if (item.content || item.description) article.append(text("p", item.content || item.description, "cm-assignment-content"));
  article.append(text("p", `締切：${item.deadlineText || item.deadline || "日付未設定"}`, "cm-assignment-deadline"));
  const href = safeUrl(item.url);
  if (href) {
    const link = text("a", "課題を開く　↗", "cm-button cm-button-primary");
    link.href = href; link.target = "_blank"; link.rel = "noopener noreferrer";
    article.append(link);
  }
  return article;
}

try {
  const [currentSnap, archivedSnap] = await Promise.all([
    getDoc(doc(db, "assignments", studentNumber)),
    getDocs(collection(db, "calendarAssignments", studentNumber, "items")),
  ]);
  const current = Array.isArray(currentSnap.data()?.assignments) ? currentSnap.data().assignments : [];
  const archived = archivedSnap.docs.map((entry) => entry.data());
  const unique = new Map();
  [...archived, ...current].forEach((item) => {
    const key = `${item.url || ""}|${item.course || ""}|${item.title || ""}|${item.deadlineText || item.deadline || ""}`;
    unique.set(key, { ...unique.get(key), ...item });
  });
  const sorted = [...unique.values()].sort((a, b) => dueDate(a) - dueDate(b));
  list.replaceChildren();
  if (!sorted.length) list.append(text("p", "課題はありません。", "cm-subtitle"));
  else sorted.forEach((item) => list.append(card(item)));
} catch (error) {
  console.error("課題取得エラー:", error);
  list.replaceChildren(text("p", "課題を読み込めませんでした。通信状態を確認してください。", "cm-subtitle"));
}
