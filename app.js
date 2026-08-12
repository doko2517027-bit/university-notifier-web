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
    setupAdminTab,
    decryptData,
    setupOfflineAlert,
    updateAssignmentNavBadge,
    updateShareNavBadge,
    updateNewsNavBadge,
    setupAttendanceWebPush,
    studentAcademicContext
} from "./common.js";

import { loadPersonalTimetableData, isEnrolledScheduleItem }
from "./personal_timetable_data.js";

import {
    setupClassSelection,
    checkClassSelectionRequired,
    setClassSelectionSchedule,
    applyClassSelections
} from "./class_selection.js";

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
    limit,
    writeBatch
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
const homeSearchForm = document.getElementById("homeSearchForm");
const homeSearchInput = document.getElementById("homeSearchInput");
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
const annualTransitionOverlay = document.getElementById("annualTransitionOverlay");
const annualTransitionTitle = document.getElementById("annualTransitionTitle");
const annualTransitionMessage = document.getElementById("annualTransitionMessage");
const annualTransitionActions = document.getElementById("annualTransitionActions");
const creditConfirmationOverlay = document.getElementById("creditConfirmationOverlay");
const creditConfirmationTitle = document.getElementById("creditConfirmationTitle");
const creditConfirmationMessage = document.getElementById("creditConfirmationMessage");
const creditConfirmationList = document.getElementById("creditConfirmationList");
const saveCreditConfirmation = document.getElementById("saveCreditConfirmation");

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
const lectureSchedulePdfLink = document.getElementById("lectureSchedulePdfLink");
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

let creditConfirmationCourses =
    new Map();

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

async function checkMaintenance(
    system = {}
) {

    if (!system.maintenance) {
        return false;
    }

    const devSnap =
        await getDoc(
            doc(
                db,
                "developers",
                studentNumber
            )
        );

    if (
        devSnap.exists() &&
        devSnap.data().enabled === true
    ) {
        return false;
    }

    location.href =
        "maintenance.html";

    return true;

}

async function startApp() {

    console.log(
        "studentNumber =",
        studentNumber
    );

    let user = null;

    try {

        if (!studentNumber) {

            localStorage.removeItem(
                "loggedIn"
            );

            localStorage.removeItem(
                "studentNumber"
            );

            location.href =
                "login.html";

            return;

        }


        /*
        ユーザー情報とsystem/appを
        同時に取得する。

        これまで：
        system/app
        ↓
        users
        ↓
        表示

        修正後：
        system/app ┐
                   ├ 同時
        users      ┘
        */
        const [
            systemSnap,
            userSnap
        ] = await Promise.all([

            getDoc(
                doc(
                    db,
                    "system",
                    "app"
                )
            ),

            getDoc(
                doc(
                    db,
                    "users",
                    studentNumber
                )
            )

        ]);


        const system =
            systemSnap.exists()
                ? systemSnap.data()
                : {};


        const maintenanceRedirected =
            await checkMaintenance(
                system
            );


        if (maintenanceRedirected) {
            return;
        }


        if (!userSnap.exists()) {

            localStorage.removeItem(
                "loggedIn"
            );

            localStorage.removeItem(
                "studentNumber"
            );

            alert(
                "ユーザー情報を取得できませんでした。もう一度ログインしてください。"
            );

            location.href =
                "login.html";

            return;

        }


        user =
            userSnap.data();


        applyManabaFeatureVisibility(
            user
        );


        if (
            user.activeMailResetRequired ===
            true
        ) {

            location.href =
                "activemail_setup.html";

            return;

        }


        if (
            user.manabaResetRequired ===
            true
        ) {

            location.href =
                "manaba_setup.html";

            return;

        }


        renderAuthSetupCards(
            user
        );


        /*
        必須情報が確認できた時点で
        先に画面を表示する。
        */
        showPage();


        /*
        年度末・単位確認は
        同じsystem/appデータを再利用。
        */
        await showAnnualTransitionIfRequired(
            user,
            system
        );

        await showCreditConfirmationIfRequired(
            user,
            system
        );


    } catch (error) {

        console.error(
            error
        );

        showPage();

        return;

    }


    /*
    最初に見える情報。
    */
    Promise.all([

        loadUserName(
            userName
        ),

        loadProfileImage(
            topProfileImage
        ),

        loadActiveMailBadge(
            user
        ),

        updateAssignmentNavBadge()

    ]).catch(error => {

        console.error(
            "ホーム基本情報読み込みエラー:",
            error
        );

    });


    /*
    時間割を最優先。
    startAppで取得済みのuserを渡し、
    usersドキュメントを再取得しない。
    */
    const todayScheduleTask =
        loadTodaySchedule(
            user
        );


    /*
    時間割を待たずに、
    その他も並行取得。
    */
    const backgroundTasks =
        Promise.all([

            loadExamMode(),

            loadWeather(
                user
            ),

            loadNews(),

            loadHomeCourseNews(),

            loadHomeSystemNews(),

            loadCourseLinks(),

            loadCourseRegistrationBanner(
                user
            )

        ]).catch(error => {

            console.error(
                "ホーム補助表示の読み込みエラー:",
                error
            );

        });


    await todayScheduleTask;

    await checkClassSelectionRequired();


    void backgroundTasks;


    /*
    初期表示に不要な重い処理は、
    操作可能になってから開始する。
    */
    const runWhenIdle =
        window.requestIdleCallback ||
        (
            callback =>
                setTimeout(
                    callback,
                    120
                )
        );


    runWhenIdle(() => {

        Promise.all([

            loadMyRanking(),

            updateNewsNavBadge(),

            loadRankingPopup(),

            loadRanking(),

            loadAttendancePopup(),

            setupAdminTab()

        ]).catch(error => {

            console.error(
                "ホーム後続表示の読み込みエラー:",
                error
            );

        });

    });

}


