import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getFirestore,
    collection,
    query,
    orderBy,
    getDocs,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    updateDoc,
    increment
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

const studentNumber = localStorage.getItem("studentNumber");

const postList = document.getElementById("postList");

async function loadPosts() {

    postList.innerHTML = "";

    const q = query(
        collection(db, "posts"),
        orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);

    for (const postDoc of snapshot.docs) {

        const post = postDoc.data();

        const likeRef = doc(
            db,
            "posts",
            postDoc.id,
            "likes",
            studentNumber
        );

        let liked = false;

        try {

            const likeSnap = await getDoc(likeRef);

            liked = likeSnap.exists();

        } catch (e) {

            console.error(e);

        }

        let time = "";

        if (post.createdAt) {

            const date = post.createdAt.toDate();

            time =
                `${date.getMonth() + 1}/${date.getDate()} ` +
                `${String(date.getHours()).padStart(2, "0")}:` +
                `${String(date.getMinutes()).padStart(2, "0")}`;

        }

        postList.innerHTML += `

<div class="post-card">

    <div class="post-header">

        <div>

            <div class="student-number">
                👤 ${post.studentNumber}
            </div>

            <div class="post-time">
                ${time}
            </div>

        </div>

        ${post.studentNumber === studentNumber ? `
            <button
                class="delete-button"
                data-id="${postDoc.id}">
                ⋯
            </button>
        ` : ""}

    </div>

    <div
        class="post-text"
        data-id="${postDoc.id}">

        ${post.text}

    </div>

    <div class="post-footer">

    <button
        class="like-button ${liked ? "liked" : ""}"
        data-id="${postDoc.id}">
        ${liked ? "❤️" : "🤍"}
    </button>

    <span class="like-count">

    ${post.likeCount ?? 0}

    </span>

    <button
        class="comment-button"
        data-id="${postDoc.id}">

        💬

    </button>

    <span>

    ${post.commentCount ?? 0}

    </span>

    </div>

</div>

`;

    };

}

loadPosts();

document.addEventListener("click", async (e) => {

    // コメント
    if (e.target.classList.contains("comment-button")) {

        const postId = e.target.dataset.id;

        location.href = `comments.html?postId=${postId}`;

        return;

    }

    // 投稿削除
    if (e.target.classList.contains("delete-button")) {

        const postId = e.target.dataset.id;

        const ok = confirm("この投稿を削除しますか？");

        if (!ok) return;

        await deleteDoc(doc(db, "posts", postId));

        loadPosts();

        return;

    }

    // いいね以外は終了
    if (!e.target.classList.contains("like-button")) return;

    const postId = e.target.dataset.id;

    const likeRef = doc(
        db,
        "posts",
        postId,
        "likes",
        studentNumber
    );

    const postRef = doc(
        db,
        "posts",
        postId
    );

    const likeSnap = await getDoc(likeRef);

    const countSpan = e.target.nextElementSibling;

    let count = Number(countSpan.textContent);

    if (likeSnap.exists()) {

        e.target.textContent = "🤍";

        countSpan.textContent = count - 1;

        e.target.classList.remove("liked");

        await deleteDoc(likeRef);

        await updateDoc(postRef, {
            likeCount: increment(-1)
        });

    } else {

        e.target.textContent = "❤️";

        countSpan.textContent = count + 1;

        e.target.classList.add("liked");

        await setDoc(likeRef, {
            likedAt: new Date()
        });

        await updateDoc(postRef, {
            likeCount: increment(1)
        });

        const heart = document.createElement("div");

        heart.textContent = "❤️";

        heart.className = "floating-heart";

        e.target.closest(".post-card").appendChild(heart);

        setTimeout(() => {

            heart.remove();

        }, 700);

        e.target.classList.add("animate");

        setTimeout(() => {

            e.target.classList.remove("animate");

        }, 200);

    }

});

let lastTap = 0;

document.addEventListener("click", (e) => {

    if (!e.target.classList.contains("post-text")) return;

    const now = Date.now();

    if (now - lastTap < 300) {

        const button = e.target
            .closest(".post-card")
            .querySelector(".like-button");

        button.click();

    }

    lastTap = now;

});