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
  updateDoc,
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
  list.onclick = handleResponseEdit;
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
      promote: "進級予定",
      repeat: "留年",
      graduate: "卒業予定",
      withdraw: "退学",
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
      ? `${targetYear}年度の確認を受付中です。反映予定日：${transition.activationDate || "未設定"}。`
      : "年度末確認を開始すると、対象学生は次回アプリを開いた時に必ず回答します。回答後も反映予定日までは、現在の学年・画面のままです。";
    if (!active) {
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
          const answered = Number(response?.academicYear) === targetYear;
          const name =
            user.name || user.userName || user.displayName || "氏名未設定";
          const grade = Number(String(user.grade || "").replace("年", ""));
          const options =
            grade === 4
              ? [
                  ["graduate", "卒業予定"],
                  ["repeat", "留年"],
                  ["withdraw", "退学"],
                ]
              : [
                  ["promote", "進級予定"],
                  ["repeat", "留年"],
                  ["withdraw", "退学"],
                ];
          return `<article class="attendance-review-card" data-student="${escapeHtml(user.id)}" data-year="${targetYear}">
        <b>${escapeHtml(name)}</b>
        <p>${escapeHtml(user.id)} ／ ${escapeHtml(String(user.grade || "未設定"))}年<br>回答：${answered ? escapeHtml(responseLabel(response.action)) : "未回答"}</p>
        <div class="report-actions">
          <select class="annual-response-select" aria-label="年度末回答を編集">
            ${options.map(([value, label]) => `<option value="${value}" ${answered && response.action === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
          <button class="btn annual-response-save" type="button">回答を保存</button>
        </div>
      </article>`;
        })
        .join("") || "<p>対象学生はいません。</p>";
  } catch (error) {
    console.error("年度末確認取得エラー:", error);
    list.innerHTML = "<p>年度末確認を取得できませんでした。</p>";
  }
}

async function handleResponseEdit(event) {
  const button = event.target.closest(".annual-response-save");
  if (!button) return;
  const card = button.closest("[data-student]");
  const targetStudent = card?.dataset.student;
  const academicYear = Number(card?.dataset.year);
  const action = card?.querySelector(".annual-response-select")?.value;
  if (!targetStudent || !Number.isInteger(academicYear) || !action) return;
  if (
    !confirm(
      `${targetStudent} の回答を「${responseLabel(action)}」へ変更しますか？`,
    )
  )
    return;
  button.disabled = true;
  try {
    await updateDoc(doc(db, "users", targetStudent), {
      annualTransitionResponse: {
        academicYear,
        action,
        submittedAt: new Date().toISOString(),
        editedAt: new Date().toISOString(),
        editedBy: studentNumber || "",
      },
      updatedAt: serverTimestamp(),
    });
    showToast("回答を更新しました");
    await loadTransition();
  } catch (error) {
    console.error("年度末回答の編集エラー:", error);
    showToast("回答を更新できませんでした");
    button.disabled = false;
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
    await setDoc(
      doc(db, "system", "app"),
      {
        annualTransition: {
          enabled,
          academicYear: year,
          activationDate: enabled ? date : null,
          startedAt: enabled ? new Date().toISOString() : null,
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