function academicYearForTransition(date = new Date()) {

    return date.getMonth() < 3
        ? date.getFullYear() - 1
        : date.getFullYear();

}


async function showAnnualTransitionIfRequired(
    user,
    system = {}
) {

    if (!annualTransitionOverlay || !studentNumber) return;

    if (["graduated", "withdrawn"].includes(user?.academicStatus)) return;

    const profileName = String(
        user?.name || user?.userName || user?.displayName || ""
    ).trim();

    if (!profileName || profileName === "氏名未設定") return;

    const transition =
        system?.annualTransition;

    if (transition?.enabled !== true) return;

    const targetYear = Number(transition.academicYear || academicYearForTransition());

    if (Number(user?.annualTransitionResponse?.academicYear) === targetYear) return;

    const grade = Number(String(user?.grade || "").replace("年", ""));
    const finalYear = grade === 4;
    const choices = finalYear
        ? [
            ["graduate", "卒業予定"],
            ["repeat", "留年"],
            ["withdraw", "退学"]
        ]
        : [
            ["promote", "進級予定"],
            ["repeat", "留年"],
            ["withdraw", "退学"]
        ];

    annualTransitionTitle.textContent = finalYear
        ? "卒業・進路予定の確認"
        : "次年度の予定を確認";
    annualTransitionMessage.textContent = "該当する項目を選んで確定してください。";
    annualTransitionActions.innerHTML = choices.map(([action, label]) => `
        <button class="btn ${action === "withdraw" ? "btn-danger" : action === "promote" || action === "graduate" ? "btn-primary" : ""}" data-annual-transition-action="${action}" type="button">${label}</button>
    `).join("");
    annualTransitionOverlay.hidden = false;
    annualTransitionOverlay.classList.add("show");

}


annualTransitionActions?.addEventListener("click", async event => {

    const button = event.target.closest("[data-annual-transition-action]");
    const action = button?.dataset.annualTransitionAction;

    if (!action) return;

    const labels = {
        promote: "進級予定",
        repeat: "留年",
        graduate: "卒業予定",
        withdraw: "退学"
    };

    if (!confirm(`「${labels[action]}」として回答します。よろしいですか？`)) return;

    try {

        const systemSnap = await getDoc(doc(db, "system", "app"));
        const transition = systemSnap.data()?.annualTransition;

        if (transition?.enabled !== true) {
            alert("年度末確認は終了しています。");
            location.reload();
            return;
        }

        button.disabled = true;

        await updateDoc(doc(db, "users", studentNumber), {
            annualTransitionResponse: {
                academicYear: Number(transition.academicYear || academicYearForTransition()),
                action,
                submittedAt: new Date().toISOString()
            },
            updatedAt: serverTimestamp()
        });

        annualTransitionOverlay.classList.remove("show");
        annualTransitionOverlay.hidden = true;
        alert("回答を保存しました。反映予定日までは現在の画面をそのまま利用できます。");

    } catch (error) {

        console.error("年度末確認の回答保存エラー:", error);
        alert("回答を保存できませんでした。もう一度お試しください。");
        button.disabled = false;

    }

});

function escapeCreditText(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[character]));
}

async function showCreditConfirmationIfRequired(
    user,
    system = {}
) {
    if (!creditConfirmationOverlay || !studentNumber || annualTransitionOverlay?.hidden === false) return;
    if (["graduated", "withdrawn"].includes(user?.academicStatus)) return;

    const profileName = String(user?.name || user?.userName || user?.displayName || "").trim();
    if (!profileName || profileName === "氏名未設定") return;

    const config =
        system?.creditConfirmation;
    if (config?.enabled !== true) return;

    const academicYear = Number(config.academicYear);
    const semester = String(config.semester || "");
    if (!Number.isInteger(academicYear) || !["前期", "後期"].includes(semester)) return;
    const previous = user?.creditConfirmationResponse;
    if (Number(previous?.academicYear) === academicYear && previous?.semester === semester) return;

    const enrolledSnap = await getDocs(collection(db, "users", studentNumber, "enrolledSubjects"));
    const courses = enrolledSnap.docs
        .map(item => ({ id: item.id, ...item.data() }))
        .filter(item => item.status !== "removed")
        .filter(item => {
            const courseSemester = String(item.registeredSemester || item.semester || "");
            return !courseSemester || courseSemester === semester || courseSemester === "通年";
        })
        .sort((a, b) => String(a.name || a.subject || a.id).localeCompare(String(b.name || b.subject || b.id), "ja"));

    creditConfirmationCourses =
        new Map(
            courses.map(
                course => [
                    course.id,
                    course
                ]
            )
        );

    if (!courses.length) return;
    creditConfirmationTitle.textContent = `${academicYear}年度 ${semester}の単位取得確認`;
    creditConfirmationMessage.textContent = "履修した各科目について、単位を取得できたか選択してください。";
    creditConfirmationList.innerHTML = courses.map(course => {
        const subject = course.name || course.subject || course.subjectKey || course.id;
        return `<label class="credit-confirmation-item" data-credit-course="${escapeCreditText(course.id)}">
            <span>${escapeCreditText(subject)}${course.isRetake ? " <small>再履修</small>" : ""}</span>
            <select aria-label="${escapeCreditText(subject)}の単位取得状況">
                <option value="earned">取得できた</option>
                <option value="not_earned">取得できなかった（再履修）</option>
            </select>
        </label>`;
    }).join("");
    creditConfirmationOverlay.dataset.academicYear = String(academicYear);
    creditConfirmationOverlay.dataset.semester = semester;
    creditConfirmationOverlay.hidden = false;
    creditConfirmationOverlay.classList.add("show");
}

