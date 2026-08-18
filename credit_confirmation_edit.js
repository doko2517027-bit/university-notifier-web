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
  withAdminScope,
} from "./admin_scope.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const params = new URLSearchParams(location.search);
const targetStudent = String(params.get("student") || "").replace(/\D/g, "");
const academicYear = Number(params.get("academicYear"));
const semester = params.get("semester") === "後期" ? "後期" : "前期";
const scope = readAdminScopeFromUrl();
const title = document.getElementById("creditEditStudent");
const help = document.getElementById("creditEditHelp");
const list = document.getElementById("creditEditList");
const saveButton = document.getElementById("saveCreditEdit");
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

if (
  !(await isAdmin()) ||
  !/^\d{7}$/.test(targetStudent) ||
  !Number.isInteger(academicYear)
) {
  alert("編集できません");
  location.replace(withAdminScope("credit_confirmation_admin.html"));
} else {
  setupTheme(document.getElementById("themeButton"));
  setupAdminTab();
  document.getElementById("backButton").onclick = () =>
    (location.href = withAdminScope("credit_confirmation_admin.html"));
  await load();
  showPage();
}

async function load() {
  try {
    const [userSnap, enrollmentSnap] = await Promise.all([
      getDoc(doc(db, "users", targetStudent)),
      getDocs(collection(db, "users", targetStudent, "enrolledSubjects")),
    ]);
    if (!userSnap.exists() || !matchesAdminScope(userSnap.data(), scope))
      throw new Error("対象外の学生です");
    const user = userSnap.data() || {};
    const response = user.creditConfirmationResponse;
    const results =
      Number(response?.academicYear) === academicYear &&
      response?.semester === semester
        ? response.results || {}
        : {};
    title.textContent = `${user.name || user.userName || user.displayName || "氏名未設定"}（${targetStudent}）`;
    help.textContent = `${academicYear}年度 ${semester}の単位取得結果を編集します。未取得にすると再履修になります。`;
    const courses = enrollmentSnap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.status !== "removed")
      .filter((item) => {
        const value = String(item.registeredSemester || item.semester || "");
        return !value || value === semester || value === "通年";
      })
      .sort((a, b) =>
        String(a.name || a.subject || a.id).localeCompare(
          String(b.name || b.subject || b.id),
          "ja",
        ),
      );
    list.innerHTML =
      courses
        .map((course) => {
          const subject =
            course.name || course.subject || course.subjectKey || course.id;
          const status = results[course.id] || course.creditStatus || "earned";
          return `<label class="credit-confirmation-item" data-course="${escapeHtml(course.id)}"><span>${escapeHtml(subject)}</span><select><option value="earned" ${status === "earned" ? "selected" : ""}>取得できた</option><option value="not_earned" ${status === "not_earned" ? "selected" : ""}>取得できなかった（再履修）</option></select></label>`;
        })
        .join("") || "<p>対象科目がありません。</p>";
  } catch (error) {
    console.error(error);
    list.innerHTML = "<p>学生情報を取得できませんでした。</p>";
    saveButton.hidden = true;
  }
}

saveButton.onclick = async () => {
  const rows = [...list.querySelectorAll("[data-course]")];
  if (!rows.length || !confirm("単位取得結果を保存しますか？")) return;
  saveButton.disabled = true;
  try {
    const batch = writeBatch(db),
      results = {};
    rows.forEach((row) => {
      const courseId = row.dataset.course;
      const status =
        row.querySelector("select")?.value === "not_earned"
          ? "not_earned"
          : "earned";
      results[courseId] = status;
      batch.set(
        doc(db, "users", targetStudent, "enrolledSubjects", courseId),
        {
          creditStatus: status,
          creditConfirmedAcademicYear: academicYear,
          creditConfirmedSemester: semester,
          creditConfirmedAt: new Date().toISOString(),
          isRetake: status === "not_earned",
          retakeLabel: status === "not_earned" ? "再履修" : null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });
    batch.update(doc(db, "users", targetStudent), {
      creditConfirmationResponse: {
        academicYear,
        semester,
        results,
        submittedAt: new Date().toISOString(),
        editedAt: new Date().toISOString(),
        editedBy: studentNumber || "",
      },
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    showToast("単位取得結果を保存しました");
  } catch (error) {
    console.error(error);
    showToast("保存に失敗しました");
  } finally {
    saveButton.disabled = false;
  }
};
