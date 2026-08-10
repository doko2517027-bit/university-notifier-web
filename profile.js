import {
    db,
    studentNumber,
    setupTheme,
    loadProfileImage,
    getProfilePhoto,
    formatDateTime,
    initializePage,
    setupOfflineAlert,
    renderPostCard,
    showToast
} from "./common.js";

import {
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    updateDoc,
    increment,
    collection,
    query,
    where,
    orderBy,
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const themeButton = document.getElementById("themeButton");
const profileImage = document.getElementById("profileImage");
const menu = document.getElementById("photoMenu");
const picker = document.getElementById("photoPicker");
const rankingNicknameInput =
    document.getElementById(
        "rankingNicknameInput"
    );

const rankingDisplayMode =
    document.getElementById(
        "rankingDisplayMode"
    );

const rankingNicknameStatus =
    document.getElementById(
        "rankingNicknameStatus"
    );

const saveRankingNicknameButton =
    document.getElementById(
        "saveRankingNicknameButton"
    );

    picker.addEventListener("change", async (e) => {

        const file = e.target.files[0];

        if (!file) return;

        if (file.size > 50 * 1024 * 1024) {

            alert("50MB以下の画像を選択してください。");

            return;

        }

        const formData = new FormData();

        formData.append("file", file);
        formData.append("upload_preset", "caremate_upload");

        const res = await fetch(
            "https://api.cloudinary.com/v1_1/vpctonjf/image/upload",
            {
                method: "POST",
                body: formData
            }
        );

        const data = await res.json();

        console.log(data);

        await Promise.all([
            updateDoc(
                doc(db, "publicUsers", studentNumber),
                {
                    photo: data.secure_url
                }
            ),
            updateDoc(
                doc(db, "users", studentNumber),
                {
                    profile: {
                        photo: data.secure_url
                    }
                }
            )
        ]);

        profileImage.src = data.secure_url;

    });

setupTheme(themeButton);

/* 先にボタン登録 */

document
.getElementById("profileImage")
.onclick = () => {
    menu.style.display = "flex";
};

document
.getElementById("backButton")
.onclick = () => {
    history.back();
};

/* その後で読み込み */

await initializePage([
    loadProfile().catch(e => {
        console.error("プロフィール取得エラー", e);
    })
]);

if (saveRankingNicknameButton) {

    saveRankingNicknameButton.onclick =
        saveRankingNicknameSettings;

}

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
.onclick = async () => {

    await Promise.all([
        updateDoc(
            doc(db, "publicUsers", studentNumber),
            {
                photo: ""
            }
        ),
        updateDoc(
            doc(db, "users", studentNumber),
            {
                profile: {
                    photo: ""
                }
            }
        )
    ]);

    profileImage.src = "images/default.png";

    menu.style.display = "none";

};

document
.getElementById("cancelPhoto")
.onclick = () => {

    menu.style.display = "none";

};

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

    const [
        snap,
        privateUserSnap,
        postSnap,
        posts
    ] = await Promise.all([

        getDoc(
            doc(
                db,
                "publicUsers",
                studentNumber
            )
        ),

        getDoc(
            doc(
                db,
                "users",
                studentNumber
            )
        ),

        getDocs(
        query(
            collection(db, "posts"),
            where("studentNumber", "==", studentNumber)
        )
    ),

    getDocs(
        collection(db, "posts")
    )

]);

if (!snap.exists()) return;

const user = snap.data();

document.getElementById("userName").textContent =
    user.name;

if (privateUserSnap.exists()) {

    renderRankingNicknameSettings(
        privateUserSnap.data()
    );

}

const photo =
    await getProfilePhoto(studentNumber);

profileImage.src = photo;

document.getElementById("postCount").textContent =
    postSnap.size;

const likeSnapshots = await Promise.all(
    posts.docs.map(post =>
        getDocs(
            collection(
                db,
                "posts",
                post.id,
                "likes"
            )
        )
    )
);

let likedCount = 0;

likeSnapshots.forEach(likeSnap => {
    likeSnap.forEach(like => {
        if (like.id === studentNumber) {
            likedCount++;
        }
    });
});

const receivedLikeSnapshots = await Promise.all(
    postSnap.docs.map(post =>
        getDocs(
            collection(
                db,
                "posts",
                post.id,
                "likes"
            )
        )
    )
);

let receivedLikes = 0;

receivedLikeSnapshots.forEach(likes => {
    receivedLikes += likes.size;
});

document.getElementById("likeCount").textContent =
    `${receivedLikes} / ${likedCount}`;

let commentCount = 0;

const commentSnapshots = await Promise.all(
    postSnap.docs.map(post =>
        getDocs(
            collection(
                db,
                "posts",
                post.id,
                "comments"
            )
        )
    )
);

commentSnapshots.forEach(commentSnap => {
    commentCount += commentSnap.size;
});

document.getElementById("commentCount").textContent =
    commentCount;

}