saveCreditConfirmation?.addEventListener("click", async () => {
    const academicYear = Number(creditConfirmationOverlay?.dataset.academicYear);
    const semester = creditConfirmationOverlay?.dataset.semester;
    const items = [...creditConfirmationList.querySelectorAll("[data-credit-course]")];
    if (!Number.isInteger(academicYear) || !semester || !items.length) return;
    if (!confirm("単位取得状況を保存します。よろしいですか？")) return;
    saveCreditConfirmation.disabled = true;
    try {
        const batch = writeBatch(db);
        const results = {};
        items.forEach(item => {
            const courseId = item.dataset.creditCourse;
            const status = item.querySelector("select")?.value === "not_earned" ? "not_earned" : "earned";
            results[courseId] = status;
            const courseRef =
                doc(
                    db,
                    "users",
                    studentNumber,
                    "enrolledSubjects",
                    courseId
                );

            const courseData =
                creditConfirmationCourses
                    .get(courseId) || {};

            const wasRetake =
                courseData.isRetake === true;

            const updateData = {

                creditStatus:
                    status,

                creditConfirmedAcademicYear:
                    academicYear,

                creditConfirmedSemester:
                    semester,

                creditConfirmedAt:
                    new Date().toISOString(),

                isRetake:
                    status === "not_earned",

                retakeLabel:
                    status === "not_earned"
                        ? "再履修"
                        : null,

                updatedAt:
                    serverTimestamp()

            };


            /*
            未取得になった場合。

            最初に落とした年度・学期を保存する。
            すでに再履修中の場合は、
            元の落単年度・学期を上書きしない。
            */
            if (
                status === "not_earned"
            ) {

                if (!wasRetake) {

                    updateData
                        .retakeSourceAcademicYear =
                        academicYear;

                    updateData
                        .retakeSourceSemester =
                        semester;

                    updateData
                        .retakeStartedAt =
                        new Date().toISOString();

                }

            }


            /*
            再履修科目を取得できた場合。

            再履修終了年度・学期を保存する。
            元のretakeSourceは履歴として残す。
            */
            if (
                status === "earned" &&
                wasRetake
            ) {

                updateData
                    .retakeResolvedAcademicYear =
                    academicYear;

                updateData
                    .retakeResolvedSemester =
                    semester;

                updateData
                    .retakeResolvedAt =
                    new Date().toISOString();

            }


            batch.set(
                courseRef,
                updateData,
                {
                    merge:
                        true
                }
            );
        });
        batch.update(doc(db, "users", studentNumber), {
            creditConfirmationResponse: {
                academicYear,
                semester,
                results,
                submittedAt: new Date().toISOString()
            },
            updatedAt: serverTimestamp()
        });
        await batch.commit();
        creditConfirmationOverlay.classList.remove("show");
        creditConfirmationOverlay.hidden = true;
        alert("単位取得状況を保存しました。未取得の科目は再履修として表示されます。");
    } catch (error) {
        console.error("単位取得確認の保存エラー:", error);
        alert("保存できませんでした。もう一度お試しください。");
    } finally {
        saveCreditConfirmation.disabled = false;
    }
});

