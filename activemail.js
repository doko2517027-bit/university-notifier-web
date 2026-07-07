import {
    db,
    studentNumber,
    showToast
} from "./common.js";

import {
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const mailCount =
    document.getElementById("mailCount");

const readButton =
    document.getElementById("readButton");

const openMailButton =
    document.getElementById("openMailButton");

load();

openMailButton.onclick = () => {
    window.open(
        "https://activemail.kagoyamail.jp",
        "_blank"
    );
};

readButton.onclick = async () => {

    const snap = await getDoc(
        doc(db, "users", studentNumber)
    );

    const unread =
        snap.data().activeMailUnreadCount || 0;

    if (unread === 0) {

        showToast("✓ 確認済みです");
        return;

    }

    await updateDoc(
        doc(db, "users", studentNumber),
        {
            activeMailUnreadCount: 0
        }
    );

    mailCount.textContent =
        "新着メールはありません";

    showToast("✓ 確認しました");

};

async function load(){

    const snap = await getDoc(
        doc(db,"users",studentNumber)
    );

    const unread =
        snap.data().activeMailUnreadCount || 0;

    if(unread===0){

        mailCount.textContent =
            "新着メールはありません";

    }else{

        mailCount.textContent =
            `新着メール ${unread}件`;

    }

}