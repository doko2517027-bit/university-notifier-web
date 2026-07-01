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
const db = getFirestore(app);

const message = document.getElementById("message");

const studentNumber =
    localStorage.getItem("studentNumber");

console.log("student:", studentNumber);

let devSnap;
let snap;

try {

    devSnap = await getDoc(
        doc(db, "developers", studentNumber)
    );

    console.log("developers OK", devSnap.exists());

} catch (e) {

    console.log("developers NG", e);

}

try {

    snap = await getDoc(
        doc(db, "system", "app")
    );

    console.log("system/app OK", snap.exists());

} catch (e) {

    console.log("system/app NG", e);

}

if (
    devSnap &&
    devSnap.exists() &&
    devSnap.data().enabled
) {

    location.href = "index.html";

} else if (snap && snap.exists()) {

    const data = snap.data();

    if (data.message) {
        message.innerHTML =
            data.message.replace(/\n/g, "<br>");
    }

    if (!data.maintenance) {
        location.href = "index.html";
    }

}

if (snap && snap.exists()) {

    const data = snap.data();

    if (data.message) {
        message.innerHTML =
            data.message.replace(/\n/g, "<br>");
    }

    if (!data.maintenance) {
        location.href = "index.html";
    }

}