function applyManabaFeatureVisibility(
    user
) {

    const available =
        user?.manabaVerified === true;


    /*
     出席管理カード
    */

    if (attendanceCard) {

        attendanceCard.hidden =
            !available;

        attendanceCard.setAttribute(
            "aria-hidden",
            available
                ? "false"
                : "true"
        );

    }


    /*
     履修登録の案内バナー
    */

    if (courseRegistrationBanner) {

        if (!available) {

            courseRegistrationBanner.hidden =
                true;

        }

    }


    /*
     履修登録の便利カードを含むスライド
    */

    if (courseRegistrationSlide) {

        if (!available) {

            courseRegistrationSlide.hidden =
                true;

        }

    }


    /*
     念のためカード自体も無効化
    */

    if (
        courseRegistrationCard &&
        !available
    ) {

        courseRegistrationCard.onclick =
            null;

        courseRegistrationCard
            .removeAttribute(
                "tabindex"
            );

    }

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

if(weatherCard){

    weatherCard.onclick = () => {

        location.href =
            "weather-settings.html";

    };

}

if (homeSearchForm) {
    homeSearchForm.addEventListener("submit", event => {
        event.preventDefault();
        const query = homeSearchInput?.value.trim();
        if (!query) return;
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank", "noopener");
    });
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

        const newsHtml =
            notices
                .slice(0, 3)
                .map(notice => {

                    const posted =
                        notice.postedAt.toDate();

                    const postedText =
                        formatDateTime(posted);

                    return `
                        <div
                            class="card news-card"
                            onclick="location.href='news.html'">

                            <div class="news-date">
                                ${postedText}
                            </div>

                            <div class="news-body">
                                ${(notice.body || "")
                                    .split("\n")[0]
                                    .substring(0, 40)}...
                            </div>

                        </div>
                    `;

                })
                .join("");


        newsList.innerHTML = `
            ${newsHtml}

            <div
                style="
                    text-align:center;
                    margin-top:20px;
                ">
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

    const notices =
        snapshot.docs.map(newsDoc =>
            newsDoc.data()
        );

    notices.sort((a, b) => {

        const dateA =
            parseCourseNewsDate(a.posted);

        const dateB =
            parseCourseNewsDate(b.posted);

        return dateB - dateA;

    });

    const courseNewsHtml =
        notices
            .slice(0, 3)
            .map(notice => `

                <div
                    class="card news-card"
                    onclick="location.href='news.html?tab=course'">

                    <div class="news-title">
                        📘 ${notice.course}
                    </div>

                    <div class="news-body">
                        ${notice.title}
                    </div>

                    <div class="news-date">
                        ${formatCourseNewsDate(
                            notice.posted
                        )}
                    </div>

                </div>

            `)
            .join("");


    homeCourseNews.innerHTML = `
        ${courseNewsHtml}

        <div
            style="
                text-align:center;
                margin-top:20px;
            ">
            <a href="news.html?tab=course">
                もっと見る →
            </a>
        </div>
    `;

}

async function loadHomeSystemNews() {
    const targetedSnapshot =
        await getDocs(
            query(
                collection(
                    db,
                    "users",
                    studentNumber,
                    "targetedSystemNews"
                ),
                orderBy(
                    "createdAt",
                    "desc"
                ),
                limit(3)
            )
        );


    const targetedDocs =
        targetedSnapshot.docs;

    const q = query(
        collection(
            db,
            "systemNews"
        ),
        orderBy(
            "createdAt",
            "desc"
        ),
        limit(3)
    );

    onSnapshot(q, (snapshot) => {

        const allDocs = [...snapshot.docs, ...targetedDocs].sort((a, b) => (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0));
        if (allDocs.length === 0) {

            homeSystemNews.innerHTML =
                "CareMateからのお知らせはありません。";

            return;

        }

        const systemNewsHtml =
            allDocs
                .slice(0, 3)
                .map(newsDoc => {

                    const notice =
                        newsDoc.data();

                    const created =
                        notice.createdAt
                            ?.toDate?.() ||
                        null;

                    const dateText =
                        formatDateTime(
                            created
                        );

                    return `
                        <div
                            class="card news-card"
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

                })
                .join("");


        homeSystemNews.innerHTML = `
            ${systemNewsHtml}

            <div
                style="
                    text-align:center;
                    margin-top:20px;
                ">
                <a href="news.html">
                    もっと見る →
                </a>
            </div>
        `;

    });

}

