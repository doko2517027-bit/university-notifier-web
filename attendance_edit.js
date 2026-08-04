import {db,studentNumber,showPage} from "./common.js";
import {arrayUnion,doc,getDoc,serverTimestamp,updateDoc} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
const recordId=new URLSearchParams(location.search).get("recordId");
const ref=doc(db,"users",studentNumber,"attendanceRecords",recordId||"missing");
const arrival=document.getElementById("arrivalStatus"),departure=document.getElementById("departureStatus"),reason=document.getElementById("correctionReason");
let original={};
async function load(){const snap=await getDoc(ref);if(!snap.exists())throw new Error("記録が見つかりません");original=snap.data();document.getElementById("editSubject").textContent=`${original.subject}${original.classGroup?`（${original.classGroup}）`:""}`;document.getElementById("editMeta").textContent=`${original.date}・${original.period}限 ${original.startTime}〜${original.endTime}`;arrival.value=original.arrivalStatus||"出席";departure.value=original.departureStatus||""}
document.getElementById("saveCorrection").onclick=async()=>{if(!reason.value.trim()){alert("修正理由を入力してください");return}if(!confirm("個人用の出席記録を修正しますか？"))return;await updateDoc(ref,{arrivalStatus:arrival.value,departureStatus:departure.value,updatedAt:serverTimestamp(),lastCorrectionReason:reason.value.trim(),corrections:arrayUnion({beforeArrival:original.arrivalStatus||"",beforeDeparture:original.departureStatus||"",afterArrival:arrival.value,afterDeparture:departure.value,reason:reason.value.trim(),correctedAt:new Date().toISOString()})});alert("修正しました");location.href="attendance.html"};
document.getElementById("backButton").onclick=()=>history.back();load().catch(error=>alert(error.message));showPage();
