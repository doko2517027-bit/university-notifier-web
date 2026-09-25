import { db, isAdmin, setupTheme, initializePage, setupAdminTab, loadUserName, loadProfileImage } from "./common.js";
import { REMINDER_OPTIONS, dateKey, safeReminderMinutes } from "./calendar_model.mjs";
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const toDate = (value) => value?.toDate?.() || new Date(value);
const formatTime = (date) => date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
let events = [];
let editingId = null;

setupTheme($("themeButton"));
$("profileButton").onclick = () => { location.href = "profile.html"; };
if (!(await isAdmin())) {
  location.replace("admin.html");
  throw new Error("管理者権限がありません。");
}
$("calendarSharedReminders").innerHTML = REMINDER_OPTIONS.map(({ minutes, label }) => `<label><input type="checkbox" value="${minutes}" />${label}</label>`).join("");
const form = $("calendarSharedForm");
function message(text, error = false) { $("calendarAdminMessage").textContent = text; $("calendarAdminMessage").classList.toggle("error", error); }
function audience(item) { return [item.department || "全学科", item.major || "全専攻", item.grade ? `${item.grade}年` : "全学年"].join(" / "); }

async function load() {
  try {
    const snapshot = await getDocs(collection(db, "calendarSharedEvents"));
    events = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => toDate(a.startAt) - toDate(b.startAt));
    $("calendarSharedList").innerHTML = events.length ? events.map((item) => {
      const start = toDate(item.startAt);
      return `<article class="calendar-admin-item"><div><b>${escapeHtml(item.title)}</b><small>${escapeHtml(dateKey(start))} ${item.allDay ? "終日" : formatTime(start)}・${escapeHtml(audience(item))}</small>${item.location ? `<small>${escapeHtml(item.location)}</small>` : ""}</div><div><button type="button" data-edit="${item.id}" class="btn">編集</button><button type="button" data-delete="${item.id}" class="btn calendar-danger">削除</button></div></article>`;
    }).join("") : "共有予定はまだありません。";
    $("calendarSharedList").querySelectorAll("[data-edit]").forEach((button) => { button.onclick = () => edit(button.dataset.edit); });
    $("calendarSharedList").querySelectorAll("[data-delete]").forEach((button) => { button.onclick = () => remove(button.dataset.delete); });
  } catch (error) { message(`共有予定を取得できませんでした：${error.message}`, true); }
}

function resetForm() {
  editingId = null; form.reset();
  $("calendarAdminFormTitle").textContent = "共有予定を登録";
  $("calendarAdminCancel").hidden = true;
}
function edit(id) {
  const item = events.find((event) => event.id === id);
  if (!item) return;
  editingId = id;
  const start = toDate(item.startAt), end = toDate(item.endAt);
  form.elements.title.value = item.title || "";
  form.elements.department.value = item.department || "";
  form.elements.major.value = item.major || "";
  form.elements.grade.value = item.grade || "";
  form.elements.startDate.value = dateKey(start);
  form.elements.startTime.value = formatTime(start);
  form.elements.endDate.value = dateKey(end);
  form.elements.endTime.value = formatTime(end);
  form.elements.allDay.checked = item.allDay === true;
  form.elements.location.value = item.location || "";
  form.elements.note.value = item.note || "";
  $("calendarSharedReminders").querySelectorAll("input").forEach((input) => { input.checked = (item.reminderMinutes || []).includes(Number(input.value)); });
  $("calendarAdminFormTitle").textContent = "共有予定を編集";
  $("calendarAdminCancel").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function remove(id) {
  const item = events.find((event) => event.id === id);
  if (!item || !confirm(`「${item.title}」を削除しますか？`)) return;
  try { await deleteDoc(doc(db, "calendarSharedEvents", id)); await load(); message("共有予定を削除しました。"); }
  catch (error) { message(`削除できませんでした：${error.message}`, true); }
}
$("calendarAdminCancel").onclick = resetForm;
form.onsubmit = async (event) => {
  event.preventDefault();
  const allDay = form.elements.allDay.checked;
  const startAt = new Date(`${form.elements.startDate.value}T${allDay ? "00:00" : form.elements.startTime.value || "09:00"}:00`);
  const endAt = new Date(`${form.elements.endDate.value}T${allDay ? "23:59" : form.elements.endTime.value || "10:00"}:00`);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt < startAt) { message("開始・終了日時を確認してください。", true); return; }
  const data = {
    title: form.elements.title.value.trim(), department: form.elements.department.value,
    major: form.elements.major.value, grade: form.elements.grade.value,
    startAt, endAt, allDay, location: form.elements.location.value.trim(), note: form.elements.note.value.trim(),
    reminderMinutes: safeReminderMinutes([...$("calendarSharedReminders").querySelectorAll("input:checked")].map((input) => input.value)),
    updatedAt: serverTimestamp(),
  };
  if (!data.title) { message("タイトルを入力してください。", true); return; }
  try {
    if (editingId) await updateDoc(doc(db, "calendarSharedEvents", editingId), data);
    else await addDoc(collection(db, "calendarSharedEvents"), { ...data, createdAt: serverTimestamp() });
    resetForm(); await load(); message("共有予定を保存しました。");
  } catch (error) { message(`共有予定を保存できませんでした：${error.message}`, true); }
};
await initializePage([setupAdminTab(), loadUserName($("userName")), loadProfileImage($("topProfileImage")), load()]);
