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

let uploadMode = null;
const selectedImages = [];
const selectedPdfs = [];
const POST_INTERVAL = 10000;

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

    const lastPost =
        Number(localStorage.getItem("lastPostTime") ?? 0);

    if (Date.now() - lastPost < POST_INTERVAL) {

        alert("投稿は10秒に1回までです。");

        return;

    }

    const text = document
        .getElementById("postText")
        .value
        .trim();

    if (
        !text &&
        selectedImages.length === 0 &&
        selectedPdfs.length === 0
    ) {
        alert("投稿内容を入力してください。");
        return;
    }

    try {

        let type = "text";
        let imageUrls = [];
        let pdfs = [];

        if (selectedImages.length > 0) {

            type = "image";

            for (const file of selectedImages) {

                imageUrls.push(
                    await uploadFile(file, "image")
                );

            }

        }

        if (selectedPdfs.length > 0) {

            type = "pdf";

            for (const file of selectedPdfs) {

                pdfs.push({

                    name: file.name,

                    url: await uploadFile(file, "raw")

                });

            }

        }

        await addDoc(collection(db, "posts"), {

            studentNumber,
            text,
            type,
            imageUrls,
            pdfs,
            createdAt: serverTimestamp(),
            likeCount: 0,
            commentCount: 0

        });

        localStorage.setItem(
            "lastPostTime",
            Date.now()
        );

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

    if (uploadMode === "pdf") {

        alert("PDFを選択中です。PDFを削除してから画像を選択してください。");

        imagePicker.value = "";

        return;

    }

    uploadMode = "image";

    const file = imagePicker.files[0];

    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {

        alert("画像は1枚10MBまでです。");

        imagePicker.value = "";

        return;

    }

    if (selectedImages.length >= 5) {

        alert("画像は5枚までです。");

        imagePicker.value = "";

        return;

    }

    selectedImages.push(file);

    uploadMode = "image";

    renderSelectedFiles();

    imagePicker.value = "";

};

pdfPicker.onchange = () => {

    if (uploadMode === "image") {

        alert("画像を選択中です。画像を削除してからPDFを選択してください。");

        pdfPicker.value = "";

        return;

    }

    uploadMode = "pdf";

    const file = pdfPicker.files[0];

    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {

        alert("PDFは1ファイル20MBまでです。");

        pdfPicker.value = "";

        return;

    }

    if (selectedPdfs.length >= 5) {

        alert("PDFは5件までです。");

        pdfPicker.value = "";

        return;

    }

    selectedPdfs.push(file);

    uploadMode = "pdf";

    renderSelectedFiles();

    pdfPicker.value = "";

};

document.addEventListener("click", (e) => {

    if (!e.target.classList.contains("remove-file")) return;

    const index =
        Number(e.target.dataset.index);

    if (e.target.dataset.type === "image") {

        selectedImages.splice(index, 1);

        if (selectedImages.length === 0) {

            uploadMode = null;

        }

    } else {

        selectedPdfs.splice(index, 1);

        if (selectedPdfs.length === 0) {

            uploadMode = null;

        }

    }

    renderSelectedFiles();

});

function renderSelectedFiles() {

    selectedFile.innerHTML = "";

    if (uploadMode === "image") {

            selectedImages.forEach((file, index) => {

                selectedFile.innerHTML += `

            <div class="selected-item">

                <span>
                    📷 ${file.name}
                </span>

                <button
                    class="remove-file"
                    data-type="image"
                    data-index="${index}">
                    ×
                </button>

            </div>

            `;

            });

    }

    if (uploadMode === "pdf") {

            selectedPdfs.forEach((file, index) => {

                selectedFile.innerHTML += `

            <div class="selected-item">

                <span>
                    📄 ${file.name}
                </span>

                <button
                    class="remove-file"
                    data-type="pdf"
                    data-index="${index}">
                    ×
                </button>

            </div>

            `;

            });
        };

}

document
.getElementById("profileButton")
.onclick = () => {

    location.href = "profile.html";

};

document
.getElementById("backButton")
.onclick = () => {

    history.back();

};