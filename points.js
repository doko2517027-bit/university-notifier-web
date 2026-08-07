import { db, studentNumber, setupTheme, initializePage, getRankMark, getAnonymousRankingName } from "./common.js";
import { collection, doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { localDateKey } from "./test_points.js";

const dailyPoint=document.getElementById("dailyPoint");
const dailyRank=document.getElementById("dailyRank");
const totalPoint=document.getElementById("totalPoint");
const chart=document.getElementById("subjectPointChart");
const list=document.getElementById("rankingList");
const historyDate=document.getElementById("subjectPointDate");
const dailySubjects=document.getElementById("dailySubjectPoints");
const historyGraph=document.getElementById("pointHistoryGraph");
let pointHistory=[];

setupTheme(document.getElementById("themeButton"));
document.getElementById("backButton").onclick=()=>history.back();
historyDate.value=localDateKey();
historyDate.max=localDateKey();
historyDate.onchange=renderHistory;
await initializePage([loadTotal(),listenSubjects(),listenSubjectHistory(),listenRanking()]);

async function loadTotal(){const snap=await getDoc(doc(db,"totalRanking",studentNumber));totalPoint.textContent=Number(snap.data()?.point||0)}

function listenSubjects(){return new Promise(resolve=>{onSnapshot(collection(db,"users",studentNumber,"subjectPoints"),snap=>{const rows=snap.docs.map(d=>d.data()).sort((a,b)=>Number(b.point||0)-Number(a.point||0));chart.innerHTML=renderSubjectBars(rows,"正解すると科目別ポイントが表示されます。");resolve()},error=>{console.error("科目別ポイント取得エラー",error);chart.innerHTML='<div class="point-load-error">⚠️ 科目別ポイントを取得できません。Firestoreルールの subjectPoints を確認してください。</div>';resolve()})})}

function listenSubjectHistory(){return new Promise(resolve=>{onSnapshot(collection(db,"users",studentNumber,"subjectPointHistory"),snap=>{pointHistory=snap.docs.map(d=>d.data()).filter(item=>item.day).sort((a,b)=>a.day.localeCompare(b.day));renderHistory();resolve()},error=>{console.error("日別科目ポイント取得エラー",error);dailySubjects.innerHTML='<div class="point-load-error">⚠️ 日別ポイントを取得できません。Firestoreルールの subjectPointHistory を確認してください。</div>';historyGraph.innerHTML="";resolve()})})}

function renderHistory(){
 const selected=historyDate.value||localDateKey();
 const rows=pointHistory.filter(item=>item.day===selected).sort((a,b)=>Number(b.point||0)-Number(a.point||0));
 dailySubjects.innerHTML=`<div class="point-history-total"><span>${formatDate(selected)}</span><b>${rows.reduce((sum,item)=>sum+Number(item.point||0),0)}pt</b></div>${renderSubjectBars(rows,"この日の科目ポイントはありません。")}`;
 const days=[];for(let offset=13;offset>=0;offset--){const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()-offset);days.push(localDateKey(date))}
 const values=days.map(day=>pointHistory.filter(item=>item.day===day).reduce((sum,item)=>sum+Number(item.point||0),0));
 const max=Math.max(1,...values);
 historyGraph.innerHTML=days.map((day,index)=>`<button type="button" class="point-day-column ${day===selected?"is-selected":""}" data-day="${day}" title="${day} ${values[index]}pt"><span>${values[index]?`${values[index]}pt`:""}</span><i style="height:${Math.max(values[index]?8:2,values[index]/max*100)}%"></i><small>${Number(day.slice(8))}</small></button>`).join("");
 historyGraph.querySelectorAll("[data-day]").forEach(button=>button.onclick=()=>{historyDate.value=button.dataset.day;renderHistory()});
}

function renderSubjectBars(rows,emptyMessage){const max=Math.max(1,...rows.map(r=>Number(r.point||0)));return rows.length?rows.map(r=>`<div class="point-chart-row"><div><b>${escapeHtml(r.subjectName||"名称未設定")}</b><span>${Number(r.point||0)}pt</span></div><i style="width:${Number(r.point||0)/max*100}%"></i></div>`).join(""):`<p>${emptyMessage}</p>`}

