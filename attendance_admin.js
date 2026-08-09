import {db,studentNumber,isAdmin,setupTheme,setupAdminTab,showPage,showToast} from "./common.js";
import {collection,doc,getDoc,getDocs,serverTimestamp,updateDoc} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const pendingList=document.getElementById("pendingReviewList");
const badge=document.getElementById("pendingReviewBadge");
const recordStudentInput=document.getElementById("recordStudentNumber");
const recordStudentList=document.getElementById("studentAttendanceList");
const studentInput=document.getElementById("testStudentNumber");
const subjectSelect=document.getElementById("testSubject");
const startInput=document.getElementById("testStartTime");
const endInput=document.getElementById("testEndTime");
const classCountSelect=document.getElementById("testClassCount");
const classGroupSelect=document.getElementById("testClassGroup");
const loadButton=document.getElementById("loadEnrolledSubjects");
const sendButton=document.getElementById("sendTestNotification");
const testResult=document.getElementById("testNotificationResult");
const testExplanation=document.getElementById("testScheduleExplanation");
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
const two=value=>String(value).padStart(2,"0");
const timeAt=(minutes)=>`${two(Math.floor(minutes/60)%24)}:${two(minutes%60)}`;
const nowMinutes=()=>{const d=new Date();return d.getHours()*60+d.getMinutes()};
const statusOptions={present:"出席",late:"遅刻",early_leave:"早退",late_and_early_leave:"遅刻・早退",absent:"欠席",unrecorded:"未打刻"};
let attendanceRecords=[];

if(!await isAdmin()){
  alert("管理者のみ利用できます");
  location.replace("index.html");
} else {
  setupTheme(document.getElementById("themeButton"));
  setupAdminTab();
  document.getElementById("backButton").onclick=()=>location.href="admin.html";
  const initial=nowMinutes()+11;
  startInput.value=timeAt(initial);
  endInput.value=timeAt(initial+30);
  updateTestExplanation();
  [startInput,endInput].forEach(node=>node.addEventListener("input",updateTestExplanation));
  classCountSelect.onchange=updateClassGroupOptions;
  loadButton.onclick=loadEnrolledSubjects;
  sendButton.onclick=queueTestNotification;
  document.getElementById("loadStudentAttendance").onclick=loadStudentAttendance;
  document.addEventListener("click",handleReviewAction);
  watchPendingReviews();
  showPage();
}

function updateTestExplanation(){
  if(!startInput.value||!endInput.value){testExplanation.textContent="開始・終了時刻を入力してください。";return}
  const [h,m]=startInput.value.split(":").map(Number);
  const notify=timeAt(h*60+m-10);
  testExplanation.textContent=`開始10分前の ${notify} に「出席／欠席」、終了5分前に「退席／早退」を通知します。開始・終了の間は15分以上必要で、終了10分後まで退席打刻できます。`;
}

function updateClassGroupOptions(){
  const count=Number(classCountSelect.value||0);
  if(!count){classGroupSelect.innerHTML='<option value="">クラスなし</option>';classGroupSelect.disabled=true;return}
  classGroupSelect.innerHTML=Array.from({length:count},(_,index)=>{const group=String.fromCharCode(65+index);return `<option value="${group}">${group}クラス</option>`}).join("");
  classGroupSelect.disabled=false;
}

async function loadEnrolledSubjects(){
  const number=studentInput.value.replace(/\D/g,"");
  if(!/^\d{7}$/.test(number)){showToast("7桁の学籍番号を入力してください");return}
  subjectSelect.disabled=true;
  subjectSelect.innerHTML="<option>読み込み中...</option>";
  const user=await getDoc(doc(db,"users",number));
  if(!user.exists()){subjectSelect.innerHTML="<option>登録されていない学籍番号です</option>";sendButton.disabled=true;return}
  if(user.data()?.manabaVerified!==true){subjectSelect.innerHTML="<option>Manaba認証が未完了です</option>";sendButton.disabled=true;showToast("Manaba認証済みの学生だけテストできます");return}
  const enrolled=await getDocs(collection(db,"users",number,"enrolledSubjects"));
  const subjects=[...new Set(enrolled.docs.map(item=>item.data()).filter(item=>item.status!=="removed").map(item=>item.name||item.subject||item.subjectKey||item.subjectId).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"ja"));
  if(!subjects.length){subjectSelect.innerHTML="<option>履修科目がありません</option>";sendButton.disabled=true;return}
  subjectSelect.innerHTML=subjects.map(subject=>`<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`).join("");
  subjectSelect.disabled=false;
  sendButton.disabled=false;
  testResult.textContent=`${subjects.length}科目を読み込みました。`;
}