function renderRankingNicknameSettings(
    userData
) {

    const nickname =
        String(
            userData.rankingNickname ||
            ""
        ).trim();


    if (rankingNicknameInput) {

        rankingNicknameInput.value =
            nickname;

    }


    const mode =
        userData.rankingDisplayMode ===
            "nickname" &&
        nickname
            ? "nickname"
            : "student_number";


    if (rankingDisplayMode) {

        rankingDisplayMode.value =
            mode;

    }


    if (!rankingNicknameStatus) {
        return;
    }


    if (!nickname) {

        rankingNicknameStatus.textContent =
            `未設定・現在は学籍番号 ${studentNumber} を表示しています。`;

        return;

    }


    if (mode === "nickname") {

        rankingNicknameStatus.textContent =
            `現在のランキング表示：${nickname}`;

    } else {

        rankingNicknameStatus.textContent =
            `ニックネーム「${nickname}」は設定済みです。現在は学籍番号 ${studentNumber} を表示しています。`;

    }

}


async function saveRankingNicknameSettings() {

    const nickname =
        rankingNicknameInput
            ?.value.trim() || "";


    const mode =
        rankingDisplayMode?.value ===
            "nickname"
            ? "nickname"
            : "student_number";


    if (
        mode === "nickname" &&
        !nickname
    ) {

        alert(
            "ニックネーム表示を選択する場合は、ニックネームを入力してください。"
        );

        rankingNicknameInput
            ?.focus();

        return;

    }


    if (nickname.length > 20) {

        alert(
            "ニックネームは20文字以内で入力してください。"
        );

        return;

    }


    try {

        saveRankingNicknameButton.disabled =
            true;

        saveRankingNicknameButton.textContent =
            "保存中...";


        await updateDoc(
            doc(
                db,
                "users",
                studentNumber
            ),
            {
                rankingNickname:
                    nickname,

                rankingDisplayMode:
                    mode,

                rankingNicknamePromptCompleted:
                    true,

                rankingNicknameUpdatedAt:
                    serverTimestamp(),

                rankingNicknameUpdatedBy:
                    studentNumber
            }
        );


        renderRankingNicknameSettings({
            rankingNickname:
                nickname,

            rankingDisplayMode:
                mode
        });


        showToast(
            "ランキング表示名を保存しました"
        );


    } catch (error) {

        console.error(
            "ランキング表示名保存エラー:",
            error
        );


        alert(
            "ランキング表示名を保存できませんでした。"
        );


    } finally {

        saveRankingNicknameButton.disabled =
            false;

        saveRankingNicknameButton.textContent =
            "ランキング表示名を保存";

    }

}

document
.getElementById("myPosts")
.onclick = async () => {

    changeTab(document.getElementById("myPosts"));

    const content =
        document.getElementById("profileContent");

    content.innerHTML = "";

    const snapshot = await getDocs(

        query(
            collection(db, "posts"),
            orderBy("createdAt", "desc")
        )

    );

    const myPosts = snapshot.docs
        .filter(doc => doc.data().studentNumber === studentNumber)

    if (myPosts.length === 0) {

        content.innerHTML =
            "<p>投稿がありません。</p>";

        return;

    }

    const cards = await Promise.all(
        myPosts.map(async postDoc => {

            const post = postDoc.data();

            const [photo, likeSnap] = await Promise.all([
                getProfilePhoto(post.studentNumber),
                getDoc(
                    doc(
                        db,
                        "posts",
                        postDoc.id,
                        "likes",
                        studentNumber
                    )
                )
            ]);

            return renderPostCard({
                postId: postDoc.id,
                post,
                photo,
                time: formatDateTime(post.createdAt),
                liked: likeSnap.exists(),
                showMenu: false,
                clickable: false
            });

        })
    );

    content.innerHTML = cards.join("");

};

