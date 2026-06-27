import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
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

    alert(localStorage.getItem("department"));
    alert(localStorage.getItem("grade"));

    button.textContent = "登録済み";
    button.disabled = true;

    department.disabled = true;
    major.disabled = true;
    grade.disabled = true;

    alert("登録完了！");

} catch (e) {

    console.error(e);
    alert(e);

}
});

async function loadNews() {

    try {

        alert("① loadNews開始");

        const department = localStorage.getItem("department");
        const grade = localStorage.getItem("grade");

        alert(department);
        alert(grade);

        if (!department || !grade) {
            return;
        }

        let id = "";

        if (department === "看護学科") {
            id = "NS" + grade.replace("年", "");
        }

        alert("④ id=" + id);

        const snapshot = await getDoc(doc(db, "notices", id));

        alert("⑤ Firestore取得");
        alert(snapshot.exists());

        const notice = snapshot.data();

        alert(JSON.stringify(notice));
        alert(newsList);
        alert("表示します");

        newsList.innerHTML = `
            <div>
                <b>${notice.date}</b><br><br>

                ${notice.text.replace(/\n/g, "<br>")}
                <br><br>

                <a href="${notice.pdf}" target="_blank">
                    PDFを見る
                </a>
            </div>
        `;

    } catch (e) {

        alert("エラー発生");
        alert(e.message);
        console.error(e);

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