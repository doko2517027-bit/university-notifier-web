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
  const assignmentAccess = document.documentElement.dataset.assignmentAccess !== "false";
  const entries = [
    { href: "exam.html", icon: "📖", label: "勉強", pages: ["app.html", "exam.html", "quiz.html", "fill_blank.html", "daily_question.html", "qa.html", "study_analytics.html", "must_remember.html"] },
    ...(assignmentAccess ? [{ href: "assignments.html", icon: "📚", label: "課題", pages: ["assignments.html"] }] : []),
    { href: "home.html", icon: "🏠", label: "ホーム", pages: ["home.html"] },
    { href: role === "admin" ? "admin.html" : "settings.html", icon: role === "admin" ? "👑" : "⚙️", label: role === "admin" ? "管理" : "設定", pages: role === "admin" ? ["admin.html", "admin_users.html", "exam_admin.html", "exam_questions_admin.html", "exam_materials_admin.html", "reports_admin.html", "question_report_edit.html", "entrance_admin.html", "settings.html"] : ["settings.html"] },
  ];
  for (const nav of document.querySelectorAll(".bottom-nav, .cm-nav")) {
    nav.replaceChildren();
    nav.setAttribute("aria-label", "メインメニュー");
    for (const entry of entries) {
      const link = document.createElement("a");
      link.href = entry.href;
      const icon = document.createElement("span");
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = entry.icon;
      const label = document.createElement("span");
      label.textContent = entry.label;
      link.append(icon, label);
      if (entry.pages.includes(current)) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      }
      nav.append(link);
    }
  }
}

export function setupTheme(button) {
  if (window.CareMatePreferences) {
    window.CareMatePreferences.bind(button);
    return;
  }
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
