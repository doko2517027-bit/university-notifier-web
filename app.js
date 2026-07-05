import {
    db,
    studentNumber,
    setupTheme,
    loadProfileImage,
    loadUserName,
    initializePage,
    showNewsSkeleton
} from "./common.js";

import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { VERSION } from "./version.js";

document.getElementById("version").textContent = `Version ${VERSION}`;

const homeCourseNews = document.getElementById("homeCourseNews");
const userName = document.getElementById("userName");
const newsList = document.getElementById("newsList");
if(newsList){
    showNewsSkeleton(newsList);
}
const todaySchedule = document.getElementById("todaySchedule");
const registered = localStorage.getItem("registered");
const manabaId = localStorage.getItem("manabaId");
const migrated = localStorage.getItem("migrated");
const topProfileImage = document.getElementById("topProfileImage");
const themeButton = document.getElementById("themeButton");

let courses = {};

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

async function startApp() {

    try {

        await checkMaintenance();

    } catch (e) {

        console.error(e);

    }

    await initializePage([

        loadUserName(userName),
        loadProfileImage(topProfileImage),
        loadNews(),
        loadTodaySchedule(),
        loadHomeCourseNews(),
        loadCourseLinks()

    ]);

}

startApp();
setupTheme(themeButton);

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
                <div class="card news-card"
                    onclick="location.href='news.html'">

                    <div class="news-date">
                        ${postedText}
                    </div>

                    <div class="news-body">

                        ${notice.body
                            .split("\n")[0]
                            .substring(0, 40)}...

                    </div>

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

async function loadHomeCourseNews() {

    const snapshot = await getDocs(
        collection(db, "courseNews")
    );

    if (snapshot.empty) {

        homeCourseNews.innerHTML =
            "コースニュースはありません。";

        return;

    }

    const notices = [];

    snapshot.forEach(doc => {

        notices.push(doc.data());

    });

    notices.sort((a, b) =>
        b.createdAt.seconds - a.createdAt.seconds
    );

    homeCourseNews.innerHTML = "";

    notices.slice(0, 3).forEach(notice => {

        homeCourseNews.innerHTML += `

        <div class="card news-card"
            onclick="location.href='news.html'">

            <div class="news-title">
                📘 ${notice.course}
            </div>

            <div class="news-body">
                ${notice.title}
            </div>

            <div class="news-date">
                ${notice.posted}
            </div>

        </div>

        `;
    });

    homeCourseNews.innerHTML += `
        <div style="text-align:center; margin-top:20px;">
            <a href="news.html">
                もっと見る →
            </a>
        </div>
    `;

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

    const data = snap.data();

    const todayTitle = data.todayTitle;
    const nextTitle = data.nextTitle;

    const todayLabel = data.todayLabel;
    const nextLabel = data.nextLabel;

    const todaySchedules = data.today;
    const nextSchedules = data.next;

    document.getElementById("todayDate").textContent =
    `${todayTitle}｜${todayLabel}`;

    document.getElementById("tomorrowDate").textContent =
        `${nextTitle}｜${nextLabel}`;

    renderSchedule(
        "todaySchedule",
        todaySchedules,
        grade
    );

    renderSchedule(
        "tomorrowSchedule",
        nextSchedules,
        grade
    );

}

function renderSchedule(targetId, schedules, grade) {

    const list = schedules
        .filter(item => item.grade === grade)
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

    if (Object.keys(courses).length === 0) {

        alert("コース情報がありません。");

        return;

    }

    console.log("時間割の科目:", subject);
    console.log("Firestore:", courses);

    const url = courses[subject];

    if (!url) {
        alert("この授業のManabaリンクはありません。");
        return;
    }

    location.href = url;

}

async function loadCourseLinks() {

    const snap = await getDoc(
        doc(db, "courseLinks", studentNumber)
    );

    if (snap.exists()) {

        courses = snap.data().courses ?? {};

    }

}

window.openCourse = openCourse;

const splash = document.getElementById("splash");

if (!sessionStorage.getItem("splashShown")) {

    splash.style.display = "flex";

    setTimeout(() => {

        splash.classList.add("hide");

        setTimeout(() => {
            splash.style.display = "none";
        }, 500);

    }, 1200);

    sessionStorage.setItem("splashShown", "true");

} else {

    splash.style.display = "none";

}

const settingButton =
document.getElementById("settingButton");

document
.getElementById("profileButton")
.onclick = () => {

    location.href = "profile.html";

};