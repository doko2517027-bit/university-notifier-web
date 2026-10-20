import { functions } from "./auth_core.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

document.getElementById("issueForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const input = document.getElementById("entrancePhrase");
  const status = document.getElementById("issueStatus");
  const button = form.querySelector("button");
  if (!confirm("現在有効な入口文言を無効にして、新しい文言を発行しますか？")) return;
  button.disabled = true;
  status.textContent = "発行中…";
  try {
    await httpsCallable(functions, "issueEntrancePhrase")({ phrase: input.value.trim() });
    status.textContent = "発行しました。10分以内に1回だけ使用できます。";
    input.value = "";
  } catch (error) {
    console.error("入口文言発行エラー:", error);
    status.textContent = "発行できませんでした。権限と通信状態を確認してください。";
  } finally { button.disabled = false; }
});
