import {
    db,
    studentNumber,
    setupTheme,
    loadProfileImage,
    loadUserName,
    initializePage,
    showNewsSkeleton,
    setupAdminTab,
    decryptData,
    setupOfflineAlert
} from "./common.js";

import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    onSnapshot
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
        return;
    }

    await initializePage([
        loadUserName(userName),
        loadProfileImage(topProfileImage),
        loadActiveMailBadge(user)
    ]);

    loadExamMode();
    loadWeather(user);
    loadNews();
    loadHomeCourseNews();
    loadHomeSystemNews();
    loadCourseLinks().then(() => {
        loadTodaySchedule();
    });
    setupAdminTab();

}

function renderAuthSetupCards(user) {

    if (!authSetupCards) return;

    const cards = [];

    if (!user.manabaPasswordEncrypted) {
        cards.push(`
            <div class="card setting-card"
                onclick="location.href='manaba_setup.html'"
                style="margin:12px 16px; border-radius:18px; cursor:pointer;">

                <b>📚 Manaba認証へ進む</b><br>
                <small>
                    課題取得・課題通知・Manaba関連機能を使うには設定が必要です。
                </small>

            </div>
        `);
    }

    if (!user.activeMailPasswordEncrypted) {
        cards.push(`
            <div class="card setting-card"
                onclick="location.href='activemail_setup.html'"
                style="margin:12px 16px; border-radius:18px; cursor:pointer;">

                <b>📧 Active!Mail認証へ進む</b><br>
                <small>
                    大学メール通知・未読件数表示を使うには設定が必要です。
                </small>

            </div>
        `);
    }

    authSetupCards.innerHTML = cards.join("");

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

weatherCard.onclick = () => {

    location.href =
        "weather-settings.html";

};

activeMailButton.onclick = () => {

    location.href = "activemail.html";

};

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

    const q = query(
        collection(db, "courseNews", studentNumber, "news"),
        orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {

        homeCourseNews.innerHTML =
            "コースニュースはありません。";

        return;

    }

    homeCourseNews.innerHTML = "";

    snapshot.docs.slice(0, 3).forEach(newsDoc => {

        const notice = newsDoc.data();

        homeCourseNews.innerHTML += `

        <div class="card news-card"
            onclick="location.href='news.html?tab=course'">

            <div class="news-title">
                📘 ${notice.course}
            </div>

            <div class="news-body">
                ${notice.title}
            </div>

        </div>

        `;

    });

    homeCourseNews.innerHTML += `
        <div style="text-align:center; margin-top:20px;">
            <a href="news.html?tab=course">
                もっと見る →
            </a>
        </div>
    `;

}

async function loadHomeSystemNews() {

    const userSnap = await getDoc(
        doc(db, "users", studentNumber)
    );

    if (
        !userSnap.exists() ||
        userSnap.data().manabaVerified !== true
    ) {
        homeSystemNews.innerHTML =
            "Manaba認証後に表示されます。";
        return;
    }

    const q = query(
        collection(db, "systemNews"),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {

        if (snapshot.empty) {

            homeSystemNews.innerHTML =
                "CareMateからのお知らせはありません。";

            return;

        }

        homeSystemNews.innerHTML = "";

        snapshot.docs.slice(0, 3).forEach(newsDoc => {

            const notice = newsDoc.data();

            const created =
                notice.createdAt
                    ? notice.createdAt.toDate()
                    : null;

            const dateText = created
                ? `${created.getFullYear()}/${created.getMonth() + 1}/${created.getDate()}`
                : "";

            homeSystemNews.innerHTML += `

            <div class="card news-card"
                onclick="location.href='news.html'">

                <div class="news-title">
                    💙 ${notice.title}
                </div>

                <div class="news-body">
                    ${(notice.body || "")
                        .split("\n")[0]
                        .substring(0, 40)}...
                </div>

                <div class="news-date">
                    ${dateText}
                </div>

            </div>

            `;

        });

        homeSystemNews.innerHTML += `
            <div style="text-align:center; margin-top:20px;">
                <a href="news.html">
                    もっと見る →
                </a>
            </div>
        `;

    });

}

async function loadTodaySchedule() {

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

    if (
        Array.isArray(data.days) &&
        data.days.length > 0
    ) {

        lectureSchedules =
            data.days.map(day => ({
                date: day.date || "",
                title: day.title || "次回講義日",
                label: day.label || "",
                schedules: Array.isArray(day.schedules)
                    ? day.schedules
                    : []
            }));

    } else {

        // 古い形式との互換性
        lectureSchedules = [
            {
                date: "",
                title: data.todayTitle || "今日",
                label: data.todayLabel || "",
                schedules: data.today || []
            },
            {
                date: "",
                title: data.nextTitle || "次回",
                label: data.nextLabel || "",
                schedules: data.next || []
            }
        ];

    }

    lectureScheduleIndex = 0;

    const firstLectureDate =
        lectureSchedules[0]?.date
            ? new Date(`${lectureSchedules[0].date}T00:00:00`)
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
        current.label || current.title;

    lectureScheduleList.innerHTML = `
        <div class="schedule-day-badge">
            ${current.title}
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

        weatherLocation.innerHTML =
            `<b>${locationName}</b>`;

        weatherMain.innerHTML = `

        <div style="
            display:flex;
            flex-direction:column;
            align-items:center;
        ">

            <div style="
                font-size:58px;
                line-height:1;
            ">
                ${weather.icon}
            </div>

            <div style="
                font-size:18px;
                margin-top:8px;
            ">
                ${weather.text}
            </div>

            <div style="
                font-size:42px;
                font-weight:bold;
                margin-top:6px;
            ">
                ${temp}℃
            </div>

        </div>

        `;

        weatherDetail.innerHTML = `

        <div style="
            display:flex;
            justify-content:space-around;
            text-align:center;
            margin-top:12px;
        ">

            <div>

                <div style="font-size:12px;color:gray;">
                    最高
                </div>

                <b>${max}℃</b>

            </div>

            <div>

                <div style="font-size:12px;color:gray;">
                    最低
                </div>

                <b>${min}℃</b>

            </div>

            <div>

                <div style="font-size:12px;color:gray;">
                    降水
                </div>

                <b>${rain}%</b>

            </div>

        </div>

        `;

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

    const today = new Date();
    const start = new Date(exam.startDate);
    const end = new Date(exam.endDate);

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

        button.textContent = day;

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