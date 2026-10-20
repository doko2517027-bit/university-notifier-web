import { auth, db, signOutCareMate } from "./auth_core.js";
import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const target = document.getElementById("accessList");
document.getElementById("signOutButton").addEventListener("click", () => {
  void signOutCareMate();
});

try {
  const snapshot = await getDocs(collection(db, "access"));
  const entries = await Promise.all(snapshot.docs.map(async (entry) => {
    const number = entry.id.replace(/^caremate-/, "");
    const user = await getDoc(doc(db, "users", number)).catch(() => null);
    return {
      number,
      name: String(user?.data()?.name || "名前未登録"),
      role: entry.data().role === "admin" ? "管理者" : "学生",
      active: entry.data().active === true,
    };
  }));
  target.replaceChildren();
  for (const item of entries) {
    const card = document.createElement("article");
    card.className = "cm-item";
    const heading = document.createElement("h3");
    heading.textContent = item.name;
    const detail = document.createElement("p");
    detail.textContent = `${item.number} · ${item.role} · ${item.active ? "利用中" : "停止中"}`;
    card.append(heading, detail);
    target.append(card);
  }
  if (!entries.length) target.textContent = "利用アカウントはありません。";
} catch (error) {
  console.error("利用アカウント一覧エラー:", error);
  target.textContent = "アカウント情報を取得できませんでした。";
}
