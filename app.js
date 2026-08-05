import {
    db,
    studentNumber,
    setupTheme,
    loadProfileImage,
    loadUserName,
    loadMyRanking,
    getRankMark,
    getAnonymousRankingName,
    initializePage,
    showPage,
    showNewsSkeleton,
    isAdmin,
    decryptData,
    setupOfflineAlert,
    updateAssignmentNavBadge,
    updateShareNavBadge,
    updateNewsNavBadge,
    setupAttendanceWebPush,
    studentAcademicContext
} from "./common.js";
import { loadPersonalTimetableData, isEnrolledScheduleItem } from "./personal_timetable_data.js";

import {
    doc,
    getDoc,
    updateDoc,
    setDoc,
    serverTimestamp,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    onSnapshot,
    limit
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { VERSION } from "./version.js";

document.getElementById("version").textContent = `Version ${VERSION}`;

const homeCourseNews = document.getElementById("homeCourseNews");
const homeSystemNews = document.getElementById("homeSystemNews");
const weatherLocation = document.getElementById("weatherLocation");
const weatherMain = document.getElementById("weatherMain");
const weatherDetail = document.getElementById("weatherDetail");
const weatherCard = document.getElementById("weatherCard");
const weatherUpdated = document.getElementById("weatherUpdated");
const weatherDate = document.getElementById("weatherDate");
const examStatusCard = document.getElementById("examStatusCard");
const examStatusLabel = document.getElementById("examStatusLabel");
const examStatusText = document.getElementById("examStatusText");
const examStatusTitle = document.getElementById("examStatusTitle");
const examCard = document.getElementById("examCard");
const examPopupOverlay = document.getElementById("examPopupOverlay");
const rankingPopupOverlay =
    document.getElementById("rankingPopupOverlay");
const attendanceCard =
    document.getElementById("attendanceCard");
const courseRegistrationBanner =
    document.getElementById("courseRegistrationBanner");
const courseRegistrationBannerText =
    document.getElementById("courseRegistrationBannerText");
const courseRegistrationSlide =
    document.getElementById("courseRegistrationSlide");
const courseRegistrationCard =
    document.getElementById("courseRegistrationCard");
const courseRegistrationCardText =
    document.getElementById("courseRegistrationCardText");
const rankingPopupDate =
    document.getElementById("rankingPopupDate");

const rankingPopupList =
    document.getElementById("rankingPopupList");

const closeRankingPopup =
    document.getElementById("closeRankingPopup");

const attendancePopupOverlay =
    document.getElementById("attendancePopupOverlay");

const attendanceSubject =
    document.getElementById("attendanceSubject");

const closeAttendancePopup =
    document.getElementById("closeAttendancePopup");

const attendanceYes =
    document.getElementById("attendanceYes");

const attendanceNo =
    document.getElementById("attendanceNo");

// 追加 定数
const rankingList =
    document.getElementById("rankingList");

const rankingDate =
    document.getElementById("rankingDate");
const myRanking =
    document.getElementById("myRanking");
const closeExamPopup = document.getElementById("closeExamPopup");
const examPopupLabel = document.getElementById("examPopupLabel");
const examPopupTitle = document.getElementById("examPopupTitle");
const examPopupCountdown = document.getElementById("examPopupCountdown");
const examPopupPeriod = document.getElementById("examPopupPeriod");
const openExamFromPopup = document.getElementById("openExamFromPopup");
const userName = document.getElementById("userName");
const newsList = document.getElementById("newsList");
if(newsList){
    showNewsSkeleton(newsList);
}
const lectureScheduleLabel = document.getElementById("lectureScheduleLabel");
const lectureScheduleDetail = document.getElementById("lectureScheduleDetail");
const lectureScheduleList = document.getElementById("lectureScheduleList");
const lecturePrev = document.getElementById("lecturePrev");
const lectureNext = document.getElementById("lectureNext");
const lectureDatePickerButton = document.getElementById("lectureDatePickerButton");
const lectureCalendarPopup = document.getElementById("lectureCalendarPopup");
const lectureCalendarMonth = document.getElementById("lectureCalendarMonth");
const lectureCalendarDays = document.getElementById("lectureCalendarDays");
const lectureCalendarPrevMonth = document.getElementById("lectureCalendarPrevMonth");
const lectureCalendarNextMonth = document.getElementById("lectureCalendarNextMonth");
const examScheduleCard = document.getElementById("examScheduleCard");
const examScheduleList = document.getElementById("examScheduleList");
const examPrev = document.getElementById("examPrev");
const examNext = document.getElementById("examNext");
const examPage = document.getElementById("examPage");
const registered = localStorage.getItem("registered");
const manabaId = localStorage.getItem("manabaId");
const migrated = localStorage.getItem("migrated");
const topProfileImage = document.getElementById("topProfileImage");
const themeButton = document.getElementById("themeButton");
const activeMailButton = document.getElementById("activeMailButton");
const activeMailBadge = document.getElementById("activeMailBadge");
const authSetupCards = document.getElementById("authSetupCards");
const authSetupSection =
    document.getElementById(
        "authSetupSection"
    );

const homeUserMiniImage =
    document.getElementById(
        "homeUserMiniImage"
    );

const settingsTab =
    document.getElementById(
        "settingsTab"
    );

const adminTab =
    document.getElementById(
        "adminTab"
    );

let courses = {};
let lectureSchedules = [];
let lectureScheduleIndex = 0;

let lectureCalendarYear = 0;
let lectureCalendarMonthIndex = 0;

let examSchedules = [];
let examScheduleIndex = 0;

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

console.log("studentNumber =", studentNumber);

    let user = null;

    try {

        if (!studentNumber) {

	    localStorage.removeItem("loggedIn");
	    localStorage.removeItem("studentNumber");
	
	    location.href = "login.html";
	    return;
	
	}

        await checkMaintenance();

        const userSnap = await getDoc(
            doc(db, "users", studentNumber)
        );

        if (!userSnap.exists()) {
	
	    localStorage.removeItem("loggedIn");
	    localStorage.removeItem("studentNumber");
	
	    alert("ユーザー情報を取得できませんでした。もう一度ログインしてください。");
	
	    location.href = "login.html";
	    return;
	
	}

        user = userSnap.data();

        if (user.activeMailResetRequired === true) {
            location.href = "activemail_setup.html";
            return;
        }

        if (user.manabaResetRequired === true) {
            location.href = "manaba_setup.html";
            return;
        }

        renderAuthSetupCards(user);

    } catch (e) {

        console.error(e);

        showPage();

        return;

    }

    showPage();

    Promise.all([

        loadUserName(
            userName
        ),

        loadMyRanking(),

        loadProfileImage(
            topProfileImage
        ),

        loadProfileImage(
            homeUserMiniImage
        ),

        loadActiveMailBadge(
            user
        ),

        setupHomeRoleTabs(),

        updateAssignmentNavBadge(),

        updateShareNavBadge(),

        updateNewsNavBadge()

    ]);

    await Promise.all([
        loadExamMode(),
        loadWeather(user),
        loadNews(),
        loadHomeCourseNews(),
        loadHomeSystemNews(),
        loadCourseLinks(),
        loadTodaySchedule(),
        loadCourseRegistrationBanner(user),
    ]);

    loadRankingPopup();

    loadRanking();

    loadAttendancePopup();

}

