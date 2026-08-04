import {db,studentNumber,showPage} from "./common.js";
import {collection,getDocs} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {absenceUnits} from "./attendance_policy.js";

const rateNode=document.getElementById("attendanceRate");
const summaryNode=document.getElementById("attendanceSummary");
const listNode=document.getElementById("attendanceList");
const qualificationNode=document.getElementById("examQualification");
const escapeHtml=value=>String(value??"").replace(/[&<>"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));

async function loadAttendance(){
    const [enrolledSnap,subjectSnap]=await Promise.all([
        getDocs(collection(db,"users",studentNumber,"enrolledSubjects")),
        getDocs(collection(db,"subjects"))
    ]);
    const practical=new Map();
    subjectSnap.docs.forEach(doc=>{const item=doc.data();const value=item.isPractical===true||String(item.classFormat||"").includes("実習");[doc.id,item.name,item.subjectKey].filter(Boolean).forEach(key=>practical.set(key,value))});
    const groups=new Map();
    for(const enrolledDoc of enrolledSnap.docs){const course=enrolledDoc.data();if(course.status==="removed")continue;const subject=course.name||course.subjectKey||enrolledDoc.id;const recordSnap=await getDocs(collection(db,"attendance",studentNumber,"subjects",encodeURIComponent(subject),"records"));for(const recordDoc of recordSnap.docs){const record={id:recordDoc.id,...recordDoc.data()};const key=record.subjectKey||record.subject||subject;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(record)}}
    let allRecords=0,totalPenalty=0,disqualified=0,totalLate=0,totalEarly=0,totalAbsent=0;
    const cards=[];
    for(const [subject,records] of groups){
        const penalty=records.reduce((sum,item)=>sum+absenceUnits(item),0);
        const late=records.filter(item=>item.arrivalStatus==="遅刻").length;
        const early=records.filter(item=>item.departureStatus==="早退").length;
        const absent=records.filter(item=>item.arrivalStatus==="欠席"||item.departureStatus==="欠席").length;
        const isPractical=practical.get(subject)===true;
        const required=isPractical?4/5:2/3;
        const rate=records.length?Math.max(0,Math.round((records.length-penalty)/records.length*100)):0;
        const qualified=!records.length||(records.length-penalty)/records.length>=required;
        if(!qualified)disqualified++;
        allRecords+=records.length;totalPenalty+=penalty;totalLate+=late;totalEarly+=early;totalAbsent+=absent;
        records.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
        cards.push(`<section class="card setting-card"><h3>${escapeHtml(subject)}</h3><p><b>出席換算 ${rate}%</b>・${isPractical?"実習 4/5以上":"実習以外 2/3以上"}<br>${qualified?"✅ 現在は基準内":"❌ 現在は基準未満"}</p><p>授業 ${records.length}回／遅刻 ${late}回／早退 ${early}回／欠席 ${absent}回<br>欠席換算 ${penalty.toFixed(2)}回（遅刻・早退3回＝欠席1回）</p><div class="attendance-record-list">${records.map(item=>`<a href="attendance_edit.html?recordId=${encodeURIComponent(item.id)}&subject=${encodeURIComponent(subject)}"><span>${escapeHtml(item.date)} ${item.period||"-"}限 ${escapeHtml(item.classGroup||"")}</span><b>${escapeHtml([item.arrivalStatus,item.departureStatus].filter(Boolean).join(" / "))}</b></a>`).join("")}</div></section>`);
    }
    const overall=allRecords?Math.max(0,Math.round((allRecords-totalPenalty)/allRecords*100)):0;
    rateNode.textContent=`${overall}%`;
    summaryNode.innerHTML=`授業 ${allRecords}回<br>遅刻 ${totalLate}回・早退 ${totalEarly}回・欠席 ${totalAbsent}回<br><b>欠席換算 ${totalPenalty.toFixed(2)}回</b><br><small>遅刻・早退は各1/3欠席として合算します。</small>`;
    listNode.innerHTML=cards.join("")||'<p class="empty-text">出席記録はまだありません。</p>';
    qualificationNode.textContent=disqualified?`❌ ${disqualified}科目で現在基準未満`:`✅ 全科目で現在基準内`;
}
document.getElementById("backButton")?.addEventListener("click",()=>history.back());
loadAttendance().catch(error=>{console.error(error);listNode.textContent="出席情報の取得に失敗しました"});showPage();
