import {
    db,
    studentNumber,
    setupTheme,
    initializePage,
    loadProfileImage,
    loadUserName,
    setupAdminTab,
    setupOfflineAlert
} from "./common.js";

import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const userName = document.getElementById("userName");
const themeButton = document.getElementById("themeButton");
const newsList = document.getElementById("newsList");
const universityTab = document.getElementById("universityTab");
const courseTab = document.getElementById("courseTab");
const systemTab = document.getElementById("systemTab");
const systemNews = document.getElementById("systemNews");
const universityNews = document.getElementById("universityNews");
const courseNews = document.getElementById("courseNews");
const topProfileImage = document.getElementById("topProfileImage");

setupTheme(themeButton);

await initializePage([

	setupAdminTab(),
    loadUserName(userName),
    loadProfileImage(topProfileImage),
    loadNews(),
    loadCourseNews(),
    loadSystemNews()

]);

universityTab.onclick = () => {

    universityTab.classList.add("active");

    courseTab.classList.remove("active");
    systemTab.classList.remove("active");

    universityNews.style.display = "block";
    courseNews.style.display = "none";
    systemNews.style.display = "none";

};

courseTab.onclick = () => {

    courseTab.classList.add("active");

    universityTab.classList.remove("active");
    systemTab.classList.remove("active");

    universityNews.style.display = "none";
    courseNews.style.display = "block";
    systemNews.style.display = "none";

};

systemTab.onclick = () => {

    systemTab.classList.add("active");

    universityTab.classList.remove("active");
    courseTab.classList.remove("active");

    universityNews.style.display = "none";
    courseNews.style.display = "none";
    systemNews.style.display = "block";

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
                    ${posted.getMonth() + 1}/
                    ${posted.getDate()}
                    ${String(posted.getHours()).padStart(2, "0")}:
                    ${String(posted.getMinutes()).padStart(2, "0")}
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

function parseCourseNewsDate(value) {

    if (!value) {
        return 0;
    }

    const match =
        String(value).match(
            /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\s+(\d{1,2}):(\d{2})$/
        );

    if (!match) {
        return 0;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);

    return new Date(
        year,
        month - 1,
        day,
        hour,
        minute
    ).getTime();

}

async function loadCourseNews() {

    const q = query(
        collection(db, "courseNews", studentNumber, "news"),
        orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {

        courseNews.innerHTML =
            "コースニュースはありません。";

        return;

    }

    const notices = [];

    snapshot.forEach(newsDoc => {

        notices.push(newsDoc.data());

    });

    notices.sort((a, b) => {

        const dateA =
            parseCourseNewsDate(a.posted);

        const dateB =
            parseCourseNewsDate(b.posted);

        return dateB - dateA;

    });

    courseNews.innerHTML = "";

    notices.forEach(notice => {

        courseNews.innerHTML += `

            <div class="card news-card"
                onclick="window.open('${notice.url}','_blank')">

                <div class="news-date">
                    ${notice.posted || ""}
                </div>

                <div class="news-title">
                    📘 ${notice.course}
                </div>

                <div class="news-body">
                    ${notice.title}
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

async function loadSystemNews() {

    const userSnap = await getDoc(
        doc(db, "users", studentNumber)
    );

    if (
        !userSnap.exists() ||
        userSnap.data().manabaVerified !== true
    ) {
        systemNews.innerHTML =
            "Manaba認証後に表示されます。";
        return;
    }

    const q = query(
        collection(db, "systemNews"),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {

        if (snapshot.empty) {

            systemNews.innerHTML =
                "CareMateからのお知らせはありません。";

            return;

        }

        systemNews.innerHTML = "";

        snapshot.forEach(newsDoc => {

            const notice = newsDoc.data();

            const created =
                notice.createdAt
                    ? notice.createdAt.toDate()
                    : null;

            const dateText = created
                ? (
                    `${created.getFullYear()}/` +
                    `${created.getMonth() + 1}/` +
                    `${created.getDate()} ` +
                    `${String(created.getHours()).padStart(2, "0")}:` +
                    `${String(created.getMinutes()).padStart(2, "0")}`
                )
                : "";

            systemNews.innerHTML += `

            <div class="card news-card">

                <div class="news-title">
                    💙 ${notice.title}
                </div>

                <div class="news-body">
                    ${(notice.body || "").replace(/\n/g,"<br>")}
                </div>

                <div class="news-date">
                    ${dateText}
                </div>

            </div>

            `;

        });

    });

}

const params = new URLSearchParams(location.search);

if (params.get("tab") === "course") {
    courseTab.click();
}