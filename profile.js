import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getFirestore,
    doc,
    getDoc,
    collection,
    query,
    where,
    orderBy,
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

const themeButton = document.getElementById("themeButton");
const studentNumber = localStorage.getItem("studentNumber");

setupTheme();

async function loadProfile() {

    document.getElementById("studentNumber").textContent =
        studentNumber;

    const snap = await getDoc(
        doc(db, "publicUsers", studentNumber)
    );

    if (!snap.exists()) return;

    const user = snap.data();

    document.getElementById("userName").textContent =
        user.name;
        
        const postSnap = await getDocs(

    query(

        collection(db, "posts"),

        where("studentNumber", "==", studentNumber)

    )

);

document.getElementById("postCount").textContent =
    postSnap.size;



let likedCount = 0;

const posts = await getDocs(
    collection(db, "posts")
);

for (const post of posts.docs) {

    const likeSnap = await getDocs(
        collection(
            db,
            "posts",
            post.id,
            "likes"
        )
    );

    likeSnap.forEach((like) => {

        if (like.id === studentNumber) {

            likedCount++;

        }

    });

}

let receivedLikes = 0;

for (const post of postSnap.docs) {

    const likes = await getDocs(
        collection(
            db,
            "posts",
            post.id,
            "likes"
        )
    );

    receivedLikes += likes.size;

}

document.getElementById("likeCount").textContent =
    `${receivedLikes} / ${likedCount}`;

}

loadProfile();

document
    .getElementById("backButton")
    .onclick = () => {

    history.back();

};

document
    .getElementById("profileImage")
    .onclick = () => {

    alert(
`プロフィール画像

📷 写真を変更

👤 初期アイコンに戻す

※現在準備中`
    );

};

document
.getElementById("myPosts")
.onclick = async () => {

    const content =
        document.getElementById("profileContent");

    content.innerHTML = "";

    const q = query(

        collection(db, "posts"),

        where("studentNumber", "==", studentNumber),

        orderBy("createdAt", "desc")

    );

    const snapshot = await getDocs(q);

    snapshot.forEach((postDoc) => {

        const post = postDoc.data();

        content.innerHTML += `

<div class="post-card">

    <div class="student-number">

        👤 ${post.studentNumber}

    </div>

    <div class="post-text">

        ${post.text}

    </div>

</div>

`;

    });

};

document
.getElementById("likedPosts")
.onclick = () => {

    document.getElementById("profileContent")
    .innerHTML =
    "<p>いいねした投稿を表示します。</p>";

};

document
.getElementById("myComments")
.onclick = () => {

    document.getElementById("profileContent")
    .innerHTML =
    "<p>コメントした投稿を表示します。</p>";

};

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