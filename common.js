import {
    getStorage
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";

import {
    getDatabase,
    ref,
    set,
    update,
    onValue,
    onDisconnect,
    serverTimestamp as databaseServerTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

import {
    getFirestore,
    doc,
    getDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
    initializeApp,
    getApps,
    getApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getAuth,
    signInWithCustomToken,
    getIdTokenResult
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    getFunctions,
    httpsCallable
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

import {
    registerDevicePushSubscription
} from "./push_subscription.js";

const firebaseConfig = {
    apiKey: "AIzaSyAEtS2NGZKqHFh29kmR9OjEpshbC1yvjFY",
    authDomain: "universitynotifier-67517.firebaseapp.com",
    projectId: "universitynotifier-67517",
    storageBucket: "universitynotifier-67517.firebasestorage.app",
    messagingSenderId: "908622250178",
    appId: "1:908622250178:web:3e355fce8698fcf179bb5b",
    databaseURL: "https://universitynotifier-67517-default-rtdb.firebaseio.com"
};

let app;

// アプリ内では拡大・縮小を行わず、通常のスクロール操作だけを残す。
document.addEventListener("touchmove", event => {
    if (event.touches.length > 1) event.preventDefault();
}, { passive: false });
document.addEventListener("gesturestart", event => event.preventDefault());

if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

function getAttendanceNow(
    normalized
) {

    if (
        normalized?.attendanceNotificationTest === true &&
        normalized?.attendanceNotificationTestClock
    ) {

        const testDate =
            new Date(
                normalized.attendanceNotificationTestClock
            );


        if (
            !Number.isNaN(
                testDate.getTime()
            )
        ) {

            return testDate;

        }

    }


    return new Date();

}

export const db = getFirestore(app);
export const storage = getStorage(app);
export const realtimeDb = getDatabase(app);
export const auth = getAuth(app);
export const functions = getFunctions(app, "asia-northeast1");

export const studentNumber =
    localStorage.getItem("studentNumber");

export async function signInCareMateAuth(studentNumber, password) {
    const authenticateCareMate = httpsCallable(
        functions,
        "authenticateCareMate"
    );

    const result = await authenticateCareMate({
        studentNumber: String(studentNumber || "").trim(),
        password: String(password || "")
    });

    await signInWithCustomToken(auth, result.data.token);
}

export async function refreshAdminClaim() {
    if (!auth.currentUser) return false;

    const token = await getIdTokenResult(auth.currentUser);
    return token.claims.admin === true;
}

// ======================
// 学籍番号から学生情報を取得
// ======================

export function parseStudentNumber(value) {

    const normalizedStudentNumber =
        String(value || "")
            .replace(/\D/g, "");

    if (
        !/^\d{7}$/.test(
            normalizedStudentNumber
        )
    ) {

        return {
            valid: false,
            studentNumber:
                normalizedStudentNumber,
            admissionYear: null,
            departmentCode: "",
            department: "",
            major: "",
            curriculumId: ""
        };

    }

    // 先頭2桁＝入学年度
    const admissionYear =
        2000 +
        Number(
            normalizedStudentNumber.slice(
                0,
                2
            )
        );

    // 3・4桁目＝学科・専攻コード
    const departmentCode =
        normalizedStudentNumber.slice(
            2,
            4
        );

    let department = "";
    let major = "";
    let curriculumPrefix = "";

    switch (departmentCode) {

        case "10":

            department =
                "看護学科";

            major = "";

            curriculumPrefix =
                "nursing";

            break;

        case "20":

            department =
                "リハビリテーション学科";

            major =
                "理学療法学専攻";

            curriculumPrefix =
                "physical_therapy";

            break;

        case "30":

            department =
                "リハビリテーション学科";

            major =
                "作業療法学専攻";

            curriculumPrefix =
                "occupational_therapy";

            break;

        case "40":

            department =
                "医療薬学科";

            major = "";

            curriculumPrefix =
                "pharmacy";

            break;

        default:

            return {
                valid: false,
                studentNumber:
                    normalizedStudentNumber,
                admissionYear,
                departmentCode,
                department: "",
                major: "",
                curriculumId: ""
            };

    }

    return {
        valid: true,

        studentNumber:
            normalizedStudentNumber,

        admissionYear,

        departmentCode,

        department,

        major,

        curriculumId:
            `${curriculumPrefix}_${admissionYear}`
    };

}


// 現在ログイン中の学生情報
export const studentAcademicContext =
    parseStudentNumber(
        studentNumber
    );

export function setupTheme(themeButton){

    const applyTheme = theme => {

        const isDark = theme === "dark";

        document.documentElement.classList.toggle("dark", isDark);

        if (themeButton) {
            themeButton.textContent = isDark ? "☀️" : "🌙";
            themeButton.setAttribute(
                "aria-label",
                isDark ? "ライトモードに切り替える" : "ダークモードに切り替える"
            );
        }

    };

    applyTheme(localStorage.getItem("theme") === "dark" ? "dark" : "light");

    if (themeButton) {
        themeButton.onclick = () => {

            const theme = document.documentElement.classList.contains("dark")
                ? "light"
                : "dark";

            localStorage.setItem("theme", theme);
            applyTheme(theme);

        };
    }

    document.querySelectorAll("#profileButton, [data-profile-button]")
        .forEach(profileButton => {

            if (profileButton.dataset.profileNavigationBound === "true") {
                return;
            }

            profileButton.dataset.profileNavigationBound = "true";
            profileButton.addEventListener("click", () => {
                location.href = "profile.html";
            });

        });

    window.addEventListener("storage", event => {
        if (event.key === "theme") {
            applyTheme(event.newValue === "dark" ? "dark" : "light");
        }
    });

}

export function setupOfflineAlert() {

    if (!navigator.onLine) {
        alert("電波が悪い、またはオフラインです。保存済みの情報を表示します。");
    }

    window.addEventListener("offline", () => {
        alert("電波が悪い、またはオフラインになりました。保存済みの情報を表示します。");
    });

}

export async function loadProfileImage(img){

    if (!img) return;

    const publicSnap = await cachedGetDoc(
        `publicUsers/${studentNumber}`,
        doc(db, "publicUsers", studentNumber)
    );

    if (
        publicSnap.exists() &&
        publicSnap.data().photo
    ) {
        img.src = publicSnap.data().photo;
        return;
    }

    const userSnap = await cachedGetDoc(
        `users/${studentNumber}`,
        doc(db, "users", studentNumber)
    );

    if (
        userSnap.exists() &&
        userSnap.data().profile?.photo
    ) {
        img.src = userSnap.data().profile.photo;
        return;
    }

    img.src = "images/default.png";

}

export function getRankMark(point){

    if(point >= 4000){
        return "👑";
    }

    if(point >= 2000){
        return "🐉";
    }

    if(point >= 1000){
        return "🦅";
    }

    if(point >= 600){
        return "🕊‎";
    }

    if(point >= 300){
        return "🦉";
    }

    if(point >= 150){
        return "‪🦜‬";
    }

    if(point >= 70){
        return "🐓";
    }

    if(point >= 30){
        return "🐥";
    }

    if(point >= 10){
        return "🐣";
    }

    return "🥚";

}

// ======================
// ランキング表示名
// ======================

export function getRankingDisplayName(
    userId,
    userData = null
) {

    const normalizedStudentNumber =
        String(
            userId ||
            "学籍番号不明"
        );


    if (!userData) {

        return normalizedStudentNumber;

    }


    const nickname =
        String(
            userData.rankingNickname ||
            ""
        ).trim();


    if (
        userData.rankingDisplayMode ===
            "nickname" &&
        nickname
    ) {

        return nickname;

    }


    return normalizedStudentNumber;

}


// 既存コードとの互換性維持
export function getAnonymousRankingName(
    userId,
    userData = null
) {

    return getRankingDisplayName(
        userId,
        userData
    );

}


// ランキング画面から一括取得するために使用
export async function getRankingUserMap() {

    const snapshot =
        await getDocs(
            collection(
                db,
                "users"
            )
        );


    return new Map(
        snapshot.docs.map(
            userDoc => [

                userDoc.id,

                {
                    id:
                        userDoc.id,

                    ...userDoc.data()
                }

            ]
        )
    );

}

// ======================
// ランキング表示名
// 初回設定ポップアップ
// ======================

let rankingNicknamePromptPromise = null;


export async function setupRankingNicknamePrompt() {

    if (!studentNumber) {
        return;
    }


    if (rankingNicknamePromptPromise) {

        return rankingNicknamePromptPromise;

    }


    rankingNicknamePromptPromise =
        checkRankingNicknamePrompt()
            .finally(() => {

                rankingNicknamePromptPromise =
                    null;

            });


    return rankingNicknamePromptPromise;

}


async function checkRankingNicknamePrompt() {

    try {

        const userRef =
            doc(
                db,
                "users",
                studentNumber
            );


        const snapshot =
            await getDoc(
                userRef
            );


        if (!snapshot.exists()) {
            return;
        }


        const userData =
            snapshot.data() || {};


        if (
            userData
                .rankingNicknamePromptCompleted ===
            true
        ) {

            return;

        }


        await showRankingNicknamePrompt(
            userRef,
            userData
        );


    } catch (error) {

        console.error(
            "ランキング表示名確認エラー:",
            error
        );

    }

}


function showRankingNicknamePrompt(
    userRef,
    userData
) {

    return new Promise(resolve => {

        const oldOverlay =
            document.getElementById(
                "rankingNicknamePrompt"
            );


        if (oldOverlay) {

            oldOverlay.remove();

        }


        const overlay =
            document.createElement(
                "div"
            );


        overlay.id =
            "rankingNicknamePrompt";

        overlay.className =
            "exam-popup-overlay";


        overlay.innerHTML = `

            <div
                class="exam-popup-card"
                style="
                    text-align:left;
                    max-width:420px;
                ">

                <div
                    class="exam-popup-icon"
                    style="margin-bottom:16px;">
                    🏆
                </div>

                <p
                    class="exam-popup-label"
                    style="text-align:center;">
                    ランキング表示名
                </p>

                <h2
                    style="
                        margin:0 0 12px;
                        text-align:center;
                    ">
                    ニックネームを設定しますか？
                </h2>

                <p
                    style="
                        margin:0 0 18px;
                        color:var(--subtext);
                        line-height:1.7;
                    ">

                    現在ランキングでは
                    <b>${studentNumber}</b>
                    と表示されています。

                    <br><br>

                    ニックネームを設定すると、
                    ランキングでは学籍番号の代わりに
                    ニックネームが表示されます。

                    <br><br>

                    あとからプロフィール画面で
                    変更できます。

                </p>

                <label
                    for="rankingNicknamePromptInput"
                    style="
                        display:block;
                        margin-bottom:7px;
                        font-weight:800;
                    ">
                    ニックネーム
                </label>

                <input
                    id="rankingNicknamePromptInput"
                    type="text"
                    maxlength="20"
                    autocomplete="off"
                    placeholder="例：ケアメイト"
                    style="
                        width:100%;
                        box-sizing:border-box;
                        margin-bottom:8px;
                    ">

                <small
                    style="
                        display:block;
                        color:var(--subtext);
                        margin-bottom:20px;
                    ">
                    20文字以内
                </small>

                <button
                    id="saveRankingNicknamePrompt"
                    type="button"
                    class="btn btn-primary"
                    style="
                        width:100%;
                        margin:0 0 10px;
                    ">
                    ニックネームを設定
                </button>

                <button
                    id="skipRankingNicknamePrompt"
                    type="button"
                    class="btn"
                    style="
                        width:100%;
                        margin:0;
                    ">
                    学籍番号のまま使う
                </button>

            </div>
        `;


        document.body.appendChild(
            overlay
        );


        const input =
            overlay.querySelector(
                "#rankingNicknamePromptInput"
            );


        const saveButton =
            overlay.querySelector(
                "#saveRankingNicknamePrompt"
            );


        const skipButton =
            overlay.querySelector(
                "#skipRankingNicknamePrompt"
            );


        input.value =
            String(
                userData.rankingNickname ||
                ""
            ).trim();


        const closePopup = () => {

            overlay.classList.remove(
                "show"
            );


            setTimeout(() => {

                overlay.remove();

            }, 220);


            resolve();

        };


        const setBusy =
            busy => {

                input.disabled =
                    busy;

                saveButton.disabled =
                    busy;

                skipButton.disabled =
                    busy;

            };


        saveButton.onclick =
            async () => {

                const nickname =
                    input.value.trim();


                if (!nickname) {

                    alert(
                        "ニックネームを入力してください。"
                    );

                    input.focus();

                    return;

                }


                if (nickname.length > 20) {

                    alert(
                        "ニックネームは20文字以内で入力してください。"
                    );

                    return;

                }


                try {

                    setBusy(true);


                    await updateDoc(
                        userRef,
                        {
                            rankingNickname:
                                nickname,

                            rankingDisplayMode:
                                "nickname",

                            rankingNicknamePromptCompleted:
                                true,

                            rankingNicknameUpdatedAt:
                                serverTimestamp(),

                            rankingNicknameUpdatedBy:
                                studentNumber
                        }
                    );


                    showToast(
                        "ランキング表示名を設定しました"
                    );


                    closePopup();


                } catch (error) {

                    console.error(
                        "ランキング表示名保存エラー:",
                        error
                    );


                    alert(
                        "ニックネームを保存できませんでした。"
                    );


                    setBusy(false);

                }

            };


        skipButton.onclick =
            async () => {

                try {

                    setBusy(true);


                    await updateDoc(
                        userRef,
                        {
                            rankingDisplayMode:
                                "student_number",

                            rankingNicknamePromptCompleted:
                                true,

                            rankingNicknameUpdatedAt:
                                serverTimestamp(),

                            rankingNicknameUpdatedBy:
                                studentNumber
                        }
                    );


                    showToast(
                        "ランキングでは学籍番号を表示します"
                    );


                    closePopup();


                } catch (error) {

                    console.error(
                        "ランキング表示設定保存エラー:",
                        error
                    );


                    alert(
                        "設定を保存できませんでした。"
                    );


                    setBusy(false);

                }

            };


        requestAnimationFrame(() => {

            overlay.classList.add(
                "show"
            );


            setTimeout(() => {

                input.focus();

            }, 220);

        });

    });

}

export async function loadUserName(element, user = null){

    if(!studentNumber){

        element.textContent="Unknownさん";
        return;

    }


    const userSnap = await cachedGetDoc(
        `publicUsers/${studentNumber}`,
        doc(db,"publicUsers",studentNumber)
    );


    if(!userSnap.exists()){

        element.textContent="Unknownさん";
        return;

    }


    const name =
        userSnap.data().name;


    let point = 0;


    const userPointSnap =
            await cachedGetDoc(
                `totalRanking/${studentNumber}`,
            doc(
                db,
                "totalRanking",
                studentNumber
            )
        );


    if(userPointSnap.exists()){

        point =
            userPointSnap.data().point || 0;

    }


    const mark =
        getRankMark(point);


    element.textContent =
        `${mark}${name}さん`;

}

export async function loadMyRanking(){

    const element =
        document.getElementById("myRanking");


    if (studentNumber) {

        await setupRankingNicknamePrompt();

    }


    if(!element || !studentNumber){
        return;
    }


    try{

        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;


        const rankingRef = collection(
                    db,
                    "dailyRanking",
                    today,
                    "users"
                );

        onSnapshot(rankingRef, rankingSnap => {

        const userInfo = element.closest(".top-user-info");
        if (userInfo) {
            userInfo.classList.add("is-clickable");
            userInfo.title = "ポイントとランキングを見る";
            userInfo.onclick = () => location.href = "points.html";
        }

        let ranking = [];


        rankingSnap.forEach(doc=>{

            ranking.push({

                studentNumber: doc.id,

                point:
                    doc.data().point || 0

            });

        });


        // ポイント順
        ranking.sort(
            (a,b)=>b.point-a.point
        );


        const myIndex =
            ranking.findIndex(
                item =>
                item.studentNumber === studentNumber
            );


        if(myIndex === -1){

            element.innerHTML = `<span class="my-ranking">順位なし 0pt</span>`;

            return;

        }


        const rank =
            myIndex + 1;


        const point =
            ranking[myIndex].point;


        let medal = "";


        if(rank === 1){
            medal = "🥇";
        }
        else if(rank === 2){
            medal = "🥈";
        }
        else if(rank === 3){
            medal = "🥉";
        }


        element.innerHTML = `

            <span class="my-ranking">
                ${medal}
                ${rank}位 ${point}pt
            </span>

        `;

        }, error => console.error("順位リアルタイム取得エラー", error));


    }catch(error){

        console.error(
            "順位取得エラー",
            error
        );

    }

}

export function showPage(){

    document.body.classList.remove("page-loading");
    document.body.classList.add("page-loaded");

}

export async function initializePage(tasks = []){

    showPage();

    await Promise.all(tasks)
        .catch(error => {
            console.error(
                "初期読み込みエラー:",
                error
            );
        });

}

export function showNewsSkeleton(target, count = 3){

    if(!target) return;

    let html = "";

    for(let i=0;i<count;i++){

        html += `

        <div class="news-card skeleton-card">

            <div class="skeleton skeleton-title"></div>

            <div class="skeleton skeleton-text"></div>

            <div class="skeleton skeleton-text short"></div>

        </div>

        `;

    }

    target.innerHTML = html;

}

export function showPostSkeleton(target, count = 5){

    if(!target) return;

    let html = "";

    for(let i=0;i<count;i++){

        html += `

        <div class="card post-card">

            <div class="post-header">

                <div>

                    <div class="skeleton skeleton-title"></div>

                    <div class="skeleton skeleton-text short"></div>

                </div>

            </div>

            <br>

            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text short"></div>

        </div>

        `;

    }

    target.innerHTML = html;

}

export function showAssignmentSkeleton(target,count=4){

    if(!target) return;

    let html = "";

    for(let i=0;i<count;i++){

        html += `

        <div class="card setting-card">

            <div class="skeleton skeleton-title"></div>

            <div class="skeleton skeleton-text"></div>

            <div class="skeleton skeleton-text short"></div>

        </div>

        `;

    }

    target.innerHTML = html;

}

let toastTimer;

export function showToast(message){

    let toast =
        document.getElementById("toast");

    if(!toast){

        toast = document.createElement("div");

        toast.id="toast";

        toast.className="toast";

        document.body.appendChild(toast);

    }

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(()=>{

        toast.classList.remove("show");

    },1800);

}

export function updateAccentColor(department, major) {

    const root = document.documentElement;

    if (department === "看護学科") {

        root.style.setProperty("--accent", "#F7EAC5");

    } else if (major === "理学療法学専攻") {

        root.style.setProperty("--accent", "#DDEBF7");

    } else if (major === "作業療法学専攻") {

        root.style.setProperty("--accent", "#E2EFDA");

    } else {

        root.style.setProperty("--accent", "#BEE9E8"); // style.cssのデフォルト
    }

}

export function formatDateTime(timestamp) {

    if (!timestamp) return "";

    const date = timestamp.toDate();

    return (
        `${date.getMonth() + 1}/${date.getDate()} ` +
        `${String(date.getHours()).padStart(2, "0")}:` +
        `${String(date.getMinutes()).padStart(2, "0")}`
    );

}

const profilePhotoCache = new Map();

const firestoreCache = new Map();

async function cachedGetDoc(path, ref) {

    if (firestoreCache.has(path)) {
        return firestoreCache.get(path);
    }

    const request =
        getDoc(ref)
            .catch(error => {

                firestoreCache.delete(path);

                throw error;

            });

    /*
    Snapshot取得後ではなく、
    リクエスト開始時点でPromiseを保存する。

    同じページ内で同時に
    publicUsers/xxxx
    users/xxxx
    などを要求しても、
    Firestore通信は1回だけになる。
    */
    firestoreCache.set(
        path,
        request
    );

    return request;

}

export async function getProfilePhoto(studentNumber) {

    if (profilePhotoCache.has(studentNumber)) {
        return profilePhotoCache.get(studentNumber);
    }

    const publicSnap = await cachedGetDoc(
        `publicUsers/${studentNumber}`,
        doc(db, "publicUsers", studentNumber)
    );

    if (
        publicSnap.exists() &&
        publicSnap.data().photo
    ) {

        profilePhotoCache.set(
            studentNumber,
            publicSnap.data().photo
        );

        return publicSnap.data().photo;

    }

    const userSnap = await cachedGetDoc(
        `users/${studentNumber}`,
        doc(db, "users", studentNumber)
    );

    if (
        userSnap.exists() &&
        userSnap.data().profile?.photo
    ) {

        profilePhotoCache.set(
            studentNumber,
            userSnap.data().profile.photo
        );

        return userSnap.data().profile.photo;

    }

    profilePhotoCache.set(
        studentNumber,
        "images/default.png"
    );

    return "images/default.png";

}

export async function isAdmin() {

    if (!studentNumber) {
        return false;
    }

    const snap = await cachedGetDoc(
        `admins/${studentNumber}`,
        doc(db, "admins", studentNumber)
    );

    return (
        snap.exists() &&
        snap.data().enabled === true
    );

}

export async function setupAdminTab() {

    const settingsTab =
        document.getElementById("settingsTab");

    if (!settingsTab) {
        return;
    }

    const admin = await isAdmin();

    if (!admin) {
        return;
    }

    settingsTab.href = "admin.html";

    settingsTab.innerHTML = `
        <span class="nav-icon-wrap">
            <span class="nav-icon">👑</span>
            <span id="adminReportBadge" class="nav-notification-badge" hidden>0</span>
        </span>
        <span>管理</span>
    `;

    try {
        onSnapshot(collection(db, "reports"), reportsSnapshot => {
            const unresolvedCount = reportsSnapshot.docs.filter(item =>
                !["closed", "corrected", "resolved"].includes(item.data().status || "open")
            ).length;

            ["adminReportBadge", "adminReportCardBadge"].forEach(id => {
                const badge = document.getElementById(id);

                if (!badge) {
                    return;
                }

                badge.textContent = unresolvedCount > 99 ? "99+" : String(unresolvedCount);
                badge.hidden = unresolvedCount === 0;
            });
        });
    } catch (error) {
        console.error("管理通報バッジ取得エラー:", error);
    }

}

const SECRET = "UniversityNotifier2026";

export async function encryptData(data) {

    const text = JSON.stringify(data);

    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(SECRET.padEnd(32, "0")),
        "AES-GCM",
        false,
        ["encrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv
        },
        key,
        encoder.encode(text)
    );

    const result = new Uint8Array(iv.length + encrypted.byteLength);

    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...result));

}

