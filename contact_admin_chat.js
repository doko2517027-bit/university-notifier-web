import {
  db,
  studentNumber,
  setupTheme,
  initializePage,
  isAdmin,
} from "./common.js";
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
const target = new URLSearchParams(location.search).get("studentNumber"),
  list = document.getElementById("contactList"),
  title = document.getElementById("pageTitle"),
  listeners = new Map();
setupTheme(document.getElementById("themeButton"));
document.getElementById("backButton").onclick = () =>
  history.length > 1 ? history.back() : location.replace("contact_admin.html");
await initializePage([]);
if (studentNumber !== "2510044" || !(await isAdmin()) || !target) {
  list.innerHTML =
    '<div class="card setting-card">この画面を利用できません。</div>';
} else {
  title.textContent = `💬 ${target} とのお問い合わせ`;
  onSnapshot(
    query(collection(db, "contacts"), where("studentNumber", "==", target)),
    (snapshot) => {
      const contacts = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((item) => !item.deletedAt)
        .sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt));
      list.innerHTML = contacts.length
        ? contacts.map(render).join("")
        : '<div class="card setting-card">お問い合わせはありません。</div>';
      contacts.forEach((contact) => listen(contact.id));
    },
  );
}
function render(x) {
  const status = x.status || "new";
  return `<section class="contact-ticket"><div class="contact-ticket-status"><label>対応状況<select class="contact-status" data-id="${x.id}"><option value="new" ${status === "new" ? "selected" : ""}>未対応</option><option value="in_progress" ${status === "in_progress" ? "selected" : ""}>対応中</option><option value="done" ${status === "done" ? "selected" : ""}>対応済み</option></select></label></div><article class="card setting-card contact-thread"><small>${formatTime(x.createdAt)}・${escapeHtml(x.category || "お問い合わせ")}</small><p class="contact-bubble student"><b>${escapeHtml(target)}</b><br>${text(x.message)}</p><div id="messages-${x.id}"><small>メッセージを読み込み中...</small></div><label>返信<textarea id="reply-${x.id}" rows="3" maxlength="2000" placeholder="${target}へ返信する内容"></textarea></label><button class="btn btn-primary contact-send" data-id="${x.id}">返信を送る</button><button class="btn btn-danger contact-delete" data-id="${x.id}">この会話を削除</button></article></section>`;
}
function listen(id) {
  if (listeners.has(id)) return;
  listeners.set(
    id,
    onSnapshot(collection(db, "contacts", id, "messages"), (snapshot) => {
      const targetElement = document.getElementById(`messages-${id}`);
      if (!targetElement) return;
      const messages = snapshot.docs
        .map((item) => item.data())
        .sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt));
      targetElement.innerHTML = messages.length
        ? messages
            .map(
              (message) =>
                `<p class="contact-bubble ${message.senderRole === "admin" ? "admin" : "student"}"><b>${message.senderRole === "admin" ? "管理者" : escapeHtml(target)}</b> <small>${formatTime(message.createdAt)}</small><br>${text(message.body)}</p>`,
            )
            .join("")
        : "<small>まだ返信はありません。</small>";
    }),
  );
}
document.addEventListener("change", async (event) => {
  const select = event.target.closest(".contact-status");
  if (!select) return;
  await updateDoc(doc(db, "contacts", select.dataset.id), {
    status: select.value,
    statusUpdatedAt: serverTimestamp(),
    statusUpdatedBy: studentNumber,
  });
});
document.addEventListener("click", async (event) => {
  const button = event.target.closest(".contact-send");
  if (!button) return;
  const id = button.dataset.id,
    area = document.getElementById(`reply-${id}`),
    body = area.value.trim();
  if (!body) return alert("返信を入力してください。");
  button.disabled = true;
  try {
    await addDoc(collection(db, "contacts", id, "messages"), {
      senderRole: "admin",
      senderStudentNumber: studentNumber,
      body,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "contacts", id), {
      status: "in_progress",
      lastMessageAt: serverTimestamp(),
    });
    area.value = "";
  } catch (error) {
    console.error(error);
    alert("返信を送信できませんでした。");
  } finally {
    button.disabled = false;
  }
});
document.addEventListener("click", async (event) => {
  const button = event.target.closest(".contact-delete");
  if (!button) return;
  if (
    !confirm(
      "この会話を学生側・管理側の両方から非表示にします。よろしいですか？",
    )
  )
    return;
  button.disabled = true;
  try {
    await updateDoc(doc(db, "contacts", button.dataset.id), {
      deletedAt: serverTimestamp(),
      deletedBy: studentNumber,
    });
  } catch (error) {
    console.error(error);
    alert("削除できませんでした。");
    button.disabled = false;
  }
});
function timeOf(value) {
  return value?.toMillis?.() || 0;
}
function formatTime(value) {
  return value?.toDate?.().toLocaleString("ja-JP") || "送信直後";
}
function text(value) {
  return escapeHtml(value || "").replace(/\n/g, "<br>");
}
function escapeHtml(value) {
  return String(value ?? "").replace(
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
