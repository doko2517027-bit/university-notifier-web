import { functions } from "./auth_core.js";
import { encryptData } from "./common.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

const list = document.getElementById("adminUserList");
const status = document.getElementById("adminUsersStatus");
const search = document.getElementById("userSearch");
const filter = document.getElementById("userRoleFilter");
let allAccounts = [];
let canManageRoles = false;
let currentStudentNumber = "";
const call = (name, data = {}) => httpsCallable(functions, name)(data);
const node = (tag, value = "", className = "") => {
  const element = document.createElement(tag);
  element.textContent = value;
  element.className = className;
  return element;
};

function field(labelText, type, autoComplete = "off") {
  const label = node("label", "", "cm-field");
  label.append(document.createTextNode(labelText));
  const input = document.createElement("input");
  input.type = type;
  input.autocomplete = autoComplete;
  if (type === "password") input.maxLength = 128;
  label.append(input);
  return { label, input };
}

function formCard(account, kind) {
  const form = document.createElement("form");
  form.className = "cm-user-action";
  const output = node("p", "", "cm-status");
  if (kind === "app") {
    form.append(node("h4", "アプリパスワード"));
    const password = field("新しいアプリパスワード", "password", "new-password");
    password.input.minLength = 6;
    const confirmation = field("新しいパスワード（再入力）", "password", "new-password");
    confirmation.input.minLength = 6;
    form.append(password.label, confirmation.label);
    const submit = node("button", "アプリパスワードを再設定", "cm-button cm-button-primary");
    submit.type = "submit";
    form.append(submit, output);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (password.input.value !== confirmation.input.value) {
        output.textContent = "確認用パスワードが一致しません。";
        return;
      }
      submit.disabled = true;
      output.textContent = "変更中…";
      try {
        await call("adminSetStudentAppPassword", { studentNumber: account.studentNumber, password: password.input.value });
        form.reset();
        output.textContent = "アプリパスワードを変更しました。";
      } catch (error) {
        console.error("管理者によるアプリパスワード再設定エラー:", error);
        output.textContent = error.code === "functions/not-found" ? "利用中の学生が見つかりません。" : "変更できませんでした。";
      } finally { submit.disabled = false; }
    });
  } else {
    form.append(node("h4", "manabaパスワード"));
    const password = field("manabaパスワード", "password");
    form.append(password.label);
    const submit = node("button", account.hasManabaPassword ? "manabaパスワードを変更" : "manabaパスワードを登録", "cm-button");
    submit.type = "submit";
    form.append(submit, output);
    if (account.hasManabaPassword) {
      const remove = node("button", "manabaパスワードを削除", "cm-button cm-button-danger");
      remove.type = "button";
      remove.addEventListener("click", async () => {
        if (!confirm(`${account.studentNumber} のmanabaパスワードを削除しますか？課題の自動取得が停止する場合があります。`)) return;
        remove.disabled = true;
        output.textContent = "削除中…";
        try {
          await call("adminRemoveStudentManabaPassword", { studentNumber: account.studentNumber });
          output.textContent = "manabaパスワードを削除しました。";
          account.hasManabaPassword = false;
          await loadUsers();
        } catch (error) {
          console.error("manabaパスワード削除エラー:", error);
          output.textContent = "削除できませんでした。";
          remove.disabled = false;
        }
      });
      form.append(remove);
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!password.input.value) { output.textContent = "manabaパスワードを入力してください。"; return; }
      submit.disabled = true;
      output.textContent = "保存中…";
      try {
        const encryptedPassword = await encryptData(password.input.value);
        await call("adminSetStudentManabaPassword", { studentNumber: account.studentNumber, encryptedPassword });
        form.reset();
        output.textContent = "manabaパスワードを保存しました。";
      } catch (error) {
        console.error("管理者によるmanabaパスワード保存エラー:", error);
        output.textContent = error.code === "functions/not-found" ? "利用中の学生が見つかりません。" : "保存できませんでした。";
      } finally { submit.disabled = false; }
    });
  }
  return form;
}

