import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
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
const PUBLIC_KEY = "BJk2fKTmfe7AZuXjW-IGMDyis_zN0iZ1B0oiG5MVefZ4n3W9mrBu-xBiWYjG_V6U2b5sGMuVXvKTbrwRKXSAiUs";

const department = document.getElementById("department");
const major = document.getElementById("major");
const grade = document.getElementById("grade");
const button = document.getElementById("subscribe");
const newsList = document.getElementById("newsList");
const registered = localStorage.getItem("registered");

if (registered === "true") {

    department.value = localStorage.getItem("department");
    major.value = localStorage.getItem("major");
    grade.value = localStorage.getItem("grade");

    department.disabled = true;
    major.disabled = true;
    grade.disabled = true;

    button.textContent = "登録済み";
    button.disabled = true;

}

department.addEventListener("change", () => {

    if (department.value !== "") {
        major.value = "";
    }

    updateState();

});

major.addEventListener("change", () => {

    if (major.value !== "") {
        department.value = "";
    }

    updateState();

});

grade.addEventListener("change", () => {

    updateState();

});

updateState();
loadNews();

function updateState() {

    if (registered === "true") {
        return;
    }

    const selected =
        department.value !== "" ||
        major.value !== "";

    grade.disabled = !selected;

    if (!selected) {
        grade.value = "";
    }

    button.disabled =
        !selected ||
        grade.value === "";

}

button.addEventListener("click", async () => {

    const permission = await Notification.requestPermission();

if (permission !== "granted") {

    alert(
        "通知が拒否されています。\n\n設定 → 通知 → University Notifier から通知を許可してください。"
    );

    return;
}

    const registration = await navigator.serviceWorker.register("sw.js");

    await navigator.serviceWorker.ready;

    const subscription =

        await registration.pushManager.getSubscription() ||
        await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY)
        });

	const selectedDepartment = department.value;
	const selectedMajor = major.value;
	const selectedGrade = grade.value;

try {

    await setDoc(
        doc(db, "users", subscription.endpoint.replace(/\//g, "_")),
        {
    		department: selectedDepartment,
   		major: selectedMajor,
   		grade: selectedGrade,
   		subscription: JSON.parse(JSON.stringify(subscription))
	}
    );

    localStorage.setItem("registered", "true");
    localStorage.setItem("department", selectedDepartment);
    localStorage.setItem("major", selectedMajor);
    localStorage.setItem("grade", selectedGrade);

    button.textContent = "登録済み";
    button.disabled = true;

    department.disabled = true;
    major.disabled = true;
    grade.disabled = true;

    alert("登録が完了しました。一度アプリを終了してください。");

} catch (e) {

    console.error(e);
    alert(e);

}
});

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

        notices.forEach((notice) => {
            let postedText = "";

            if (notice.postedAt) {

                const posted = notice.postedAt.toDate();

                postedText =
                    `${posted.getFullYear()}/` +
                    `${posted.getMonth() + 1}/` +
                    `${posted.getDate()} ` +
                    `${String(posted.getHours()).padStart(2, "0")}:` +
                    `${String(posted.getMinutes()).padStart(2, "0")}`;

            } else {

                postedText = notice.date;

            }

            newsList.innerHTML += `
                <div style="margin-bottom:20px;">
                    <b>${postedText}</b>

                    ${notice.body.replace(/\n/g, "<br>")}
                    <br><br>

                    <a href="${notice.pdf}" target="_blank">
                        PDFを見る
                    </a>
                </div>
                <hr>
            `;
        });

    } catch (e) {
        console.error("エラー:", e);
        alert(e);

    }
}

function urlBase64ToUint8Array(base64String) {

    const padding = "=".repeat((4 - base64String.length % 4) % 4);

    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = atob(base64);

    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));

}

const themeButton = document.getElementById("themeButton");

// 前回の設定を読み込む
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

const splash = document.getElementById("splash");

splash.style.display = "flex";

setTimeout(() => {

    splash.classList.add("hide");

    setTimeout(() => {
        splash.style.display = "none";
    }, 500);

}, 1200);