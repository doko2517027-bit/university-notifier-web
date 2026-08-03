import {

    db,
    studentNumber,
    showPage

} from "./common.js";


import {

    doc,
    setDoc,
    updateDoc,
    serverTimestamp

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";



// ======================
// 要素取得
// ======================


const subjectName =
    document.getElementById(
        "subjectName"
    );


const attendanceStatus =
    document.getElementById(
        "attendanceStatus"
    );


const attendanceButton =
    document.getElementById(
        "attendanceButton"
    );


const leaveButton =
    document.getElementById(
        "leaveButton"
    );



const backButton =
    document.getElementById(
        "backButton"
    );





// ======================
// URLから授業取得
// ======================

const params =
    new URLSearchParams(
        location.search
    );


const subject =
    params.get("subject")
    ||
    "授業名未設定";



subjectName.textContent =
    subject;





// ======================
// 出席ボタン
// ======================


attendanceButton.onclick = async () => {


    try{


        const today =
            new Date()
            .toISOString()
            .slice(0,10);



        const recordRef =
            doc(
                db,
                "attendance",
                studentNumber,
                "subjects",
                subject,
                "records",
                today
            );



        await setDoc(
            recordRef,
            {

                status:"出席",

                checkIn:
                    serverTimestamp(),

                checkOut:null

            }
        );



        attendanceStatus.textContent =
            "✅ 出席打刻済み";


        attendanceButton.style.display =
            "none";


        leaveButton.style.display =
            "block";



    }
    catch(e){

        console.error(e);

        alert(
            "出席登録に失敗しました"
        );

    }


};





// ======================
// 退席ボタン
// ======================


leaveButton.onclick = async () => {


    try{


        const today =
            new Date()
            .toISOString()
            .slice(0,10);



        const recordRef =
            doc(
                db,
                "attendance",
                studentNumber,
                "subjects",
                subject,
                "records",
                today
            );



        await updateDoc(
            recordRef,
            {

                status:"退席",

                checkOut:
                    serverTimestamp()

            }
        );



        attendanceStatus.textContent =
            "🚪 退席打刻済み";


        leaveButton.style.display =
            "none";


    }
    catch(e){

        console.error(e);

        alert(
            "退席登録に失敗しました"
        );

    }


};





// ======================
// 戻る
// ======================


if(backButton){

    backButton.onclick = () => {

        history.back();

    };

}



showPage();