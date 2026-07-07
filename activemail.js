import {
    db,
    studentNumber
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