/* ========================================
   設定・管理タブの仕分け
======================================== */

async function setupHomeRoleTabs() {

    try {

        const administrator =
            await isAdmin();


        if (administrator) {

            if (settingsTab) {

                settingsTab.style.display =
                    "none";

            }


            if (adminTab) {

                adminTab.style.display =
                    "flex";

            }

        } else {

            if (settingsTab) {

                settingsTab.style.display =
                    "flex";

            }


            if (adminTab) {

                adminTab.style.display =
                    "none";

            }

        }

    } catch (error) {

        console.error(
            "ホーム管理者判定エラー:",
            error
        );


        if (settingsTab) {

            settingsTab.style.display =
                "flex";

        }


        if (adminTab) {

            adminTab.style.display =
                "none";

        }

    }

}

function renderAuthSetupCards(
    user
) {

    if (!authSetupCards) {
        return;
    }


    const cards = [];


    if (
        !user.manabaPasswordEncrypted
    ) {

        cards.push(`

            <a
                href="manaba_setup.html"
                class="home-setup-card">


                <span class="home-setup-icon">

                    📚

                </span>


                <span class="home-setup-content">

                    <small>

                        初期設定

                    </small>


                    <strong>

                        Manaba認証を設定

                    </strong>


                    <span>

                        課題取得・課題通知・Manaba関連機能を利用するために必要です。

                    </span>

                </span>


                <span class="home-setup-arrow">

                    →

                </span>

            </a>

        `);

    }


    if (
        !user.activeMailPasswordEncrypted
    ) {

        cards.push(`

            <a
                href="activemail_setup.html"
                class="home-setup-card">


                <span class="home-setup-icon">

                    📧

                </span>


                <span class="home-setup-content">

                    <small>

                        初期設定

                    </small>


                    <strong>

                        Active!Mail認証を設定

                    </strong>


                    <span>

                        大学メール通知や未読件数を表示するために必要です。

                    </span>

                </span>


                <span class="home-setup-arrow">

                    →

                </span>

            </a>

        `);

    }


    authSetupCards.innerHTML =
        cards.join("");


    if (authSetupSection) {

        authSetupSection.hidden =
            cards.length === 0;

    }

}

function loadActiveMailBadge(user) {

    if (!activeMailBadge) return;

    const unreadCount =
        user.activeMailUnreadCount || 0;

    if (unreadCount <= 0) {
        activeMailBadge.hidden = true;
        return;
    }

    activeMailBadge.hidden = false;

    activeMailBadge.textContent =
        unreadCount > 99
            ? "99+"
            : unreadCount;

}

startApp();
setupTheme(themeButton);
setupOfflineAlert();

// 5分ごと
setInterval(updateLastActive, 5 * 60 * 1000);

// アプリへ戻った時
document.addEventListener("visibilitychange", () => {

    if (!document.hidden) {

        updateLastActive();

    }

});

if(weatherCard){

    weatherCard.onclick = () => {

        location.href =
            "weather-settings.html";

    };

}

if(attendanceCard){

    attendanceCard.onclick = async () => {

        try {

            await setupAttendanceWebPush();

            location.href =
                "attendance.html";

        } catch (error) {

            console.error(
                "出席通知登録エラー:",
                error
            );

            location.href =
                "attendance.html";

        }

    };

}

const personalTimetableCard=document.getElementById("personalTimetableCard");
if(personalTimetableCard){
    personalTimetableCard.onclick=()=>{location.href="personal_timetable.html";};
}

async function loadCourseRegistrationBanner(user){
    if(!courseRegistrationBanner) return;

    if(user?.manabaVerified !== true) return;

    try {
        const configSnap = await getDoc(doc(db, "system", "courseRegistration"));
        if(!configSnap.exists()) return;

        const config = configSnap.data();
        const now = Date.now();
        const starts = config.startAt ? new Date(config.startAt).getTime() : 0;
        const ends = config.endAt ? new Date(config.endAt).getTime() : Infinity;
        const inPeriod = now >= starts && now <= ends;

        if(
            config.published !== true ||
            config.pageEnabled !== true ||
            config.phase === "hidden" ||
            !inPeriod
        ) return;

        if(config.bannerEnabled === true){
            courseRegistrationBannerText.textContent =
                config.bannerText || "履修登録期間中！！";
            courseRegistrationBanner.dataset.speed = config.bannerSpeed || "normal";
            courseRegistrationBanner.hidden = false;
            courseRegistrationBanner.onclick = () => {
                location.href = "course_registration.html";
            };
        }

        if(config.convenienceCardEnabled === true && courseRegistrationSlide){
            courseRegistrationSlide.hidden = false;
            if(courseRegistrationCardText){
                courseRegistrationCardText.textContent =
                    `${config.academicYear}年度 ${config.semester}の履修科目を登録`;
            }
            courseRegistrationCard.onclick = () => {
                location.href = "course_registration.html";
            };
        }
    } catch(error) {
        console.error("履修登録案内取得エラー:", error);
    }
}

if(activeMailButton){

    activeMailButton.onclick = () => {

        location.href = "activemail.html";

    };

}

async function loadNews() {

    try {

        const department =
            localStorage.getItem(
                "department"
            );

        const grade =
            localStorage.getItem(
                "grade"
            );

        const major =
            localStorage.getItem(
                "major"
            );


        if (
            (!department && !major) ||
            !grade
        ) {

            renderHomeNewsEmpty(
                newsList,
                "所属情報が設定されていません。"
            );

            return;

        }


        let newsQuery;


        if (department) {

            newsQuery = query(

                collection(
                    db,
                    "news"
                ),

                where(
                    "department",
                    "==",
                    department
                ),

                where(
                    "grade",
                    "==",
                    grade.replace(
                        "年",
                        ""
                    )
                )

            );

        } else {

            newsQuery = query(

                collection(
                    db,
                    "news"
                ),

                where(
                    "major",
                    "==",
                    major
                ),

                where(
                    "grade",
                    "==",
                    grade.replace(
                        "年",
                        ""
                    )
                )

            );

        }


        const snapshot =
            await getDocs(
                newsQuery
            );


        if (snapshot.empty) {

            renderHomeNewsEmpty(
                newsList,
                "大学からのお知らせはありません。"
            );

            return;

        }


        const notices =
            snapshot.docs
                .map(
                    newsDocument => {

                        const data =
                            newsDocument.data() || {};


                        return {

                            ...data,

                            id:
                                newsDocument.id

                        };

                    }
                )
                .sort(
                    (
                        noticeA,
                        noticeB
                    ) =>
                        getFirestoreTime(
                            noticeB.postedAt
                        ) -
                        getFirestoreTime(
                            noticeA.postedAt
                        )
                );


        const cards =
            notices
                .slice(
                    0,
                    3
                )
                .map(
                    notice => {

                        const body =
                            String(
                                notice.body ||
                                notice.title ||
                                "お知らせ"
                            );


                        const firstLine =
                            body
                                .split("\n")
                                .find(
                                    line =>
                                        line.trim() !== ""
                                ) ||
                            "大学からのお知らせ";


                        return createHomeNewsCard({

                            href:
                                "news.html",

                            icon:
                                "📢",

                            category:
                                "大学",

                            title:
                                shortenText(
                                    firstLine,
                                    34
                                ),

                            body:
                                shortenText(
                                    body,
                                    56
                                ),

                            date:
                                formatDateTime(
                                    firestoreValueToDate(
                                        notice.postedAt
                                    )
                                )

                        });

                    }
                )
                .join("");


        newsList.innerHTML =
            cards +
            createHomeNewsMoreLink(
                "news.html",
                "大学のお知らせをすべて見る"
            );

    } catch (error) {

        console.error(
            "大学お知らせ取得エラー:",
            error
        );


        renderHomeNewsError(
            newsList
        );

    }

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

    return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5])
    ).getTime();

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

