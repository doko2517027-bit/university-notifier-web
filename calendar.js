import {
  db, studentNumber, setupTheme, initializePage, loadProfileImage,
  loadUserName, loadMyRanking, setupAdminTab, updateAssignmentNavBadge,
  updateNewsNavBadge,
} from "./common.js";
import { loadPersonalTimetableData } from "./personal_timetable_data.js";
import { JAPANESE_HOLIDAYS } from "./calendar_holidays.mjs";
import {
  REMINDER_OPTIONS, dateKey, parseManabaDeadline, monthCells,
  matchesSharedAudience, safeReminderMinutes,
} from "./calendar_model.mjs";
import {
  collection, doc, getDoc, getDocs, query, where, addDoc, updateDoc,
  deleteDoc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);
const toDate = (value) => value?.toDate?.() || (value ? new Date(value) : null);
const dateTime = (value) => {
  const date = toDate(value);
  return date && !Number.isNaN(date.getTime()) ? date : null;
};
const formatDay = (key) => {
  const date = new Date(`${key}T00:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日（${"日月火水木金土"[date.getDay()]}）`;
};
const formatTime = (date) => date?.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) || "";
const safeManabaUrl = (raw) => {
  try {
    const url = new URL(String(raw || ""), "https://sums.manaba.jp/ct/");
    return url.origin === "https://sums.manaba.jp" && url.pathname.startsWith("/ct/") ? url.href : "";
  } catch { return ""; }
};

let user = {};
let events = [];
let reminderPreferences = new Map();
let filter = "all";
let selectedDate = dateKey(new Date());
let visibleMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let activeEvent = null;
let editingEvent = null;

setupTheme($("themeButton"));
$("profileButton").onclick = () => { location.href = "profile.html"; };

function showMessage(message, isError = false) {
  $("calendarMessage").textContent = message;
  $("calendarMessage").classList.toggle("error", isError);
}

async function assignmentId(item) {
  const identity = String(item.url || `${item.course || ""}|${item.title || ""}`);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function assignmentEvent(id, item) {
  const deadline = dateTime(item.deadlineAt) || parseManabaDeadline(item.deadlineText || item.deadline);
  if (!deadline) return null;
  return {
    kind: "assignment", id, date: dateKey(deadline), startAt: deadline,
    title: item.title || "課題", subtitle: item.course || "科目名なし",
    note: `締切：${formatDay(dateKey(deadline))} ${formatTime(deadline)}`,
    url: safeManabaUrl(item.url),
  };
}

async function loadCalendarData() {
  showMessage("予定を読み込み中...");
  let profileError = false;
  try {
    const profile = await getDoc(doc(db, "users", studentNumber));
    user = profile.data() || {};
  } catch (error) {
    console.warn("カレンダーのプロフィール取得失敗:", error);
    user = {};
    profileError = true;
  }
  const sources = await Promise.allSettled([
    getDocs(query(collection(db, "calendarEvents"), where("ownerId", "==", studentNumber))),
    getDocs(collection(db, "calendarSharedEvents")),
    getDocs(collection(db, "calendarAssignments", studentNumber, "items")),
    getDoc(doc(db, "assignments", studentNumber)),
    getDocs(collection(db, "calendarReminderPreferences", studentNumber, "items")),
    loadPersonalTimetableData({ userData: user, includeCommonEvents: true }),
  ]);
  const [personal, shared, archived, currentAssignments, preferences, timetable] = sources.map((result) =>
    result.status === "fulfilled" ? result.value : null,
  );
  reminderPreferences = new Map((preferences?.docs || []).map((snapshot) => [snapshot.id, safeReminderMinutes(snapshot.data()?.reminderMinutes)]));
  const next = [];

  for (const snapshot of personal?.docs || []) {
    const data = snapshot.data();
    const startAt = dateTime(data.startAt);
    if (!startAt) continue;
    const endAt = dateTime(data.endAt) || startAt;
    for (let day = new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate()); day <= endAt; day.setDate(day.getDate() + 1)) {
      next.push({ kind: "personal", id: snapshot.id, date: dateKey(day), startAt, endAt,
        title: data.title, subtitle: data.location || "個人の予定", note: data.note || "",
        location: data.location || "", allDay: data.allDay === true,
        reminderMinutes: safeReminderMinutes(data.reminderMinutes), category: data.category || "personal" });
      if (next.length > 10000) break;
    }
  }
  for (const snapshot of shared?.docs || []) {
    const data = snapshot.data();
    if (!matchesSharedAudience(data, user)) continue;
    const startAt = dateTime(data.startAt);
    if (!startAt) continue;
    const endAt = dateTime(data.endAt) || startAt;
    for (let day = new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate()); day <= endAt; day.setDate(day.getDate() + 1)) {
      next.push({ kind: "shared", id: snapshot.id, date: dateKey(day), startAt, endAt,
        title: data.title, subtitle: data.location || "学年共有", note: data.note || "",
        location: data.location || "", allDay: data.allDay === true });
      if (next.length > 10000) break;
    }
  }
  const archivedIds = new Set();
  for (const snapshot of archived?.docs || []) {
    archivedIds.add(snapshot.id);
    const event = assignmentEvent(snapshot.id, snapshot.data());
    if (event) next.push(event);
  }
  for (const item of currentAssignments?.data()?.assignments || []) {
    const id = await assignmentId(item);
    if (archivedIds.has(id)) continue;
    const event = assignmentEvent(id, item);
    if (event) next.push(event);
  }
  for (const entry of timetable?.entries || []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date || "")) continue;
    next.push({ kind: "timetable", id: entry.entryId, date: entry.date,
      startAt: new Date(`${entry.date}T${entry.startTime || "09:00"}:00`),
      title: entry.subject, subtitle: `${entry.period || "-"}限${entry.room ? `・${entry.room}` : ""}`,
      note: [entry.teacher, entry.building, entry.room].filter(Boolean).join(" / "),
      isCommon: entry.isCommonScheduleEvent });
  }
  events = next;
  const failed = sources.filter((source) => source.status === "rejected").length + Number(profileError);
  showMessage(failed ? `${failed}種類の予定を取得できませんでした。再読み込みで再試行できます。` : "", Boolean(failed));
  render();
}

