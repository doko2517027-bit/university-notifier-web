import {
  db,
  studentNumber,
  setupTheme,
  loadProfileImage,
  initializePage,
  setupOfflineAlert,
  showToast,
} from "./common.js";

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const themeButton = document.getElementById("themeButton");
const profileImage = document.getElementById("profileImage");
const menu = document.getElementById("photoMenu");
const picker = document.getElementById("photoPicker");
const rankingNicknameInput = document.getElementById("rankingNicknameInput");

const rankingDisplayMode = document.getElementById("rankingDisplayMode");

const rankingNicknameStatus = document.getElementById("rankingNicknameStatus");

const saveRankingNicknameButton = document.getElementById(
  "saveRankingNicknameButton",
);

picker.addEventListener("change", async (e) => {
  const file = e.target.files[0];

  if (!file) return;

  if (file.size > 50 * 1024 * 1024) {
    alert("50MB以下の画像を選択してください。");

    return;
  }

  const formData = new FormData();

  formData.append("file", file);
  formData.append("upload_preset", "caremate_upload");

  const res = await fetch(
    "https://api.cloudinary.com/v1_1/vpctonjf/image/upload",
    {
      method: "POST",
      body: formData,
    },
  );

  const data = await res.json();

  console.log(data);

  await Promise.all([
    updateDoc(doc(db, "publicUsers", studentNumber), {
      photo: data.secure_url,
    }),
    updateDoc(doc(db, "users", studentNumber), {
      profile: {
        photo: data.secure_url,
      },
    }),
  ]);

  profileImage.src = data.secure_url;
});

setupTheme(themeButton);

/* 先にボタン登録 */

document.getElementById("profileImage").onclick = () => {
  menu.style.display = "flex";
};

document.getElementById("backButton").onclick = () => {
  history.back();
};

/* その後で読み込み */

await initializePage([
  loadProfile().catch((e) => {
    console.error("プロフィール取得エラー", e);
  }),
]);

if (saveRankingNicknameButton) {
  saveRankingNicknameButton.onclick = saveRankingNicknameSettings;
}

document.getElementById("choosePhoto").onclick = () => {
  picker.removeAttribute("capture");

  picker.click();

  menu.style.display = "none";
};

document.getElementById("takePhoto").onclick = () => {
  picker.setAttribute("capture", "environment");

  picker.click();

  menu.style.display = "none";
};

document.getElementById("resetPhoto").onclick = async () => {
  await Promise.all([
    updateDoc(doc(db, "publicUsers", studentNumber), {
      photo: "",
    }),
    updateDoc(doc(db, "users", studentNumber), {
      profile: {
        photo: "",
      },
    }),
  ]);

  profileImage.src = "images/default.png";

  menu.style.display = "none";
};

document.getElementById("cancelPhoto").onclick = () => {
  menu.style.display = "none";
};

async function loadProfile() {
  document.getElementById("studentNumber").textContent = studentNumber;

  const [snap, privateUserSnap] = await Promise.all([
    getDoc(doc(db, "publicUsers", studentNumber)),

    getDoc(doc(db, "users", studentNumber)),
  ]);

  if (!snap.exists()) return;

  const user = snap.data();

  document.getElementById("userName").textContent = user.name;

  if (privateUserSnap.exists()) {
    renderRankingNicknameSettings(privateUserSnap.data());
  }

  const photo = await getProfilePhoto(studentNumber);

  profileImage.src = photo;
}

function renderRankingNicknameSettings(userData) {
  const nickname = String(userData.rankingNickname || "").trim();

  if (rankingNicknameInput) {
    rankingNicknameInput.value = nickname;
  }

  const mode =
    userData.rankingDisplayMode === "nickname" && nickname
      ? "nickname"
      : "student_number";

  if (rankingDisplayMode) {
    rankingDisplayMode.value = mode;
  }

  if (!rankingNicknameStatus) {
    return;
  }

  if (!nickname) {
    rankingNicknameStatus.textContent = `未設定・現在は学籍番号 ${studentNumber} を表示しています。`;

    return;
  }

  if (mode === "nickname") {
    rankingNicknameStatus.textContent = `現在のランキング表示：${nickname}`;
  } else {
    rankingNicknameStatus.textContent = `ニックネーム「${nickname}」は設定済みです。現在は学籍番号 ${studentNumber} を表示しています。`;
  }
}

async function saveRankingNicknameSettings() {
  const nickname = rankingNicknameInput?.value.trim() || "";

  const mode =
    rankingDisplayMode?.value === "nickname" ? "nickname" : "student_number";

  if (mode === "nickname" && !nickname) {
    alert("ニックネーム表示を選択する場合は、ニックネームを入力してください。");

    rankingNicknameInput?.focus();

    return;
  }

  if (nickname.length > 20) {
    alert("ニックネームは20文字以内で入力してください。");

    return;
  }

  try {
    saveRankingNicknameButton.disabled = true;

    saveRankingNicknameButton.textContent = "保存中...";

    await updateDoc(doc(db, "users", studentNumber), {
      rankingNickname: nickname,

      rankingDisplayMode: mode,

      rankingNicknamePromptCompleted: true,

      rankingNicknameUpdatedAt: serverTimestamp(),

      rankingNicknameUpdatedBy: studentNumber,
    });

    renderRankingNicknameSettings({
      rankingNickname: nickname,

      rankingDisplayMode: mode,
    });

    showToast("ランキング表示名を保存しました");
  } catch (error) {
    console.error("ランキング表示名保存エラー:", error);

    alert("ランキング表示名を保存できませんでした。");
  } finally {
    saveRankingNicknameButton.disabled = false;

    saveRankingNicknameButton.textContent = "ランキング表示名を保存";
  }
}
