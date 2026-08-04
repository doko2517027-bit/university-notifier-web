import { db, studentNumber, setupTheme, initializePage, getRankMark, getAnonymousRankingName } from "./common.js";
import { collection, doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { localDateKey } from "./test_points.js";
const dailyPoint=document.getElementById("dailyPoint"), dailyRank=document.getElementById("dailyRank"), totalPoint=document.getElementById("totalPoint"), chart=document.getElementById("subjectPointChart"), list=document.getElementById("rankingList");
setupTheme(document.getElementById("themeButton")); document.getElementById("backButton").onclick=()=>history.back();
await initializePage([loadTotal(),listenSubjects(),listenRanking()]);
async function loadTotal(){const snap=await getDoc(doc(db,"totalRanking",studentNumber));totalPoint.textContent=Number(snap.data()?.point||0)}
function listenSubjects(){return new Promise(resolve=>{onSnapshot(collection(db,"users",studentNumber,"subjectPoints"),snap=>{const rows=snap.docs.map(d=>d.data()).sort((a,b)=>Number(b.point||0)-Number(a.point||0));const max=Math.max(1,...rows.map(r=>Number(r.point||0)));chart.innerHTML=rows.length?rows.map(r=>`<div class="point-chart-row"><div><b>${escapeHtml(r.subjectName||"名称未設定")}</b><span>${Number(r.point||0)}pt</span></div><i style="width:${Number(r.point||0)/max*100}%"></i></div>`).join(""):"<p>正解すると科目別ポイントが表示されます。</p>";resolve()},()=>resolve())})}
function listenRanking(){
 const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);const yesterdayKey=localDateKey(yesterday);
 document.getElementById("rankingTargetDate").textContent=`${yesterday.getFullYear()}年${yesterday.getMonth()+1}月${yesterday.getDate()}日 23:59確定`;
 onSnapshot(doc(db,"dailyRanking",localDateKey(),"users",studentNumber),snap=>{dailyPoint.textContent=Number(snap.data()?.point||0)});
 return new Promise(resolve=>{onSnapshot(collection(db,"dailyRanking",yesterdayKey,"users"),snap=>{const ranking=snap.docs.map(d=>({id:d.id,point:Number(d.data().point||0)})).sort((a,b)=>b.point-a.point);const mine=ranking.findIndex(r=>r.id===studentNumber);dailyRank.textContent=mine<0?"-":mine+1;list.innerHTML=ranking.length?ranking.slice(0,50).map((r,i)=>`<div class="point-ranking-row ${r.id===studentNumber?"is-me":""}"><b>${i<3?["🥇","🥈","🥉"][i]:i+1}</b><span>${getRankMark(r.point)} ${escapeHtml(getAnonymousRankingName(r.id))}</span><strong>${r.point}pt</strong></div>`).join(""):"<p>昨日のランキングデータはありません。</p>";resolve()},()=>resolve())})
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
