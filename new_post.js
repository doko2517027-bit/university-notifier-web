import {
    db,
    studentNumber,
    setupTheme,
    loadProfileImage
} from "./common.js";

import {
  
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const themeButton = document.getElementById("themeButton");
const button = document.getElementById("postButton");
const topProfileImage = document.getElementById("topProfileImage");

setupTheme(themeButton);
loadProfileImage(topProfileImage);

button.onclick = async () => {

    const text = document
        .getElementById("postText")
        .value
        .trim();

    if (!text) {

        alert("内容を入力してください");

        return;

    }

    try {

        await addDoc(collection(db, "posts"), {

            studentNumber,

            text,

            createdAt: serverTimestamp(),

            likeCount: 0,

            commentCount: 0

        });

        alert("投稿しました！");

        location.href = "share.html";

    }

    catch (e) {

        console.error(e);

        alert("投稿に失敗しました");

    }

};

document.getElementById("backButton").onclick = () => {

    history.back();

};