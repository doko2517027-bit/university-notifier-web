import {
  db,
  studentNumber,
  showToast,
  setupOfflineAlert,
  updateNewsNavBadge,
} from "./common.js";

import {
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

let unread = 0;

const mailCount = document.getElementById("mailCount");

const readButton = document.getElementById("readButton");

const openMailButton = document.getElementById("openMailButton");

await Promise.all([load(), updateNewsNavBadge()]);

openMailButton.onclick = () => {
  window.open("https://activemail.kagoyamail.jp/am_bin/slogin", "_blank");
};

readButton.onclick = async () => {
  if (unread === 0) {
    showToast("✓ 確認済みです");
    return;
  }

  await updateDoc(doc(db, "users", studentNumber), {
    activeMailUnreadCount: 0,
  });

  unread = 0;

  mailCount.textContent = "新着メールはありません";

  showToast("✓ 確認しました");
};

async function load() {
  const snap = await getDoc(doc(db, "users", studentNumber));

  unread = snap.data().activeMailUnreadCount || 0;

  mailCount.textContent =
    unread === 0 ? "新着メールはありません" : `新着メール ${unread}件`;
}
