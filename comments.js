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

const params = new URLSearchParams(location.search);

const postId = params.get("postId");

const postCard = document.getElementById("postCard");

document.getElementById("backButton").onclick = () => {

    history.back();

};

async function loadPost() {

    const snap = await getDoc(
        doc(db, "posts", postId)
    );

    if (!snap.exists()) {

        postCard.innerHTML = "投稿がありません";

        return;

    }

    const post = snap.data();

    let time = "";

    if (post.createdAt) {

        const date = post.createdAt.toDate();

        time =
            `${date.getMonth() + 1}/${date.getDate()} ` +
            `${String(date.getHours()).padStart(2,"0")}:` +
            `${String(date.getMinutes()).padStart(2,"0")}`;

    }

    postCard.innerHTML = `

<div class="post-card">

    <div class="student-number">

        👤 ${post.studentNumber}

    </div>

    <div class="post-time">

        ${time}

    </div>

    <div class="post-text">

        ${post.text}

    </div>

</div>

`;

}

loadPost();