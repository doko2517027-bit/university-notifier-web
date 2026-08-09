import {db,studentNumber,isAdmin,setupTheme,setupAdminTab,showPage,showToast} from "./common.js";
import {collection,collectionGroup,doc,getDocs,limit,onSnapshot,orderBy,query,serverTimestamp,updateDoc} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const pendingList=document.getElementById("pendingReviewList");
const badge=document.getElementById("pendingReviewBadge");
const studentInput=document.getElementById("testStudentNumber");
const subjectSelect=document.getElementById("testSubject");
const startInput=document.getElementById("testStartTime");
const endInput=document.getElementById("testEndTime");
const classInput=document.getElementById("testClassGroup");
const loadButton=document.getElementById("loadEnrolledSubjects");
const sendButton=document.getElementById("sendTestNotification");
const testResult=document.getElementById("testNotificationResult");
const testExplanation=document.getElementById("testScheduleExplanation");
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
const two=value=>String(value).padStart(2,"0");
const timeAt=(minutes)=>`${two(Math.floor(minutes/60)%24)}:${two(minutes%60)}`;
const nowMinutes=()=>{const d=new Date();return d.getHours()*60+d.getMinutes()};

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
  loadButton.onclick=loadEnrolledSubjects;
  sendButton.onclick=queueTestNotification;
  document.addEventListener("click",handleReviewAction);
  watchPendingReviews();
  showPage();
}

function updateTestExplanation(){
  if(!startInput.value||!endInput.value){testExplanation.textContent="開始・終了時刻を入力してください。";return}
  const [h,m]=startInput.value.split(":").map(Number);
  const notify=timeAt(h*60+m-10);
  testExplanation.textContent=`開始10分前の ${notify} に「出席／欠席」、終了5分前に「退席／早退」を通知します。終了10分後まで退席打刻できます。`;
}

async function loadEnrolledSubjects(){
  const number=studentInput.value.replace(/\D/g,"");
  if(!/^\d{7}$/.test(number)){showToast("7桁の学籍番号を入力してください");return}
  subjectSelect.disabled=true;
  subjectSelect.innerHTML="<option>読み込み中...</option>";
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
  if(!/^\d{7}$/.test(number)||!subject||subjectSelect.disabled||!startInput.value||!endInput.value||startInput.value>=endInput.value||startAt<nowMinutes()+1){showToast("開始時刻は1分以上先に設定してください");return}
  const testId=`admin_${Date.now()}`;
  const today=new Date();
  const date=`${today.getFullYear()}-${two(today.getMonth()+1)}-${two(today.getDate())}`;
  const expiresAt=new Date(today.getTime()+2*60*60*1000).toISOString();
  sendButton.disabled=true;
  try{
    await updateDoc(doc(db,"users",number),{
      attendanceNotificationTest:{enabled:true,testId,date,expiresAt,requestedBy:studentNumber||"",requestedAt:serverTimestamp(),lectures:[{subject,period:1,classGroup:classInput.value.trim(),startTime:startInput.value,endTime:endInput.value}]}
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
  return `<article class="attendance-review-card" data-path="${escapeHtml(item.ref.path)}"><div><b>${escapeHtml(data.subject||"科目未設定")}</b> <span class="report-status is-open">確認待ち</span></div><p>学生：${escapeHtml(data.studentNumber||item.ref.parent.parent?.id||"-")}<br>日時：${escapeHtml(data.date||"-")} ${escapeHtml(data.period||"-")}限<br>打刻：${escapeHtml(data.endLabel||"-")}（${formatDate(data.endClientAt)}）</p><div class="report-actions"><button class="btn btn-primary review-approve" data-status="PRESENT">出席として確定</button><button class="btn review-approve" data-status="EARLY_LEAVE">早退として確定</button><button class="btn btn-danger review-approve" data-status="ABSENT">欠席として確定</button></div></article>`;
}

function watchPendingReviews(){
  onSnapshot(query(collectionGroup(db,"attendanceRecords"),orderBy("updatedAt","desc"),limit(100)),snapshot=>{
    const pending=snapshot.docs.filter(item=>item.data().earlyEndReviewRequired===true&&item.data().earlyEndReviewStatus==="pending");
    badge.hidden=!pending.length;badge.textContent=pending.length;
    pendingList.innerHTML=pending.map(reviewCard).join("")||"<p>確認待ちの記録はありません。</p>";
  },error=>{console.error(error);pendingList.innerHTML="<p>確認待ちの記録を読み込めません。Firebaseルールを確認してください。</p>"});
}

async function handleReviewAction(event){
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
  }catch(error){console.error(error);showToast("確定に失敗しました。Firebaseルールを確認してください");button.disabled=false}
}
