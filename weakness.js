import {
    setupTheme,
    initializePage,
    loadProfileImage
} from "./common.js";

const themeButton = document.getElementById("themeButton");
const topProfileImage = document.getElementById("topProfileImage");

setupTheme(themeButton);

await initializePage([
    loadProfileImage(topProfileImage)
]);

document.getElementById("backButton").onclick = () => {
    history.back();
};

document.getElementById("profileButton").onclick = () => {
    location.href = "profile.html";
};