function visibleEventsForDate(key) {
  return events.filter((event) => event.date === key && (filter === "all" || event.kind === filter))
    .sort((a, b) => (a.startAt?.getTime() || 0) - (b.startAt?.getTime() || 0));
}

function renderOverview() {
  const today = dateKey(new Date());
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
  const assignments = events.filter((event) => event.kind === "assignment" && event.startAt >= new Date() && event.startAt <= weekEnd).length;
  const classes = events.filter((event) => event.kind === "timetable" && event.date === today).length;
  const todayPlans = events.filter((event) => ["personal", "shared"].includes(event.kind) && event.date === today).length;
  $("calendarOverview").innerHTML = `<div><small>7日以内の課題</small><strong>${assignments}</strong></div><div><small>今日の時間割</small><strong>${classes}</strong></div><div><small>今日の予定</small><strong>${todayPlans}</strong></div>`;
}

function render() {
  renderOverview();
  $("calendarMonthTitle").textContent = `${visibleMonth.getFullYear()}年 ${visibleMonth.getMonth() + 1}月`;
  $("calendarHolidayNote").hidden = [2026, 2027].includes(visibleMonth.getFullYear());
  const today = dateKey(new Date());
  $("calendarGrid").innerHTML = monthCells(visibleMonth.getFullYear(), visibleMonth.getMonth()).map(({ date, inMonth }) => {
    const dayEvents = visibleEventsForDate(date);
    const holiday = JAPANESE_HOLIDAYS[date];
    const dayNumber = Number(date.slice(-2));
    return `<button type="button" class="calendar-day${inMonth ? "" : " outside"}${date === selectedDate ? " selected" : ""}${date === today ? " today" : ""}${holiday ? " holiday" : ""}" data-date="${date}" aria-label="${escapeHtml(`${date}${holiday ? ` ${holiday}` : ""} 予定${dayEvents.length}件`)}">
      <span class="calendar-day-number">${dayNumber}</span>${holiday ? `<span class="calendar-holiday-label">${escapeHtml(holiday)}</span>` : ""}
      <span class="calendar-day-items">${dayEvents.slice(0, 2).map((item) => `<span class="calendar-dot ${item.kind}" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</span>`).join("")}${dayEvents.length > 2 ? `<small>＋${dayEvents.length - 2}件</small>` : ""}</span></button>`;
  }).join("");
  $("calendarGrid").querySelectorAll("[data-date]").forEach((button) => {
    button.onclick = () => {
      selectedDate = button.dataset.date;
      const selected = new Date(`${selectedDate}T00:00:00`);
      if (selected.getMonth() !== visibleMonth.getMonth() || selected.getFullYear() !== visibleMonth.getFullYear()) {
        visibleMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
      }
      render();
    };
  });
  document.querySelectorAll(".calendar-filters button").forEach((button) => button.classList.toggle("active", button.dataset.filter === filter));
  renderDay();
}

