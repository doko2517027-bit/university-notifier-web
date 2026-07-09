import {
    db,
    studentNumber,
    setupTheme,
    initializePage,
    loadProfileImage,
    isAdmin
} from "./common.js";

const themeButton =
    document.getElementById("themeButton");

const topProfileImage =
    document.getElementById("topProfileImage");

setupTheme(themeButton);

const admin = await isAdmin();

if (!admin) {

    alert("管理者のみアクセスできます。");

    location.href = "index.html";

}

await initializePage([
    loadProfileImage(topProfileImage)
]);

document
.getElementById("backButton")
.onclick = () => {

    location.href = "admin.html";

};

document
.getElementById("profileButton")
.onclick = () => {

    location.href = "profile.html";

};