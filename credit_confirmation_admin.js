import {
  db,
  studentNumber,
  isAdmin,
  setupTheme,
  setupAdminTab,
  showPage,
  showToast,
} from "./common.js";
import {
  readAdminScopeFromUrl,
  matchesAdminScope,
  scopeLabel,
  withAdminScope,
} from "./admin_scope.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const scope = readAdminScopeFromUrl();
const scopeLabelNode = document.getElementById("creditScopeLabel");
const help = document.getElementById("creditConfirmationHelp");
const academicYearInput = document.getElementById("creditAcademicYear");
const semesterInput = document.getElementById("creditSemester");
const startButton = document.getElementById("startCreditConfirmation");
const stopButton = document.getElementById("stopCreditConfirmation");
const list = document.getElementById("creditConfirmationAdminList");
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
const currentAcademicYear = () =>
  new Date().getMonth() < 3
    ? new Date().getFullYear() - 1
    : new Date().getFullYear();

if (!(await isAdmin())) {
  alert("管理者のみ利用できます");
  location.replace("index.html");
} else {
  setupTheme(document.getElementById("themeButton"));
  setupAdminTab();
  document.getElementById("backButton").onclick = () =>
    (location.href = withAdminScope("admin.html"));
  scopeLabelNode.textContent = `現在の管理対象：${scopeLabel(scope)}`;
  startButton.onclick = () => saveConfig(true);
  stopButton.onclick = () => saveConfig(false);
  await load();
  showPage();
}

async function load() {
  try {
    const [systemSnap, usersSnap] = await Promise.all([
      getDoc(doc(db, "system", "app")),
      getDocs(collection(db, "users")),
    ]);
    const config = systemSnap.data()?.creditConfirmation || {};
    const active = config.enabled === true;
    const academicYear = Number(config.academicYear || currentAcademicYear());
    const semester = config.semester === "後期" ? "後期" : "前期";
    academicYearInput.value = academicYear;
    semesterInput.value = semester;
    startButton.hidden = active;
    stopButton.hidden = !active;
    help.textContent = active
      ? `${academicYear}年度 ${semester}の単位取得確認を受付中です。`
      : "開始すると、対象学生は次回ホームを開いた時に回答します。";
    if (!active) {
      list.innerHTML = "<p>単位取得確認はまだ開始していません。</p>";
      return;
    }
    const users = usersSnap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((user) => matchesAdminScope(user, scope))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    list.innerHTML =
      users
        .map((user) => {
          const answer = user.creditConfirmationResponse;
          const answered =
            Number(answer?.academicYear) === academicYear &&
            answer?.semester === semester;
          const values = Object.values(answered ? answer.results || {} : {});
          const retakes = values.filter(
            (value) => value === "not_earned",
          ).length;
          const name =
            user.name || user.userName || user.displayName || "氏名未設定";
          return `<article class="attendance-review-card"><b>${escapeHtml(name)}</b><p>${escapeHtml(user.id)} ／ ${escapeHtml(String(user.grade || "未設定"))}年<br>回答：${answered ? `済み（再履修 ${retakes}科目）` : "未回答"}</p><div class="report-actions"><a class="btn" href="${withAdminScope(`credit_confirmation_edit.html?student=${encodeURIComponent(user.id)}&academicYear=${academicYear}&semester=${encodeURIComponent(semester)}`)}">単位取得結果を編集</a></div></article>`;
        })
        .join("") || "<p>対象学生はいません。</p>";
  } catch (error) {
    console.error("単位取得確認の取得エラー:", error);
    list.innerHTML = "<p>取得できませんでした。</p>";
  }
}

async function saveConfig(enabled) {
  const academicYear = Number(academicYearInput.value);
  const semester = semesterInput.value;
  if (
    enabled &&
    (!Number.isInteger(academicYear) || !["前期", "後期"].includes(semester))
  ) {
    showToast("年度と学期を選択してください");
    return;
  }
  if (
    !confirm(
      enabled
        ? `${academicYear}年度 ${semester}の単位取得確認を開始しますか？`
        : "単位取得確認を停止しますか？",
    )
  )
    return;
  try {
    await setDoc(
      doc(db, "system", "app"),
      {
        creditConfirmation: {
          enabled,
          academicYear,
          semester,
          updatedAt: new Date().toISOString(),
          updatedBy: studentNumber || "",
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    showToast(
      enabled ? "単位取得確認を開始しました" : "単位取得確認を停止しました",
    );
    await load();
  } catch (error) {
    console.error("単位取得確認の保存エラー:", error);
    showToast("保存に失敗しました");
  }
}