async function loadTodaySchedule(
    userData = null
) {

    const department =
        localStorage.getItem(
            "department"
        );

    const major =
        localStorage.getItem(
            "major"
        );

    const grade =
        String(
            localStorage.getItem(
                "grade"
            ) || ""
        )
            .normalize("NFKC")
            .replace("年", "")
            .trim();


    let docId = "";


    if (
        department ===
        "看護学科"
    ) {

        docId =
            "ns_yamate";

    } else if (
        major ===
        "理学療法学専攻"
    ) {

        docId =
            "pt";

    } else if (
        major ===
        "作業療法学専攻"
    ) {

        docId =
            "ot";

    }


    if (!docId) {

        lectureScheduleLabel.textContent =
            "講義予定";

        lectureScheduleList.innerHTML =
            `<p class="empty-text">時間割がありません。</p>`;

        return;

    }


    /*
    履修情報と大学時間割を
    同時取得。
    */
    const [
        personalTimetable,
        snap
    ] = await Promise.all([

        loadPersonalTimetableData(),

        getDoc(
            doc(
                db,
                "schedule",
                docId
            )
        )

    ]);


    const enrolledAliases =
        personalTimetable
            ?.aliasToCourse ||
        new Map();


    if (!snap.exists()) {

        lectureScheduleLabel.textContent =
            "講義予定";

        lectureScheduleList.innerHTML =
            `<p class="empty-text">時間割がありません。</p>`;

        return;

    }


    const data =
        snap.data();

    if (
        lectureSchedulePdfLink &&
        /^https:\/\//.test(String(data.sourcePdfUrl || ""))
    ) {
        lectureSchedulePdfLink.href = data.sourcePdfUrl;
    }

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

                date:
                    day.date || "",

                title:
                    day.title ||
                    "次回講義日",

                label:
                    day.label || "",

                schedules:
                    Array.isArray(
                        day.schedules
                    )
                        ? day.schedules
                            .filter(
                                item =>
                                    isEnrolledScheduleItem(
                                        item,
                                        enrolledAliases
                                    )
                            )
                            .map(
                                item => ({
                                    ...item,
                                    date:
                                        day.date || ""
                                })
                            )
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

    const scheduleParams =
        new URLSearchParams(
            location.search
        );


    let currentUserData =
        userData
            ? {
                ...userData
            }
            : null;


    if (
        scheduleParams.get(
            "clearAttendanceTestDate"
        ) === "1"
    ) {

        localStorage.removeItem(
            "careMateAttendanceTestDate"
        );

        localStorage.removeItem(
            "careMateSelectedScheduleDate"
        );


        const resetAt =
            new Date().toISOString();


        if (studentNumber) {

            await updateDoc(
                doc(
                    db,
                    "users",
                    studentNumber
                ),
                {
                    "attendanceTestClock.enabled":
                        false,

                    "attendanceTestClock.resetAt":
                        resetAt
                }
            );

        }


        if (currentUserData) {

            currentUserData = {

                ...currentUserData,

                attendanceTestClock: {

                    ...(
                        currentUserData
                            .attendanceTestClock ||
                        {}
                    ),

                    enabled:
                        false,

                    resetAt

                }

            };

        }

    }


    /*
    startAppからuserが渡されていない場合だけ
    Firestoreから取得。
    */
    if (
        !currentUserData &&
        studentNumber
    ) {

        const userSnapshot =
            await getDoc(
                doc(
                    db,
                    "users",
                    studentNumber
                )
            );


        currentUserData =
            userSnapshot.exists()
                ? userSnapshot.data()
                : {};

    }


    currentUserData =
        currentUserData || {};


    const userTestClock =
        currentUserData
            .attendanceTestClock ||
        {};
    const userTestDateActive = userTestClock.enabled === true &&
        /^\d{4}-\d{2}-\d{2}$/.test(userTestClock.date || "") &&
        Date.parse(userTestClock.expiresAt || "") > Date.now();

    if (!userTestDateActive && localStorage.getItem("careMateAttendanceTestDate")) {
        localStorage.removeItem("careMateAttendanceTestDate");
        localStorage.removeItem("careMateSelectedScheduleDate");
    }

    const notificationTest =
        currentUserData
            .attendanceNotificationTest ||
        {};
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

    const today =
        new Date();


    const actualToday =
        today.toLocaleDateString(
            "sv-SE"
        );


    /*
    クラス選択を要求するのは
    「今日の履修講義」だけ。

    未来日の講義は、
    classGroupがあって未選択でも
    予定そのものは消さない。

    出席表示テスト中だけは、
    テスト日を今日扱いにする。
    */
    const classSelectionDate =

        userTestDateActive
            ? userTestClock.date
            : actualToday;


    const classSelectionSchedules =

        lectureSchedules

            .filter(
                day =>
                    day.date ===
                    classSelectionDate
            )

            .flatMap(
                day =>

                    (day.schedules || [])
                        .map(
                            item => ({

                                ...item,

                                date:
                                    day.date || ""

                            })
                        )
            );


    setClassSelectionSchedule(
        classSelectionSchedules
    );


    /*
    Firestoreに保存済みの
    日付 × 科目 × 時限ごとの
    クラス選択を取得。
    */
    const classSelections =

        currentUserData
            ?.classSelections &&
        typeof currentUserData
            .classSelections ===
            "object"

            ? currentUserData
                .classSelections

            : {};


    /*
    今日
    → クラス選択を反映する。

    未来日・過去日
    → 履修登録済み予定をそのまま残す。

    これで未来日のclassGroupあり講義も
    カレンダー・時間割から消えない。
    */
    lectureSchedules =

        lectureSchedules.map(
            day => {

                const schedules =

                    (day.schedules || [])
                        .map(
                            item => ({

                                ...item,

                                date:
                                    day.date || ""

                            })
                        );


                if (
                    day.date !==
                    classSelectionDate
                ) {

                    return {

                        ...day,

                        schedules

                    };

                }


                return {

                    ...day,

                    schedules:
                        applyClassSelections(
                            schedules,
                            classSelections
                        )

                };

            }
        );


    const requestedTestDate =
        scheduleParams.get(
            "attendanceTestDate"
        );


    let initialDate =
        "";


    /*
    明示的な出席テスト中は、
    テスト日を最優先する。
    */

    if (userTestDateActive) {

        initialDate =
            userTestClock.date;

    } else if (
        notificationTestActive
    ) {

        initialDate =
            notificationTest.date;

    } else if (
        /^\d{4}-\d{2}-\d{2}$/.test(
            requestedTestDate || ""
        )
    ) {

        initialDate =
            requestedTestDate;

    } else if (
        today.getDay() !== 0
    ) {

        /*
        通常時は保存された古い日付ではなく、
        必ず今日を初期表示する。

        月曜日～土曜日なら、
        講義予定がなくても今日を作成する。
        */

        initialDate =
            actualToday;

    } else {

        /*
        日曜日は従来どおり、
        時間割に存在する次の講義日を使う。
        */

        const exactToday =
            lectureSchedules.find(
                item =>
                    item.date === actualToday
            );


        const nextDay =
            lectureSchedules.find(
                item =>
                    item.date > actualToday
            );


        initialDate =

            exactToday?.date ||

            nextDay?.date ||

            lectureSchedules.at(-1)
                ?.date ||

            "";

    }


    /*
    テスト指定を保存
    */

    if (
        /^\d{4}-\d{2}-\d{2}$/.test(
            requestedTestDate || ""
        )
    ) {

        localStorage.setItem(

            "careMateSelectedScheduleDate",

            requestedTestDate

        );


        localStorage.setItem(

            "careMateAttendanceTestDate",

            requestedTestDate

        );

    }


    if (userTestDateActive) {

        localStorage.setItem(

            "careMateSelectedScheduleDate",

            userTestClock.date

        );


        localStorage.setItem(

            "careMateAttendanceTestDate",

            userTestClock.date

        );

    }


    /*
    通常起動では8/1などの古い選択日を
    初期表示に使わない。
    */

    if (
        !userTestDateActive &&
        !notificationTestActive &&
        !/^\d{4}-\d{2}-\d{2}$/.test(
            requestedTestDate || ""
        )
    ) {

        localStorage.setItem(

            "careMateSelectedScheduleDate",

            initialDate

        );

    }


    let initialIndex =
        ensureLectureScheduleDate(
            initialDate
        );


    if (initialIndex < 0) {

        initialIndex =
            lectureSchedules.findIndex(
                item =>
                    item.date ===
                    initialDate
            );

    }


    lectureScheduleIndex =
        Math.max(
            0,
            initialIndex
        );

    /*
    今日に履修済み講義がない場合は、次に履修済み講義がある日を表示する。
    明示した日付・通知テスト中はその日付を優先する。
    */
    if (
        !userTestDateActive &&
        !notificationTestActive &&
        !/^\d{4}-\d{2}-\d{2}$/.test(requestedTestDate || "") &&
        !(lectureSchedules[lectureScheduleIndex]?.schedules || []).length
    ) {
        const nextIndex = lectureSchedules.findIndex(
            item => item.date > actualToday && (item.schedules || []).length > 0
        );
        if (nextIndex >= 0) {
            lectureScheduleIndex = nextIndex;
            localStorage.setItem(
                "careMateSelectedScheduleDate",
                lectureSchedules[nextIndex].date
            );
        }
    }


    const initialScheduleDate =

        lectureSchedules[
            lectureScheduleIndex
        ]?.date ||

        actualToday;


    const firstLectureDate =
        new Date(

            `${initialScheduleDate}T00:00:00`

        );


    lectureCalendarYear =
        firstLectureDate.getFullYear();


    lectureCalendarMonthIndex =
        firstLectureDate.getMonth();

    renderCurrentLectureSchedule(grade);

}

