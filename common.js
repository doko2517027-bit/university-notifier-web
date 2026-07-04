import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getFirestore,
    doc,
    getDoc
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

export async function loadProfileImage(img){

    if (!img) return;

    const snap = await getDoc(
        doc(db, "publicUsers", studentNumber)
    );

    if (!snap.exists()) return;

    const user = snap.data();

    img.src = user.photo || "images/default.png";

}

export async function loadUserName(element){

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