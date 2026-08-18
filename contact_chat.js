import { db, studentNumber, setupTheme, initializePage } from "./common.js";
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
  addDoc,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
const list = document.getElementById("contactList"),
  listeners = new Map();
setupTheme(document.getElementById("themeButton"));
document.getElementById("backButton").onclick = () =>
  history.length > 1 ? history.back() : location.replace("settings.html");
await initializePage([
  new Promise((resolve) =>
    onSnapshot(
      query(
        collection(db, "contacts"),
        where("studentNumber", "==", studentNumber),
      ),
      (snapshot) => {
        const rows = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .filter((item) => !item.deletedAt)
          .sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt));
        const active = new Set(rows.map((x) => x.id));
        listeners.forEach((off, id) => {
          if (!active.has(id)) {
            off();
            listeners.delete(id);
          }
        });
        list.innerHTML = rows.length
          ? rows.map(render).join("")
          : '<div class="card setting-card">お問い合わせの履歴はありません。設定画面から新しいお問い合わせを送れます。</div>';
        rows.forEach((x) => listen(x.id));
        resolve();
      },
    ),
  ),
]);
function render(x) {
  const label = { new: "未対応", in_progress: "対応中", done: "対応済み" }[
    x.status || "new"
  ];
  return `<section class="contact-ticket"><div class="contact-ticket-status"><b>対応状況：${label}</b></div><article class="card setting-card contact-thread" data-contact-id="${x.id}"><small>${formatTime(x.createdAt)}・${escapeHtml(x.category || "お問い合わせ")}</small><p class="contact-bubble student"><b>あなた</b><br>${text(x.message)}</p><div class="contact-messages" id="messages-${x.id}"><small>読み込み中...</small></div><label>メッセージ<textarea id="reply-${x.id}" rows="3" maxlength="2000" placeholder="追加の内容を送る"></textarea></label><button class="btn btn-primary contact-send" data-id="${x.id}">送信する</button></article></section>`;
}
function listen(id) {
  if (listeners.has(id)) return;
  listeners.set(
    id,
    onSnapshot(collection(db, "contacts", id, "messages"), (snapshot) => {
      const element = document.getElementById(`messages-${id}`);
      if (!element) return;
      const msgs = snapshot.docs
        .map((x) => x.data())
        .sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt));
      element.innerHTML = msgs.length
        ? msgs
            .map(
              (m) =>
                `<p class="contact-bubble ${m.senderRole === "admin" ? "admin" : "student"}"><b>${m.senderRole === "admin" ? "管理者" : "あなた"}</b> <small>${formatTime(m.createdAt)}</small><br>${text(m.body)}</p>`,
            )
            .join("")
        : "<small>まだ返信はありません。</small>";
    }),
  );
}
document.addEventListener("click", async (event) => {
  const button = event.target.closest(".contact-send");
  if (!button) return;
  const id = button.dataset.id,
    area = document.getElementById(`reply-${id}`),
    body = area.value.trim();
  if (!body) return alert("メッセージを入力してください。");
  button.disabled = true;
  try {
    await addDoc(collection(db, "contacts", id, "messages"), {
      senderRole: "student",
      senderStudentNumber: studentNumber,
      body,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "contacts", id), {
      status: "new",
      lastMessageAt: serverTimestamp(),
    });
    area.value = "";
  } catch (error) {
    console.error(error);
    alert("送信できませんでした。");
  } finally {
    button.disabled = false;
  }
});
function timeOf(x) {
  return x?.toMillis?.() || 0;
}
function formatTime(x) {
  return x?.toDate?.().toLocaleString("ja-JP") || "送信直後";
}
function text(x) {
  return escapeHtml(x || "").replace(/\n/g, "<br>");
}
function escapeHtml(x) {
  return String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c],
  );
}
