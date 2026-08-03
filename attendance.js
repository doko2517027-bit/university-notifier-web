import {
    setupTheme
} from "./common.js";


// ======================
// 仮データ
// 後でFirebaseから取得する
// ======================

const attendanceData = [

    {
        subject: "成人看護学",
        attendance: 10,
        late: 1,
        early: 0,
        absent: 0
    },


    {
        subject: "基礎看護学",
        attendance: 8,
        late: 0,
        early: 1,
        absent: 0
    },


    {
        subject: "公衆衛生",
        attendance: 7,
        late: 0,
        early: 0,
        absent: 1
    }

];




// ======================
// 要素取得
// ======================

const attendanceRate =
    document.getElementById(
        "attendanceRate"
    );


const attendanceSummary =
    document.getElementById(
        "attendanceSummary"
    );


const attendanceList =
    document.getElementById(
        "attendanceList"
    );


const examQualification =
    document.getElementById(
        "examQualification"
    );




// ======================
// 初期表示
// ======================

function loadAttendance(){


    let totalAttendance = 0;
    let totalLate = 0;
    let totalEarly = 0;
    let totalAbsent = 0;


    let totalClass = 0;



    attendanceList.innerHTML = "";



    attendanceData.forEach(item => {



        totalAttendance += item.attendance;

        totalLate += item.late;

        totalEarly += item.early;

        totalAbsent += item.absent;



        totalClass +=
            item.attendance +
            item.late +
            item.early +
            item.absent;



        const rate =
            Math.round(
                (
                    item.attendance /
                    (
                        item.attendance +
                        item.late +
                        item.early +
                        item.absent
                    )
                )
                * 100
            );



        attendanceList.innerHTML += `


        <div class="card setting-card">


            <h3>
                ${item.subject}
            </h3>


            <p>
                出席率：${rate}%
            </p>



            <p>

                出席 ${item.attendance}回<br>

                遅刻 ${item.late}回<br>

                早退 ${item.early}回<br>

                欠席 ${item.absent}回

            </p>


        </div>



        `;


    });



    const overallRate =
        Math.round(
            (
                totalAttendance /
                totalClass
            )
            * 100
        );



    attendanceRate.textContent =
        `${overallRate}%`;



    attendanceSummary.innerHTML = `


        出席 ${totalAttendance}回<br>

        遅刻 ${totalLate}回<br>

        早退 ${totalEarly}回<br>

        欠席 ${totalAbsent}回


    `;




    // ======================
    // 試験資格判定
    // ======================


    if(overallRate >= 67){


        examQualification.innerHTML =
            "✅ 資格あり";


    }
    else{


        examQualification.innerHTML =
            "❌ 資格なし";


    }


}




loadAttendance();

const backButton =
    document.getElementById("backButton");


if(backButton){

    backButton.onclick = () => {

        history.back();

    };

}