async function loadHomeCourseNews() {

    try {

        const courseNewsQuery =
            query(

                collection(
                    db,
                    "courseNews",
                    studentNumber,
                    "news"
                ),

                orderBy(
                    "createdAt",
                    "desc"
                )

            );


        const snapshot =
            await getDocs(
                courseNewsQuery
            );


        if (snapshot.empty) {

            renderHomeNewsEmpty(
                homeCourseNews,
                "コースのお知らせはありません。"
            );

            return;

        }


        const notices =
            snapshot.docs
                .map(
                    newsDocument =>
                        newsDocument.data() || {}
                )
                .sort(
                    (
                        noticeA,
                        noticeB
                    ) =>
                        parseCourseNewsDate(
                            noticeB.posted
                        ) -
                        parseCourseNewsDate(
                            noticeA.posted
                        )
                );


        const cards =
            notices
                .slice(
                    0,
                    3
                )
                .map(
                    notice =>
                        createHomeNewsCard({

                            href:
                                "news.html?tab=course",

                            icon:
                                "📘",

                            category:
                                notice.course ||
                                "コース",

                            title:
                                shortenText(
                                    notice.title ||
                                    "コースからのお知らせ",
                                    34
                                ),

                            body:
                                shortenText(
                                    notice.body ||
                                    notice.title ||
                                    "",
                                    56
                                ),

                            date:
                                formatCourseNewsDate(
                                    notice.posted
                                )

                        })
                )
                .join("");


        homeCourseNews.innerHTML =
            cards +
            createHomeNewsMoreLink(
                "news.html?tab=course",
                "コースのお知らせをすべて見る"
            );

    } catch (error) {

        console.error(
            "コースお知らせ取得エラー:",
            error
        );


        renderHomeNewsError(
            homeCourseNews
        );

    }

}

async function loadHomeSystemNews() {

    try {

        const userSnapshot =
            await getDoc(

                doc(
                    db,
                    "users",
                    studentNumber
                )

            );


        if (
            !userSnapshot.exists() ||
            userSnapshot.data()
                .manabaVerified !== true
        ) {

            renderHomeNewsEmpty(

                homeSystemNews,

                "Manaba認証後に表示されます。",

                "🔐"

            );

            return;

        }


        const systemNewsQuery =
            query(

                collection(
                    db,
                    "systemNews"
                ),

                orderBy(
                    "createdAt",
                    "desc"
                )

            );


        onSnapshot(

            systemNewsQuery,

            snapshot => {

                if (snapshot.empty) {

                    renderHomeNewsEmpty(
                        homeSystemNews,
                        "CareMateからのお知らせはありません。"
                    );

                    return;

                }


                const cards =
                    snapshot.docs
                        .slice(
                            0,
                            3
                        )
                        .map(
                            newsDocument => {

                                const notice =
                                    newsDocument.data() || {};


                                return createHomeNewsCard({

                                    href:
                                        "news.html",

                                    icon:
                                        "💙",

                                    category:
                                        "CareMate",

                                    title:
                                        shortenText(
                                            notice.title ||
                                            "CareMateからのお知らせ",
                                            34
                                        ),

                                    body:
                                        shortenText(
                                            notice.body ||
                                            "",
                                            56
                                        ),

                                    date:
                                        formatDateTime(
                                            firestoreValueToDate(
                                                notice.createdAt
                                            )
                                        )

                                });

                            }
                        )
                        .join("");


                homeSystemNews.innerHTML =
                    cards +
                    createHomeNewsMoreLink(
                        "news.html",
                        "CareMateのお知らせをすべて見る"
                    );

            },

            error => {

                console.error(
                    "CareMateお知らせ監視エラー:",
                    error
                );


                renderHomeNewsError(
                    homeSystemNews
                );

            }

        );

    } catch (error) {

        console.error(
            "CareMateお知らせ取得エラー:",
            error
        );


        renderHomeNewsError(
            homeSystemNews
        );

    }

}

/* ========================================
   ホームお知らせ共通表示
======================================== */

function createHomeNewsCard({

    href,
    icon,
    category,
    title,
    body,
    date

}) {

    return `

        <a
            href="${escapeHtmlAttribute(
                href
            )}"
            class="home-news-item">


            <span class="home-news-item-icon">

                ${escapeHtml(icon)}

            </span>


            <span class="home-news-item-content">


                <span class="home-news-item-top">

                    <span class="home-news-category">

                        ${escapeHtml(
                            category
                        )}

                    </span>


                    ${
                        date
                            ? `

                                <time>

                                    ${escapeHtml(
                                        date
                                    )}

                                </time>

                            `
                            : ""
                    }

                </span>


                <strong>

                    ${escapeHtml(
                        title
                    )}

                </strong>


                ${
                    body
                        ? `

                            <span class="home-news-item-body">

                                ${escapeHtml(
                                    body
                                )}

                            </span>

                        `
                        : ""
                }

            </span>


            <span class="home-news-item-arrow">

                →

            </span>

        </a>

    `;

}


function createHomeNewsMoreLink(
    href,
    label
) {

    return `

        <a
            href="${escapeHtmlAttribute(
                href
            )}"
            class="home-news-more-link">

            <span>

                ${escapeHtml(
                    label
                )}

            </span>

            <b>
                →
            </b>

        </a>

    `;

}


function renderHomeNewsEmpty(
    target,
    message,
    icon = "📭"
) {

    if (!target) {
        return;
    }


    target.innerHTML = `

        <div class="home-news-empty">

            <span>

                ${escapeHtml(
                    icon
                )}

            </span>

            <p>

                ${escapeHtml(
                    message
                )}

            </p>

        </div>

    `;

}


function renderHomeNewsError(
    target
) {

    if (!target) {
        return;
    }


    target.innerHTML = `

        <div class="home-news-empty is-error">

            <span>
                ⚠️
            </span>

            <p>
                お知らせを取得できませんでした。
            </p>

            <button
                type="button"
                onclick="location.reload()">

                再読み込み

            </button>

        </div>

    `;

}


/* ========================================
   日付変換
======================================== */

function firestoreValueToDate(
    value
) {

    if (!value) {

        return null;

    }


    if (
        typeof value.toDate ===
        "function"
    ) {

        return value.toDate();

    }


    if (
        value instanceof Date
    ) {

        return value;

    }


    const convertedDate =
        new Date(value);


    return Number.isNaN(
        convertedDate.getTime()
    )
        ? null
        : convertedDate;

}


