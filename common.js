import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getStorage
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";

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
    appId: "1:908622250178:web:3e355fce8698fcf179bb5b"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);

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

    target.innerHTML="";

    for(let i=0;i<count;i++){

        target.innerHTML+=`

        <div class="news-card skeleton-card">

            <div class="skeleton skeleton-title"></div>

            <div class="skeleton skeleton-text"></div>

            <div class="skeleton skeleton-text short"></div>

        </div>

        `;

    }

}

export function showPostSkeleton(target, count = 5){

    if(!target) return;

    target.innerHTML="";

    for(let i=0;i<count;i++){

        target.innerHTML+=`

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

}

export function showAssignmentSkeleton(target,count=4){

    if(!target) return;

    target.innerHTML="";

    for(let i=0;i<count;i++){

        target.innerHTML+=`

        <div class="card setting-card">

            <div class="skeleton skeleton-title"></div>

            <div class="skeleton skeleton-text"></div>

            <div class="skeleton skeleton-text short"></div>

        </div>

        `;

    }

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

export async function getProfilePhoto(studentNumber) {

    const publicSnap = await getDoc(
        doc(db, "publicUsers", studentNumber)
    );

    if (
        publicSnap.exists() &&
        publicSnap.data().photo
    ) {
        return publicSnap.data().photo;
    }

    const userSnap = await getDoc(
        doc(db, "users", studentNumber)
    );

    if (
        userSnap.exists() &&
        userSnap.data().profile?.photo
    ) {
        return userSnap.data().profile.photo;
    }

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