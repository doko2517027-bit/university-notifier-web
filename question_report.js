import {
    addDoc,
    collection,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
    db,
    studentNumber
} from "./common.js";


export async function reportWrongAnswer(button, details) {

    const confirmed = window.confirm(
        "この問題は『答えが違う』ことを管理者に報告しますか？"
    );

    if (!confirmed) {
        return;
    }

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = "報告中...";

    try {

        await addDoc(
            collection(db, "reports"),
            {
                type: "questionAnswer",
                reason: "設定されている答えが違う可能性があります",
                reporterStudentNumber:
                    studentNumber ||
                    localStorage.getItem("studentNumber") ||
                    "unknown",
                status: "open",
                notificationSentAt: null,
                createdAt: serverTimestamp(),
                ...details
            }
        );

        button.textContent = "報告済み";
        alert("管理者に報告しました。");

    } catch (error) {

        console.error("問題報告エラー:", error);
        button.disabled = false;
        button.textContent = originalText;
        alert("報告を送信できませんでした。時間をおいて再度お試しください。");

    }

}
