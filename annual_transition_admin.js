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
const scopeLabelNode = document.getElementById("annualScopeLabel");
const help = document.getElementById("annualTransitionHelp");
const activationDate = document.getElementById(
  "annualTransitionActivationDate",
);
const startButton = document.getElementById("startAnnualTransition");
const stopButton = document.getElementById("stopAnnualTransition");
const list = document.getElementById("annualTransitionList");
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
  location.replace("index.html");
} else {
  setupTheme(document.getElementById("themeButton"));
  setupAdminTab();
  document.getElementById("backButton").onclick = () =>
    (location.href = withAdminScope("admin.html"));
  scopeLabelNode.textContent = `現在の管理対象：${scopeLabel(scope)}`;
  startButton.onclick = () => saveTransition(true);
  stopButton.onclick = () => saveTransition(false);
  await loadTransition();
  showPage();
}

function academicYearForTransition(date = new Date()) {
  return date.getMonth() < 3 ? date.getFullYear() - 1 : date.getFullYear();
}

function defaultActivationDate() {
  return `${academicYearForTransition() + 1}-04-01`;
}

function responseLabel(action) {
  return (
    {
      promote: "進級",
      repeat: "同学年を継続",
      graduate: "卒業",
      withdraw: "退学",
      leave: "休学を継続",
    }[action] || "未回答"
  );
}

async function loadTransition() {
  try {
    const [systemSnap, usersSnap] = await Promise.all([
      getDoc(doc(db, "system", "app")),
      getDocs(collection(db, "users")),
    ]);
    const transition = systemSnap.data()?.annualTransition || {};
    const active = transition.enabled === true;
    const targetYear = Number(
      transition.academicYear || academicYearForTransition(),
    );
    activationDate.value = transition.activationDate || defaultActivationDate();
    startButton.hidden = active;
    stopButton.hidden = !active;
    help.textContent = active
      ? `${targetYear}年度の本人確認を受付中です。反映予定日：${transition.activationDate || "未設定"}。未回答者のため受付は自動的には終了しません。`
      : "年度末確認を開始すると、対象学生は次回アプリを開いた時に必ず回答します。回答後も反映予定日までは、現在の学年・画面のままです。";
    if (!active && !transition.academicYear) {
      list.innerHTML = "<p>年度末確認はまだ開始していません。</p>";
      return;
    }
    const users = usersSnap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((user) => matchesAdminScope(user, scope))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    list.innerHTML =
      users
        .map((user) => {
          const response = user.annualTransitionResponse;
          const answered = Number(response?.academicYear) === targetYear && response?.decisionVersion === 2;
          const name =
            user.name || user.userName || user.displayName || "氏名未設定";
          return `<article class="attendance-review-card" data-student="${escapeHtml(user.id)}" data-year="${targetYear}">
        <b>${escapeHtml(name)}</b>
        <p>${escapeHtml(user.id)} ／ ${escapeHtml(String(user.grade || "未設定"))}<br>本人の最終回答：${answered ? escapeHtml(responseLabel(response.action)) : "未回答"}</p>
        ${answered && response.overrideReason ? `<p>修正理由：${escapeHtml(response.overrideReason)}</p>` : ""}
      </article>`;
        })
        .join("") || "<p>対象学生はいません。</p>";
  } catch (error) {
    console.error("年度末確認取得エラー:", error);
    list.innerHTML = "<p>年度末確認を取得できませんでした。</p>";
  }
}

async function saveTransition(enabled) {
  const date = activationDate.value;
  if (enabled && !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
    showToast("反映予定日を入力してください");
    return;
  }
  const year = academicYearForTransition();
  const message = enabled
    ? `${year}年度の年度末確認を開始します。学生には必須の確認画面が表示されます。`
    : "年度末確認を停止します。学生の確認画面は表示されなくなります。";
  if (!confirm(message)) return;
  try {
    const previousTransition = enabled ? {} :
      (await getDoc(doc(db, "system", "app"))).data()?.annualTransition || {};
    await setDoc(
      doc(db, "system", "app"),
      {
        annualTransition: {
          enabled,
          academicYear: enabled ? year : previousTransition.academicYear || year,
          activationDate: enabled ? date : previousTransition.activationDate || null,
          startedAt: enabled ? new Date().toISOString() : previousTransition.startedAt || null,
          updatedAt: new Date().toISOString(),
          updatedBy: studentNumber || "",
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    showToast(
      enabled ? "年度末確認を開始しました" : "年度末確認を停止しました",
    );
    await loadTransition();
  } catch (error) {
    console.error("年度末確認保存エラー:", error);
    showToast("設定の保存に失敗しました");
  }
}
