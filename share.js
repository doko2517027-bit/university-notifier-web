import {
    db,
    studentNumber,
    setupTheme,
    loadProfileImage,
    loadUserName,
    initializePage,
    showPostSkeleton,
    formatDateTime
} from "./common.js";

import {
    
    collection,
    query,
    orderBy,
    getDocs,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    updateDoc,
    onSnapshot,
    increment
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const themeButton = document.getElementById("themeButton");
const userName = document.getElementById("userName");
const postList = document.getElementById("postList");
if(postList){
    showPostSkeleton(postList);
}
const topProfileImage = document.getElementById("topProfileImage");


setupTheme(themeButton);

await initializePage([

    loadUserName(userName),
    loadProfileImage(topProfileImage),
    loadPosts()

]);

function renderPost(postDoc, liked) {

    const post = postDoc.data();

    const time =
        formatDateTime(post.createdAt);

    return `

<div class="card post-card">

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

    <div class="post-text">

        ${post.text}

    </div>

    ${post.type === "image" ? `

    <img
        src="${post.imageUrl}"
        class="post-image">

    ` : ""}

    ${post.type === "pdf" ? `

    <div
        class="post-pdf"
        data-url="${post.pdfUrl}">

        📄 ${post.pdfName}

    </div>

    ` : ""}

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

}

async function loadPosts() {

    postList.innerHTML = "";

    const q = query(
        collection(db, "posts"),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, async (snapshot) => {

        postList.innerHTML = "";

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

        const time =
            formatDateTime(post.createdAt);

        postList.innerHTML += renderPost(postDoc, liked);

    };

    });

}

document.addEventListener("click", async (e) => {

    if (e.target.classList.contains("post-pdf")) {

        const url = e.target.dataset.url;

        window.open(url);

        return;

    }

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

    const countSpan = e.target.nextElementSibling;

    let count = Number(countSpan.textContent);

    const wasLiked = e.target.classList.contains("liked");

    // 画面を先に更新
    if (wasLiked) {

        e.target.textContent = "🤍";
        e.target.classList.remove("liked");
        countSpan.textContent = count - 1;

    } else {

        e.target.textContent = "❤️";
        e.target.classList.add("liked");
        countSpan.textContent = count + 1;

        const heart = document.createElement("div");

        heart.textContent = "❤️";

        heart.className = "floating-heart";

        e.target.closest(".post-card").appendChild(heart);

        setTimeout(() => {

            heart.remove();

        },700);

        e.target.classList.add("animate");

        setTimeout(() => {

            e.target.classList.remove("animate");

        },200);

    }

    const likeSnap = await getDoc(likeRef);

    if (likeSnap.exists()) {

        await deleteDoc(likeRef);

        await updateDoc(postRef, {
            likeCount: increment(-1)
        });

    } else {

        await setDoc(likeRef, {
            likedAt: new Date()
        });

        await updateDoc(postRef, {
            likeCount: increment(1)
        });

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

document
.getElementById("profileButton")
.onclick = () => {

    location.href = "profile.html";

};