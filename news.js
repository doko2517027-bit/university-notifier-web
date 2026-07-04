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
const themeButton = document.getElementById("themeButton");
const newsList = document.getElementById("newsList");

const studentNumber = localStorage.getItem("studentNumber");

const universityTab = document.getElementById("universityTab");
const courseTab = document.getElementById("courseTab");

const universityNews = document.getElementById("universityNews");
const courseNews = document.getElementById("courseNews");

loadUserName();
loadNews();
loadCourseNews();
setupTheme();

universityTab.onclick = () => {

    universityTab.classList.add("active");
    courseTab.classList.remove("active");

    universityNews.style.display = "block";
    courseNews.style.display = "none";

};

courseTab.onclick = () => {

    courseTab.classList.add("active");
    universityTab.classList.remove("active");

    universityNews.style.display = "none";
    courseNews.style.display = "block";

};

async function loadUserName() {

    const snap = await getDoc(
        doc(db, "publicUsers", studentNumber)
    );

    if (!snap.exists()) {
        userName.textContent = "Unknownさん";
        return;
    }

    userName.textContent = snap.data().name + "さん";

}

async function loadNews() {

    const department = localStorage.getItem("department");
    const major = localStorage.getItem("major");
    const grade = localStorage.getItem("grade");

    let q;

    if (department !== "") {

        q = query(
            collection(db, "news"),
            where("department", "==", department),
            where("grade", "==", grade.replace("年", ""))
        );

    } else {

        q = query(
            collection(db, "news"),
            where("major", "==", major),
            where("grade", "==", grade.replace("年", ""))
        );

    }

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        newsList.innerHTML = "お知らせはありません。";
        return;
    }

    const notices = [];

    snapshot.forEach(doc => {
        notices.push(doc.data());
    });

    notices.sort((a, b) =>
        b.postedAt.seconds - a.postedAt.seconds
    );

    newsList.innerHTML = "";

    notices.forEach(notice => {

        const posted = notice.postedAt.toDate();

        newsList.innerHTML += `
            <div class="news-card">

                <div class="news-date">
                    ${posted.getFullYear()}/${posted.getMonth()+1}/${posted.getDate()}
                </div>

                <div class="news-body">
                    ${notice.body.replace(/\n/g,"<br>")}
                </div>

                <br>

                <a href="${notice.pdf}" target="_blank">
                    📄 PDFを見る
                </a>

            </div>
        `;

    });

}

async function loadCourseNews() {

    const snapshot = await getDocs(
        collection(db, "courseNews")
    );

    if (snapshot.empty) {

        courseNews.innerHTML = "コースニュースはありません。";

        return;

    }

    const notices = [];

    snapshot.forEach(doc => {

        notices.push(doc.data());

    });

    notices.sort((a, b) =>
        b.createdAt.seconds - a.createdAt.seconds
    );

    courseNews.innerHTML = "";

    notices.forEach(notice => {

        const isNew =
            (Date.now() - notice.createdAt.toDate().getTime()) <
            1000 * 60 * 60 * 24 * 3;

        courseNews.innerHTML += `

        <div class="news-card"
            onclick="window.open('${notice.url}','_blank')">

            <div class="news-title">
                📘 ${notice.course}
            </div>

            <div class="news-body">
                ${notice.title}
            </div>

            <div class="news-date">
                👤 ${notice.author}<br>
                🕒 ${notice.posted}
            </div>

            <div class="news-link">

                🗞️ コースニュースを開く

            </div>

        </div>

        `;

    });

}

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

document
.getElementById("profileButton")
.onclick = () => {

    location.href = "profile.html";

};