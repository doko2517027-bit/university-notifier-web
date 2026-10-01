import { auth, functions, initializePage } from "./common.js";
import { signOut } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";
import { VERSION } from "./version.js";

const list = document.getElementById("guardianTimetable");
const weekLabel = document.getElementById("guardianWeekLabel");
let entries = [];
let weekOffset = 0;

await initializePage();
await auth.authStateReady();
const currentUser = auth.currentUser;
const token = currentUser ? await currentUser.getIdTokenResult() : null;
if (!currentUser || token?.claims?.role !== "guardian" || currentUser.uid !== `guardian-${token?.claims?.linkedStudentNumber || ""}`) {
  localStorage.removeItem("guardianLoggedIn");
  location.href = "login.html";
  throw new Error("保護者ログインが必要です。");
}

document.getElementById("version").textContent = `Version ${VERSION}`;

try {
  const getGuardianTimetable = httpsCallable(functions, "getGuardianTimetable");
  const result = await getGuardianTimetable();
  entries = Array.isArray(result.data?.entries) ? result.data.entries : [];
  document.getElementById("guardianStudentLabel").textContent = `${result.data?.studentName || result.data?.linkedStudentNumber || "学生"}さんの時間割`;
  renderWeek();
} catch (error) {
  console.error("保護者時間割取得エラー:", error);
  list.innerHTML = '<div class="card setting-card guardian-empty">時間割を取得できませんでした。時間をおいて再度お試しください。</div>';
}

document.getElementById("previousWeek").addEventListener("click", () => { weekOffset -= 1; renderWeek(); });
document.getElementById("nextWeek").addEventListener("click", () => { weekOffset += 1; renderWeek(); });
document.getElementById("guardianLogout").addEventListener("click", async () => {
  await signOut(auth).catch(() => {});
  localStorage.removeItem("careMateRole");
  localStorage.removeItem("guardianLoggedIn");
  localStorage.removeItem("guardianStudentNumber");
  location.href = "login.html";
});

function renderWeek() {
  const start = startOfWeek(new Date());
  start.setDate(start.getDate() + weekOffset * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startKey = toDateKey(start);
  const endKey = toDateKey(end);
  weekLabel.textContent = `${formatShort(start)}〜${formatShort(end)}`;
  const byDate = new Map();
  entries.filter((entry) => entry.date >= startKey && entry.date <= endKey).forEach((entry) => {
    if (!byDate.has(entry.date)) byDate.set(entry.date, []);
    byDate.get(entry.date).push(entry);
  });
  const html = [];
  for (let day = 0; day < 7; day += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + day);
    const key = toDateKey(date);
    const dayEntries = byDate.get(key) || [];
    html.push(`<section class="card setting-card guardian-day-card">
      <h2>${escapeHtml(new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", weekday: "short" }).format(date))}</h2>
      ${dayEntries.length ? dayEntries.map(renderEntry).join("") : '<p class="guardian-empty">予定はありません</p>'}
    </section>`);
  }
  list.innerHTML = html.join("");
}

function renderEntry(entry) {
  const time = entry.startTime || entry.endTime ? `${entry.startTime || "--:--"}〜${entry.endTime || "--:--"}` : "時間未設定";
  const details = [entry.period ? `${entry.period}限` : "", entry.classGroup, entry.room].filter(Boolean).join("・");
  return `<article class="guardian-schedule-item"><div><strong>${escapeHtml(entry.subject)}</strong><span>${escapeHtml(time)}</span></div>${details ? `<small>${escapeHtml(details)}</small>` : ""}</article>`;
}

function startOfWeek(value) {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date;
}
function toDateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatShort(date) { return `${date.getMonth() + 1}/${date.getDate()}`; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
