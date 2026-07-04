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

async function uploadFile(file, resourceType = "image") {

    const formData = new FormData();

    formData.append("file", file);

    formData.append("upload_preset", "caremate_upload");

    const res = await fetch(

        `https://api.cloudinary.com/v1_1/vpctonjf/${resourceType}/upload`,

        {

            method: "POST",

            body: formData

        }

    );

    const data = await res.json();

    return data.secure_url;

}

button.onclick = async () => {

    const text = document
        .getElementById("postText")
        .value
        .trim();

    if (
        !text &&
        imagePicker.files.length === 0 &&
        pdfPicker.files.length === 0
    ) {
        alert("投稿内容を入力してください。");
        return;
    }

    try {

        let type = "text";

        let imageUrl = "";

        let pdfUrl = "";

        let pdfName = "";

        if (imagePicker.files.length > 0) {

            imageUrl = await uploadFile(
                imagePicker.files[0],
                "image"
            );

            type = "image";

        }

        if (pdfPicker.files.length > 0) {

            pdfUrl = await uploadFile(
                pdfPicker.files[0],
                "raw"
            );

            pdfName = pdfPicker.files[0].name;

            type = "pdf";

        }

        await addDoc(collection(db, "posts"), {

            studentNumber,
            text,
            type,
            imageUrl,
            pdfUrl,
            pdfName,
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