function getFirestoreTime(
    value
) {

    const date =
        firestoreValueToDate(
            value
        );


    return date
        ? date.getTime()
        : 0;

}


/* ========================================
   文字列処理
======================================== */

function shortenText(
    value,
    maximumLength
) {

    const normalized =
        String(
            value ||
            ""
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();


    if (
        normalized.length <=
        maximumLength
    ) {

        return normalized;

    }


    return (
        normalized.slice(
            0,
            maximumLength
        ) +
        "…"
    );

}


function escapeHtml(
    value
) {

    return String(
        value ??
        ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}


function escapeHtmlAttribute(
    value
) {

    return escapeHtml(
        value
    );

}

async function loadTodaySchedule() {

    const personalTimetable = await loadPersonalTimetableData();
    const enrolledAliases = personalTimetable.aliasToCourse || new Map();

    const department =
        localStorage.getItem("department");

    const major =
        localStorage.getItem("major");

    const grade =
        localStorage.getItem("grade");

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

        lectureScheduleLabel.textContent =
            "講義予定";

        lectureScheduleList.innerHTML =
            `<p class="empty-text">時間割がありません。</p>`;

        return;

    }

    const data = snap.data();

    const scheduleDays =
        Array.isArray(data.allDays) && data.allDays.length > 0
            ? data.allDays
            : data.days;

    if (
        Array.isArray(scheduleDays) &&
        scheduleDays.length > 0
    ) {

        lectureSchedules =
            scheduleDays.map(day => ({
                date: day.date || "",
                title: day.title || "次回講義日",
                label: day.label || "",
                schedules: Array.isArray(day.schedules)
                    ? day.schedules.filter(item => isEnrolledScheduleItem(item,enrolledAliases))
                    : []
            }));

    } else {

        // 古い形式との互換性
        lectureSchedules = [
            {
                date: "",
                title: data.todayTitle || "今日",
                label: data.todayLabel || "",
                schedules: (data.today || []).filter(item => isEnrolledScheduleItem(item,enrolledAliases))
            },
            {
                date: "",
                title: data.nextTitle || "次回",
                label: data.nextLabel || "",
                schedules: (data.next || []).filter(item => isEnrolledScheduleItem(item,enrolledAliases))
            }
        ];

    }

    const scheduleParams = new URLSearchParams(location.search);
    if (scheduleParams.get("clearAttendanceTestDate") === "1") {
        localStorage.removeItem("careMateAttendanceTestDate");
        localStorage.removeItem("careMateSelectedScheduleDate");
        if (studentNumber) {
            await updateDoc(doc(db, "users", studentNumber), {
                "attendanceTestClock.enabled": false,
                "attendanceTestClock.resetAt": new Date().toISOString()
            });
        }
    }

    const userSnapshot = studentNumber
        ? await getDoc(doc(db, "users", studentNumber))
        : null;
    const userTestClock = userSnapshot?.data()?.attendanceTestClock || {};
    const userTestDateActive = userTestClock.enabled === true &&
        /^\d{4}-\d{2}-\d{2}$/.test(userTestClock.date || "") &&
        Date.parse(userTestClock.expiresAt || "") > Date.now();

    if (!userTestDateActive && localStorage.getItem("careMateAttendanceTestDate")) {
        localStorage.removeItem("careMateAttendanceTestDate");
        localStorage.removeItem("careMateSelectedScheduleDate");
    }

    const notificationTest = userSnapshot?.data()?.attendanceNotificationTest || {};
    const notificationTestActive = notificationTest.enabled === true &&
        notificationTest.date === new Date().toLocaleDateString("sv-SE") &&
        Date.parse(notificationTest.expiresAt || "") > Date.now() &&
        (Array.isArray(notificationTest.lectures) ? notificationTest.lectures : [notificationTest])
            .some(test => isEnrolledScheduleItem({ subject: test.subject }, enrolledAliases));
    if (notificationTestActive) {
        let testDay = lectureSchedules.find(item => item.date === notificationTest.date);
        if (!testDay) {
            testDay = { date: notificationTest.date, title: "今日", label: "通知テスト", schedules: [] };
            lectureSchedules.push(testDay);
            lectureSchedules.sort((a, b) => String(a.date).localeCompare(String(b.date)));
        }
        const testLectures = Array.isArray(notificationTest.lectures)
            ? notificationTest.lectures : [notificationTest];
        for (const test of testLectures) {
            if (!isEnrolledScheduleItem({ subject: test.subject }, enrolledAliases)) continue;
            testDay.schedules.push({
                subject: test.subject,
                grade,
                period: `${test.period || 1}限`,
                classGroup: test.classGroup || "",
                startTime: test.startTime,
                endTime: test.endTime,
                building: "CareMate",
                room: "クラス通知テスト",
                attendanceNotificationTest: true
            });
        }
    }

    const selectedAttendanceClass = userSnapshot?.data()?.attendanceClassGroup || "";
    if (selectedAttendanceClass) {
        lectureSchedules = lectureSchedules.map(day => ({
            ...day,
            schedules: (day.schedules || []).filter(item =>
                !item.classGroup || item.classGroup === selectedAttendanceClass
            )
        }));
    }

    let availableClassGroups = [...new Set(
        lectureSchedules.flatMap(day => day.schedules || [])
            .filter(item => !grade || String(item.grade || "") === String(grade))
            .map(item => String(item.classGroup || "").trim())
            .filter(Boolean)
    )];
    const standardClassGroups = availableClassGroups.filter(group => /^[A-DＡ-Ｄ]クラス$/.test(group));
    if (standardClassGroups.length > 1) availableClassGroups = standardClassGroups;
    if (!userSnapshot?.data()?.attendanceClassGroup && availableClassGroups.length > 1) {
        showAttendanceClassSelector(availableClassGroups);
    }

    const actualToday = new Date().toLocaleDateString("sv-SE");
    let initialDate = userTestDateActive ? userTestClock.date
        : notificationTestActive ? notificationTest.date : "";
    if (!initialDate) {
        const exactToday = lectureSchedules.find(item => item.date === actualToday);
        const nextDay = lectureSchedules.find(item => item.date >= actualToday);
        initialDate = exactToday?.date || nextDay?.date || lectureSchedules.at(-1)?.date || "";
    }
    lectureScheduleIndex = Math.max(0, lectureSchedules.findIndex(item => item.date === initialDate));

    // 日付選択は端末内に保持する。attendanceTestDate は表示だけを変える
    // 明示的なテスト用指定で、実際の端末・サーバー時刻には触れない。
    const requestedTestDate = scheduleParams.get("attendanceTestDate");
    if (/^\d{4}-\d{2}-\d{2}$/.test(requestedTestDate || "")) {
        localStorage.setItem("careMateSelectedScheduleDate", requestedTestDate);
        localStorage.setItem("careMateAttendanceTestDate", requestedTestDate);
    }
    if (userTestDateActive) {
        localStorage.setItem("careMateSelectedScheduleDate", userTestClock.date);
        localStorage.setItem("careMateAttendanceTestDate", userTestClock.date);
    }
    const savedScheduleDate = userTestDateActive
        ? userTestClock.date
        : localStorage.getItem("careMateSelectedScheduleDate") || "";
    const savedScheduleIndex = lectureSchedules.findIndex(
        item => item.date === savedScheduleDate
    );
    if (savedScheduleIndex >= 0) {
        lectureScheduleIndex = savedScheduleIndex;
    }

    const firstLectureDate =
        lectureSchedules[lectureScheduleIndex]?.date
            ? new Date(`${lectureSchedules[lectureScheduleIndex].date}T00:00:00`)
            : new Date();

    lectureCalendarYear =
        firstLectureDate.getFullYear();

    lectureCalendarMonthIndex =
        firstLectureDate.getMonth();

    renderCurrentLectureSchedule(grade);

}

function renderCurrentLectureSchedule(grade) {

    if (
        !lectureScheduleLabel ||
        !lectureScheduleList ||
        lectureSchedules.length === 0
    ) {
        return;
    }

    const current =
        lectureSchedules[lectureScheduleIndex];

    lectureScheduleLabel.textContent =
        splitLectureScheduleLabel(current).dateText;

    const labelParts = splitLectureScheduleLabel(current);

    if (lectureScheduleDetail) {
        lectureScheduleDetail.textContent = labelParts.detailText;
        lectureScheduleDetail.hidden = !labelParts.detailText;
    }

    if (lectureDatePickerButton) {
        lectureDatePickerButton.setAttribute(
            "aria-label",
            labelParts.detailText
                ? `${labelParts.dateText} ${labelParts.detailText}の時間割を選択`
                : `${labelParts.dateText}の時間割を選択`
        );
    }

    const attendanceTestDate =
        localStorage.getItem("careMateAttendanceTestDate") || "";
    lectureScheduleList.innerHTML = `
        <div class="schedule-day-badge">
            ${current.date === attendanceTestDate ? "今日（表示テスト）" : current.title}
        </div>
    `;

    renderSchedule(
        "lectureScheduleList",
        current.schedules,
        grade,
        true
    );

    if (lecturePrev) {

        lecturePrev.disabled =
            lectureScheduleIndex === 0;

    }

    if (lectureNext) {

        lectureNext.disabled =
            lectureScheduleIndex ===
            lectureSchedules.length - 1;

    }

}

function showAttendanceClassSelector(groups) {
    if (document.getElementById("attendanceClassSelector")) return;
    const overlay = document.createElement("div");
    overlay.id = "attendanceClassSelector";
    overlay.className = "exam-popup-overlay show attendance-class-selector";
    const card = document.createElement("div");
    card.className = "exam-popup-card";
    const title = document.createElement("h2");
    title.textContent = "所属クラスを選択";
    const description = document.createElement("p");
    description.textContent = "時間割がクラス別に分かれています。選択すると、そのクラスの出席通知だけが届きます。";
    const choices = document.createElement("div");
    choices.className = "attendance-class-options";
    for (const group of groups) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "main-button";
        button.textContent = group;
        button.onclick = async () => {
            button.disabled = true;
            await updateDoc(doc(db, "users", studentNumber), {
                attendanceClassGroup: group,
                attendanceClassGroupSelectedAt: new Date().toISOString()
            });
            overlay.remove();
            location.reload();
        };
        choices.appendChild(button);
    }
    const later = document.createElement("button");
    later.type = "button";
    later.className = "btn attendance-class-later";
    later.textContent = "あとで選ぶ（全クラス通知）";
    later.onclick = () => overlay.remove();
    card.append(title, description, choices, later);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
}

