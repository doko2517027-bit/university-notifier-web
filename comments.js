import {
    db,
    studentNumber,
    setupTheme,
    loadProfileImage,
    initializePage,
    formatDateTime,
    getProfilePhoto
} from "./common.js";

import {
    doc,
    getDoc,
    collection,
    query,
    orderBy,
    getDocs,
    addDoc,
    serverTimestamp,
    updateDoc,
    increment,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const commentText = document.getElementById("commentText");
const sendComment = document.getElementById("sendComment");
const commentList = document.getElementById("commentList");
const params = new URLSearchParams(location.search);
const postId = params.get("postId");
const postCard = document.getElementById("postCard");
const themeButton = document.getElementById("themeButton");
const topProfileImage = document.getElementById("topProfileImage");

setupTheme(themeButton);

await initializePage([

    loadProfileImage(topProfileImage),
    loadPost(),
    loadComments()

]);

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

    const photo =
        await getProfilePhoto(post.studentNumber);

    const time =
        formatDateTime(post.createdAt);

postCard.innerHTML = `

<div class="card post-card">

    <div class="student-number">

        <img
            src="${photo}"
            class="top-profile-image">

        ${post.studentNumber}

    </div>

    <div class="post-time">

        ${time}

    </div>

    <div class="post-text">

        ${post.text}

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

    </div>

</div>

`;

}

async function loadComments() {

    commentList.innerHTML = "";

    const q = query(
        collection(
            db,
            "posts",
            postId,
            "comments"
        ),
        orderBy("createdAt", "asc")
    );

    const snapshot = await getDocs(q);

    for (const commentDoc of snapshot.docs) {

        const comment = commentDoc.data();

        const photo =
            await getProfilePhoto(comment.studentNumber);

        const time =
            formatDateTime(comment.createdAt);

        commentList.innerHTML += `

<div class="card post-card">

    <div class="post-header">

        <div>

            <div class="student-number">

                <img
                    src="${photo}"
                    class="top-profile-image">

                ${comment.studentNumber}

            </div>

            <div class="post-time">

                ${time}

            </div>

        </div>

        ${comment.studentNumber === studentNumber ? `

        <button
            class="delete-comment"
            data-id="${commentDoc.id}">
            ⋯
        </button>

        ` : ""}

    </div>

    <div class="post-text">

        ${comment.text}

    </div>

</div>

`;

    }

}

sendComment.onclick = async () => {

    const text = commentText.value.trim();

    if (!text) return;

    try{

        await addDoc(

            collection(
                db,
                "posts",
                postId,
                "comments"
            ),

            {

                studentNumber,

                text,

                createdAt: serverTimestamp()

            }

        );

        await updateDoc(

            doc(db,"posts",postId),

            {

                commentCount: increment(1)

            }

        );

        commentText.value = "";

        await loadComments();

    } catch (e) {

        console.error(e);
        
        alert("コメントの投稿に失敗しました。")
    }

};

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

    if (!e.target.classList.contains("delete-comment")) return;

    const ok = confirm("コメントを削除しますか？");

    if (!ok) return;

    const commentId = e.target.dataset.id;

    await deleteDoc(

        doc(
            db,
            "posts",
            postId,
            "comments",
            commentId
        )

    );

    await updateDoc(
        doc(db,"posts",postId),
        {
            commentCount: increment(-1)
        }
    );

    await loadComments();

});

document
.getElementById("profileButton")
.onclick = () => {

    location.href = "profile.html";

};