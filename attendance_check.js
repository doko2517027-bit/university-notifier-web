import {db,studentNumber,showPage} from "./common.js";
import {classifyArrival,classifyDeparture,isDepartureWindow,PERIOD_TIMES,slotId} from "./attendance_policy.js";
import {doc,getDoc,runTransaction,serverTimestamp,Timestamp,updateDoc} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const params=new URLSearchParams(location.search);
const action=params.get("action")||"arrival";
const subject=params.get("subject")||"授業名未設定";
const date=params.get("date")||new Date().toLocaleDateString("sv-SE");
const period=Number(params.get("period")||0);
const scheduleId=params.get("scheduleId")||"";
const classGroup=params.get("classGroup")||"";
const defaults=PERIOD_TIMES[period]||{};
const startTime=params.get("startTime")||defaults.startTime||"";
const endTime=params.get("endTime")||defaults.endTime||"";
const recordId=params.get("recordId")||slotId(scheduleId,date,period,subject);
const subjectName=document.getElementById("subjectName");
const attendanceStatus=document.getElementById("attendanceStatus");
const primaryButton=document.getElementById("attendanceButton");
const secondaryButton=document.getElementById("leaveButton");

subjectName.textContent=`${subject}${classGroup?`（${classGroup}）`:""}`;
document.getElementById("attendanceMeta").textContent=`${date}・${period}限 ${startTime}〜${endTime}`;
document.getElementById("personalRecordNotice").textContent="CareMate上の個人用記録です。大学の公式出席記録ではありません。";

function recordRef(){return doc(db,"attendance",studentNumber,"subjects",encodeURIComponent(subject),"records",recordId)}

async function saveChoice(choice){
    if(!studentNumber)throw new Error("ログイン情報がありません");
    const now=new Date();
    const status=action==="departure"
        ? classifyDeparture(now,endTime)
        : (choice==="absence"?"欠席":classifyArrival(now,startTime));
    if(action==="departure"&&!isDepartureWindow(now,endTime))throw new Error("退席操作は終了5分前から終了10分後までです。後から出席管理画面で修正できます。");
    await runTransaction(db,async transaction=>{
        const ref=recordRef();
        const snap=await transaction.get(ref);
        const existing=snap.data()||{};
        if(existing.classGroup&&classGroup&&existing.classGroup!==classGroup)throw new Error(`${existing.classGroup}で既に記録済みです。`);
        if(action==="arrival"&&existing.arrivalStatus)throw new Error("この授業は既に記録済みです。");
        if(action==="departure"&&!existing.arrivalStatus)throw new Error("先に出席または欠席を記録してください。");
        if(action==="departure"&&existing.departureStatus)throw new Error("退席は既に記録済みです。");
        const base={recordId,scheduleId,date,period,subject,subjectKey:subject,classGroup,
            startTime,endTime,source:"notification",updatedAt:serverTimestamp()};
        if(action==="arrival")Object.assign(base,{arrivalStatus:status,checkInAt:Timestamp.fromDate(now),createdAt:serverTimestamp()});
        else Object.assign(base,{departureStatus:status,checkOutAt:Timestamp.fromDate(now)});
        transaction.set(ref,base,{merge:true});
    });
    if(classGroup)await updateDoc(doc(db,"users",studentNumber),{[`attendancePreferences.${encodeURIComponent(subject)}`]:{subject,classGroup,selectedAt:new Date().toISOString(),source:"attendance"}});
    attendanceStatus.textContent=`✅ ${status}として保存しました`;
    primaryButton.disabled=true;secondaryButton.disabled=true;
    if(navigator.serviceWorker?.ready){const registration=await navigator.serviceWorker.ready;const notices=await registration.getNotifications();notices.filter(item=>String(item.tag||"").includes(recordId)).forEach(item=>item.close())}
}

async function init(){
    const snap=await getDoc(recordRef());
    if(snap.exists()){
        const data=snap.data();
        attendanceStatus.textContent=`記録済み：${[data.arrivalStatus,data.departureStatus].filter(Boolean).join(" / ")}`;
    }
    if(action==="departure"){
        primaryButton.textContent="🚪 退席";secondaryButton.textContent="⏱ 早退";
        primaryButton.onclick=()=>saveChoice("departure").catch(showError);secondaryButton.onclick=()=>saveChoice("early").catch(showError);
    }else{
        primaryButton.textContent="✅ 出席・到着";secondaryButton.textContent="❌ 欠席";
        primaryButton.onclick=()=>saveChoice("arrival").catch(showError);secondaryButton.onclick=()=>saveChoice("absence").catch(showError);
    }
}
function showError(error){console.error(error);alert(error.message||"保存に失敗しました")}
document.getElementById("backButton")?.addEventListener("click",()=>history.back());
init().catch(showError);showPage();