function splitLectureScheduleLabel(schedule) {
    const rawLabel = String(schedule?.label || "")
        .replace(/\s+/g, " ")
        .trim();
    const labelMatch = rawLabel.match(
        /^(\d{1,2}月\d{1,2}日\s*[（(][日月火水木金土][)）])\s*(.*)$/
    );

    if (labelMatch) {
        return {
            dateText: labelMatch[1].replace("(", "（").replace(")", "）"),
            detailText: labelMatch[2].trim()
        };
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(schedule?.date || "")) {
        const date = new Date(`${schedule.date}T00:00:00`);
        return {
            dateText: `${date.getMonth() + 1}月${date.getDate()}日（${"日月火水木金土"[date.getDay()]}）`,
            detailText: rawLabel
        };
    }

    return {
        dateText: rawLabel || schedule?.title || "講義予定",
        detailText: ""
    };
}

function renderSchedule(
    targetId,
    schedules,
    grade,
    append = false
) {

    const list = schedules
        .filter(item => item.grade === grade)
        .sort((a, b) =>
            parseInt(a.period) - parseInt(b.period)
        );

    if (list.length === 0) {

        const target =
            document.getElementById(targetId);

        const emptyHtml =
            `<p class="empty-text">授業はありません</p>`;

        if (append) {
            target.insertAdjacentHTML(
                "beforeend",
                emptyHtml
            );
        } else {
            target.innerHTML = emptyHtml;
        }

        return;
    }

    const target =
        document.getElementById(targetId);

    const scheduleHtml =
        list.map(item => `
            <div class="lesson-card" onclick="openCourse('${item.subject}')">
                <div class="lesson-period">${item.period}</div>
                <div>
                    <div class="lesson-subject">
                        ${item.subject}
                        ${item.classGroup ? `<span class="lesson-class-group">${item.classGroup}</span>` : ""}
                    </div>
                    <div class="lesson-room">
                        ${item.building} ${item.room}
                    </div>
                    <div class="lesson-teacher">
                        ${item.teacher}
                    </div>
                </div>
            </div>
        `).join("");
    
    if (append) {

        target.insertAdjacentHTML(
            "beforeend",
            scheduleHtml
        );

    } else {

        target.innerHTML =
            scheduleHtml;

    }

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

if (
    splash &&
    !sessionStorage.getItem("splashShown")
) {

    splash.style.display = "flex";

    setTimeout(() => {

        splash.classList.add("hide");

        setTimeout(() => {
            splash.style.display = "none";
        }, 500);

    }, 1200);

    sessionStorage.setItem("splashShown", "true");

} else if (splash) {

    splash.style.display = "none";

}

const settingButton =
document.getElementById("settingButton");

document
.getElementById("profileButton")
.onclick = () => {

    location.href = "profile.html";

};

async function updateLastActive() {

    if (!studentNumber) return;

    try {

        await updateDoc(
            doc(db, "users", studentNumber),
            {
                lastActiveAt: serverTimestamp()
            }
        );

    } catch (e) {

        console.error(e);

    }

}

async function loadWeather(user) {

    try {

        let latitude = 35.4437;
        let longitude = 139.6500;
        let locationName = "横浜市中区";

        if (user?.weatherEncrypted) {

            const weatherSetting =
                await decryptData(user.weatherEncrypted);

            latitude = weatherSetting.latitude;
            longitude = weatherSetting.longitude;
            locationName = weatherSetting.name;

        }

        const url =
            "https://api.open-meteo.com/v1/forecast" +
            `?latitude=${latitude}` +
            `&longitude=${longitude}` +
            "&current=temperature_2m,apparent_temperature,weather_code" +
            "&hourly=precipitation_probability" +
            "&daily=temperature_2m_max,temperature_2m_min" +
            "&timezone=Asia%2FTokyo";

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("天気の取得に失敗しました");
        }

        const data = await response.json();

        const weather =
            getWeatherText(data.current.weather_code);

        const temp =
            Math.round(data.current.temperature_2m);

        const apparent =
            Math.round(
                data.current.apparent_temperature
            );

        const max =
            Math.round(data.daily.temperature_2m_max[0]);

        const min =
            Math.round(data.daily.temperature_2m_min[0]);

        const nowHour =
            new Date().getHours();

        const rain =
            data.hourly.precipitation_probability[nowHour] ?? 0;

        weatherLocation.textContent = locationName;
        weatherMain.textContent = `${weather.icon} ${temp}℃`;
        weatherDetail.textContent = `${max}/${min}℃　💧${rain}%`;

        setWeatherCardStyle(weather.text);

        const now = new Date();

        const dateText =
            `${now.getMonth() + 1}月${now.getDate()}日`;

        weatherDate.textContent = dateText;

        const timeText =
            `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

        weatherUpdated.innerHTML =
            `🕒 更新 ${timeText}`;

    } catch (e) {

        console.error(e);

        weatherMain.textContent =
            "天気を取得できませんでした。";

        weatherDetail.textContent = "";

    }

}

function getWeatherText(code) {

    const hour = new Date().getHours();

    const isNight =
        hour >= 19 || hour < 5;

    const isEvening =
        hour >= 17 && hour < 19;

    if (code === 0) {
        if (isNight) {
            return { icon: "🌙", text: "晴れ" };
        }

        if (isEvening) {
            return { icon: "🌇", text: "晴れ" };
        }

        return { icon: "☀️", text: "晴れ" };
    }

    if ([1, 2, 3].includes(code)) {
        if (isNight) {
            return { icon: "☁️", text: "くもり" };
        }

        return { icon: "🌤", text: "くもり時々晴れ" };
    }

    if ([45, 48].includes(code)) {
        return { icon: "🌫", text: "霧" };
    }

    if ([51, 53, 55, 56, 57].includes(code)) {
        if (isNight) {
            return { icon: "🌧️", text: "霧雨" };
        }

        return { icon: "🌦", text: "霧雨" };
    }

    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
        return { icon: "🌧", text: "雨" };
    }

    if ([71, 73, 75, 77, 85, 86].includes(code)) {
        return { icon: "❄️", text: "雪" };
    }

    if ([95, 96, 99].includes(code)) {
        return { icon: "⛈", text: "雷雨" };
    }

    return { icon: "🌤", text: "天気" };

}

function setWeatherCardStyle(weatherText) {

    weatherCard.style.background = "";
    weatherCard.style.borderColor = "";
    weatherCard.style.color = "#0F172A";

    if (weatherText.includes("晴れ")) {
        weatherCard.style.background =
            "linear-gradient(135deg, #E0F2FE, #FEF3C7)";
    } else if (weatherText.includes("くもり")) {
        weatherCard.style.background =
            "linear-gradient(135deg, #E5E7EB, #F8FAFC)";
    } else if (
        weatherText.includes("雨") ||
        weatherText.includes("霧雨")
    ) {
        weatherCard.style.background =
            "linear-gradient(135deg, #DBEAFE, #E0F2FE)";
    } else if (weatherText.includes("雪")) {
        weatherCard.style.background =
            "linear-gradient(135deg, #FFFFFF, #E0F2FE)";
    } else if (weatherText.includes("雷")) {
        weatherCard.style.background =
            "linear-gradient(135deg, #EDE9FE, #DBEAFE)";
    }

}

async function loadExamMode() {

    const examSlide =
        examCard?.closest(".home-slide");

    if (examStatusCard) {
        examStatusCard.style.display = "none";
    }

    if (examSlide) {

        examSlide.style.display = "none";

    }

    const snap = await getDoc(
        doc(db, "system", "exam")
    );

    if (!snap.exists()) return;

    if (examScheduleCard) {
        examScheduleCard.style.display = "none";
    }

    const exam = snap.data();

    if (exam.enabled !== true) return;

    const now = new Date();

    const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

    const start = new Date(
        exam.startDate + "T00:00:00"
    );

    const end = new Date(
        exam.endDate + "T23:59:59"
    );

    const diffToStart =
        Math.ceil((start - today) / (1000 * 60 * 60 * 24));

    const diffToEnd =
        Math.ceil((end - today) / (1000 * 60 * 60 * 24));

    const schedule =
        Array.isArray(exam.schedule)
            ? exam.schedule
            : [];

    if (examScheduleCard && examScheduleList) {

        const validSchedule =
            schedule
                .filter(item =>
                    item &&
                    (
                        item.date ||
                        item.subject ||
                        item.time ||
                        item.room
                    )
                )
                .sort((a, b) =>
                    String(a.date || "")
                        .localeCompare(String(b.date || ""))
                );

        if (validSchedule.length > 0) {

            examScheduleCard.style.display = "";

            const grouped = {};

            validSchedule.forEach(item => {

                if (!grouped[item.date]) {
                    grouped[item.date] = [];
                }

                grouped[item.date].push(item);

            });

            examSchedules =
                Object.keys(grouped).map(date => ({
                    date,
                    schedules: grouped[date]
                }));

            examScheduleIndex = 0;

            renderCurrentExamSchedule();

        } else {

            examSchedules = [];
            examScheduleIndex = 0;

            examScheduleCard.style.display = "none";

        }

    }

    if (examStatusCard && exam.showCountdown) {

        if (today < start) {

            examStatusCard.style.display = "";

            examStatusLabel.textContent =
                "📚 テスト開始まで";

            examStatusText.textContent =
                `あと ${diffToStart}日`;

            examStatusTitle.textContent =
                exam.title || "定期試験";

        } else if (today <= end) {

            examStatusCard.style.display = "";

            examStatusLabel.textContent =
                "🔥 テスト期間中";

            examStatusText.textContent =
                `終了まであと ${diffToEnd}日`;

            examStatusTitle.textContent =
                exam.title || "定期試験";

        } else {

            examStatusCard.style.display = "none";

        }

    }

    if (examCard && examSlide) {

        if (exam.showHomeButton) {

            examSlide.style.display = "";

            examCard.style.display = "block";

            examCard.onclick = () => {
                location.href = "exam.html";
            };

        } else {

            examSlide.style.display = "none";

        }

    }

    if (exam.showPopup) {

        const todayKey =
            new Date().toISOString().slice(0, 10);

        const popupKey =
            `examPopupShown_${todayKey}`;

        if (!localStorage.getItem(popupKey)) {

            if (today < start) {

                showExamPopup({
                    label: "テスト開始まで",
                    title: exam.title || "定期試験",
                    countdown: `あと ${diffToStart}日`,
                    period:
                        `${formatExamDate(start)} 〜 ${formatExamDate(end)}`
                });

            } else if (today <= end) {

                showExamPopup({
                    label: "テスト期間中",
                    title: exam.title || "定期試験",
                    countdown: `終了まであと ${diffToEnd}日`,
                    period:
                        `${formatExamDate(start)} 〜 ${formatExamDate(end)}`
                });

            }

            localStorage.setItem(popupKey, "true");

        }

    }

}

function loadRankingPopup(){


    // 出席確認ポップアップ表示中なら出さない
    const params =
        new URLSearchParams(
            location.search
        );


    if(params.get("attendance") === "1"){
        return;
    }



    if(!rankingPopupOverlay){
        return;
    }



    const today =
        new Date()
        .toISOString()
        .slice(0,10);



    const key =
        `rankingPopupShown_${today}`;



    // 今日表示済みなら終了
    if(localStorage.getItem(key)){
        return;
    }



    rankingPopupOverlay.classList.add("show");



    localStorage.setItem(
        key,
        "true"
    );

}

async function loadRanking(){

    if(!rankingList){
        return;
    }


    try{

        const now = new Date();

		// 昨日の日付を取得
		now.setDate(now.getDate() - 1);
		
		const yesterday =
		    `${now.getFullYear()}-` +
		    `${String(now.getMonth() + 1).padStart(2,"0")}-` +
		    `${String(now.getDate()).padStart(2,"0")}`;
		
		
		const q = query(
		    collection(
		        db,
		        "dailyRanking",
		        yesterday,
		        "users"
		    ),
            orderBy("point","desc"),
            limit(3)
        );


        const snapshot =
            await getDocs(q);


        if(snapshot.empty){

            rankingList.innerHTML =
                "ランキングデータがありません。";

            return;

        }


        rankingList.innerHTML = "";


        let rank = 1;


        for (const rankingDoc of snapshot.docs) {

            const data = rankingDoc.data();

            const studentId = rankingDoc.id;

            //累計ポイント取得
            let totalPoint = 0;

            const totalSnap =
                await getDoc(
                    doc(
                        db,
                        "totalRanking",
                        studentId
                    )
                );

            if(totalSnap.exists()){

                totalPoint =
                    totalSnap.data().point || 0;

            }

            const mark =
                getRankMark(totalPoint);

            rankingList.innerHTML += `

                <div class="ranking-item">

                    <div class="ranking-rank">

                        ${
                            rank === 1 ? "🥇" :
                            rank === 2 ? "🥈" :
                            rank === 3 ? "🥉" :
                            rank
                        }

                    </div>


                    <div class="ranking-user">

                        <div class="ranking-name">
                            ${mark}${getAnonymousRankingName(studentId, studentId === studentNumber)}
                        </div>


                        <div class="ranking-score">
                            ${data.point || 0}pt
                        </div>

                    </div>

                </div>

            `;


            rank++;
        }


        if(rankingDate){

    const displayDate = new Date();

    displayDate.setDate(
        displayDate.getDate() - 1
    );

    rankingDate.textContent =
        `${displayDate.getFullYear()}年`+
        `${displayDate.getMonth()+1}月`+
        `${displayDate.getDate()}日`;

}


    }catch(e){

        console.error(e);

        rankingList.innerHTML =
            "ランキング取得に失敗しました。";

    }

}

function renderCurrentExamSchedule() {

    if (
        !examScheduleList ||
        !examPage ||
        examSchedules.length === 0
    ) {
        return;
    }

    const item =
    examSchedules[examScheduleIndex];

    const dateText =
        item.date
            ? formatExamScheduleDate(item.date)
            : "日付未設定";

    examPage.textContent = dateText;

    examScheduleList.innerHTML = `
        <div class="exam-schedule-item">

            ${
                item.schedules.map(schedule => `
                    <div class="lesson-card">

                        <div style="flex:1">

                            <div class="lesson-subject">
                                ${schedule.subject || "科目未設定"}
                            </div>

                            ${
                                schedule.time
                                    ? `<div class="lesson-room">🕒 ${schedule.time}</div>`
                                    : ""
                            }

                            ${
                                schedule.room
                                    ? `<div class="lesson-teacher">📍 ${schedule.room}</div>`
                                    : ""
                            }

                        </div>

                    </div>
                `).join("")
            }

        </div>
    `;

    if (examPrev) {

        examPrev.disabled =
            examScheduleIndex === 0;

    }

    if (examNext) {

        examNext.disabled =
            examScheduleIndex ===
            examSchedules.length - 1;

    }
}

function renderLectureCalendar() {

    if (!lectureCalendarDays) {
        return;
    }

    lectureCalendarDays.innerHTML = "";

    lectureCalendarMonth.textContent =
        `${lectureCalendarYear}年${lectureCalendarMonthIndex + 1}月`;

    const firstDay =
        new Date(
            lectureCalendarYear,
            lectureCalendarMonthIndex,
            1
        );

    const lastDay =
        new Date(
            lectureCalendarYear,
            lectureCalendarMonthIndex + 1,
            0
        );

    const startWeek =
        firstDay.getDay();

    const totalDays =
        lastDay.getDate();

    // 月初まで空マス
    for (let i = 0; i < startWeek; i++) {

        const empty = document.createElement("div");
        empty.className = "lecture-calendar-empty";
        lectureCalendarDays.appendChild(empty);

    }

    // 日付
    for (let day = 1; day <= totalDays; day++) {

        const date =
            new Date(
                lectureCalendarYear,
                lectureCalendarMonthIndex,
                day
            );

        const yyyy = date.getFullYear();

        const mm = String(date.getMonth() + 1)
            .padStart(2, "0");

        const dd = String(day)
            .padStart(2, "0");

        const dateString =
            `${yyyy}-${mm}-${dd}`;

        const dayData =
            lectureSchedules.find(
                item => item.date === dateString
            );
        
        const grade =
            localStorage.getItem("grade");

        const hasLecture =
            dayData &&
            Array.isArray(dayData.schedules) &&
            dayData.schedules.some(
                schedule => schedule.grade === grade
            );

        const button =
            document.createElement("button");

        button.type = "button";
        button.className =
            "lecture-calendar-day";
        button.setAttribute(
            "aria-label",
            `${yyyy}年${date.getMonth() + 1}月${day}日`
        );

        const dayNumber = document.createElement("span");
        dayNumber.className = "lecture-calendar-day-number";
        dayNumber.textContent = day;
        button.appendChild(dayNumber);

        const today = new Date();

        const todayString =
            `${today.getFullYear()}-` +
            `${String(today.getMonth() + 1).padStart(2, "0")}-` +
            `${String(today.getDate()).padStart(2, "0")}`;

        const selectedDate =
            lectureSchedules[lectureScheduleIndex]?.date || "";

        if (dateString === todayString) {
            button.classList.add("is-today");
        }

        if (dateString === selectedDate) {
            button.classList.add("is-selected");
        }

        /* 授業がある日だけ点を付ける */
        if (hasLecture) {

            button.classList.add("has-lecture");

        }

        /* days に存在する日は、授業がなくても押せる */
        if (dayData) {

            button.classList.add("has-schedule-date");

            button.onclick = () => {

                lectureScheduleIndex =
                    lectureSchedules.findIndex(
                        item => item.date === dateString
                    );
                localStorage.setItem(
                    "careMateSelectedScheduleDate",
                    dateString
                );
                
                lectureCalendarYear = yyyy;
                lectureCalendarMonthIndex = date.getMonth();

                lectureCalendarPopup.hidden = true;

                lectureDatePickerButton.setAttribute(
                    "aria-expanded",
                    "false"
                );

                const grade =
                    localStorage.getItem("grade");

                renderCurrentLectureSchedule(grade);

            };

        } else {

            button.disabled = true;

        }

        lectureCalendarDays.appendChild(button);

    }

}

function showExamPopup({
    label,
    title,
    countdown,
    period
}) {

    if (!examPopupOverlay) return;

    examPopupLabel.textContent = label;
    examPopupTitle.textContent = title;
    examPopupCountdown.textContent = countdown;
    examPopupPeriod.textContent = period;

    examPopupOverlay.classList.add("show");

}

function hideExamPopup() {

    if (!examPopupOverlay) return;

    examPopupOverlay.classList.remove("show");

}

function formatExamDate(date) {

    return (
        `${date.getFullYear()}/` +
        `${date.getMonth() + 1}/` +
        `${date.getDate()}`
    );

}

function formatExamScheduleDate(value) {

    if (!value) return "";

    const parts = value.split("-");

    if (parts.length !== 3) {
        return value;
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    const date = new Date(
        year,
        month - 1,
        day
    );

    const weekdays = [
        "日",
        "月",
        "火",
        "水",
        "木",
        "金",
        "土"
    ];

    return (
        `${month}/${day}` +
        `（${weekdays[date.getDay()]}）`
    );

}

if (closeExamPopup) {

    closeExamPopup.onclick = () => {
        hideExamPopup();
    };

}

if (openExamFromPopup) {

    openExamFromPopup.onclick = () => {
        location.href = "exam.html";
    };

}

if (examPopupOverlay) {

    examPopupOverlay.onclick = (e) => {

        if (e.target === examPopupOverlay) {
            hideExamPopup();
        }

    };

}

if (examPrev) {

    examPrev.onclick = () => {

        if (examScheduleIndex <= 0) {
            return;
        }

        examScheduleIndex--;

        renderCurrentExamSchedule();

    };

}

if (examNext) {

    examNext.onclick = () => {

        if (
            examScheduleIndex >=
            examSchedules.length - 1
        ) {
            return;
        }

        examScheduleIndex++;

        renderCurrentExamSchedule();

    };

}

if (lecturePrev) {

    lecturePrev.onclick = () => {

        if (lectureScheduleIndex <= 0) {
            return;
        }

        lectureScheduleIndex--;

        const grade =
            localStorage.getItem("grade");

        renderCurrentLectureSchedule(grade);

    };

}

if (lectureNext) {

    lectureNext.onclick = () => {

        if (
            lectureScheduleIndex >=
            lectureSchedules.length - 1
        ) {
            return;
        }

        lectureScheduleIndex++;

        const grade =
            localStorage.getItem("grade");

        renderCurrentLectureSchedule(grade);

    };

}

if (
    lectureDatePickerButton &&
    lectureCalendarPopup
) {

    lectureDatePickerButton.onclick = () => {

        const willOpen =
            lectureCalendarPopup.hidden;

        lectureCalendarPopup.hidden =
            !willOpen;

        lectureDatePickerButton.setAttribute(
            "aria-expanded",
            String(willOpen)
        );

        if (willOpen) {
            renderLectureCalendar();
        }

    };

}

document.addEventListener("click", (e) => {

    if (
        !lectureCalendarPopup ||
        !lectureDatePickerButton
    ) {
        return;
    }

    if (lectureCalendarPopup.hidden) {
        return;
    }

    const clickedInsideCalendar =
        lectureCalendarPopup.contains(e.target);

    const clickedDateButton =
        lectureDatePickerButton.contains(e.target);

    if (
        !clickedInsideCalendar &&
        !clickedDateButton
    ) {

        lectureCalendarPopup.hidden = true;

        lectureDatePickerButton.setAttribute(
            "aria-expanded",
            "false"
        );

    }

});

if (lectureCalendarPrevMonth) {

    lectureCalendarPrevMonth.onclick = () => {

        lectureCalendarMonthIndex--;

        if (lectureCalendarMonthIndex < 0) {
            lectureCalendarMonthIndex = 11;
            lectureCalendarYear--;
        }

        renderLectureCalendar();

    };

}

if (lectureCalendarNextMonth) {

    lectureCalendarNextMonth.onclick = () => {

        lectureCalendarMonthIndex++;

        if (lectureCalendarMonthIndex > 11) {
            lectureCalendarMonthIndex = 0;
            lectureCalendarYear++;
        }

        renderLectureCalendar();

    };

}

function hideRankingPopup(){

    if(!rankingPopupOverlay){
        return;
    }

    rankingPopupOverlay.classList.remove("show");

}


if(closeRankingPopup){

    closeRankingPopup.onclick = () => {

        hideRankingPopup();

    };

}

if(rankingPopupOverlay){

    rankingPopupOverlay.onclick = (e)=>{

        if(e.target === rankingPopupOverlay){

            hideRankingPopup();

        }

    };

}

function loadAttendancePopup(){

    const params =
        new URLSearchParams(
            location.search
        );


    const attendance =
        params.get("attendance");


    const subject =
        params.get("subject");


    if(attendance !== "1"){
        return;
    }


    if(!attendancePopupOverlay){
        return;
    }


    if(attendanceSubject && subject){

        attendanceSubject.textContent =
            subject;

    }


    attendancePopupOverlay.classList.add("show");


}



function hideAttendancePopup(){

    if(!attendancePopupOverlay){
        return;
    }


    attendancePopupOverlay.classList.remove("show");

}

if(closeAttendancePopup){

    closeAttendancePopup.onclick = ()=>{

        hideAttendancePopup();

        history.replaceState(
            null,
            "",
            "index.html"
        );

    };

}

if(attendanceNo){

    attendanceNo.onclick = ()=>{

        hideAttendancePopup();

        history.replaceState(
            null,
            "",
            "index.html"
        );

    };

}



if(attendanceYes){

    attendanceYes.onclick = async ()=>{


        const params =
            new URLSearchParams(
                location.search
            );


        const subject =
            params.get("subject");



        if(!subject){

            alert(
                "科目情報がありません"
            );

            return;

        }



        try{


            const today =
                new Date()
                .toISOString()
                .slice(0,10);



            await setDoc(

                doc(
                    db,
                    "attendance",
                    studentNumber,
                    "subjects",
                    subject,
                    "records",
                    today
                ),

                {

                    status:
                        "出席",

                    createdAt:
                        serverTimestamp(),

                    source:
                        "push"

                }

            );



            alert(
                `${subject}\n出席しました`
            );



            history.replaceState(
                null,
                "",
                "index.html"
            );



            location.href =
                `attendance.html?subject=${subject}`;



        }catch(error){


            console.error(
                "出席保存エラー:",
                error
            );


            alert(
                "出席登録に失敗しました"
            );


        }


    };

}

/* ========================================
   ホームカードのキーボード操作
======================================== */

setupHomeCardKeyboardAccess();


function setupHomeCardKeyboardAccess() {

    const cards = [

        examCard,

        attendanceCard,

        courseRegistrationCard,

        personalTimetableCard

    ].filter(Boolean);


    cards.forEach(
        card => {

            card.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key !== "Enter" &&
                        event.key !== " "
                    ) {

                        return;

                    }


                    event.preventDefault();

                    card.click();

                }
            );

        }
    );

}