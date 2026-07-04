import {
    db,
    studentNumber,
    setupTheme,
    loadProfileImage,
    initializePage,
    showToast
} from "./common.js";

import {
  
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const themeButton = document.getElementById("themeButton");
const button = document.getElementById("postButton");
const topProfileImage = document.getElementById("topProfileImage");
const selectImage = document.getElementById("selectImage");
const selectPdf = document.getElementById("selectPdf");
const imagePicker = document.getElementById("imagePicker");
const pdfPicker = document.getElementById("pdfPicker");
const selectedFile = document.getElementById("selectedFile");

setupTheme(themeButton);

await initializePage([

    loadProfileImage(topProfileImage)

]);

button.onclick = async () => {

    const text = document
        .getElementById("postText")
        .value
        .trim();

    if (!text) {

        alert("内容を入力してください");

        return;

    }

    try {

        await addDoc(collection(db, "posts"), {

            studentNumber,

            text,

            type: "text",

            imageUrl: "",

            pdfUrl: "",

            pdfName: "",

            createdAt: serverTimestamp(),

            likeCount: 0,

            commentCount: 0

        });

        showToast("投稿しました");

        setTimeout(() => {

            location.href = "share.html";

        }, 1800);

    }

    catch (e) {

        console.error(e);

        alert("投稿に失敗しました");

    }

};

selectImage.onclick = () => {

    imagePicker.click();

};

selectPdf.onclick = () => {

    pdfPicker.click();

};

imagePicker.onchange = () => {

    const file = imagePicker.files[0];

    if (!file) return;

    selectedFile.textContent =
        `📷 ${file.name}`;

};

pdfPicker.onchange = () => {

    const file = pdfPicker.files[0];

    if (!file) return;

    selectedFile.textContent =
        `📄 ${file.name}`;

};



document
.getElementById("backButton")
.onclick = () => {

    history.back();

};