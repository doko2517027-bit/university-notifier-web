import {
    db,
    studentNumber,
    setupTheme,
    loadProfileImage
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

    snapshot.forEach((commentDoc) => {

        const comment = commentDoc.data();

        let time = "";

        if (comment.createdAt) {

            const date = comment.createdAt.toDate();

            time =
                `${date.getMonth() + 1}/${date.getDate()} ` +
                `${String(date.getHours()).padStart(2,"0")}:` +
                `${String(date.getMinutes()).padStart(2,"0")}`;

        }

        commentList.innerHTML += `

<div class="post-card">

    <div class="post-header">

        <div>

            <div class="student-number">

                👤 ${comment.studentNumber}

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

    });

}

sendComment.onclick = async () => {

    const text = commentText.value.trim();

    if (!text) return;

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

};

document.addEventListener("click", async (e) => {

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