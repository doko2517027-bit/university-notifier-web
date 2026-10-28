import { callCareMate } from "./backend_client.js?v=20261028-3";

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
    const experienceMode = new FormData(form).get("experienceMode") || "assignments";
    await callCareMate("issueEntrancePhrase", { phrase: input.value.trim(), experienceMode });
    status.textContent = `発行しました。10分以内に1回だけ使用できます（${experienceMode === "study-only" ? "課題通知なし" : "課題通知あり"}）。`;
    input.value = "";
  } catch (error) {
    console.error("入口文言発行エラー:", error);
    status.textContent = "発行できませんでした。権限と通信状態を確認してください。";
  } finally { button.disabled = false; }
});
