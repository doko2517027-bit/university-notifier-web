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


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const userName = document.getElementById("userName");
const newsList = document.getElementById("newsList");
const todaySchedule = document.getElementById("todaySchedule");
const registered = localStorage.getItem("registered");
const studentNumber = localStorage.getItem("studentNumber");
const manabaId = localStorage.getItem("manabaId");
const migrated = localStorage.getItem("migrated");

const root = document.documentElement;

const department = localStorage.getItem("department");
const major = localStorage.getItem("major");

if (department === "看護学科") {

    root.style.setProperty("--accent", "#F7EAC5");

}
else if (major === "理学療法学専攻") {

    root.style.setProperty("--accent", "#DDEBF7");

}
else if (major === "作業療法学専攻") {

    root.style.setProperty("--accent", "#E2EFDA");

}

const loggedIn =
    localStorage.getItem("loggedIn");

if (loggedIn !== "true") {

    location.href = "login.html";

}

async function checkMaintenance() {

    const snap = await getDoc(
        doc(db, "system", "app")
    );

    if (!snap.exists()) {
        return;
    }

    const system = snap.data();

    if (!system.maintenance) {
        return;
    }

    const devSnap = await getDoc(
        doc(db, "developers", studentNumber)
    );

    if (
        devSnap.exists() &&
        devSnap.data().enabled === true
    ) {
        return;
    }

    location.href = "maintenance.html";

}

checkMaintenance()
.then(() => {
    loadUserName();
    loadNews();
    loadTodaySchedule();
})
.catch((e) => {
    console.error(e);
    loadUserName();
    loadNews();
    loadTodaySchedule();
});

async function loadUserName() {

    console.log("studentNumber:", studentNumber);

    const ref = doc(
        db,
        "publicUsers",
        studentNumber
    );

    const snap = await getDoc(ref);

    if (!snap.exists()) {

        userName.textContent = "Unknownさん";
        return;

    }

    userName.textContent =
        snap.data().name + "さん";

}

async function loadNews() {

    try {

        const department = localStorage.getItem("department");
        const grade = localStorage.getItem("grade");
        const major = localStorage.getItem("major");

        if ((!department && !major) || !grade) {
            return;
        }

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
        const notices = [];

        snapshot.forEach((doc) => {
            notices.push(doc.data());
        });

        notices.sort((a, b) => {
            return b.postedAt.seconds - a.postedAt.seconds;
        });

        if (snapshot.empty) {
            newsList.innerHTML = "まだお知らせはありません";
            return;
        }

        newsList.innerHTML = "";

        notices.slice(0, 3).forEach((notice) => {

            const posted = notice.postedAt.toDate();

            const postedText =
                `${posted.getFullYear()}/` +
                `${posted.getMonth() + 1}/` +
                `${posted.getDate()} ` +
                `${String(posted.getHours()).padStart(2, "0")}:` +
                `${String(posted.getMinutes()).padStart(2, "0")}`;

            newsList.innerHTML += `
                <div class="news-card">
                    <div class="news-date">${postedText}</div>

                    <div class="news-body">
                        ${notice.body.replace(/\n/g, "<br>")}
                    </div>

                    <br>

                    <a href="${notice.pdf}" target="_blank">
                        📄 PDFを見る
                    </a>
                </div>
            `;
        });

        newsList.innerHTML += `
            <div style="text-align:center; margin-top:20px;">
                <a href="news.html">
                    もっと見る →
                </a>
            </div>
        `;

    } catch (e) {
        console.error(e);
        newsList.innerHTML = "お知らせの取得に失敗しました。";
    }
}

async function loadTodaySchedule() {

    const department = localStorage.getItem("department");
    const major = localStorage.getItem("major");
    const grade = localStorage.getItem("grade");

    let docId = "";

    if (department === "看護学科") {
        docId = "ns_yamate";
    } else if (major === "理学療法学専攻") {
        docId = "pt";
    } else if (major === "作業療法学専攻") {
        docId = "ot";
    }

    const snap = await getDoc(
        doc(db, "schedule", docId)
    );

    if (!snap.exists()) {
        document.getElementById("todaySchedule").innerHTML = "時間割がありません。";
        document.getElementById("tomorrowSchedule").innerHTML = "時間割がありません。";
        return;
    }

    const schedules = snap.data().data;

    const week = ["日", "月", "火", "水", "木", "金", "土"];

    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    renderDaySchedule(today, "今日", "todayDate", "todaySchedule", schedules, week, grade);
    renderDaySchedule(tomorrow, "明日", "tomorrowDate", "tomorrowSchedule", schedules, week, grade);

}

function renderDaySchedule(date, label, dateId, targetId, schedules, week, grade) {

    const day = week[date.getDay()];

    document.getElementById(dateId).textContent =
        `${label}｜${date.getMonth() + 1}月${date.getDate()}日（${day}）`;

    const list = schedules
        .filter(item =>
            item.grade === grade &&
            item.day === day
        )
        .sort((a, b) =>
            parseInt(a.period) - parseInt(b.period)
        );

    if (list.length === 0) {
        document.getElementById(targetId).innerHTML =
            `<p class="empty-text">授業はありません</p>`;
        return;
    }

    document.getElementById(targetId).innerHTML =
        list.map(item => `
            <div class="lesson-card" onclick="openCourse('${item.subject}')">
                <div class="lesson-period">${item.period}</div>
                <div>
                    <div class="lesson-subject">${item.subject}</div>
                    <div class="lesson-room">
                        ${item.building} ${item.room}
                    </div>
                    <div class="lesson-teacher">
                        ${item.teacher}
                    </div>
                </div>
            </div>
        `).join("");

}

async function openCourse(subject) {

    const snap = await getDoc(
        doc(db, "courseLinks", studentNumber)
    );

    if (!snap.exists()) {
        alert("コース情報がありません。");
        return;
    }

    const courses = snap.data().courses;

    const url = courses[subject];

    if (!url) {
        alert("この授業のManabaリンクはありません。");
        return;
    }

    if (confirm("Manabaの授業を開きますか？")) {
        window.open(url, "_blank");
    }

}

window.openCourse = openCourse;

const themeButton = document.getElementById("themeButton");

// 前回の設定を読み込む
if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
    themeButton.textContent = "☀️";
} else {
    themeButton.textContent = "🌙";
}

//ボタンを押した時
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

const splash = document.getElementById("splash");

if (!localStorage.getItem("splashShown")) {

    splash.style.display = "flex";

    setTimeout(() => {

        splash.classList.add("hide");

        setTimeout(() => {
            splash.style.display = "none";
        }, 500);

    }, 1200);

    localStorage.setItem("splashShown", "true");

} else {

    splash.style.display = "none";

}

const settingButton =
document.getElementById("settingButton");

settingButton.addEventListener("click",()=>{

    location.href="settings.html";

})
