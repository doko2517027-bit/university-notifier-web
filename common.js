import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

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
    setDoc,
    getDoc,
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
    appId: "1:908622250178:web:3e355fce8698fcf179bb5b",
    databaseURL: "https://universitynotifier-67517-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const realtimeDb = getDatabase(app);

export const studentNumber =
    localStorage.getItem("studentNumber");

export function setupTheme(themeButton){

    if(localStorage.getItem("theme")==="dark"){

        document.documentElement.classList.add("dark");
        themeButton.textContent="☀️";

    }else{

        themeButton.textContent="🌙";

    }

    themeButton.onclick=()=>{

        document.documentElement.classList.toggle("dark");

        if(document.documentElement.classList.contains("dark")){

            localStorage.setItem("theme","dark");
            themeButton.textContent="☀️";

        }else{

            localStorage.setItem("theme","light");
            themeButton.textContent="🌙";

        }

    };

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

    const publicSnap = await getDoc(
        doc(db, "publicUsers", studentNumber)
    );

    if (
        publicSnap.exists() &&
        publicSnap.data().photo
    ) {
        img.src = publicSnap.data().photo;
        return;
    }

    const userSnap = await getDoc(
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

function getRankMark(point){

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

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

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
    setDoc,
    getDoc,
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
    appId: "1:908622250178:web:3e355fce8698fcf179bb5b",
    databaseURL: "https://universitynotifier-67517-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const realtimeDb = getDatabase(app);

export const studentNumber =
    localStorage.getItem("studentNumber");

export function setupTheme(themeButton){

    if(localStorage.getItem("theme")==="dark"){

        document.documentElement.classList.add("dark");
        themeButton.textContent="☀️";

    }else{

        themeButton.textContent="🌙";

    }

    themeButton.onclick=()=>{

        document.documentElement.classList.toggle("dark");

        if(document.documentElement.classList.contains("dark")){

            localStorage.setItem("theme","dark");
            themeButton.textContent="☀️";

        }else{

            localStorage.setItem("theme","light");
            themeButton.textContent="🌙";

        }

    };

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

    const publicSnap = await getDoc(
        doc(db, "publicUsers", studentNumber)
    );

    if (
        publicSnap.exists() &&
        publicSnap.data().photo
    ) {
        img.src = publicSnap.data().photo;
        return;
    }

    const userSnap = await getDoc(
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

function getRankMark(point){

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

export async function loadUserName(element, user = null){

    if(!studentNumber){

        element.textContent="Unknownさん";
        return;

    }

    const snap = await getDoc(
        doc(db,"publicUsers",studentNumber)
    );

    if(!snap.exists()){

        element.textContent="Unknownさん";
        return;

    }

    element.textContent =
        snap.data().name + "さん";

}

export async function loadMyRanking(){

    const element =
        document.getElementById("myRanking");


    if(!element || !studentNumber){
        return;
    }


    try{

        const today =
            new Date()
            .toISOString()
            .slice(0,10);


        const rankingSnap =
            await getDocs(
                collection(
                    db,
                    "dailyRanking",
                    today,
                    "users"
                )
            );


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

            element.innerHTML = "";

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

    try{

        await Promise.all(tasks);

    }finally{

        showPage();

    }

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

export async function getProfilePhoto(studentNumber) {

    if (profilePhotoCache.has(studentNumber)) {
        return profilePhotoCache.get(studentNumber);
    }

    const publicSnap = await getDoc(
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

    const userSnap = await getDoc(
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

    const snap = await getDoc(
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
        👑<br>
        <span>管理</span>
    `;

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

document.addEventListener("gesturestart", e => {
    e.preventDefault();
});

document.addEventListener("gesturechange", e => {
    e.preventDefault();
});

document.addEventListener("gestureend", e => {
    e.preventDefault();
});

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
                <img src="${photo}" class="top-profile-image">
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

        const snap = await getDoc(
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

    const badge =
        document.getElementById(
            "shareNavBadge"
        );

    if (!badge || !studentNumber) {
        return;
    }

    try {

        const userSnap = await getDoc(
            doc(
                db,
                "users",
                studentNumber
            )
        );

        if (!userSnap.exists()) {

            badge.hidden = true;
            badge.textContent = "0";

            return;

        }

        const shareLastReadAt =
            userSnap.data().shareLastReadAt || null;

        let postsQuery;

        if (shareLastReadAt) {

            postsQuery = query(
                collection(db, "posts"),
                where(
                    "createdAt",
                    ">",
                    shareLastReadAt
                )
            );

        } else {

            postsQuery = query(
                collection(db, "posts")
            );

        }

        const postsSnap =
            await getDocs(postsQuery);

        const count =
            postsSnap.size;

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
            "共有バッジ取得エラー:",
            error
        );

        badge.hidden = true;

    }

}

function parseNewsPostedDate(value) {

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

function getTimestampMilliseconds(timestamp) {

    if (!timestamp) {
        return 0;
    }

    if (
        typeof timestamp.toMillis === "function"
    ) {
        return timestamp.toMillis();
    }

    if (
        typeof timestamp.toDate === "function"
    ) {
        return timestamp.toDate().getTime();
    }

    return 0;

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
    "share.html": "共有画面",
    "post.html": "投稿作成",
    "comments.html": "コメント画面",
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

export async function loadMyRanking(){

    const element =
        document.getElementById("myRanking");


    if(!element || !studentNumber){
        return;
    }


    try{

        const today =
            new Date()
            .toISOString()
            .slice(0,10);


        const rankingSnap =
            await getDocs(
                collection(
                    db,
                    "dailyRanking",
                    today,
                    "users"
                )
            );


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

            element.innerHTML = "";

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

    try{

        await Promise.all(tasks);

    }finally{

        showPage();

    }

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

export async function getProfilePhoto(studentNumber) {

    if (profilePhotoCache.has(studentNumber)) {
        return profilePhotoCache.get(studentNumber);
    }

    const publicSnap = await getDoc(
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

    const userSnap = await getDoc(
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

    const snap = await getDoc(
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
        👑<br>
        <span>管理</span>
    `;

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

document.addEventListener("gesturestart", e => {
    e.preventDefault();
});

document.addEventListener("gesturechange", e => {
    e.preventDefault();
});

document.addEventListener("gestureend", e => {
    e.preventDefault();
});

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
                <img src="${photo}" class="top-profile-image">
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

        const snap = await getDoc(
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

    const badge =
        document.getElementById(
            "shareNavBadge"
        );

    if (!badge || !studentNumber) {
        return;
    }

    try {

        const userSnap = await getDoc(
            doc(
                db,
                "users",
                studentNumber
            )
        );

        if (!userSnap.exists()) {

            badge.hidden = true;
            badge.textContent = "0";

            return;

        }

        const shareLastReadAt =
            userSnap.data().shareLastReadAt || null;

        let postsQuery;

        if (shareLastReadAt) {

            postsQuery = query(
                collection(db, "posts"),
                where(
                    "createdAt",
                    ">",
                    shareLastReadAt
                )
            );

        } else {

            postsQuery = query(
                collection(db, "posts")
            );

        }

        const postsSnap =
            await getDocs(postsQuery);

        const count =
            postsSnap.size;

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
            "共有バッジ取得エラー:",
            error
        );

        badge.hidden = true;

    }

}

function parseNewsPostedDate(value) {

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

function getTimestampMilliseconds(timestamp) {

    if (!timestamp) {
        return 0;
    }

    if (
        typeof timestamp.toMillis === "function"
    ) {
        return timestamp.toMillis();
    }

    if (
        typeof timestamp.toDate === "function"
    ) {
        return timestamp.toDate().getTime();
    }

    return 0;

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
    "share.html": "共有画面",
    "post.html": "投稿作成",
    "comments.html": "コメント画面",
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