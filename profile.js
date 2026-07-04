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

const menu =
    document.getElementById("photoMenu");

const picker =
    document.getElementById("photoPicker");

    picker.addEventListener("change", (e) => {

        const file = e.target.files[0];

        if (!file) return;

        const reader = new FileReader();

        reader.onload = () => {

            document
                .getElementById("profileImage")
                .src = reader.result;

            localStorage.setItem(
                "profileImage",
                reader.result
            );

        };

        reader.readAsDataURL(file);

    });

document
.getElementById("profileImage")
.onclick = () => {

    menu.style.display = "flex";

};

document
.getElementById("choosePhoto")
.onclick = () => {

    picker.removeAttribute("capture");

    picker.click();

    menu.style.display = "none";

};

document
.getElementById("takePhoto")
.onclick = () => {

    picker.setAttribute("capture","environment");

    picker.click();

    menu.style.display = "none";

};

document
.getElementById("resetPhoto")
.onclick = () => {

    localStorage.removeItem("profileImage");

    document
        .getElementById("profileImage")
        .src = "images/default.png";

    menu.style.display = "none";

};

document
.getElementById("cancelPhoto")
.onclick = () => {

    menu.style.display = "none";

};

setupTheme();

function changeTab(button){

    document
    .querySelectorAll(".profile-tabs button")
    .forEach(btn=>{

        btn.classList.remove("active");

    });

    button.classList.add("active");

}

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

const savedImage =
    localStorage.getItem("profileImage");

if (savedImage) {

    document
        .getElementById("profileImage")
        .src = savedImage;

}

loadProfile();

document
    .getElementById("backButton")
    .onclick = () => {

    history.back();

};

document
.getElementById("myPosts")
.onclick = async () => {

    changeTab(document.getElementById("myPosts"));

    const content =
        document.getElementById("profileContent");

    content.innerHTML = "";

    const snapshot = await getDocs(collection(db, "posts"));

    const myPosts = snapshot.docs
        .filter(doc => doc.data().studentNumber === studentNumber)
        .sort((a, b) =>
            b.data().createdAt.toMillis() - a.data().createdAt.toMillis()
        );

    if (myPosts.length === 0) {

        content.innerHTML =
            "<p>投稿がありません。</p>";

        return;

    }

    myPosts.forEach((postDoc) => {

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

    changeTab(document.getElementById("likedPosts"));

    document.getElementById("profileContent")
    .innerHTML =
    "<p>いいねした投稿を表示します。</p>";

};

document
.getElementById("myComments")
.onclick = () => {

    changeTab(document.getElementById("myComments"));

    document.getElementById("profileContent")
    .innerHTML =
    "<p>コメントした投稿を表示します。</p>";

};

function setupTheme() {

    if (localStorage.getItem("theme") === "dark") {

        document.documentElement.classList.add("dark");
        themeButton.textContent = "☀️";

    } else {

        themeButton.textContent = "🌙";

    }

    themeButton.addEventListener("click", () => {

        document.documentElement.classList.toggle("dark");

        if (document.documentElement.classList.contains("dark")) {

            localStorage.setItem("theme","dark");
            themeButton.textContent="☀️";

        } else {

            localStorage.setItem("theme","light");
            themeButton.textContent="🌙";

        }

    });

}