function renderDay() {
  $("calendarSelectedTitle").textContent = formatDay(selectedDate);
  const holiday = JAPANESE_HOLIDAYS[selectedDate];
  const dayEvents = visibleEventsForDate(selectedDate);
  $("calendarDayEvents").innerHTML = `${holiday ? `<div class="calendar-holiday-card">🇯🇵 ${escapeHtml(holiday)}</div>` : ""}${dayEvents.length ? dayEvents.map((event) => `<button type="button" class="calendar-agenda-item ${event.kind}" data-kind="${event.kind}" data-id="${escapeHtml(event.id)}"><span class="calendar-agenda-time">${event.allDay ? "終日" : formatTime(event.startAt)}</span><span><b>${escapeHtml(event.title)}</b><small>${escapeHtml(event.subtitle)}</small></span><span aria-hidden="true">›</span></button>`).join("") : '<p class="calendar-empty">この日の予定はありません。</p>'}`;
  $("calendarDayEvents").querySelectorAll("[data-id]").forEach((button) => {
    button.onclick = () => openDetail(events.find((event) => event.id === button.dataset.id && event.kind === button.dataset.kind && event.date === selectedDate));
  });
}

function reminderCheckboxes(selected = []) {
  return REMINDER_OPTIONS.map(({ minutes, label }) => `<label><input type="checkbox" value="${minutes}" ${selected.includes(minutes) ? "checked" : ""} />${label}</label>`).join("");
}

function openDetail(event) {
  if (!event) return;
  activeEvent = event;
  const labels = { assignment: "課題の締切", timetable: "大学の時間割", personal: "自分の予定", shared: "学年共有の予定" };
  $("calendarDetailKind").textContent = labels[event.kind];
  $("calendarDetailKind").className = `calendar-detail-kind ${event.kind}`;
  $("calendarDetailTitle").textContent = event.title;
  const dateText = `${formatDay(event.date)}${event.allDay ? "・終日" : ` ${formatTime(event.startAt)}`}`;
  $("calendarDetailBody").innerHTML = `<p><b>日時</b><br>${escapeHtml(dateText)}</p>${event.subtitle ? `<p><b>関連</b><br>${escapeHtml(event.subtitle)}</p>` : ""}${event.location ? `<p><b>場所</b><br>${escapeHtml(event.location)}</p>` : ""}${event.note ? `<p><b>詳細</b><br>${escapeHtml(event.note).replace(/\n/g, "<br>")}</p>` : ""}`;
  $("calendarDetailOpen").hidden = !["assignment", "timetable"].includes(event.kind);
  $("calendarDetailOpen").textContent = event.kind === "assignment" ? "課題を開く" : "時間割で見る";
  $("calendarDetailEdit").hidden = event.kind !== "personal";
  $("calendarDetailDelete").hidden = event.kind !== "personal";
  const assignmentReminder = event.kind === "assignment" && event.startAt > new Date();
  $("calendarAssignmentReminder").hidden = !assignmentReminder;
  if (assignmentReminder) $("calendarAssignmentReminderChoices").innerHTML = reminderCheckboxes(reminderPreferences.get(event.id) || []);
  $("calendarDetailOverlay").hidden = false;
}

function closeDetail() { $("calendarDetailOverlay").hidden = true; activeEvent = null; }
function openEditor(event = null, date = selectedDate) {
  editingEvent = event;
  const form = $("calendarEventForm");
  form.reset();
  const start = event?.startAt || new Date(`${date}T09:00:00`);
  const end = event?.endAt || new Date(`${date}T10:00:00`);
  form.elements.title.value = event?.title || "";
  form.elements.startDate.value = dateKey(start);
  form.elements.endDate.value = dateKey(end);
  form.elements.startTime.value = formatTime(start);
  form.elements.endTime.value = formatTime(end);
  form.elements.allDay.checked = event?.allDay || false;
  form.elements.category.value = event?.category || "personal";
  form.elements.location.value = event?.location || "";
  form.elements.note.value = event?.note || "";
  $("calendarEventReminders").innerHTML = reminderCheckboxes(event?.reminderMinutes || []);
  $("calendarEditorTitle").textContent = event ? "予定を編集" : "予定を追加";
  $("calendarEditorOverlay").hidden = false;
  form.elements.title.focus();
}
function closeEditor() { $("calendarEditorOverlay").hidden = true; editingEvent = null; }

