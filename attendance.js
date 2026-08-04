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

    const registeredSubjectSnap =
        await getDocs(collection(db, "subjects"));

    const practicalBySubject = new Map();

    registeredSubjectSnap.forEach(subjectDoc => {

        const data = subjectDoc.data();
        const isPractical =
            typeof data.isPractical === "boolean"
                ? data.isPractical
                : String(data.classFormat || "").includes("実習");

        if (data.name) {
            practicalBySubject.set(data.name, isPractical);
        }

        if (data.subjectKey) {
            practicalBySubject.set(data.subjectKey, isPractical);
        }

        practicalBySubject.set(subjectDoc.id, isPractical);

    });


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

            isPractical:
                practicalBySubject.get(subject) === true,

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

        const requiredNumerator =
            item.isPractical ? 4 : 2;

        const requiredDenominator =
            item.isPractical ? 5 : 3;

        const qualified =
            total === 0 ||
            item.attendance * requiredDenominator >=
                total * requiredNumerator;



        attendanceList.innerHTML += `


        <div class="card setting-card">


            <h3>
                ${item.subject}
            </h3>


            <p>
                出席率：${rate}%
            </p>

            <p>
                判定区分：${item.isPractical ? "実習" : "実習以外"}<br>
                必要出席率：${requiredNumerator}/${requiredDenominator}以上<br>
                ${qualified ? "✅ 試験資格あり" : "❌ 試験資格なし"}
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


    const disqualifiedCount =
        attendanceData.filter(item => {

            const total =
                item.attendance + item.late +
                item.early + item.absent;

            if (total === 0) {
                return false;
            }

            return item.isPractical
                ? item.attendance * 5 < total * 4
                : item.attendance * 3 < total * 2;

        }).length;

    examQualification.innerHTML =
        disqualifiedCount === 0
            ? "✅ 全科目で資格あり"
            : `❌ ${disqualifiedCount}科目で資格なし`;


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
