import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEtS2NGZKqHFh29kmR9OjEpshbC1yvjFY",
  authDomain: "universitynotifier-67517.firebaseapp.com",
  projectId: "universitynotifier-67517",
  storageBucket: "universitynotifier-67517.firebasestorage.app",
  messagingSenderId: "908622250178",
  appId: "1:908622250178:web:3e355fce8698fcf179bb5b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const themeButton = document.getElementById("themeButton");
const button = document.getElementById("postButton");

setupTheme();

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

        const studentNumber =
            localStorage.getItem("studentNumber");

        await addDoc(collection(db, "posts"), {

            studentNumber: studentNumber,

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

document.getElementById("backButton").onclick = () => {

    history.back();

};

function setupTheme() {

    if (localStorage.getItem("theme") === "dark") {

        document.documentElement.classList.add("dark");
        themeButton.textContent = "☀️";

    } else {

        themeButton.textContent = "🌙";

    }

    themeButton.addEventListener("click", () => {

        document.documentElement.classList.contains("dark")

        if (document.body.classList.contains("dark")) {

            localStorage.setItem("theme", "dark");
            themeButton.textContent = "☀️";

        } else {

            localStorage.setItem("theme", "light");
            themeButton.textContent = "🌙";

        }

    });

}