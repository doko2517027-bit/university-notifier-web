import {
    db,
    studentNumber,
    setupTheme,
    initializePage,
    loadProfileImage,
    loadUserName
} from "./common.js";

import {
    
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const userName = document.getElementById("userName");
const themeButton = document.getElementById("themeButton");
const newsList = document.getElementById("newsList");
const universityTab = document.getElementById("universityTab");
const courseTab = document.getElementById("courseTab");
const universityNews = document.getElementById("universityNews");
const courseNews = document.getElementById("courseNews");
const topProfileImage = document.getElementById("topProfileImage");

setupTheme(themeButton);

await initializePage([

    loadUserName(userName),
    loadProfileImage(topProfileImage),
    loadNews(),
    loadCourseNews()

]);

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
            <div class="card news-card">

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

        <div class="card news-card"
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

document.getElementById("profileButton").onclick = () => {
    location.href = "profile.html";
};