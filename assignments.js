import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getFirestore,
    doc,
    getDoc
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

const userName = document.getElementById("userName");
const assignmentList = document.getElementById("assignmentList");
const themeButton = document.getElementById("themeButton");

const studentNumber = localStorage.getItem("studentNumber");
const loggedIn = localStorage.getItem("loggedIn");

if (loggedIn !== "true") {
    location.href = "login.html";
}

loadUserName();
loadAssignments();
setupTheme();

async function loadUserName() {

    if (!studentNumber) {
        userName.textContent = "Unknownさん";
        return;
    }

    const snap = await getDoc(
        doc(db, "publicUsers", studentNumber)
    );

    if (!snap.exists()) {
        userName.textContent = "Unknownさん";
        return;
    }

    userName.textContent = snap.data().name + "さん";

}

async function loadAssignments() {

    if (!studentNumber) {
        assignmentList.innerHTML = "ログインしてください。";
        return;
    }

    const snap = await getDoc(
        doc(db, "assignments", studentNumber)
    );

    if (!snap.exists()) {
        assignmentList.innerHTML = "未提出課題はありません。";
        return;
    }

    const data = snap.data();

    const assignments = data.assignments || [];

    if (assignments.length === 0) {
        assignmentList.innerHTML = "未提出課題はありません。";
        return;
    }

    assignmentList.innerHTML = "";

    assignments.forEach(item => {

        const title =
            item.title ||
            item.name ||
            item.subject ||
            "課題名なし";

        const deadline =
            item.deadline ||
            item.due ||
            item.limit ||
            "締切不明";

        const rawUrl =
            item.courseUrl ||
            "";

        const url =
            rawUrl
                ? "https://sums.manaba.jp/ct/" + rawUrl + "_report"
        : "";

        assignmentList.innerHTML += `
            <div class="setting-card">
                <h3>📚 ${title}</h3>

                <p>
                    <b>締切</b><br>
                    ${deadline}
                </p>

                ${
                    url
                    ? `<a href="${url}" target="_blank">Manabaで開く</a>`
                    : `<p>リンクなし</p>`
                }
            </div>
        `;

    });

}

function setupTheme() {

    if (localStorage.getItem("theme") === "dark") {
        document.body.classList.add("dark");
        themeButton.textContent = "☀️";
    } else {
        themeButton.textContent = "🌙";
    }

    themeButton.addEventListener("click", () => {

        document.body.classList.toggle("dark");

        if (document.body.classList.contains("dark")) {
            localStorage.setItem("theme", "dark");
            themeButton.textContent = "☀️";
        } else {
            localStorage.setItem("theme", "light");
            themeButton.textContent = "🌙";
        }

    });

}