function renderCurrentLectureSchedule(
    grade
) {

    if (
        !lectureScheduleLabel ||
        !lectureScheduleList ||
        lectureSchedules.length === 0
    ) {

        return;

    }


    const current =
        lectureSchedules[
            lectureScheduleIndex
        ];


    if (!current) {

        return;

    }


    const labelParts =
        splitLectureScheduleLabel(
            current
        );


    lectureScheduleLabel.textContent =
        labelParts.dateText;


    if (lectureScheduleDetail) {

        lectureScheduleDetail.textContent =
            labelParts.detailText;

        lectureScheduleDetail.hidden =
            !labelParts.detailText;

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
        localStorage.getItem(
            "careMateAttendanceTestDate"
        ) || "";


    const todayString =
        new Date()
            .toLocaleDateString(
                "sv-SE"
            );


    const hasValidDate =
        /^\d{4}-\d{2}-\d{2}$/.test(
            current.date || ""
        );


    const isPastDate =
        hasValidDate &&
        current.date < todayString;


    let badgeText =
        "";


    if (
        current.date ===
        attendanceTestDate
    ) {

        badgeText =
            "今日（表示テスト）";

    } else if (!isPastDate) {

        /*
         今日または未来の日付だけ、
         「今日」「次回講義日」「講義予定」
         などの表示を出す。
        */

        badgeText =
            current.title ||
            "講義予定";

    }


    /*
     過去日では上部の
     「次回講義日」表示を作らない。
    */

    const scheduleHtml =
        buildScheduleHtml(
            current.schedules || [],
            grade
        );


    lectureScheduleList.innerHTML = `

        ${
            badgeText
                ? `
                    <div class="schedule-day-badge">
                        ${badgeText}
                    </div>
                `
                : ""
        }

        ${scheduleHtml}

    `;


    /*
     前後の日付は必要に応じて作成できるため、
     配列の先頭・末尾でも矢印を無効化しない。
    */

    if (lecturePrev) {

        lecturePrev.disabled =
            false;

    }


    if (lectureNext) {

        lectureNext.disabled =
            false;

    }

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

function buildScheduleHtml(
    schedules,
    grade
) {

    const normalizedGrade =
        String(
            grade || ""
        )
            .normalize("NFKC")
            .replace("年", "")
            .trim();


    const list =
        schedules

            .filter(
                item => {

                    const itemGrade =
                        String(
                            item.grade || ""
                        )
                            .normalize("NFKC")
                            .replace("年", "")
                            .trim();


                    return (
                        !normalizedGrade ||
                        !itemGrade ||
                        itemGrade ===
                            normalizedGrade
                    );

                }
            )

            .sort(
                (a, b) =>
                    parseInt(a.period) -
                    parseInt(b.period)
            );


    if (
        list.length === 0
    ) {

        return `
            <p class="empty-text">
                授業はありません
            </p>
        `;

    }


    return list
        .map(
            item => `

                <div
                    class="lesson-card"
                    onclick="openCourse('${item.subject}')">

                    <div class="lesson-period">
                        ${item.period}
                    </div>

                    <div>

                        <div class="lesson-subject">

                            ${item.subject}

                            ${
                                item.classGroup
                                    ? `
                                        <span class="lesson-class-group">
                                            ${item.classGroup}
                                        </span>
                                    `
                                    : ""
                            }

                        </div>

                        <div class="lesson-room">
                            ${item.building || ""}
                            ${item.room || ""}
                        </div>

                        <div class="lesson-teacher">
                            ${item.teacher || ""}
                        </div>

                    </div>

                </div>

            `
        )
        .join("");

}

function renderLectureScheduleWithMotion(
    grade,
    direction
) {

    if (
        !lectureScheduleList
    ) {

        renderCurrentLectureSchedule(
            grade
        );

        return;

    }


    lectureScheduleList.classList.remove(
        "schedule-slide-prev",
        "schedule-slide-next"
    );


    renderCurrentLectureSchedule(
        grade
    );


    requestAnimationFrame(
        () => {

            lectureScheduleList.classList.add(

                direction === "prev"
                    ? "schedule-slide-prev"
                    : "schedule-slide-next"

            );


            setTimeout(
                () => {

                    lectureScheduleList
                        .classList.remove(
                            "schedule-slide-prev",
                            "schedule-slide-next"
                        );

                },
                180
            );

        }
    );

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
    !sessionStorage.getItem(
        "splashShown"
    )
) {

    splash.style.display =
        "flex";


    setTimeout(() => {

        splash.classList.add(
            "hide"
        );


        setTimeout(() => {

            splash.style.display =
                "none";

        }, 180);

    }, 320);


    sessionStorage.setItem(
        "splashShown",
        "true"
    );

} else if (splash) {

    splash.style.display =
        "none";

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


        const rankingRows =
            await Promise.all(

                snapshot.docs.map(
                    async (
                        rankingDoc,
                        index
                    ) => {

                        const data =
                            rankingDoc.data();

                        const studentId =
                            rankingDoc.id;


                        const totalSnap =
                            await getDoc(
                                doc(
                                    db,
                                    "totalRanking",
                                    studentId
                                )
                            );


                        const totalPoint =
                            totalSnap.exists()
                                ? (
                                    totalSnap.data()
                                        .point ||
                                    0
                                )
                                : 0;


                        const mark =
                            getRankMark(
                                totalPoint
                            );


                        const rank =
                            index + 1;


                        return `
                            <div class="ranking-item">

                                <div class="ranking-rank">
                                    ${
                                        rank === 1
                                            ? "🥇"
                                            : rank === 2
                                                ? "🥈"
                                                : rank === 3
                                                    ? "🥉"
                                                    : rank
                                    }
                                </div>

                                <div class="ranking-user">

                                    <div class="ranking-name">
                                        ${mark}${getAnonymousRankingName(
                                            studentId,
                                            studentId === studentNumber
                                        )}
                                    </div>

                                    <div class="ranking-score">
                                        ${data.point || 0}pt
                                    </div>

                                </div>

                            </div>
                        `;

                    }
                )

            );


        rankingList.innerHTML =
            rankingRows.join("");


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

function createEmptyLectureSchedule(
    dateString
) {

    const date =
        new Date(
            `${dateString}T00:00:00`
        );


    const todayString =
        new Date()
            .toLocaleDateString(
                "sv-SE"
            );


    return {

        date:
            dateString,

        title:
            dateString === todayString
                ? "今日"
                : "講義予定",

        label:
            "",

        schedules:
            []

    };

}


function ensureLectureScheduleDate(
    dateString
) {

    let index =
        lectureSchedules.findIndex(
            item =>
                item.date === dateString
        );


    if (index >= 0) {

        return index;

    }


    const date =
        new Date(
            `${dateString}T00:00:00`
        );


    /*
     日曜日は今までどおり追加・選択しない。
    */

    if (
        Number.isNaN(
            date.getTime()
        ) ||
        date.getDay() === 0
    ) {

        return -1;

    }


    lectureSchedules.push(
        createEmptyLectureSchedule(
            dateString
        )
    );


    lectureSchedules.sort(
        (left, right) =>
            String(
                left.date || ""
            ).localeCompare(
                String(
                    right.date || ""
                )
            )
    );


    index =
        lectureSchedules.findIndex(
            item =>
                item.date === dateString
        );


    return index;

}

function renderLectureCalendar() {

    if (
        !lectureCalendarDays ||
        !lectureCalendarMonth
    ) {

        return;

    }


    lectureCalendarDays.innerHTML =
        "";


    lectureCalendarMonth.textContent =

        `${lectureCalendarYear}年` +

        `${lectureCalendarMonthIndex + 1}月`;


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


    /*
     月初より前の空白
    */

    for (
        let index = 0;
        index < startWeek;
        index++
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "lecture-calendar-empty";


        lectureCalendarDays.appendChild(
            empty
        );

    }


    const todayString =
        new Date()
            .toLocaleDateString(
                "sv-SE"
            );


    const selectedDate =

        lectureSchedules[
            lectureScheduleIndex
        ]?.date || "";


    const grade =
        localStorage.getItem(
            "grade"
        );


    /*
     当月の日付
    */

    for (
        let day = 1;
        day <= totalDays;
        day++
    ) {

        const date =
            new Date(

                lectureCalendarYear,

                lectureCalendarMonthIndex,

                day

            );


        const yyyy =
            date.getFullYear();


        const mm =
            String(
                date.getMonth() + 1
            )
            .padStart(
                2,
                "0"
            );


        const dd =
            String(
                day
            )
            .padStart(
                2,
                "0"
            );


        const dateString =
            `${yyyy}-${mm}-${dd}`;


        const isSunday =
            date.getDay() === 0;


        const dayData =
            lectureSchedules.find(
                item =>
                    item.date ===
                    dateString
            );


        const normalizedGrade =
            String(
                grade || ""
            )
                .normalize("NFKC")
                .replace("年", "")
                .trim();


        const hasLecture =

            dayData &&

            Array.isArray(
                dayData.schedules
            ) &&

            dayData.schedules.some(
                schedule => {

                    const scheduleGrade =
                        String(
                            schedule.grade || ""
                        )
                            .normalize("NFKC")
                            .replace("年", "")
                            .trim();


                    return (
                        !normalizedGrade ||
                        !scheduleGrade ||
                        scheduleGrade ===
                            normalizedGrade
                    );

                }
            );


        const button =
            document.createElement(
                "button"
            );


        button.type =
            "button";


        button.className =
            "lecture-calendar-day";


        button.setAttribute(

            "aria-label",

            `${yyyy}年` +

            `${date.getMonth() + 1}月` +

            `${day}日`

        );


        const dayNumber =
            document.createElement(
                "span"
            );


        dayNumber.className =
            "lecture-calendar-day-number";


        dayNumber.textContent =
            String(
                day
            );


        button.appendChild(
            dayNumber
        );


        if (
            dateString === todayString
        ) {

            button.classList.add(
                "is-today"
            );

        }


        if (
            dateString === selectedDate
        ) {

            button.classList.add(
                "is-selected"
            );

        }


        /*
         実際に履修講義がある日だけ点を付ける。
        */

        if (hasLecture) {

            button.classList.add(
                "has-lecture"
            );

        }


        /*
         日曜日は従来どおり選択不可。
        */

        if (isSunday) {

            button.disabled =
                true;


            button.classList.add(
                "is-sunday"
            );


            lectureCalendarDays
                .appendChild(
                    button
                );


            continue;

        }


        /*
         月曜日～土曜日は、
         予定データがなくても選択可能。
        */

        button.classList.add(
            "has-schedule-date"
        );


        button.onclick = () => {

            const newIndex =
                ensureLectureScheduleDate(
                    dateString
                );


            if (newIndex < 0) {

                return;

            }


            lectureScheduleIndex =
                newIndex;


            localStorage.setItem(

                "careMateSelectedScheduleDate",

                dateString

            );


            lectureCalendarYear =
                yyyy;


            lectureCalendarMonthIndex =
                date.getMonth();


            if (lectureCalendarPopup) {

                lectureCalendarPopup.hidden =
                    true;

            }


            if (lectureDatePickerButton) {

                lectureDatePickerButton
                    .setAttribute(

                        "aria-expanded",

                        "false"

                    );

            }


            const currentGrade =
                localStorage.getItem(
                    "grade"
                );


            renderCurrentLectureSchedule(
                currentGrade
            );

        };


        lectureCalendarDays.appendChild(
            button
        );

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

        const current =
            lectureSchedules[
                lectureScheduleIndex
            ];

        if (!current) {
            return;
        }

        const date =
            new Date(
                `${current.date}T00:00:00`
            );

        date.setDate(
            date.getDate() - 1
        );

        if (date.getDay() === 0) {
            date.setDate(
                date.getDate() - 1
            );
        }

        const dateString =
            date.toLocaleDateString(
                "sv-SE"
            );

        const index =
            ensureLectureScheduleDate(
                dateString
            );

        if (index < 0) {
            return;
        }

        lectureScheduleIndex =
            index;

        localStorage.setItem(
            "careMateSelectedScheduleDate",
            dateString
        );

        lectureCalendarYear =
            date.getFullYear();

        lectureCalendarMonthIndex =
            date.getMonth();

        renderLectureScheduleWithMotion(
            localStorage.getItem(
                "grade"
            ),
            "prev"
        );

    };

}

if (lectureNext) {

    lectureNext.onclick = () => {

        const current =
            lectureSchedules[
                lectureScheduleIndex
            ];

        if (!current) {
            return;
        }

        const date =
            new Date(
                `${current.date}T00:00:00`
            );

        date.setDate(
            date.getDate() + 1
        );

        if (date.getDay() === 0) {
            date.setDate(
                date.getDate() + 1
            );
        }

        const dateString =
            date.toLocaleDateString(
                "sv-SE"
            );

        const index =
            ensureLectureScheduleDate(
                dateString
            );

        if (index < 0) {
            return;
        }

        lectureScheduleIndex =
            index;

        localStorage.setItem(
            "careMateSelectedScheduleDate",
            dateString
        );

        lectureCalendarYear =
            date.getFullYear();

        lectureCalendarMonthIndex =
            date.getMonth();

        renderLectureScheduleWithMotion(
            localStorage.getItem(
                "grade"
            ),
            "next"
        );

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