function listenRanking() {

    const yesterday =
        new Date();

    yesterday.setDate(
        yesterday.getDate() - 1
    );


    const yesterdayKey =
        localDateKey(
            yesterday
        );


    document
        .getElementById(
            "rankingTargetDate"
        )
        .textContent =

        `${yesterday.getFullYear()}年` +
        `${yesterday.getMonth() + 1}月` +
        `${yesterday.getDate()}日 23:59確定`;


    /*
     自分の今日の獲得ポイント
    */

    onSnapshot(

        doc(
            db,
            "dailyRanking",
            localDateKey(),
            "users",
            studentNumber
        ),

        snap => {

            dailyPoint.textContent =
                Number(
                    snap.data()?.point || 0
                );

        }

    );


    /*
     昨日のランキング
    */

    return new Promise(
        resolve => {

            onSnapshot(

                collection(
                    db,
                    "dailyRanking",
                    yesterdayKey,
                    "users"
                ),

                async snapshot => {

                    try {

                        /*
                         順位と右側のポイントは
                         昨日の獲得ポイントを使用
                        */

                        const ranking =
                            snapshot.docs
                                .map(
                                    rankingDoc => ({

                                        id:
                                            rankingDoc.id,

                                        point:
                                            Number(
                                                rankingDoc
                                                    .data()
                                                    .point || 0
                                            )

                                    })
                                )
                                .sort(
                                    (left, right) =>
                                        right.point -
                                        left.point
                                );


                        const myIndex =
                            ranking.findIndex(
                                item =>
                                    item.id ===
                                    studentNumber
                            );


                        dailyRank.textContent =
                            myIndex < 0
                                ? "-"
                                : String(
                                    myIndex + 1
                                );


                        /*
                         表示対象の上位50人について、
                         totalRankingから累計ポイントを取得
                        */

                        const visibleRanking =
                            ranking.slice(
                                0,
                                50
                            );


                        const rankingWithTotal =
                            await Promise.all(

                                visibleRanking.map(
                                    async item => {

                                        try {

                                            const totalSnapshot =
                                                await getDoc(

                                                    doc(
                                                        db,
                                                        "totalRanking",
                                                        item.id
                                                    )

                                                );


                                            return {

                                                ...item,

                                                totalPoint:
                                                    Number(
                                                        totalSnapshot
                                                            .data()
                                                            ?.point || 0
                                                    )

                                            };

                                        } catch (error) {

                                            console.error(
                                                "累計ポイント取得エラー:",
                                                item.id,
                                                error
                                            );


                                            return {

                                                ...item,

                                                totalPoint:
                                                    0

                                            };

                                        }

                                    }
                                )

                            );


                        list.innerHTML =
                            rankingWithTotal.length

                                ? rankingWithTotal
                                    .map(
                                        (
                                            item,
                                            index
                                        ) => `

                                            <div class="
                                                point-ranking-row
                                                ${
                                                    item.id === studentNumber
                                                        ? "is-me"
                                                        : ""
                                                }
                                            ">

                                                <b>
                                                    ${
                                                        index < 3
                                                            ? [
                                                                "🥇",
                                                                "🥈",
                                                                "🥉"
                                                            ][index]
                                                            : index + 1
                                                    }
                                                </b>

                                                <span>

                                                    ${
                                                        getRankMark(
                                                            item.totalPoint
                                                        )
                                                    }

                                                    ${escapeHtml(
                                                        getAnonymousRankingName(
                                                            item.id
                                                        )
                                                    )}

                                                </span>

                                                <strong>
                                                    ${item.point}pt
                                                </strong>

                                            </div>

                                        `
                                    )
                                    .join("")

                                : `
                                    <p>
                                        昨日のランキングデータはありません。
                                    </p>
                                `;


                        resolve();

                    } catch (error) {

                        console.error(
                            "ランキング表示エラー:",
                            error
                        );


                        list.innerHTML = `
                            <p class="point-load-error">
                                ⚠️ ランキングを取得できませんでした。
                            </p>
                        `;


                        resolve();

                    }

                },

                error => {

                    console.error(
                        "ランキング取得エラー:",
                        error
                    );


                    list.innerHTML = `
                        <p class="point-load-error">
                            ⚠️ ランキングを取得できませんでした。
                        </p>
                    `;


                    resolve();

                }

            );

        }

    );

}

function formatDate(day){const [year,month,date]=day.split("-");return `${year}年${Number(month)}月${Number(date)}日`}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
