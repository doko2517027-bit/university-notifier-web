import {
    db,
    studentNumber
} from "./common.js";

import {
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


let classTargets = [];



/**
 * 起動時クラス確認
 */
export async function checkClassSelectionRequired(){

    if(!studentNumber){
        return;
    }


    try{

        const userSnap =
            await getDoc(
                doc(db,"users",studentNumber)
            );


        if(!userSnap.exists()){
            return;
        }


        const selected =
            userSnap.data().classSelections || {};



        const schedule =
            await getTodayClassSchedule();



        if(schedule.length === 0){
            return;
        }



        classTargets =
            schedule.filter(item=>{

                if(!item.classGroup){
                    return false;
                }


                const groups =
                    extractGroups(item.classGroup);


                // A/B/Cなど複数クラスなら対象
                return groups.length > 1;

            });



        if(classTargets.length === 0){
            return;
        }



        const needSelect =
            classTargets.some(item=>{

                return !selected[
                    createKey(item)
                ];

            });



        if(needSelect){

            showClassSelectionPopup(
                classTargets,
                selected
            );

        }


    }catch(e){

        console.error(
            "クラス確認エラー",
            e
        );

    }

}





/**
 * 今日の時間割取得
 */
let todayScheduleData = [];


/**
 * app.jsから時間割を渡す
 */
export function setClassSelectionSchedule(schedule){

    if(
        Array.isArray(schedule)
    ){

        todayScheduleData = schedule;

    }

}



/**
 * 今日の時間割取得
 */
async function getTodayClassSchedule(){

    return todayScheduleData;

}

/**
 * 科目キー
 */
function createKey(item){

    return (
        `${item.subject}_${item.date || ""}_${item.period || ""}`
    );

}





/**
 * popup生成
 */
function showClassSelectionPopup(
    targets,
    selected
){


    let overlay =
        document.getElementById(
            "classSelectionOverlay"
        );


    if(!overlay){
        return;
    }



    const list =
        document.getElementById(
            "classSelectionList"
        );


    if(!list){
        return;
    }



    list.innerHTML = "";



    targets.forEach(item=>{


        const key =
            createKey(item);



        const groups =
            extractGroups(
                item.classGroup
            );



        const box =
        document.createElement("div");


        box.className =
            "class-select-box";



        box.innerHTML = `

            <h3>
            ${item.subject}
            </h3>

            <p>
            ${item.period || ""}
            </p>


            <div class="class-buttons">

                ${
                    groups.map(group=>`

                    <button
                    class="main-button class-choice"
                    data-key="${key}"
                    data-value="${group}">

                    ${group}

                    </button>

                    `).join("")
                }

            </div>

        `;


        list.appendChild(box);


    });



    list.querySelectorAll(
        ".class-choice"
    )
    .forEach(button=>{


        button.onclick=()=>{


            const parent =
                button.parentElement;


            parent
            .querySelectorAll("button")
            .forEach(btn=>{

                btn.classList.remove(
                    "selected"
                );

            });


            button.classList.add(
                "selected"
            );


            button.dataset.selected =
                "true";


        };


    });



    overlay.classList.add("show");



    const save =
        document.getElementById(
            "saveClassSelection"
        );


    save.onclick =
        async ()=>{


            const selections={};


            list.querySelectorAll(
                ".class-choice.selected"
            )
            .forEach(btn=>{


                selections[
                    btn.dataset.key
                ] =
                    btn.dataset.value;


            });



            const oldSelections =
                selected || {};


            const newSelections = {

                ...oldSelections,

                ...selections

            };

            localStorage.setItem(
                "classSelections",
                JSON.stringify(
                    newSelections
                )
            );


            await updateDoc(
                doc(db,"users",studentNumber),
                {

                    classSelections:
                        newSelections,

                    classSelectionUpdatedAt:
                        new Date()
                            .toISOString()

                }
            );



            overlay.classList.remove(
                "show"
            );


            location.reload();


        };


}





/**
 * A/B/C抽出
 */
function extractGroups(value){

    if(!value){
        return [];
    }


    const text =
        String(value)
        .toUpperCase()
        .replaceAll("クラス","")
        .replaceAll("組","")
        .trim();



    // A〜Zクラスを抽出
    const alphabetGroups =
        text.match(/[A-Z]/g);



    if(alphabetGroups){

        return [
            ...new Set(alphabetGroups)
        ];

    }



    // 念のため区切り対応
    return text
        .split(/[\/・,、\s]+/)
        .map(v=>v.trim())
        .filter(Boolean);

}



export function setupClassSelection(){

}