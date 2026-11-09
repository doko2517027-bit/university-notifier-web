import { auth, db } from "./auth_core.js?v=20261107-1";
import { collection, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const studentNumber = String((await auth.currentUser.getIdTokenResult()).claims.studentNumber || "");
const list = document.getElementById("manabaList");
const nav = document.getElementById("manabaCategoryNav");
const title = document.getElementById("manabaListTitle");
const count = document.getElementById("manabaCount");
const sync = document.getElementById("manabaSyncStatus");
const pagination = document.getElementById("manabaPagination");
const PAGE_SIZE = 5;
const categories = [
  ["all", "すべて"], ["course_news", "コースニュース"],
  ["content", "コースコンテンツ"], ["survey", "アンケート"],
  ["quiz", "小テスト"], ["report", "レポート"],
];
const labels = Object.fromEntries(categories);
const allowedCategories = new Set(categories.map(([key]) => key).filter((key) => key !== "all"));
const taskCategories = new Set(["quiz", "survey", "report"]);
const requested = new URL(location.href).searchParams.get("category") || "all";
let selected = labels[requested] ? requested : "all";
let currentPage = Math.max(1, Number.parseInt(new URL(location.href).searchParams.get("page") || "1", 10) || 1);
let items = [];

function node(tag, value, className = "") {
  const element = document.createElement(tag);
  element.textContent = String(value ?? "");
  element.className = className;
  return element;
}
function safeManabaUrl(raw) {
  try {
    const url = new URL(String(raw || ""), "https://sums.manaba.jp/ct/");
    if (/^\/(?:course_\d|page_\d|home(?:_|$))/.test(url.pathname)) url.pathname = "/ct" + url.pathname;
    return url.protocol === "https:" && url.hostname === "sums.manaba.jp" ? url.href : "";
  } catch { return ""; }
}
function timeValue(item) {
  return dateValue(item.sourceUpdatedAt) || dateValue(item.start || item.startText)
    || dateValue(item.dateText)
    || timestampValue(item.firstSeenAt)
    || 0;
}
function timestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (Number.isFinite(value?.seconds)) return value.seconds * 1000;
  return 0;
}
function dateValue(value) {
  const raw = String(value || "").trim().replaceAll("/", "-");
  const match = raw.match(/(20\d{2})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
  return match ? new Date(`${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}T${match[4] ? match[4].padStart(2, "0") : "00"}:${match[5] || "00"}:00+09:00`).getTime() : 0;
}
function formatPostedDate(item) {
  if (item.sourceUpdatedAt) return String(item.sourceUpdatedAt);
  if (item.dateText) return String(item.dateText);
  const date = item.firstSeenAt?.toDate?.();
  return date ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date) : "日時情報なし";
}
function taskState(item) {
  const start = dateValue(item.start || item.startText);
  if (item.published === false || (start && start > Date.now())) return "upcoming";
  if (item.submitted === true) return "submitted";
  const deadline = dateValue(item.deadline || item.deadlineText);
  return deadline && deadline < Date.now() ? "overdue" : "pending";
}
function taskStateLabel(state) {
  return ({ pending: "未提出（締切前）", upcoming: "公開前", overdue: "未提出（締切済み）", submitted: "提出済み" })[state] || "";
}
function renderNav() {
  const totals = new Map(categories.map(([key]) => [key, 0]));
  for (const item of items) totals.set(item.category, (totals.get(item.category) || 0) + 1);
  totals.set("all", items.length);
  nav.replaceChildren();
  for (const [key, label] of categories) {
    const button = node("button", `${label} ${totals.get(key) || 0}`, "cm-manaba-category");
    button.type = "button";
    button.setAttribute("aria-pressed", key === selected ? "true" : "false");
    button.addEventListener("click", () => {
      selected = key;
      currentPage = 1;
      const url = new URL(location.href); url.searchParams.set("category", key); url.searchParams.delete("page");
      history.replaceState(null, "", url);
      renderNav(); renderList();
    });
    nav.append(button);
  }
}
function card(item) {
  const article = node("article", "", "cm-item cm-manaba-card");
  article.append(node("span", item.categoryLabel || labels[item.category] || "manaba", "cm-item-kicker"));
  article.append(node("h3", item.title || "名称なし"));
  if (taskCategories.has(item.category)) {
    article.append(node("p", item.course || "科目名なし", "cm-manaba-course"));
    const state = taskState(item);
    article.classList.add(`is-${state}`);
    article.append(node("strong", taskStateLabel(state), `cm-manaba-status is-${state}`));
    article.append(node("p", `公開：${item.start || item.startText || "日時未設定"}`, "cm-manaba-date"));
    article.append(node("p", `締切：${item.deadline || item.deadlineText || "日時未設定"}`, "cm-manaba-date"));
  } else {
    // Long page-body text is intentionally not shown.  News, grades and
    // coaching entries use the same compact title/date layout as threads.
    article.append(node("p", `最終更新：${formatPostedDate(item)}`, "cm-manaba-date"));
  }
  const href = safeManabaUrl(item.url);
  if (href) {
    const link = node("a", "manabaで開く　↗", "cm-button cm-button-primary cm-button-compact");
    link.href = href; link.target = "_blank"; link.rel = "noopener noreferrer";
    article.append(link);
  }
  return article;
}
function goToPage(page, totalPages) {
  currentPage = Math.max(1, Math.min(totalPages, page));
  const url = new URL(location.href);
  if (currentPage === 1) url.searchParams.delete("page");
  else url.searchParams.set("page", String(currentPage));
  history.replaceState(null, "", url);
  renderList();
  title.scrollIntoView({ behavior: "smooth", block: "start" });
}
function renderPagination(totalPages) {
  pagination.replaceChildren();
  pagination.hidden = totalPages <= 1;
  if (totalPages <= 1) return;
  const previous = node("button", "◀︎", "cm-pagination-arrow");
  previous.type = "button"; previous.disabled = currentPage === 1; previous.setAttribute("aria-label", "前のページ");
  previous.addEventListener("click", () => goToPage(currentPage - 1, totalPages));
  pagination.append(previous);
  const first = Math.max(1, Math.min(currentPage - 1, totalPages - 2));
  const last = Math.min(totalPages, first + 2);
  for (let page = first; page <= last; page += 1) {
    const button = node("button", page, "cm-pagination-page");
    button.type = "button";
    button.setAttribute("aria-label", `${page}ページ目`);
    if (page === currentPage) button.setAttribute("aria-current", "page");
    button.addEventListener("click", () => goToPage(page, totalPages));
    pagination.append(button);
  }
  const next = node("button", "▶︎", "cm-pagination-arrow");
  next.type = "button"; next.disabled = currentPage === totalPages; next.setAttribute("aria-label", "次のページ");
  next.addEventListener("click", () => goToPage(currentPage + 1, totalPages));
  pagination.append(next);
}
function renderList() {
  const visible = items
    .filter((item) => selected === "all" || item.category === selected)
    .sort((a, b) => timeValue(b) - timeValue(a)
      || dateValue(b.deadline || b.deadlineText) - dateValue(a.deadline || a.deadlineText)
      || String(b.title || "").localeCompare(String(a.title || ""), "ja"));
  title.textContent = selected === "all" ? "すべての情報" : labels[selected];
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);
  const pageItems = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  count.textContent = `${visible.length}件・${currentPage}/${totalPages}ページ（取得済みの履歴を含む）`;
  list.replaceChildren();
  if (!visible.length) list.append(node("p", "この種類の情報はまだ取得されていません。", "cm-subtitle"));
  else pageItems.forEach((item) => list.append(card(item)));
  renderPagination(visible.length ? totalPages : 0);
}

const unsubscribeMeta = onSnapshot(doc(db, "manabaActivity", studentNumber), (snapshot) => {
  const updated = snapshot.data()?.updatedAt?.toDate?.();
  sync.textContent = updated
    ? `最終確認：${new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(updated)}（1時間ごとに確認）`
    : "初回のmanaba情報を取得しています。";
}, (error) => { console.warn("manaba取得時刻を読めませんでした:", error); sync.textContent = "更新時刻を確認できませんでした。"; });

const unsubscribeItems = onSnapshot(collection(db, "manabaActivity", studentNumber, "items"), (snapshot) => {
  items = snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .filter((item) => allowedCategories.has(item.category));
  renderNav(); renderList();
}, (error) => {
  console.error("manaba情報を読み込めませんでした:", error);
  list.replaceChildren(node("p", "manaba情報を読み込めませんでした。通信状態をご確認ください。", "cm-subtitle"));
});

window.addEventListener("pagehide", (event) => {
  if (!event.persisted) { unsubscribeMeta(); unsubscribeItems(); }
});
