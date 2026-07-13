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
    setupAdminTab,
    setupOfflineAlert,
    renderPostCard,
    updateAssignmentNavBadge
} from "./common.js";

import {
    collection,
    query,
    orderBy,
    limit,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    updateDoc,
    onSnapshot,
    increment,
    addDoc
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

await checkManabaVerified();

async function checkManabaVerified() {

    const snap = await getDoc(
        doc(db, "users", studentNumber)
    );

    if (
        !snap.exists() ||
        snap.data().manabaVerified !== true
    ) {
        alert("共有機能はManaba認証後に利用できます。");
        location.href = "index.html";
    }

}

await initializePage([

    setupAdminTab(),
    loadUserName(userName),
    loadProfileImage(topProfileImage),
    loadPosts(),
    updateAssignmentNavBadge()

]);

async function renderPost(postDoc, liked) {

    const post = postDoc.data();

    const photo =
        await getProfilePhoto(post.studentNumber);

    const time =
        formatDateTime(post.createdAt);

    return renderPostCard({
        postId: postDoc.id,
        post,
        photo,
        time,
        liked,
        showMenu: true,
        clickable: false
    });

}

async function loadPosts() {

    postList.innerHTML = "";

    const q = query(
        collection(db, "posts"),
        orderBy("createdAt", "desc"),
        limit(20)
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
            likedAt: new Date(),
            studentNumber,
            notificationType: "like",
            notificationSentAt: null
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

reportPost.onclick = async () => {

    const reason = prompt(
        "通報理由を入力してください。"
    );

    if (!reason) return;

    const postSnap = await getDoc(
        doc(db, "posts", selectedPostId)
    );

    if (!postSnap.exists()) {
        alert("投稿が見つかりません。");
        return;
    }

    const post = postSnap.data();

    await addDoc(
        collection(db, "reports"),
        {
            type: "post",
            postId: selectedPostId,
            targetStudentNumber: post.studentNumber,
            reporterStudentNumber: studentNumber,
            reason,
            status: "open",
            createdAt: new Date()
        }
    );

    postMenu.style.display = "none";

    alert("通報しました。");

};