async function queueTestNotification(){
  const number=studentInput.value.replace(/\D/g,"");
  const subject=subjectSelect.value;
  const [startHour,startMinute]=startInput.value.split(":").map(Number);
  const startAt=startHour*60+startMinute;
  const [endHour,endMinute]=endInput.value.split(":").map(Number);
  const endAt=endHour*60+endMinute;
  if(!/^\d{7}$/.test(number)||!subject||subjectSelect.disabled||!startInput.value||!endInput.value||startAt<nowMinutes()+1||endAt-startAt<15){showToast("開始時刻は1分以上先、終了時刻は開始から15分以上後に設定してください");return}
  const testId=`admin_${Date.now()}`;
  const today=new Date();
  const date=`${today.getFullYear()}-${two(today.getMonth()+1)}-${two(today.getDate())}`;
  const expiresAt=new Date(today.getTime()+2*60*60*1000).toISOString();
  sendButton.disabled=true;
  try{
    await updateDoc(doc(db,"users",number),{
      attendanceNotificationTest:{enabled:true,testId,date,expiresAt,requestedBy:studentNumber||"",requestedAt:serverTimestamp(),lectures:[{subject,period:1,classGroup:classGroupSelect.value,startTime:startInput.value,endTime:endInput.value}]}
    });
    testResult.textContent=`${number} の「${subject}」を予約しました。開始10分前に通知します。`;
    showToast("テスト通知を予約しました");
  }catch(error){console.error(error);showToast("予約に失敗しました。Firebaseルールを確認してください");testResult.textContent="予約に失敗しました。"}
  finally{sendButton.disabled=false}
}