function accountCard(account) {
  const article = node("article", "", "cm-item cm-admin-user");
  const head = node("div", "", "cm-admin-user-head");
  head.append(node("h3", account.name), node("span", account.studentNumber, "cm-admin-user-id"));
  const meta = node("div", "", "cm-admin-user-meta");
  meta.append(node("span", account.studentNumber === "2510044" ? "主管理者" : account.role === "admin" ? "管理者" : "学生", `cm-admin-chip ${account.role}`));
  meta.append(node("span", account.active ? "利用中" : "登録解除済み", `cm-admin-chip ${account.active ? "" : "inactive"}`));
  meta.append(node("span", `manaba ${account.hasManabaPassword ? "登録済み" : "未登録"}`, "cm-admin-chip"));
  article.append(head, meta);
  if (!account.active) return article;
  const canEditAccount = account.studentNumber !== currentStudentNumber && (canManageRoles || account.role !== "admin");
  if (!canEditAccount && account.studentNumber !== "2510044") article.append(node("p", "管理者アカウントの変更は主管理者のみ可能です。"));
  if (!canEditAccount && account.studentNumber === "2510044") article.append(node("p", "主管理者アカウントは他の管理者から変更できません。"));
  if (!canEditAccount) return article;
  const details = document.createElement("details");
  details.className = "cm-details";
  const summary = node("summary", "設定・パスワードを開く");
  details.append(summary, formCard(account, "manaba"), formCard(account, "app"));
  if (canManageRoles && account.studentNumber !== "2510044") {
    const roleBox = node("div", "", "cm-user-action");
    roleBox.append(node("h4", "管理者権限"), node("p", account.role === "admin" ? "このユーザーは管理画面を利用できます。" : "現在は学生として利用中です。"));
    const roleButton = node("button", account.role === "admin" ? "管理者権限を解除" : "管理者権限を付与", account.role === "admin" ? "cm-button cm-button-danger" : "cm-button");
    roleButton.type = "button";
    const roleStatus = node("p", "", "cm-status");
    roleButton.addEventListener("click", async () => {
      const role = account.role === "admin" ? "member" : "admin";
      if (!confirm(`${account.name}（${account.studentNumber}）を${role === "admin" ? "管理者" : "学生"}に変更しますか？`)) return;
      roleButton.disabled = true;
      roleStatus.textContent = "権限を変更中…";
      try {
        await call("adminSetCareMateRole", { studentNumber: account.studentNumber, role });
        status.textContent = `${account.studentNumber} の権限を変更しました。画面を再読み込みすると反映されます。`;
        await loadUsers(true);
      } catch (error) {
        roleStatus.textContent = error.code === "functions/permission-denied" ? "主管理者のみ変更できます。" : "権限を変更できませんでした。";
        roleButton.disabled = false;
      }
    });
    roleBox.append(roleButton, roleStatus);
    details.append(roleBox);
  }
  const revoke = node("button", "登録解除", "cm-button cm-button-danger");
  revoke.type = "button";
  revoke.addEventListener("click", async () => {
    const ok = confirm(`${account.name}（${account.studentNumber}）の利用を解除しますか？ログインできなくなります。学習・課題データは復元に備えて保持されます。`);
    if (!ok) return;
    revoke.disabled = true;
    status.textContent = `${account.studentNumber} の登録を解除中…`;
    try {
      await call("adminDeactivateStudent", { studentNumber: account.studentNumber });
      status.textContent = `${account.studentNumber} の利用を解除しました。`;
      await loadUsers();
    } catch (error) {
      console.error("学生登録解除エラー:", error);
      status.textContent = error.code === "functions/not-found" ? "利用中の学生が見つかりません。" : "登録解除できませんでした。";
      revoke.disabled = false;
    }
  });
  details.append(revoke);
  article.append(details);
  return article;
}

function renderUsers() {
  const query = search.value.trim().toLocaleLowerCase();
  const mode = filter.value;
  const visible = allAccounts.filter((account) => {
    if (query && !`${account.name} ${account.studentNumber}`.toLocaleLowerCase().includes(query)) return false;
    if (mode === "active" && !account.active) return false;
    if (mode === "inactive" && account.active) return false;
    if (mode === "admin" && account.role !== "admin") return false;
    if (mode === "member" && account.role !== "member") return false;
    return true;
  });
  document.getElementById("userCount").textContent = `${visible.length} / ${allAccounts.length}人`;
  document.getElementById("rolePolicyHint").textContent = canManageRoles
    ? "主管理者として、ユーザーの設定と管理者権限の付与・解除ができます。"
    : "管理者権限の付与・解除は2510044のみ可能です。学生の設定・テスト管理は利用できます。";
  list.replaceChildren();
  if (!visible.length) list.append(node("p", "該当するユーザーはいません。", "cm-subtitle"));
  visible.forEach((account) => list.append(accountCard(account)));
}

async function loadUsers(preserveStatus = false) {
  list.textContent = "読み込み中…";
  if (!preserveStatus) status.textContent = "";
  try {
    const result = await call("adminListCareMateAccounts");
    allAccounts = result.data?.accounts || [];
    canManageRoles = result.data?.canManageRoles === true;
    currentStudentNumber = result.data?.currentStudentNumber || "";
    renderUsers();
  } catch (error) {
    console.error("ユーザー一覧取得エラー:", error);
    list.textContent = "ユーザー一覧を取得できませんでした。管理者ログインと通信状態を確認してください。";
  }
}

document.getElementById("refreshUsers").addEventListener("click", () => void loadUsers());
search.addEventListener("input", renderUsers);
filter.addEventListener("change", renderUsers);
await loadUsers();
