import { functions } from "./auth_core.js";
import { encryptData } from "./common.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

const list = document.getElementById("adminUserList");
const status = document.getElementById("adminUsersStatus");
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
  article.append(node("h3", account.name), node("p", `${account.studentNumber} · ${account.role === "admin" ? "管理者" : "学生"} · ${account.active ? "利用中" : "登録解除済み"}`));
  if (account.role !== "admin") article.append(node("p", `manabaパスワード：${account.hasManabaPassword ? "登録済み" : "未登録"}`));
  if (!account.active || account.role === "admin") return article;
  const details = document.createElement("details");
  details.className = "cm-details";
  const summary = node("summary", "このユーザーを管理");
  details.append(summary, formCard(account, "manaba"), formCard(account, "app"));
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

async function loadUsers() {
  list.textContent = "読み込み中…";
  status.textContent = "";
  try {
    const result = await call("adminListCareMateAccounts");
    const accounts = result.data?.accounts || [];
    list.replaceChildren();
    if (!accounts.length) list.append(node("p", "ユーザーが登録されていません。", "cm-subtitle"));
    accounts.forEach((account) => list.append(accountCard(account)));
  } catch (error) {
    console.error("ユーザー一覧取得エラー:", error);
    list.textContent = "ユーザー一覧を取得できませんでした。管理者ログインと通信状態を確認してください。";
  }
}

document.getElementById("refreshUsers").addEventListener("click", () => void loadUsers());
await loadUsers();
