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

const devSnap = await getDoc(
    doc(db, "developers", studentNumber)
);

if (
    devSnap.exists() &&
    devSnap.data().enabled
) {

    location.href = "index.html";
    return;

}

const snap = await getDoc(doc(db, "system", "app"));

if (snap.exists()) {

    const data = snap.data();

    if (data.message) {
        message.innerHTML = data.message.replace(/\n/g, "<br>");
    }

    if (!data.maintenance) {
        location.href = "index.html";
    }

}