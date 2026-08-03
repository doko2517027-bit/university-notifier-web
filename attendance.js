import {
    db,
    studentNumber,
    showPage,
    setupOfflineAlert,
    loadProfileImage
} from "./common.js";

import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

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

async function loadAttendance(){

    const attendanceData = [];


    // 科目取得
    const subjectSnap =
        await getDocs(
            collection(
                db,
                "attendance",
                studentNumber,
                "subjects"
            )
        );



    for(const subjectDoc of subjectSnap.docs){


        const subject =
            subjectDoc.id;



        let attendance = 0;
        let late = 0;
        let early = 0;
        let absent = 0;



        const recordSnap =
            await getDocs(
                collection(
                    db,
                    "attendance",
                    studentNumber,
                    "subjects",
                    subject,
                    "records"
                )
            );



        recordSnap.forEach(recordDoc => {


            const data =
                recordDoc.data();



            if(data.status === "出席"){

                attendance++;

            }
            else if(data.status === "遅刻"){

                late++;

            }
            else if(data.status === "早退"){

                early++;

            }
            else if(data.status === "欠席"){

                absent++;

            }


        });



        attendanceData.push({

            subject,

            attendance,

            late,

            early,

            absent

        });


    }


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



        const total =
            item.attendance +
            item.late +
            item.early +
            item.absent;


        const rate =
            total > 0
                ? Math.round(
                    (item.attendance / total) * 100
                )
                : 0;



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
        totalClass > 0
            ? Math.round(
                (totalAttendance / totalClass) * 100
            )
            : 0;



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




loadAttendance()
.catch(e=>{
    console.error(e);
    attendanceList.innerHTML =
        "出席情報の取得に失敗しました";
});

const backButton =
    document.getElementById("backButton");


if(backButton){

    backButton.onclick = () => {

        history.back();

    };

}

showPage();