$("calendarPrev").onclick = () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1); render(); };
$("calendarNext").onclick = () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1); render(); };
$("calendarToday").onclick = () => { selectedDate = dateKey(new Date()); visibleMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1); render(); };
$("calendarNewEvent").onclick = () => openEditor();
$("calendarAddOnDay").onclick = () => openEditor();
document.querySelectorAll(".calendar-filters button").forEach((button) => {
  button.onclick = () => { filter = button.dataset.filter; render(); };
});
$("calendarDetailClose").onclick = closeDetail;
$("calendarEditorClose").onclick = closeEditor;
$("calendarDetailOverlay").onclick = (event) => { if (event.target.id === "calendarDetailOverlay") closeDetail(); };
$("calendarEditorOverlay").onclick = (event) => { if (event.target.id === "calendarEditorOverlay") closeEditor(); };
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeDetail(); closeEditor(); } });
$("calendarDetailOpen").onclick = () => {
  if (!activeEvent) return;
  location.href = activeEvent.kind === "assignment" ? (activeEvent.url || "assignments.html") : "personal_timetable.html";
};
$("calendarDetailEdit").onclick = () => { if (activeEvent?.kind === "personal") { const event = activeEvent; closeDetail(); openEditor(event); } };
$("calendarDetailDelete").onclick = async () => {
  if (activeEvent?.kind !== "personal") return;
  if (!confirm(`「${activeEvent.title}」を削除しますか？`)) return;
  try { await deleteDoc(doc(db, "calendarEvents", activeEvent.id)); closeDetail(); await loadCalendarData(); showMessage("予定を削除しました。"); }
  catch (error) { showMessage(`削除できませんでした：${error.message}`, true); }
};
$("calendarAssignmentReminderSave").onclick = async () => {
  if (activeEvent?.kind !== "assignment") return;
  const minutes = safeReminderMinutes([...$("calendarAssignmentReminderChoices").querySelectorAll("input:checked")].map((input) => input.value));
  try {
    await setDoc(doc(db, "calendarReminderPreferences", studentNumber, "items", activeEvent.id), { reminderMinutes: minutes, updatedAt: serverTimestamp() });
    reminderPreferences.set(activeEvent.id, minutes);
    showMessage("課題のリマインダーを保存しました。");
  } catch (error) { showMessage(`通知設定を保存できませんでした：${error.message}`, true); }
};
$("calendarEventForm").onsubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const title = form.elements.title.value.trim();
  const allDay = form.elements.allDay.checked;
  const startAt = new Date(`${form.elements.startDate.value}T${allDay ? "00:00" : form.elements.startTime.value || "09:00"}:00`);
  const endAt = new Date(`${form.elements.endDate.value}T${allDay ? "23:59" : form.elements.endTime.value || "10:00"}:00`);
  if (!title || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt < startAt) {
    showMessage("タイトルと正しい開始・終了日時を入力してください。", true); return;
  }
  const reminderMinutes = safeReminderMinutes([...$("calendarEventReminders").querySelectorAll("input:checked")].map((input) => input.value));
  const data = { ownerId: studentNumber, title, startAt, endAt, allDay,
    category: form.elements.category.value, location: form.elements.location.value.trim(),
    note: form.elements.note.value.trim(), reminderMinutes, updatedAt: serverTimestamp() };
  try {
    if (editingEvent) await updateDoc(doc(db, "calendarEvents", editingEvent.id), data);
    else await addDoc(collection(db, "calendarEvents"), { ...data, createdAt: serverTimestamp() });
    selectedDate = dateKey(startAt);
    visibleMonth = new Date(startAt.getFullYear(), startAt.getMonth(), 1);
    closeEditor(); await loadCalendarData(); showMessage("予定を保存しました。");
  } catch (error) { showMessage(`予定を保存できませんでした：${error.message}`, true); }
};

await initializePage([
  setupAdminTab(), loadUserName($("userName")), loadProfileImage($("topProfileImage")),
  loadMyRanking(), updateAssignmentNavBadge(), updateNewsNavBadge(), loadCalendarData(),
]);