export async function decryptData(encryptedText) {

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const raw = Uint8Array.from(
        atob(encryptedText),
        c => c.charCodeAt(0)
    );

    const iv = raw.slice(0, 12);
    const data = raw.slice(12);

    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(SECRET.padEnd(32, "0")),
        "AES-GCM",
        false,
        ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv
        },
        key,
        data
    );

    return JSON.parse(decoder.decode(decrypted));

}

let lastTouchEnd = 0;

document.addEventListener("touchend", e => {

    const now = Date.now();

    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }

    lastTouchEnd = now;

}, { passive: false });

export function renderPostCard({
    postId,
    post,
    photo,
    time,
    liked = false,
    showMenu = false,
    clickable = false
}) {

    return `

<div class="card post-card ${clickable ? "clickable-post" : ""}"
    ${clickable ? `data-post-id="${postId}"` : ""}>

    <div class="post-header">

        <div>
            <div class="student-number">
                <img 
                src="${photo}" 
                loading="lazy"
                class="top-profile-image">
                ${post.studentNumber}
            </div>

            <div class="post-time">
                ${time}
            </div>
        </div>

        ${showMenu ? `
        <button
            class="delete-button"
            data-id="${postId}"
            data-owner="${post.studentNumber}">
            ⋯
        </button>
        ` : ""}

    </div>

    <div class="post-text">
        ${post.text || ""}
    </div>

    ${post.images?.length ? `
    <div class="post-images">
        ${post.images.map(image => `
            <img
                src="${image.url}"
                class="post-image"
                data-url="${image.url}">
        `).join("")}
    </div>
    ` : ""}

    ${post.pdfs?.length ? `
        ${post.pdfs.map(pdf => `
            <div class="post-pdf" data-url="${pdf.url}">
                <div class="pdf-title">📄 ${pdf.name}</div>
                <div class="pdf-subtitle">タップして開く</div>
            </div>
        `).join("")}
    ` : ""}

    <div class="post-footer">

        <button
            class="like-button ${liked ? "liked" : ""}"
            data-id="${postId}">
            ${liked ? "❤️" : "🤍"}
        </button>

        <span class="like-count">
            ${post.likeCount ?? 0}
        </span>

        <button
            class="comment-button"
            data-id="${postId}">
            💬
        </button>

        <span class="comment-count">
            ${post.commentCount ?? 0}
        </span>

    </div>

</div>

`;

}

