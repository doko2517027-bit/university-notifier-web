import {
  functions,
  auth,
  setupTheme,
  initializePage,
  loadProfileImage,
  loadUserName,
  setupAdminTab,
} from "./common.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";
import { getIdTokenResult } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
const $ = (id) => document.getElementById(id),
  labels = {
    doctor: "医師",
    nurse: "看護師",
    pharmacist: "薬剤師",
    pt: "理学療法士（PT）",
    ot: "作業療法士（OT）",
    st: "言語聴覚士（ST）",
    clerk: "医事・受付",
    auditor: "監査担当",
    administrator: "病院管理者",
  };
setupTheme($("themeButton"));
await initializePage([
  setupAdminTab(),
  loadUserName($("userName")),
  loadProfileImage($("topProfileImage")),
]);
const claims = auth.currentUser
  ? await getIdTokenResult(auth.currentUser)
  : null;
if (
  !(
    claims?.claims?.clinical === true &&
    claims.claims.clinicalRole === "administrator"
  )
) {
  document.querySelector("main").innerHTML =
    '<section class="card setting-card"><h2>病院管理は病院管理者専用です</h2><p>病院を登録したアカウントでClinicalへログインしてください。</p><p><a class="btn btn-primary" href="clinical_entry.html">Clinical入口へ戻る</a></p></section>';
  throw new Error("Clinical hospital administrator only");
}
const hospitalId = String(claims.claims.clinicalHospitalId || "");
$("hospitalId").value = hospitalId;
$("hospitalLabel").textContent = `病院ID：${hospitalId}`;
const list = async () => {
  const area = $("staffList");
  area.textContent = "読み込み中…";
  try {
    const result = await httpsCallable(
      functions,
      "listClinicalStaff",
    )({ hospitalId });
    const staff = result.data?.staff || [];
    area.innerHTML = staff.length
      ? staff
          .map(
            (item) =>
              `<div class="clinical-staff-row"><div><b>${item.staffId}</b><br><small>${labels[item.role] || item.role} ・ ${item.active ? "有効" : "停止中"}</small></div>${item.role === "administrator" ? "" : `<div class="clinical-staff-actions"><button class="btn btn-secondary" data-edit="${item.staffId}" data-role="${item.role}">職種を変更</button><button class="btn btn-danger" data-stop="${item.staffId}" data-role="${item.role}">停止</button></div>`}</div>`,
          )
          .join("")
      : "<p>職員はまだ登録されていません。</p>";
  } catch (error) {
    console.error(error);
    area.textContent = "職員一覧を読み込めませんでした。";
  }
};
$("staffForm").onsubmit = async (e) => {
  e.preventDefault();
  const button = e.submitter,
    status = $("staffStatus");
  button.disabled = true;
  status.textContent = "職員を登録中…";
  try {
    await httpsCallable(
      functions,
      "configureClinicalStaff",
    )({
      hospitalId,
      staffId: $("staffUid").value.trim(),
      role: $("staffRole").value,
      active: true,
    });
    status.textContent =
      "職員と職種を登録しました。対象職員はClinicalへログインできるようになります。";
    e.target.reset();
    $("hospitalId").value = hospitalId;
    await list();
  } catch (error) {
    console.error(error);
    status.textContent =
      error.code === "functions/not-found"
        ? "指定した職員IDのCareMateアカウントが見つかりません。"
        : "職員を登録できませんでした。職員IDを確認してください。";
  } finally {
    button.disabled = false;
  }
};
document.addEventListener("click", async (event) => {
  const edit = event.target.closest("[data-edit]"),
    stop = event.target.closest("[data-stop]");
  if (edit) {
    $("staffUid").value = edit.dataset.edit;
    $("staffRole").value = edit.dataset.role;
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (!stop || !confirm(`${stop.dataset.stop} のClinical権限を停止しますか？`))
    return;
  stop.disabled = true;
  try {
    await httpsCallable(
      functions,
      "configureClinicalStaff",
    )({
      hospitalId,
      staffId: stop.dataset.stop,
      role: stop.dataset.role,
      active: false,
    });
    await list();
  } catch (error) {
    console.error(error);
    alert("停止できませんでした。");
  } finally {
    stop.disabled = false;
  }
});
await list();
