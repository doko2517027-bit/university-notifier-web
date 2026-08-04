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

function listenSubjects(){return new Promise(resolve=>{onSnapshot(collection(db,"users",studentNumber,"subjectPoints"),snap=>{const rows=snap.docs.map(d=>d.data()).sort((a,b)=>Number(b.point||0)-Number(a.point||0));chart.innerHTML=renderSubjectBars(rows,"正解すると科目別ポイントが表示されます。");resolve()},()=>resolve())})}

function listenSubjectHistory(){return new Promise(resolve=>{onSnapshot(collection(db,"users",studentNumber,"subjectPointHistory"),snap=>{pointHistory=snap.docs.map(d=>d.data()).filter(item=>item.day).sort((a,b)=>a.day.localeCompare(b.day));renderHistory();resolve()},()=>resolve())})}

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

function listenRanking(){const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);const yesterdayKey=localDateKey(yesterday);document.getElementById("rankingTargetDate").textContent=`${yesterday.getFullYear()}年${yesterday.getMonth()+1}月${yesterday.getDate()}日 23:59確定`;onSnapshot(doc(db,"dailyRanking",localDateKey(),"users",studentNumber),snap=>{dailyPoint.textContent=Number(snap.data()?.point||0)});return new Promise(resolve=>{onSnapshot(collection(db,"dailyRanking",yesterdayKey,"users"),snap=>{const ranking=snap.docs.map(d=>({id:d.id,point:Number(d.data().point||0)})).sort((a,b)=>b.point-a.point);const mine=ranking.findIndex(r=>r.id===studentNumber);dailyRank.textContent=mine<0?"-":mine+1;list.innerHTML=ranking.length?ranking.slice(0,50).map((r,i)=>`<div class="point-ranking-row ${r.id===studentNumber?"is-me":""}"><b>${i<3?["🥇","🥈","🥉"][i]:i+1}</b><span>${getRankMark(r.point)} ${escapeHtml(getAnonymousRankingName(r.id))}</span><strong>${r.point}pt</strong></div>`).join(""):"<p>昨日のランキングデータはありません。</p>";resolve()},()=>resolve())})}

function formatDate(day){const [year,month,date]=day.split("-");return `${year}年${Number(month)}月${Number(date)}日`}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
