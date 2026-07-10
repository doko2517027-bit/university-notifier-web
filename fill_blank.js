import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";

import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const firebaseConfig = {
  // ここは他のJSと同じ設定をそのまま貼る
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

}

loadQuestions();