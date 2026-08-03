import {

    showPage

} from "./common.js";



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


attendanceButton.onclick = () => {


    attendanceStatus.textContent =
        "✅ 出席打刻済み";


    attendanceButton.style.display =
        "none";


    leaveButton.style.display =
        "block";


};





// ======================
// 退席ボタン
// ======================


leaveButton.onclick = () => {


    attendanceStatus.textContent =
        "🚪 退席打刻済み";


    leaveButton.style.display =
        "none";


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