import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getFirestore,
    doc,
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
const db = getFirestore(app);

const userName = document.getElementById("userName");
const themeButton = document.getElementById("themeButton");
const card = document.querySelector(".setting-card");

const studentNumber = localStorage.getItem("studentNumber");

loadUserName();
loadNews();
setupTheme();

async function loadUserName() {

    const snap = await getDoc(
        doc(db, "publicUsers", studentNumber)
    );

    if (!snap.exists()) {
        userName.textContent = "Unknownさん";
        return;
    }

    userName.textContent = snap.data().name + "さん";

}

async function loadNews() {

    const department = localStorage.getItem("department");
    const major = localStorage.getItem("major");
    const grade = localStorage.getItem("grade");

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

    if (snapshot.empty) {

        card.innerHTML = "お知らせはありません。";
        return;

    }

    const notices = [];

    snapshot.forEach(doc => {

        notices.push(doc.data());

    });

    notices.sort((a, b) =>
        b.postedAt.seconds - a.postedAt.seconds
    );

    card.innerHTML = "";

    notices.forEach(notice => {

        const posted = notice.postedAt.toDate();

        card.innerHTML += `
            <div style="margin-bottom:20px;">

                <b>
                    ${posted.getFullYear()}/${posted.getMonth()+1}/${posted.getDate()}
                </b>

                <br><br>

                ${notice.body.replace(/\n/g,"<br>")}

                <br><br>

                <a href="${notice.pdf}" target="_blank">
                    PDFを見る
                </a>

                <hr>

            </div>
        `;

    });

}

function setupTheme() {

    if (localStorage.getItem("theme") === "dark") {

        document.body.classList.add("dark");
        themeButton.textContent = "☀️";

    } else {

        themeButton.textContent = "🌙";

    }

    themeButton.addEventListener("click", () => {

        document.body.classList.toggle("dark");

        if (document.body.classList.contains("dark")) {

            localStorage.setItem("theme", "dark");
            themeButton.textContent = "☀️";

        } else {

            localStorage.setItem("theme", "light");
            themeButton.textContent = "🌙";

        }

    });

}