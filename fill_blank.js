import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";

import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

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

const params = new URLSearchParams(location.search);

const subjectId = params.get("subjectId");
const unitId = params.get("unitId");

async function loadQuestions() {

    const ref = doc(
        db,
        "examSubjects",
        subjectId,
        "units",
        unitId,
        "ai",
        "generated"
    );

    const snap = await getDoc(ref);

    if (!snap.exists()) {
        alert("AI問題がありません");
        return;
    }

    const data = snap.data();

    console.log(data);

    const container = document.getElementById("questions");

    console.log(container);
    console.log(data.fill_blank);

    data.fill_blank.forEach((q, index) => {

        console.log(q);

        container.innerHTML += `
            <div style="border:1px solid #ccc;padding:15px;margin:15px;border-radius:10px;background:white;color:black;">
                <h3>問題 ${index + 1}</h3>
                <p>${q.question}</p>
                <button>答え：${q.answer}</button>
            </div>
        `;

    });

}

loadQuestions().finally(() => {
    document.body.classList.remove("page-loading");
});