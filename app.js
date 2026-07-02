import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
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

if (
    registered === "true" &&
    migrated !== "true"
) {

    location.href = "student-update.html";

}

const loggedIn =
    localStorage.getItem("loggedIn");

if (loggedIn !== "true") {

    location.href = "login.html";

}

async function checkMaintenance() {

    const ref = doc(db, "system", "app");

    const snap = await getDoc(ref);

    if (!snap.exists()) {
        return;
    }

    const system = snap.data();

    if (!system.maintenance) {
        return;
    }

    const registration = await navigator.serviceWorker.ready;

    const subscription =
        await registration.pushManager.getSubscription();

    if (!subscription) {
        location.href = "maintenance.html";
        return;
    }

    const devRef = doc(
        db,
        "developers",
        studentNumber
    );

    const devSnap = await getDoc(devRef);

    if (devSnap.exists()) {
        return;
    }

    location.href = "maintenance.html";

}

checkMaintenance().then(() => {

    loadUserName();
    loadNews();
    loadTodaySchedule();

});

async function loadUserName() {

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

        const latestNews = notices.slice(0, 3);

        latestNews.forEach((notice) => {

            let postedText = "";

            if (notice.postedAt) {

                const posted = notice.postedAt.toDate();

                postedText =
                    `${posted.getFullYear()}/` +
                    `${posted.getMonth() + 1}/` +
                    `${posted.getDate()} ` +
                    `${String(posted.getHours()).padStart(2, "0")}:` +
                    `${String(posted.getMinutes()).padStart(2, "0")}`;

            } else {

                postedText = notice.date;

            }

            newsList.innerHTML += `
                <div style="margin-bottom:20px;">
                    <b>${postedText}</b>

                    ${notice.body.replace(/\n/g, "<br>")}
                    <br><br>

                    <a href="${notice.pdf}" target="_blank">
                        PDFを見る
                    </a>
                </div>
                <hr>
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

        alert(e);

    }
}

async function loadTodaySchedule() {

    const courseRef = doc(
        db,
        "courseLinks",
        studentNumber
    );

    const courseSnap = await getDoc(courseRef);

    let courseLinks = {};

    if (courseSnap.exists()) {

        courseLinks =
            courseSnap.data().courses;

    }

    const department = localStorage.getItem("department");
    const major = localStorage.getItem("major");
    const grade = localStorage.getItem("grade");

    if ((!department && !major) || !grade) {

        todaySchedule.innerHTML = "学科・学年を登録してください。";
        return;

    }

    let docId = "";

    if (department === "看護学科") {
        docId = "ns_yamate";
    }
    else if (major === "理学療法学専攻") {
        docId = "pt";
    }
    else if (major === "作業療法学専攻") {
        docId = "ot";
    }

    const ref = doc(db, "schedule", docId);

    const snap = await getDoc(ref);

    if (!snap.exists()) {

        todaySchedule.innerHTML = "時間割がありません。";
        return;

    }

    const schedules = snap.data().data;

    const week = ["日","月","火","水","木","金","土"];

    const today = new Date();

    // 18時以降は翌日の時間割を表示
    if (today.getHours() >= 18) {
        today.setDate(today.getDate() + 1);
    }

    const todayDay = week[today.getDay()];

    const result = schedules.filter(item =>

        item.grade === grade &&
        item.day === todayDay

    );

    result.sort((a,b)=>{

        return parseInt(a.period) - parseInt(b.period);

    });

    if(result.length===0){

        todaySchedule.innerHTML="今日は授業がありません。";
        return;

    }

    let html = `
    <table class="schedule-table">
        <thead>
            <tr>
                <th>時限</th>
                <th>科目名</th>
                <th>区分</th>
                <th>建物</th>
                <th>講義室</th>
                <th>教員名</th>
            </tr>
        </thead>
        <tbody>
    `;

    result.forEach(item => {

        html += `
        <tr>
            <td>${item.period}</td>
            <td>

            <a
                href="#"
                class="course-link"
                data-subject="${item.subject}"
            >

            ${item.subject}

            </a>

            </td>
            <td>${item.kubun}</td>
            <td>${item.building}</td>
            <td>${item.room}</td>
            <td>${item.teacher}</td>
        </tr>
        `;

    });

    html += `
        </tbody>
    </table>
    `;

    todaySchedule.innerHTML = html;

    document
    .querySelectorAll(".course-link")
    .forEach(link => {

        link.addEventListener(
            "click",
            (e)=>{

                e.preventDefault();

                let subject =
                    e.target.dataset.subject;

                subject = subject
                    .replace(/[（(].*?[）)]/g, "")
                    .trim();

                let courseId =
                    courseLinks[subject];

                if (!courseId) {

                    for (const key in courseLinks) {

                        if (
                            subject.includes(key) ||
                            key.includes(subject)
                        ) {

                            courseId = courseLinks[key];
                            break;

                        }

                    }

                }

                if (!courseId) {

                    alert("この授業はまだ対応していません");

                    return;

                }

                if (!courseId) {

                    alert("この授業はまだ対応していません");
                    return;

                }

                window.open(
                    "https://sums.manaba.jp/ct/" + courseId,
                    "_blank"
                );

            }
        );

    });

}

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

splash.style.display = "flex";

setTimeout(() => {

    splash.classList.add("hide");

    setTimeout(() => {
        splash.style.display = "none";
    }, 500);

}, 1200);

const settingButton =
document.getElementById("settingButton");

settingButton.addEventListener("click",()=>{

    location.href="settings.html";

});