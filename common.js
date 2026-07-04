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

    const snap=await getDoc(
        doc(
            db,
            "publicUsers",
            studentNumber
        )
    );

    if(!snap.exists()) return;

    const user=snap.data();

    img.src=user.photo || "images/default.png";

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