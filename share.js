import {
    db,
    studentNumber,
    setupTheme,
    loadProfileImage,
    loadUserName,
    initializePage,
    showPostSkeleton,
    formatDateTime,
    getProfilePhoto,
    setupAdminTab
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

const postMenu =
    document.getElementById("postMenu");

const deletePost =
    document.getElementById("deletePost");

const reportPost =
    document.getElementById("reportPost");

let selectedPostId = "";
const themeButton = document.getElementById("themeButton");
const userName = document.getElementById("userName");
const postList = document.getElementById("postList");
if(postList){
    showPostSkeleton(postList);
}
const topProfileImage = document.getElementById("topProfileImage");


setupTheme(themeButton);

await initializePage([

	setupAdminTab(),
    loadUserName(userName),
    loadProfileImage(topProfileImage),
    loadPosts()

]);

async function renderPost(postDoc, liked) {

    const post = postDoc.data();

    const photo =
        await getProfilePhoto(post.studentNumber);

    const time =
        formatDateTime(post.createdAt);

    return `

<div class="card post-card">

    <div class="post-header">

        <div>

            <div class="student-number">

                <img
                    src="${photo}"
                    class="top-profile-image">

                ${post.studentNumber}

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

    

    ${post.images?.length ? `

    <div class="post-images">

        ${post.images.map(image => `

        <img
            src="${image.url}"
            class="post-image"
            data-url="${image.url}">

        `).join("")}

    </div>

    ` : ""}

    ${post.pdfs?.length ? `

    ${post.pdfs.map(pdf => `

    <div
        class="post-pdf"
        data-url="${pdf.url}">

        <div class="pdf-title">

            📄 ${pdf.name}

        </div>

        <div class="pdf-subtitle">

            タップして開く

        </div>

    </div>

    `).join("")}

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

        postList.innerHTML +=
            await renderPost(postDoc, liked);

    };

    });

}

document.addEventListener("click", async (e) => {

    const pdf = e.target.closest(".post-pdf");

    if (pdf) {

        window.open(pdf.dataset.url, "_blank");

        return;

    }

    const image = e.target.closest(".post-image");

    if (image) {

        window.open(image.dataset.url, "_blank");

        return;

    }

    // コメント
    if (e.target.classList.contains("comment-button")) {

        const postId = e.target.dataset.id;

        location.href = `comments.html?postId=${postId}`;

        return;

    }

    // 投稿削除・通報
    if (e.target.classList.contains("delete-button")) {

        selectedPostId =
            e.target.dataset.id;

        postMenu.style.display = "flex";

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

document
.getElementById("cancelPostMenu")
.onclick = () => {

    postMenu.style.display = "none";

};

deletePost.onclick = async () => {

    const ok =
        confirm("投稿を削除しますか？");

    if (!ok) return;

    await deleteDoc(
        doc(db,"posts",selectedPostId)
    );

    postMenu.style.display = "none";

};

reportPost.onclick = () => {

    alert("通報機能は準備中です。");

};