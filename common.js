// Shared client helpers for the three role-specific CareMate tabs.
import { auth, db, functions } from "./auth_core.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { initializeGlobalStudyTracking } from "./study_tracking.js";

export { auth, db, functions };
export let studentNumber = localStorage.getItem("studentNumber");
export function setStudentNumber(value) { studentNumber = String(value || ""); }

export function normalizeNavigation() {
  const role = document.documentElement.dataset.caremateRole;
  if (!role) return;
  const current = location.pathname.split("/").pop();
  const entries = [
    { href: "app.html", label: "テスト", pages: ["app.html", "exam.html", "quiz.html", "fill_blank.html", "daily_question.html", "qa.html", "study_analytics.html", "must_remember.html"] },
    { href: role === "admin" ? "admin.html" : "settings.html", label: role === "admin" ? "管理" : "設定", pages: role === "admin" ? ["admin.html", "exam_admin.html", "exam_questions_admin.html", "exam_materials_admin.html", "reports_admin.html", "question_report_edit.html", "entrance_admin.html", "settings.html"] : ["settings.html"] },
    { href: "assignments.html", label: "課題", pages: ["assignments.html"] },
  ];
  for (const nav of document.querySelectorAll(".bottom-nav")) {
    nav.replaceChildren();
    for (const entry of entries) {
      const link = document.createElement("a");
      link.href = entry.href;
      link.textContent = entry.label;
      if (entry.pages.includes(current)) link.classList.add("active");
      nav.append(link);
    }
  }
}

export function setupTheme(button) {
  if (localStorage.getItem("theme") === "dark") document.documentElement.classList.add("dark");
  if (!button) return;
  button.addEventListener("click", () => {
    const dark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", dark ? "dark" : "light");
  });
}

export function showPage() {
  document.body.classList.remove("page-loading");
  document.body.classList.add("page-loaded");
}

export async function initializePage(tasks = []) {
  normalizeNavigation();
  showPage();
  initializeGlobalStudyTracking({ db, studentNumber, loggedIn: true });
  const outcomes = await Promise.allSettled(tasks);
  for (const outcome of outcomes) {
    if (outcome.status === "rejected") console.error("画面の初期読み込みエラー:", outcome.reason);
  }
}

export async function loadProfileImage(img) {
  if (!img || !studentNumber) return;
  try {
    const publicSnap = await getDoc(doc(db, "publicUsers", studentNumber));
    const publicPhoto = publicSnap.data()?.photo;
    if (typeof publicPhoto === "string" && publicPhoto) { img.src = publicPhoto; return; }
    const userSnap = await getDoc(doc(db, "users", studentNumber));
    const privatePhoto = userSnap.data()?.profile?.photo;
    if (typeof privatePhoto === "string" && privatePhoto) { img.src = privatePhoto; return; }
  } catch (error) { console.warn("プロフィール画像を読み込めませんでした:", error); }
  img.src = "icon-192.png";
}

export async function isAdmin() {
  if (!studentNumber || auth.currentUser?.uid !== `caremate-${studentNumber}`) return false;
  const snapshot = await getDoc(doc(db, "access", auth.currentUser.uid));
  return snapshot.data()?.active === true && snapshot.data()?.role === "admin";
}

export async function setupAdminTab() { normalizeNavigation(); }
export async function updateAssignmentNavBadge() { /* Retired legacy badge. */ }
export async function updateNewsNavBadge() { /* University news was retired. */ }
export function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "cm-toast";
  toast.textContent = String(message || "");
  document.body.append(toast);
  setTimeout(() => toast.remove(), 3500);
}

// Existing manaba data uses this AES-GCM format. Keep it until a verified
// server-side credential migration is ready; changing it would break Render.
const MANABA_LEGACY_KEY = "UniversityNotifier2026";
export async function encryptData(value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(MANABA_LEGACY_KEY.padEnd(32, "0")), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(value)));
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}
