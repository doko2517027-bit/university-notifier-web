import { auth, db } from "./auth_core.js?v=20261028-2";
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
  ["all", "すべて"], ["course_news", "コースニュース"], ["portfolio", "ポートフォリオ"],
  ["thread", "掲示板"], ["content", "コンテンツ"], ["quiz", "小テスト"],
  ["survey", "アンケート"], ["report", "レポート"], ["project", "プロジェクト"],
  ["grade", "成績"], ["coaching", "個別指導"], ["peer_review", "ピアレビュー"],
];
const labels = Object.fromEntries(categories);
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
    return url.protocol === "https:" && url.hostname === "sums.manaba.jp" ? url.href : "";
  } catch { return ""; }
}
function timeValue(item) {
  return item.lastSeenAt?.toMillis?.() || item.firstSeenAt?.toMillis?.() || 0;
}
function formatDate(item) {
  if (item.dateText) return String(item.dateText);
  const date = item.lastSeenAt?.toDate?.();
  return date ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date) : "日時情報なし";
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
  article.append(node("p", item.course || "科目名なし", "cm-manaba-course"));
  if (item.summary && item.summary !== item.title) article.append(node("p", item.summary, "cm-manaba-summary"));
  const meta = node("p", formatDate(item), "cm-manaba-date");
  article.append(meta);
  if (item.submitted === true) article.append(node("strong", "提出済み", "cm-manaba-status is-submitted"));
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
    .sort((a, b) => timeValue(b) - timeValue(a) || String(b.dateText || "").localeCompare(String(a.dateText || "")));
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
    ? `最終確認：${new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(updated)}（10分ごとに確認）`
    : "初回のmanaba情報を取得しています。";
}, (error) => { console.warn("manaba取得時刻を読めませんでした:", error); sync.textContent = "更新時刻を確認できませんでした。"; });

const unsubscribeItems = onSnapshot(collection(db, "manabaActivity", studentNumber, "items"), (snapshot) => {
  items = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  renderNav(); renderList();
}, (error) => {
  console.error("manaba情報を読み込めませんでした:", error);
  list.replaceChildren(node("p", "manaba情報を読み込めませんでした。通信状態をご確認ください。", "cm-subtitle"));
});

window.addEventListener("pagehide", (event) => {
  if (!event.persisted) { unsubscribeMeta(); unsubscribeItems(); }
});
