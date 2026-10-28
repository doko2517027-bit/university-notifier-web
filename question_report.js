import {
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { db, studentNumber } from "./common.js?v=20261028-3";
import {
  openStudentDialog,
  showStudentNotice,
} from "./student_modal.mjs?v=20261021-1";

const issueOptions = [
  { value: "question", label: "問題が違います", reason: "問題文が違う可能性があります" },
  { value: "answer", label: "答えが違います", reason: "設定されている答えが違う可能性があります" },
  { value: "explanation", label: "解説が違います", reason: "解説が違う可能性があります" },
];

export async function reportWrongAnswer(button, details) {
  const selectedIssue = await openStudentDialog({
    title: "違う内容を選んでください",
    message: "選択した内容を管理者へ送信しますか？",
    choices: issueOptions,
    confirmLabel: "管理者へ送信する",
    cancelLabel: "やめる",
  });
  if (!selectedIssue) return;
  const issue = issueOptions.find((item) => item.value === selectedIssue);
  if (!issue) return;

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "報告中...";

  try {
    await addDoc(collection(db, "reports"), {
      type: "questionAnswer",
      issueCategory: issue.value,
      reason: issue.reason,
      reporterStudentNumber:
        studentNumber || localStorage.getItem("studentNumber") || "unknown",
      status: "open",
      notificationSentAt: null,
      createdAt: serverTimestamp(),
      ...details,
    });

    button.textContent = "報告済み";
    await showStudentNotice("送信しました", "管理者へ報告しました。");
  } catch (error) {
    console.error("問題報告エラー:", error);
    button.disabled = false;
    button.textContent = originalText;
    await showStudentNotice(
      "送信できませんでした",
      "通信状態を確認し、時間をおいてもう一度お試しください。",
    );
  }
}
