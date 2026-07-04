import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { VERSION } from "./version.js";

document.getElementById("version").textContent = `Version ${VERSION}`;

const firebaseConfig = {
  apiKey: "AIzaSyAEtS2NGZKqHFh29kmR9OjEpshbC1yvjFY",
  authDomain: "universitynotifier-67517.firebaseapp.com",
  projectId: "universitynotifier-67517",
  storageBucket: "universitynotifier-67517.firebasestorage.app",
  messagingSenderId: "908622250178",
  appId: "1:908622250178:web:3e355fce8698fcf179bb5b"
};

const button = document.getElementById("postButton");

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

        const user = JSON.parse(
            localStorage.getItem("user")
        );

        await addDoc(collection(db, "posts"), {

            author: user.name,

            studentNumber: user.studentNumber,

            text: text,

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