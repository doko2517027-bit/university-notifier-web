import {
    db,
    studentNumber,
    setupTheme,
    initializePage,
    loadProfileImage,
    loadUserName,
    setupAdminTab,
    setupOfflineAlert,
    updateAssignmentNavBadge,
    updateShareNavBadge
} from "./common.js";

import {
    doc,
    getDoc,
    setDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    onSnapshot,
    serverTimestamp
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
const universityNewsBadge = document.getElementById("universityNewsBadge");
const courseNewsBadge = document.getElementById("courseNewsBadge");
const systemNewsBadge = document.getElementById("systemNewsBadge");

let readNewsIds = new Set();

async function loadReadNewsIds() {

    if (!studentNumber) {
        return;
    }

    try {

        const snapshot = await getDocs(
            collection(
                db,
                "users",
                studentNumber,
                "readNews"
            )
        );

        readNewsIds = new Set(
            snapshot.docs.map(
                readDoc => readDoc.id
            )
        );

    } catch (error) {

        console.error(
            "お知らせ既読情報取得エラー:",
            error
        );

        readNewsIds = new Set();

    }

}

async function markNewsAsRead(
    type,
    originalNewsId
) {

    if (
        !studentNumber ||
        !type ||
        !originalNewsId
    ) {
        return false;
    }

    const readId =
        `${type}_${originalNewsId}`;

    if (readNewsIds.has(readId)) {
        return true;
    }

    try {

        await setDoc(
            doc(
                db,
                "users",
                studentNumber,
                "readNews",
                readId
            ),
            {
                type,
                newsId: originalNewsId,
                studentNumber,
                readAt: serverTimestamp()
            }
        );

        readNewsIds.add(readId);

        return true;

    } catch (error) {

        console.error(
            "既読保存エラー:",
            error
        );

        return false;

    }

}

setupTheme(themeButton);

await loadReadNewsIds();

await initializePage([

    setupAdminTab(),
    loadUserName(userName),
    loadProfileImage(topProfileImage),
    loadNews(),
    loadCourseNews(),
    loadSystemNews(),
    updateAssignmentNavBadge(),
    updateShareNavBadge(),
    loadNewsTabBadges()

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

    snapshot.forEach(newsDoc => {

        notices.push({
            id: newsDoc.id,
            ...newsDoc.data()
        });

    });

    notices.sort((a, b) =>
        b.postedAt.seconds - a.postedAt.seconds
    );

    newsList.innerHTML = "";

    notices.forEach(notice => {

        const posted =
            notice.postedAt.toDate();

        const readId =
            `university_${notice.id}`;

        const isUnread =
            !readNewsIds.has(readId);

        newsList.innerHTML += `

            <div
                class="card news-card news-readable-card"
                data-news-type="university"
                data-news-id="${notice.id}">

                ${
                    isUnread
                        ? `<span class="news-new-label">NEW</span>`
                        : ""
                }

                <div class="news-date">
                    ${formatDateTime(posted)}
                </div>

                <div class="news-body">
                    ${notice.body.replace(/\n/g, "<br>")}
                </div>

                <br>

                ${
                    notice.pdf
                        ? `
                            <a
                                href="${notice.pdf}"
                                target="_blank"
                                rel="noopener noreferrer">
                                📄 PDFを見る
                            </a>
                        `
                        : ""
                }

                ${
                    isUnread
                        ? `
                            <div class="news-read-hint">
                                タップで既読
                            </div>
                        `
                        : ""
                }

            </div>

        `;

    });

}

newsList.addEventListener(
    "click",
    async (event) => {

        const card =
            event.target.closest(
                ".news-readable-card"
            );

        if (!card) {
            return;
        }

        const type =
            card.dataset.newsType;

        const newsId =
            card.dataset.newsId;

        const readId =
            `${type}_${newsId}`;

        if (readNewsIds.has(readId)) {
            return;
        }

        const saved =
            await markNewsAsRead(
                type,
                newsId
            );

        if (!saved) {
            return;
        }

        card
            .querySelector(".news-new-label")
            ?.remove();

        card
            .querySelector(".news-read-hint")
            ?.remove();

        decreaseNewsTabBadge(
            universityNewsBadge
        );

    }
);

courseNews.addEventListener(
    "click",
    async (event) => {

        const card =
            event.target.closest(
                ".news-readable-card"
            );

        if (!card) {
            return;
        }

        const type =
            card.dataset.newsType;

        const newsId =
            card.dataset.newsId;

        const newsUrl =
            card.dataset.newsUrl;

        const readId =
            `${type}_${newsId}`;

        if (!readNewsIds.has(readId)) {

            const saved =
                await markNewsAsRead(
                    type,
                    newsId
                );

            if (!saved) {
                return;
            }

            card
                .querySelector(".news-new-label")
                ?.remove();

            card
                .querySelector(".news-read-hint")
                ?.remove();

            decreaseNewsTabBadge(
                courseNewsBadge
            );
        }

        if (newsUrl) {
            window.open(
                newsUrl,
                "_blank",
                "noopener,noreferrer"
            );
        }

    }
);

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

function getTimestampMilliseconds(timestamp) {

    if (!timestamp) {
        return 0;
    }

    if (typeof timestamp.toMillis === "function") {
        return timestamp.toMillis();
    }

    if (typeof timestamp.toDate === "function") {
        return timestamp.toDate().getTime();
    }

    return 0;

}

function setNewsTabBadge(badge, count) {

    if (!badge) {
        return;
    }

    if (count <= 0) {

        badge.hidden = true;
        badge.textContent = "0";

        return;
    }

    badge.hidden = false;

    badge.textContent =
        count > 99
            ? "99+"
            : String(count);

}

function decreaseNewsTabBadge(badge) {

    if (!badge || badge.hidden) {
        return;
    }

    const currentCount =
        Number(badge.textContent);

    if (
        !Number.isFinite(currentCount) ||
        currentCount <= 1
    ) {

        badge.textContent = "0";
        badge.hidden = true;

        return;
    }

    badge.textContent =
        String(currentCount - 1);

}

async function loadNewsTabBadges() {

    if (!studentNumber) {
        return;
    }

    try {

        const userSnap = await getDoc(
            doc(db, "users", studentNumber)
        );

        if (!userSnap.exists()) {
            return;
        }

        const user = userSnap.data();

        const universityLastRead =
            getTimestampMilliseconds(
                user.universityNewsLastReadAt
            );

        const courseLastRead =
            getTimestampMilliseconds(
                user.courseNewsLastReadAt
            );

        const systemLastRead =
            getTimestampMilliseconds(
                user.systemNewsLastReadAt
            );

        const department =
            localStorage.getItem("department") || "";

        const major =
            localStorage.getItem("major") || "";

        const grade =
            (
                localStorage.getItem("grade") || ""
            ).replace("年", "");

        let universityUnreadCount = 0;

        if (grade && (department || major)) {

            let universityQuery;

            if (department) {

                universityQuery = query(
                    collection(db, "news"),
                    where("department", "==", department),
                    where("grade", "==", grade)
                );

            } else {

                universityQuery = query(
                    collection(db, "news"),
                    where("major", "==", major),
                    where("grade", "==", grade)
                );

            }

            const universitySnap =
                await getDocs(universityQuery);

            universitySnap.forEach(newsDoc => {
        
                const readId =
                    `university_${newsDoc.id}`;
            
                if (!readNewsIds.has(readId)) {
                    universityUnreadCount++;
                }
            
            });

        }

        const courseSnap = await getDocs(
            collection(
                db,
                "courseNews",
                studentNumber,
                "news"
            )
        );

        let courseUnreadCount = 0;

        courseSnap.forEach(newsDoc => {

            const postedAt =
                parseCourseNewsDate(
                    newsDoc.data().posted
                );

            if (postedAt > courseLastRead) {
                courseUnreadCount++;
            }

        });

        const systemSnap = await getDocs(
            collection(db, "systemNews")
        );

        let systemUnreadCount = 0;

        systemSnap.forEach(newsDoc => {

            const createdAt =
                getTimestampMilliseconds(
                    newsDoc.data().createdAt
                );

            if (createdAt > systemLastRead) {
                systemUnreadCount++;
            }

        });

        setNewsTabBadge(
            universityNewsBadge,
            universityUnreadCount
        );

        setNewsTabBadge(
            courseNewsBadge,
            courseUnreadCount
        );

        setNewsTabBadge(
            systemNewsBadge,
            systemUnreadCount
        );

    } catch (error) {

        console.error(
            "お知らせ個別バッジ取得エラー:",
            error
        );

    }

}

function formatDateTime(date) {

    if (!date) {
        return "";
    }

    return (
        `${date.getFullYear()}/` +
        `${String(date.getMonth() + 1).padStart(2, "0")}/` +
        `${String(date.getDate()).padStart(2, "0")} ` +
        `${String(date.getHours()).padStart(2, "0")}:` +
        `${String(date.getMinutes()).padStart(2, "0")}`
    );

}

function formatCourseNewsDate(value) {

    const timestamp =
        parseCourseNewsDate(value);

    if (!timestamp) {
        return value || "";
    }

    return formatDateTime(
        new Date(timestamp)
    );

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

        notices.push({
            id: newsDoc.id,
            ...newsDoc.data()
        });

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

        const readId =
            `course_${notice.id}`;
    
        const isUnread =
            !readNewsIds.has(readId);
    
        courseNews.innerHTML += `
    
            <div
                class="card news-card news-readable-card"
                data-news-type="course"
                data-news-id="${notice.id}"
                data-news-url="${notice.url || ""}">
    
                ${
                    isUnread
                        ? `<span class="news-new-label">NEW</span>`
                        : ""
                }
    
                <div class="news-date">
                    ${formatCourseNewsDate(notice.posted)}
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
    
                ${
                    isUnread
                        ? `
                            <div class="news-read-hint">
                                タップで既読
                            </div>
                        `
                        : ""
                }
    
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

            const notice = {
                id: newsDoc.id,
                ...newsDoc.data()
            };

            const created =
                notice.createdAt
                    ? notice.createdAt.toDate()
                    : null;

            const dateText = formatDateTime(created);

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