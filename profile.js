import {
    db,
    studentNumber,
    setupTheme,
    loadProfileImage,
    getProfilePhoto,
    formatDateTime,
    initializePage,
    setupOfflineAlert,
    renderPostCard
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
    getDocs
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const themeButton = document.getElementById("themeButton");
const profileImage = document.getElementById("profileImage");
const menu = document.getElementById("photoMenu");
const picker = document.getElementById("photoPicker");

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

    const [snap, postSnap, posts] = await Promise.all([

    getDoc(
        doc(db, "publicUsers", studentNumber)
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

const photo =
    await getProfilePhoto(studentNumber);

profileImage.src = photo;

document.getElementById("postCount").textContent =
    postSnap.size;

let likedCount = 0;

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

    for (const postDoc of myPosts) {

        const post = postDoc.data();

        const photo =
            await getProfilePhoto(post.studentNumber);

        const time =
            formatDateTime(post.createdAt);

        const likeSnap = await getDoc(
            doc(
                db,
                "posts",
                postDoc.id,
                "likes",
                studentNumber
            )
        );

        content.innerHTML += renderPostCard({
            postId: postDoc.id,
            post,
            photo,
            time,
            liked: likeSnap.exists(),
            showMenu: false,
            clickable: false
        });

    };

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

    const likedPosts = [];

    for (const postDoc of snapshot.docs) {

        const likeSnap = await getDoc(
            doc(db, "posts", postDoc.id, "likes", studentNumber)
        );

        if (likeSnap.exists()) {
            likedPosts.push(postDoc);
        }

    }

    if (likedPosts.length === 0) {
        content.innerHTML = "<p>いいねした投稿はありません。</p>";
        return;
    }

    for (const postDoc of likedPosts) {

        const post = postDoc.data();
        const photo = await getProfilePhoto(post.studentNumber);
        const time = formatDateTime(post.createdAt);

        content.innerHTML += `

<div class="card post-card"
    onclick="location.href='comments.html?postId=${postDoc.id}'">

    <div class="student-number">
        <img src="${photo}" class="top-profile-image">
        ${post.studentNumber}
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

};

document
.getElementById("myComments")
.onclick = () => {

    changeTab(document.getElementById("myComments"));

    document.getElementById("profileContent")
    .innerHTML =
    "<p>コメントした投稿を表示します。</p>";

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