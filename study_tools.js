import { db, studentNumber } from "./common.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}

export function studyToolsHtml(question, earnedPoints) {
    return `
        <section class="study-tools" aria-label="問題の検索とポイント">
            <div class="study-point-summary">
                <span>この問題の正解ポイント <b>+${Number(earnedPoints || 0)}pt</b></span>
                <span>累計 <b class="study-total-points">読み込み中…</b></span>
            </div>
            <form class="study-search-form">
                <input class="study-search-input" type="search" value="${escapeHtml(question)}" placeholder="この問題をGoogleで検索" aria-label="この問題をGoogleで検索">
                <button class="btn btn-secondary" type="submit">検索</button>
            </form>
        </section>`;
}

export function setupStudyTools(root) {
    const form = root.querySelector(".study-search-form");
    if (form) {
        form.addEventListener("submit", event => {
            event.preventDefault();
            const query = form.querySelector(".study-search-input")?.value.trim();
            if (!query) return;
            window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank", "noopener");
        });
    }
    refreshTotalPoints(root);
}

export async function refreshTotalPoints(root) {
    const output = root.querySelector(".study-total-points");
    if (!output || !studentNumber) return;
    try {
        const snapshot = await getDoc(doc(db, "totalRanking", studentNumber));
        output.textContent = `${Number(snapshot.data()?.point || 0).toLocaleString()}pt`;
    } catch (error) {
        console.warn("累計ポイントの取得に失敗しました。", error);
        output.textContent = "--pt";
    }
}