export async function updateAssignmentNavBadge() {

    const badge =
        document.getElementById(
            "assignmentNavBadge"
        );

    if (!badge || !studentNumber) {
        return;
    }

    try {

        const snap = await cachedGetDoc(
            `assignments/${studentNumber}`,
            doc(
                db,
                "assignments",
                studentNumber
            )
        );

        if (!snap.exists()) {

            badge.hidden = true;
            badge.textContent = "0";

            return;

        }

        const assignments =
            snap.data().assignments || [];

        const count =
            Array.isArray(assignments)
                ? assignments.length
                : 0;

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

    } catch (error) {

        console.error(
            "課題バッジ取得エラー:",
            error
        );

        badge.hidden = true;

    }

}

export async function updateShareNavBadge() {
    // 共有タブは機能リクエストへ置き換え済み。旧投稿の取得は行わない。
    return;

}

export async function updateNewsNavBadge() {

    const badge =
        document.getElementById(
            "newsNavBadge"
        );

    if (!badge || !studentNumber) {
        return;
    }

    try {

        const readSnapshot =
            await getDocs(
                collection(
                    db,
                    "users",
                    studentNumber,
                    "readNews"
                )
            );

        const readNewsIds =
            new Set(
                readSnapshot.docs.map(
                    readDoc => readDoc.id
                )
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

        if (
            grade &&
            (
                department ||
                major
            )
        ) {

            let universityQuery;

            if (department) {

                universityQuery = query(
                    collection(db, "news"),
                    where(
                        "department",
                        "==",
                        department
                    ),
                    where(
                        "grade",
                        "==",
                        grade
                    )
                );

            } else {

                universityQuery = query(
                    collection(db, "news"),
                    where(
                        "major",
                        "==",
                        major
                    ),
                    where(
                        "grade",
                        "==",
                        grade
                    )
                );

            }

            const universitySnapshot =
                await getDocs(
                    universityQuery
                );

            universitySnapshot.forEach(
                newsDoc => {

                    const readId =
                        `university_${newsDoc.id}`;

                    if (!readNewsIds.has(readId)) {
                        universityUnreadCount++;
                    }

                }
            );

        }

        const courseSnapshot =
            await getDocs(
                collection(
                    db,
                    "courseNews",
                    studentNumber,
                    "news"
                )
            );

        let courseUnreadCount = 0;

        courseSnapshot.forEach(
            newsDoc => {

                const readId =
                    `course_${newsDoc.id}`;

                if (!readNewsIds.has(readId)) {
                    courseUnreadCount++;
                }

            }
        );

        const systemSnapshot =
            await getDocs(
                collection(
                    db,
                    "systemNews"
                )
            );

        let systemUnreadCount = 0;

        systemSnapshot.forEach(
            newsDoc => {

                const readId =
                    `system_${newsDoc.id}`;

                if (!readNewsIds.has(readId)) {
                    systemUnreadCount++;
                }

            }
        );

        const totalCount =
            universityUnreadCount +
            courseUnreadCount +
            systemUnreadCount;

        if (totalCount <= 0) {

            badge.hidden = true;
            badge.textContent = "0";

            return;

        }

        badge.hidden = false;

        badge.textContent =
            totalCount > 99
                ? "99+"
                : String(totalCount);

    } catch (error) {

        console.error(
            "お知らせバッジ取得エラー:",
            error
        );

        badge.hidden = true;

    }

}

let presenceInitialized = false;

const presencePageNames = {
    "index.html": "ホーム画面",
    "news.html": "お知らせ",
    "requests.html": "機能リクエスト",
    "profile.html": "プロフィール",
    "settings.html": "設定画面",
    "assignment.html": "課題画面",
    "exam.html": "テスト対策",
    "quiz.html": "四択問題",
    "fill_blank.html": "穴埋め問題",
    "daily_question.html": "今日の1問",
    "must_remember.html": "重要ポイント",
    "weather-settings.html": "天気設定",
    "admin.html": "管理画面",
    "exam_admin.html": "テスト管理",
    "exam_materials_admin.html": "資料管理",
    "exam_questions_admin.html": "問題管理"
};

function getCurrentPageFileName() {

    const pathname =
        location.pathname || "";

    const fileName =
        pathname.split("/").pop();

    return fileName || "index.html";

}

function getCurrentPageName() {

    const fileName =
        getCurrentPageFileName();

    return (
        presencePageNames[fileName] ||
        document.title ||
        fileName ||
        "ページ不明"
    );

}

export async function setupPresence() {

    if (presenceInitialized) {
        return;
    }

    if (!studentNumber) {
        return;
    }

    if (
        localStorage.getItem("loggedIn") !== "true"
    ) {
        return;
    }

    presenceInitialized = true;

    const statusRef = ref(
        realtimeDb,
        `status/${studentNumber}`
    );

    const connectedRef = ref(
        realtimeDb,
        ".info/connected"
    );

    const page =
        getCurrentPageFileName();

    const pageName =
        getCurrentPageName();

    onValue(
        connectedRef,
        async snapshot => {

            if (snapshot.val() !== true) {
                return;
            }

            try {

                await onDisconnect(
                    statusRef
                ).set({
                    studentNumber,
                    state: "offline",
                    page,
                    pageName,
                    lastChanged:
                        databaseServerTimestamp()
                });

                await set(
                    statusRef,
                    {
                        studentNumber,
                        state: "online",
                        page,
                        pageName,
                        lastChanged:
                            databaseServerTimestamp()
                    }
                );

            } catch (error) {

                console.error(
                    "オンライン状態設定エラー:",
                    error
                );

            }

        }
    );

    document.addEventListener(
        "visibilitychange",
        async () => {

            try {

                if (document.hidden) {

                    await update(
                        statusRef,
                        {
                            state: "away",
                            page:
                                getCurrentPageFileName(),
                            pageName:
                                getCurrentPageName(),
                            lastChanged:
                                databaseServerTimestamp()
                        }
                    );

                } else {

                    await update(
                        statusRef,
                        {
                            state: "online",
                            page:
                                getCurrentPageFileName(),
                            pageName:
                                getCurrentPageName(),
                            lastChanged:
                                databaseServerTimestamp()
                        }
                    );

                }

            } catch (error) {

                console.error(
                    "画面状態更新エラー:",
                    error
                );

            }

        }
    );

}

if (
    studentNumber &&
    localStorage.getItem("loggedIn") === "true"
) {

    setupPresence().catch(error => {

        console.error(
            "Presence開始エラー:",
            error
        );

    });

}

// ======================
// 出席通知・標準Web Push
// ======================

export async function setupAttendanceWebPush() {

    try {

        if (!studentNumber) {
            return;
        }

        if (
            localStorage.getItem("loggedIn") !== "true"
        ) {
            return;
        }

        await registerDevicePushSubscription(
            db,
            studentNumber,
            "attendance"
        );

        console.log(
            "出席Web Push購読情報保存完了"
        );

    } catch (error) {

        console.error(
            "出席Web Push設定エラー:",
            error
        );

    }

}
