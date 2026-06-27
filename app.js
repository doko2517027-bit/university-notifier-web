import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc
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

const button = document.getElementById("subscribe");

button.addEventListener("click", async () => {

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
        alert("通知が拒否されました");
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

   const department = prompt("学科を入力してください\n例：看護1年");

try {

    await setDoc(
        doc(db, "users", subscription.endpoint.replace(/\//g, "_")),
        {
            department: department,
            subscription: JSON.parse(JSON.stringify(subscription))
        }
    );

    alert("登録完了！");

} catch (e) {

    console.error(e);
    alert(e);

}
});

function urlBase64ToUint8Array(base64String) {

    const padding = "=".repeat((4 - base64String.length % 4) % 4);

    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = atob(base64);

    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));

}