document
.getElementById("likedPosts")
.onclick = async () => {

    changeTab(document.getElementById("likedPosts"));

    const content = document.getElementById("profileContent");
    content.innerHTML = "";

    const snapshot = await getDocs(
        query(
            collection(db, "posts"),
            orderBy("createdAt", "desc")
        )
    );

    const likedResults = await Promise.all(
        snapshot.docs.map(async postDoc => {

            const likeSnap = await getDoc(
                doc(
                    db,
                    "posts",
                    postDoc.id,
                    "likes",
                    studentNumber
                )
            );

            return {
                postDoc,
                liked: likeSnap.exists()
            };

        })
    );

    const likedPosts = likedResults
        .filter(item => item.liked)
        .map(item => item.postDoc);

    if (likedPosts.length === 0) {
        content.innerHTML = "<p>いいねした投稿はありません。</p>";
        return;
    }

    const cards = await Promise.all(
        likedPosts.map(async postDoc => {

            const post = postDoc.data();

            const photo =
                await getProfilePhoto(post.studentNumber);

            return renderPostCard({
                postId: postDoc.id,
                post,
                photo,
                time: formatDateTime(post.createdAt),
                liked: true,
                showMenu: false,
                clickable: false
            });

        })
    );

    content.innerHTML = cards.join("");

};

document
.getElementById("myComments")
.onclick = async () => {

    changeTab(document.getElementById("myComments"));

    const content =
        document.getElementById("profileContent");

    content.innerHTML = "";

    const snapshot = await getDocs(
        query(
            collection(db, "posts"),
            orderBy("createdAt", "desc")
        )
    );

    const myComments = [];

    for (const postDoc of snapshot.docs) {

        const commentSnap = await getDocs(
            collection(
                db,
                "posts",
                postDoc.id,
                "comments"
            )
        );

        commentSnap.forEach(commentDoc => {

            const comment = commentDoc.data();

            if (comment.studentNumber === studentNumber) {
                myComments.push({
                    postId: postDoc.id,
                    post: postDoc.data(),
                    comment
                });
            }

        });

    }

    if (myComments.length === 0) {
        content.innerHTML = "<p>コメントした投稿はありません。</p>";
        return;
    }

    let html = "";

    myComments.forEach(item => {

        html += `

    <div class="card post-card"
        onclick="location.href='comments.html?postId=${item.postId}'">

        <div class="post-time">
            コメント先：${item.post.studentNumber}
        </div>

        <div class="post-text">
            ${item.comment.text}
        </div>

        <div class="news-link">
            💬 コメント画面を開く
        </div>

    </div>

    `;

    });

    content.innerHTML = html;

};

document.addEventListener("click", async (e)=>{

    const pdf = e.target.closest(".post-pdf");

    if (pdf) {

        window.open(pdf.dataset.url, "_blank");

        return;

    }

    const image = e.target.closest(".post-image");

    if (image) {

        window.open(image.dataset.url, "_blank");

    }

    if (e.target.classList.contains("comment-button")) {
        location.href = `comments.html?postId=${e.target.dataset.id}`;
        return;
    }

    if (e.target.classList.contains("like-button")) {
        const postId = e.target.dataset.id;

        const likeRef = doc(db, "posts", postId, "likes", studentNumber);
        const postRef = doc(db, "posts", postId);

        const countSpan = e.target.nextElementSibling;
        const count = Number(countSpan.textContent);
        const wasLiked = e.target.classList.contains("liked");

        if (wasLiked) {
            e.target.textContent = "🤍";
            e.target.classList.remove("liked");
            countSpan.textContent = count - 1;

            await deleteDoc(likeRef);
            await updateDoc(postRef, {
                likeCount: increment(-1)
            });
        } else {
            e.target.textContent = "❤️";
            e.target.classList.add("liked");
            countSpan.textContent = count + 1;

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

        return;
    }

});