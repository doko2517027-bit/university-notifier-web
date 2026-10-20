import { auth, db, signOutCareMate } from "./auth_core.js";
import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { functions } from "./auth_core.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

const target = document.getElementById("accessList");
const newAccountForm = document.getElementById("newAccountForm");
const newAccountStatus = document.getElementById("newAccountStatus");
document.getElementById("signOutButton").addEventListener("click", () => {
  void signOutCareMate();
});

newAccountForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = newAccountForm.querySelector("button[type=submit]");
  const studentNumber = document.getElementById("newStudentNumber").value.trim();
  const name = document.getElementById("newStudentName").value.trim();
  const passwordInput = document.getElementById("newStudentPassword");
  button.disabled = true;
  newAccountStatus.textContent = "登録しています…";
  try {
    await httpsCallable(functions, "createCareMateAccount")({
      studentNumber, name, password: passwordInput.value,
    });
    passwordInput.value = "";
    document.getElementById("newStudentNumber").value = "";
    document.getElementById("newStudentName").value = "";
    newAccountStatus.textContent = `${studentNumber} のアカウントを登録しました。`;
    await renderAccessList();
  } catch (error) {
    console.error("学生アカウント登録エラー:", error);
    const messages = {
      "functions/already-exists": "この学籍番号はすでに登録されています。",
      "functions/invalid-argument": error.message || "入力内容を確認してください。",
      "functions/permission-denied": "管理者権限を確認できませんでした。",
    };
    newAccountStatus.textContent = messages[error?.code] || "登録できませんでした。通信状態をご確認ください。";
  } finally {
    button.disabled = false;
  }
});

async function renderAccessList() {
  try {
  const snapshot = await getDocs(collection(db, "access"));
  const entries = await Promise.all(snapshot.docs.map(async (entry) => {
    const number = entry.id.replace(/^caremate-/, "");
    const user = await getDoc(doc(db, "users", number)).catch(() => null);
    return {
      number,
      name: String(user?.data()?.name || "名前未登録"),
      role: entry.data().role === "admin" ? "管理者" : "学生",
      active: entry.data().active === true,
    };
  }));
  target.replaceChildren();
  for (const item of entries) {
    const card = document.createElement("article");
    card.className = "cm-item";
    const heading = document.createElement("h3");
    heading.textContent = item.name;
    const detail = document.createElement("p");
    detail.textContent = `${item.number} · ${item.role} · ${item.active ? "利用中" : "停止中"}`;
    card.append(heading, detail);
    target.append(card);
  }
  if (!entries.length) target.textContent = "利用アカウントはありません。";
  } catch (error) {
  console.error("利用アカウント一覧エラー:", error);
  target.textContent = "アカウント情報を取得できませんでした。";
  }
}

await renderAccessList();
