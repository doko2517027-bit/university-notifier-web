import {
  db,
  studentNumber,
  isAdmin,
  setupTheme,
  setupAdminTab,
  showPage,
  showToast,
} from "./common.js?v=20261029-1";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
const openList = document.getElementById("openReportList"),
  resolvedList = document.getElementById("resolvedReportList"),
  openSection = document.getElementById("openReportsSection"),
  resolvedSection = document.getElementById("resolvedReportsSection"),
  openButton = document.getElementById("showOpenReports"),
  resolvedButton = document.getElementById("showResolvedReports");
const resolvedStatuses = new Set(["closed", "corrected", "resolved"]);
let reports = [];
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char],
  );
if (!(await isAdmin())) {
  alert("管理者のみ利用できます");
  location.replace("app.html");
}
setupTheme(document.getElementById("themeButton"));
setupAdminTab();
document.getElementById("backButton").onclick = () =>
  (location.href = "admin.html");
function setView(view) {
  const resolved = view === "resolved";
  openSection.hidden = resolved;
  resolvedSection.hidden = !resolved;
  openButton.classList.toggle("btn-primary", !resolved);
  resolvedButton.classList.toggle("btn-primary", resolved);
  history.replaceState(
    null,
    "",
    `reports_admin.html?view=${resolved ? "resolved" : "open"}`,
  );
}
openButton.onclick = () => setView("open");
resolvedButton.onclick = () => setView("resolved");
setView(new URLSearchParams(location.search).get("view"));
async function resolveNames(items) {
  const cache = new Map();
  await Promise.all(
    items
      .filter(
        (item) =>
          item.data.type === "questionAnswer" &&
          item.data.subjectId &&
          item.data.unitId,
      )
      .map(async (item) => {
        const key = `${item.data.subjectId}|${item.data.unitId}`;
        if (cache.has(key)) return;
        const [subject, unit] = await Promise.all([
          getDoc(doc(db, "examSubjects", item.data.subjectId)),
          getDoc(
            doc(
              db,
              "examSubjects",
              item.data.subjectId,
              "units",
              item.data.unitId,
            ),
          ),
        ]);
        cache.set(key, {
          subject:
            subject.data()?.name ||
            subject.data()?.subjectName ||
            item.data.subjectId,
          unit: unit.data()?.name || unit.data()?.unitName || item.data.unitId,
        });
      }),
  );
  return cache;
}
function card(item, names, resolved) {
  const report = item.data,
    labels =
      names.get(`${report.subjectId || ""}|${report.unitId || ""}`) || {};
  return `<article class="card setting-card report-management-card"><div class="report-card-heading"><b>テスト問題の答え</b><span class="report-status ${resolved ? "is-resolved" : "is-open"}">${resolved ? (report.status === "corrected" ? "修正済み" : "解決済み") : "未解決"}</span></div><p><b>科目：</b>${escapeHtml(labels.subject || "-")}<br><b>単元：</b>${escapeHtml(labels.unit || "-")}<br><b>問題形式：</b>${escapeHtml(report.questionType || "-")}</p><p><b>問題文</b><br>${escapeHtml(report.question || "-")}</p><p><b>登録された答え</b><br>${escapeHtml(Array.isArray(report.registeredAnswer) ? report.registeredAnswer.join(" / ") : (report.registeredAnswer ?? "-"))}</p><p><b>報告者：</b>${escapeHtml(report.reporterStudentNumber || "-")}<br><b>理由：</b>${escapeHtml(report.reason || "-")}</p><div class="report-actions">${!resolved ? `<a class="btn btn-primary" href="question_report_edit.html?reportId=${encodeURIComponent(item.id)}">問題を直接修正</a>` : ""}${resolved ? `<button class="btn reopen-report" data-id="${item.id}">未解決へ戻す</button>` : `<button class="btn close-report" data-id="${item.id}">対応済みにする</button>`}</div></article>`;
}
async function render() {
  const names = await resolveNames(reports),
    open = reports.filter(
      (item) => !resolvedStatuses.has(item.data.status || "open"),
    ),
    resolved = reports.filter((item) =>
      resolvedStatuses.has(item.data.status || "open"),
    );
  document.getElementById("openReportCount").textContent = open.length;
  document.getElementById("resolvedReportCount").textContent = resolved.length;
  const badge = document.getElementById("reportsUnresolvedBadge");
  badge.textContent = open.length;
  badge.hidden = !open.length;
  openList.innerHTML =
    open.map((item) => card(item, names, false)).join("") ||
    '<div class="card setting-card">未解決の通報はありません。</div>';
  resolvedList.innerHTML =
    resolved.map((item) => card(item, names, true)).join("") ||
    '<div class="card setting-card">解決済みの履歴はありません。</div>';
}
await new Promise((resolve) => {
  let firstSnapshot = true;
  onSnapshot(
    query(collection(db, "reports"), orderBy("createdAt", "desc")),
    async (snapshot) => {
      reports = snapshot.docs
        .map((item) => ({ id: item.id, data: item.data() }))
        .filter((item) => item.data.type === "questionAnswer");
      try {
        await render();
      } catch (error) {
        console.error("報告一覧の表示エラー:", error);
      } finally {
        if (firstSnapshot) {
          firstSnapshot = false;
          resolve();
        }
      }
    },
    (error) => {
      console.error("報告一覧の読み込みエラー:", error);
      openList.textContent = "報告一覧を読み込めませんでした。";
      if (firstSnapshot) {
        firstSnapshot = false;
        resolve();
      }
    },
  );
});
document.addEventListener("click", async (event) => {
  const close = event.target.closest(".close-report"),
    reopen = event.target.closest(".reopen-report");
  if (close) {
    await updateDoc(doc(db, "reports", close.dataset.id), {
      status: "resolved",
      resolvedAt: serverTimestamp(),
      resolvedBy: studentNumber,
    });
    showToast("解決済みに移動しました");
  } else if (reopen) {
    await updateDoc(doc(db, "reports", reopen.dataset.id), {
      status: "open",
      reopenedAt: serverTimestamp(),
      reopenedBy: studentNumber,
    });
    showToast("未解決へ戻しました");
  }
});
showPage();