function formatDate(value){
  const date=value?.toDate?.()||(value instanceof Date?value:null);
  return date?new Intl.DateTimeFormat("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(date):"-";
}

function reviewCard(item){
  const data=item.data();
  return `<article class="attendance-review-card" data-path="${escapeHtml(item.ref.path)}" data-date="${escapeHtml(data.date||"")}" data-period="${escapeHtml(data.period||"")}" data-subject="${escapeHtml(data.subject||"")}" data-test-id="${escapeHtml(data.testId||"")}"><div><b>${escapeHtml(data.subject||"科目未設定")}</b> <span class="report-status is-open">確認待ち</span></div><p>学生：${escapeHtml(data.studentNumber||item.ref.parent.parent?.id||"-")}<br>日時：${escapeHtml(data.date||"-")} ${escapeHtml(data.period||"-")}限<br>打刻：${escapeHtml(data.endLabel||"-")}（${formatDate(data.endClientAt)}）</p><div class="report-actions"><button class="btn btn-primary review-approve" data-status="PRESENT">出席として確定</button><button class="btn review-approve" data-status="EARLY_LEAVE">早退として確定</button><button class="btn btn-danger review-approve" data-status="ABSENT">欠席として確定</button><button class="btn review-bulk-present">打刻済み学生を一括出席</button></div></article>`;
}

async function watchPendingReviews(){
  try{
    const users=await getDocs(collection(db,"users"));
    const snapshots=await Promise.all(users.docs.map(user=>getDocs(collection(user.ref,"attendanceRecords"))));
    attendanceRecords=snapshots.flatMap(snapshot=>snapshot.docs);
    const pending=attendanceRecords.filter(item=>item.data().earlyEndReviewRequired===true&&item.data().earlyEndReviewStatus==="pending");
    pending.sort((left,right)=>((right.data().updatedAt?.toMillis?.()||0)-(left.data().updatedAt?.toMillis?.()||0)));
    badge.hidden=!pending.length;badge.textContent=pending.length;
    pendingList.innerHTML=pending.map(reviewCard).join("")||"<p>確認待ちの記録はありません。</p>";
  }catch(error){console.error(error);pendingList.innerHTML="<p>確認待ちの記録を読み込めません。</p>"}
}

async function handleReviewAction(event){
  const saveButton=event.target.closest(".save-student-record");
  if(saveButton){
    const card=saveButton.closest(".attendance-review-card");
    const status=card.querySelector(".student-record-status").value;
    saveButton.disabled=true;
    try{await updateDoc(doc(db,"users",saveButton.dataset.student,"attendanceRecords",card.dataset.studentRecord),{status,statusLabel:statusOptions[status],statusFinalized:true,adminEditedAt:serverTimestamp(),adminEditedBy:studentNumber||"",updatedAt:serverTimestamp()});showToast("出席記録を変更しました");await loadStudentAttendance()}catch(error){console.error(error);showToast("変更に失敗しました");saveButton.disabled=false}
    return;
  }
  const bulkButton=event.target.closest(".review-bulk-present");
  if(bulkButton){
    const card=bulkButton.closest(".attendance-review-card");
    const matching=attendanceRecords.filter(item=>{const data=item.data();return data.date===card.dataset.date&&String(data.period)===card.dataset.period&&data.subject===card.dataset.subject&&String(data.testId||"")===card.dataset.testId&&Boolean(data.startStampedAt||data.startKind)&&!data.absenceTapped});
    if(!matching.length){showToast("開始打刻済みの学生がいません");return}
    bulkButton.disabled=true;
    try{await Promise.all(matching.map(item=>updateDoc(item.ref,{earlyEndReviewStatus:"resolved",earlyEndReviewResolvedAt:serverTimestamp(),earlyEndReviewResolvedBy:studentNumber||"",earlyEndReviewResolution:"present_bulk",status:"present",statusLabel:"出席",statusFinalized:true,updatedAt:serverTimestamp()})));showToast(`${matching.length}人を出席として確定しました`);await watchPendingReviews()}catch(error){console.error(error);showToast("一括確定に失敗しました");bulkButton.disabled=false}
    return;
  }
  const button=event.target.closest(".review-approve");
  if(!button)return;
  const card=button.closest(".attendance-review-card");
  const pathParts=card.dataset.path.split("/");
  const student=pathParts[1];
  const recordId=pathParts[3];
  const status=button.dataset.status;
  const labels={PRESENT:"出席",EARLY_LEAVE:"早退",ABSENT:"欠席"};
  button.disabled=true;
  try{
    await updateDoc(doc(db,"users",student,"attendanceRecords",recordId),{earlyEndReviewStatus:"resolved",earlyEndReviewResolvedAt:serverTimestamp(),earlyEndReviewResolvedBy:studentNumber||"",earlyEndReviewResolution:status,status,statusLabel:labels[status],statusFinalized:true,updatedAt:serverTimestamp()});
    showToast(`${labels[status]}として確定しました`);
    await watchPendingReviews();
  }catch(error){console.error(error);showToast("確定に失敗しました。Firebaseルールを確認してください");button.disabled=false}
}

async function loadStudentAttendance(){
  const number=recordStudentInput.value.replace(/\D/g,"");
  if(!/^\d{7}$/.test(number)){showToast("7桁の学籍番号を入力してください");return}
  recordStudentList.innerHTML="<p>読み込み中...</p>";
  try{
    const records=await getDocs(collection(db,"users",number,"attendanceRecords"));
    const rows=records.docs.sort((left,right)=>String(right.data().date||"").localeCompare(String(left.data().date||""))||Number(right.data().period||0)-Number(left.data().period||0));
    recordStudentList.innerHTML=rows.map(item=>{const data=item.data(),current=data.status||"unrecorded";return `<article class="attendance-review-card" data-student-record="${escapeHtml(item.id)}"><b>${escapeHtml(data.subject||"科目未設定")}</b><p>${escapeHtml(data.date||"-")} ${escapeHtml(data.period||"-")}限<br>開始：${formatDate(data.startClientAt)}／終了：${formatDate(data.endClientAt)}</p><label>最終判定<select class="student-record-status">${Object.entries(statusOptions).map(([value,label])=>`<option value="${value}" ${value===current?"selected":""}>${label}</option>`).join("")}</select></label><button class="btn btn-primary save-student-record" data-student="${number}">変更を保存</button></article>`}).join("")||"<p>出席記録はありません。</p>";
  }catch(error){console.error(error);recordStudentList.innerHTML="<p>出席記録を読み込めません。</p>"}
}
