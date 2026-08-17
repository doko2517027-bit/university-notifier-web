import {auth,setupTheme,initializePage,loadProfileImage,loadUserName,setupAdminTab} from "./common.js";
import {getIdTokenResult} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

const $=id=>document.getElementById(id);
const roleName={administrator:"病院管理者",doctor:"医師",nurse:"看護師",pharmacist:"薬剤師",pt:"理学療法士（PT）",ot:"作業療法士（OT）",st:"言語聴覚士（ST）",clerk:"医事・受付",auditor:"監査担当"};
const editableRoles=["doctor","nurse","pharmacist","pt","ot","st","clerk"];

document.head.insertAdjacentHTML("beforeend",`<style>
  .clinical-workspace{width:100%;max-width:none;padding:0 0 112px}.clinical-layout{grid-template-columns:320px minmax(0,1fr);gap:24px;align-items:start}.clinical-sidebar{top:18px;padding:18px}.clinical-sidebar h2{margin:0 0 12px;font-size:1.18rem}.clinical-patient{padding:13px 14px;margin:9px 0;font-size:.98rem}.clinical-patient:hover{border-color:#0f766e}.clinical-tabs{gap:9px;margin:18px 0 14px}.clinical-tabs button{padding:0 16px;min-height:44px;font-weight:700}.clinical-patient-head{padding-bottom:4px}.clinical-patient-head h2{font-size:1.45rem}.clinical-data-grid{grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.clinical-data-grid .card{padding:14px}.clinical-notice{padding:11px 15px;margin-bottom:14px;font-size:.9rem}.clinical-notice b{font-size:1rem}.clinical-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0}.clinical-editor{display:grid;gap:14px;max-width:none}.clinical-editor h3{margin:0}.clinical-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.clinical-form-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.clinical-editor label{display:grid;gap:7px;font-weight:700}.clinical-editor input,.clinical-editor textarea,.clinical-editor select{box-sizing:border-box;width:100%;font:inherit;padding:11px 12px;border:1px solid var(--border);border-radius:10px;background:var(--card);color:inherit}.clinical-editor textarea{resize:vertical;min-height:108px;line-height:1.6}.clinical-role-chip{padding:6px 11px;border-radius:999px;background:#e0f2fe;color:#075985;font-weight:700;font-size:.85rem}.clinical-record-type{border:1px solid var(--border);border-radius:14px;padding:16px;background:color-mix(in srgb,#0f766e 4%,var(--card))}.clinical-chart-values{display:flex;justify-content:space-between;gap:8px;margin-top:8px;color:var(--subtext);font-size:.85rem}@media(max-width:1100px){.clinical-layout{grid-template-columns:250px minmax(0,1fr);gap:14px}.clinical-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:780px){.clinical-workspace{padding-bottom:92px}.clinical-layout{grid-template-columns:1fr;gap:12px}.clinical-sidebar{position:static;padding:14px}.clinical-form-grid,.clinical-form-grid.two{grid-template-columns:1fr}.clinical-toolbar{align-items:stretch}.clinical-toolbar .btn,.clinical-toolbar select{width:100%}.clinical-tabs{margin-inline:-2px}.clinical-tabs button{padding:0 13px}.clinical-record-type{padding:13px}.clinical-data-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>`);
document.head.insertAdjacentHTML("beforeend",`<style>
  .clinical-calendar-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,360px);gap:18px;align-items:start}.clinical-day-detail{position:sticky;top:18px;margin-top:0;box-shadow:0 14px 35px rgba(15,23,42,.08)}@media(max-width:980px){.clinical-calendar-layout{grid-template-columns:1fr}.clinical-day-detail{position:static;margin-top:16px}}
</style>`);
document.head.insertAdjacentHTML("beforeend",`<style>.clinical-notice{display:none!important}</style>`);

document.head.insertAdjacentHTML("beforeend",`<style>
  .clinical-calendar-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0 14px}.clinical-calendar-toolbar h3{margin:0}.clinical-calendar-controls{display:flex;gap:8px;align-items:center}.clinical-calendar-controls button{min-height:38px;border:1px solid var(--border);border-radius:9px;background:var(--card);padding:0 12px;font:inherit;cursor:pointer}.clinical-calendar-weekdays,.clinical-calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}.clinical-calendar-weekdays span{padding:0 6px;color:var(--subtext);font-size:.82rem;font-weight:700}.clinical-calendar-day{position:relative;min-height:118px;padding:10px;border:1px solid var(--border);border-radius:12px;background:var(--card);text-align:left;cursor:pointer}.clinical-calendar-day:hover,.clinical-calendar-day.selected{border-color:#0f766e;box-shadow:0 0 0 2px rgba(15,118,110,.12)}.clinical-calendar-day.empty{visibility:hidden}.clinical-calendar-day time{font-weight:800}.clinical-calendar-events{display:grid;gap:4px;margin-top:7px}.clinical-calendar-event{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;border-radius:999px;padding:3px 6px;font-size:.72rem;font-weight:700}.clinical-calendar-event.nurse{background:#dbeafe;color:#1d4ed8}.clinical-calendar-event.doctor{background:#fee2e2;color:#b91c1c}.clinical-calendar-event.pharmacist{background:#f3e8ff;color:#7e22ce}.clinical-calendar-event.rehab{background:#dcfce7;color:#15803d}.clinical-calendar-event.schedule{background:#fef3c7;color:#92400e}.clinical-day-detail{margin-top:16px;padding:16px;border:1px solid var(--border);border-radius:14px;background:color-mix(in srgb,#0f766e 4%,var(--card))}.clinical-day-detail h4{margin:0 0 8px}.clinical-timeline-line{border-left:3px solid #0f766e;padding:4px 0 4px 12px;margin-top:9px}.clinical-timeline-line small{color:var(--subtext)}.clinical-line-chart{width:100%;height:240px;display:block;border:1px solid var(--border);border-radius:12px;background:var(--card)}.clinical-line-chart .grid{stroke:#dce5e8;stroke-width:1}.clinical-line-chart .axis{stroke:#64748b;stroke-width:1.4}.clinical-line-chart .series{fill:none;stroke:#0f9d8a;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.clinical-line-chart circle{fill:#0f9d8a;stroke:#fff;stroke-width:2}.clinical-chart-axis{display:flex;justify-content:space-between;font-size:.78rem;color:var(--subtext);margin:6px 10px 0}@media(max-width:780px){.clinical-calendar-weekdays,.clinical-calendar-grid{gap:4px}.clinical-calendar-weekdays span{padding:0;text-align:center;font-size:.7rem}.clinical-calendar-day{min-height:72px;padding:6px}.clinical-calendar-event{padding:2px 4px;font-size:.62rem}.clinical-calendar-toolbar{align-items:flex-start;flex-direction:column}.clinical-calendar-controls{width:100%;justify-content:space-between}.clinical-calendar-controls button{flex:1;padding:0 8px}.clinical-line-chart{height:200px}}
</style>`);

setupTheme($("themeButton"));
await initializePage([setupAdminTab(),loadUserName($("userName")),loadProfileImage($("topProfileImage"))]);

const token=auth.currentUser?await getIdTokenResult(auth.currentUser):null;
const claims=token?.claims||{};
if(claims.clinical!==true){$("workspace").innerHTML='<div class="clinical-empty">Clinicalへログインしてから開いてください。</div>';throw new Error("Clinical login required")}

const currentRole=String(claims.clinicalRole||"");
const hospitalId=String(claims.clinicalHospitalId||"");
$("roleLabel").textContent=`${roleName[currentRole]||"Clinical職員"} ・ ${hospitalId}`;
if(currentRole==="administrator")document.querySelector("header.header").insertAdjacentHTML("beforeend",'<p><a class="btn btn-secondary" href="clinical_admin.html">病院管理</a></p>');

const canManage=["administrator","clerk"].includes(currentRole);
const canEdit=editableRoles.includes(currentRole)||currentRole==="administrator";
if(canManage)$("addPatient").classList.remove("hidden");
if(canManage)document.querySelector(".clinical-sidebar").insertAdjacentHTML("beforeend",'<div class="clinical-toolbar"><button id="setICloudFile" class="btn btn-secondary">iCloudフォルダを設定</button><button id="loadICloudFile" class="btn btn-secondary">iCloudから読み込み</button><small id="cloudStatus">保存先は未設定です</small></div>');

let editorRole=currentRole==="administrator"?"nurse":currentRole;
let tab="overview";
let selectedId="";
let calendarMonth=new Date(2026,7,1);
let calendarDay="2026-08-17";
let editingRecordIndex=null;
let patients=[];
let clinicalDirectoryHandle=null;

const esc=value=>String(value??"").replace(/[&<>\"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[char]));
const currentPatient=()=>patients.find(patient=>patient.key===selectedId);
function patientAge(birth){if(!birth)return "年齢未設定";const date=new Date(`${birth}T00:00:00`);if(Number.isNaN(date.getTime()))return "年齢未設定";const today=new Date();let age=today.getFullYear()-date.getFullYear();const passed=today.getMonth()>date.getMonth()||(today.getMonth()===date.getMonth()&&today.getDate()>=date.getDate());if(!passed)age--;return `${Math.max(0,age)}歳`}
const allowEditor=()=>currentRole==="administrator"||currentRole===editorRole;
const cloudDB="caremate-clinical-icloud";
function cloudStatus(text){const el=$("cloudStatus");if(el)el.textContent=text}
function openCloudDB(){return new Promise((resolve,reject)=>{const request=indexedDB.open(cloudDB,1);request.onupgradeneeded=()=>request.result.createObjectStore("handles");request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function storeFileHandle(handle){const db=await openCloudDB();const tx=db.transaction("handles","readwrite");tx.objectStore("handles").put(handle,"patientFile");return new Promise(resolve=>tx.oncomplete=resolve)}
async function readFileHandle(){const db=await openCloudDB();const tx=db.transaction("handles","readonly");const request=tx.objectStore("handles").get("patientFile");return new Promise(resolve=>{request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>resolve(null)})}
const patientFileName=patient=>`caremate-clinical-${String(patient.key).replace(/[^A-Za-z0-9_-]/g,"")}.json`;
function normalizePatients(list){return list.map(patient=>({...patient,key:patient.key||crypto.randomUUID(),vitals:patient.vitals||[],vitalSeries:patient.vitalSeries||[],calendarEvents:patient.calendarEvents||[],records:patient.records||[]}))}
async function saveToICloud(){if(!clinicalDirectoryHandle)return;try{for(const patient of patients){const fileHandle=await clinicalDirectoryHandle.getFileHandle(patientFileName(patient),{create:true});const writable=await fileHandle.createWritable();await writable.write(JSON.stringify({version:1,patient},null,2));await writable.close()}cloudStatus(`${patients.length}人を患者別JSONで保存済み`)}catch(error){cloudStatus("保存できませんでした")}}
async function loadFromICloud(handle=clinicalDirectoryHandle){if(!handle)return;try{const loaded=[];for await(const [name,fileHandle] of handle.entries()){if(!name.startsWith("caremate-clinical-")||!name.endsWith(".json"))continue;const data=JSON.parse(await (await fileHandle.getFile()).text());if(data.patient)loaded.push(data.patient)}patients=normalizePatients(loaded);selectedId=patients[0]?.key||"";cloudStatus(`${patients.length}人をiCloudから読み込み済み`);render()}catch(error){alert("患者別保存ファイルを読み込めませんでした。")}}
async function configureICloudFile(){if(!window.showDirectoryPicker){alert("Chromeで開いてください。");return}try{clinicalDirectoryHandle=await window.showDirectoryPicker({mode:"readwrite"});await storeFileHandle(clinicalDirectoryHandle);await saveToICloud();cloudStatus("iCloudフォルダを設定済み")}catch(error){}}
async function chooseICloudFile(){if(!window.showDirectoryPicker){alert("Chromeで開いてください。");return}try{clinicalDirectoryHandle=await window.showDirectoryPicker({mode:"readwrite"});await storeFileHandle(clinicalDirectoryHandle);await loadFromICloud()}catch(error){}}
async function restoreICloudFile(){clinicalDirectoryHandle=await readFileHandle();if(!clinicalDirectoryHandle)return;if(clinicalDirectoryHandle.kind!=="directory"){clinicalDirectoryHandle=null;cloudStatus("患者別JSON用にiCloudフォルダを設定してください");return}const permission=await clinicalDirectoryHandle.queryPermission({mode:"readwrite"});if(permission==="granted")await loadFromICloud();else cloudStatus("iCloudフォルダを再選択してください")}

function renderPatients(){
  const keyword=$("patientSearch").value.trim().toLowerCase();
  const rows=patients.filter(patient=>`${patient.id} ${patient.label}`.toLowerCase().includes(keyword));
  $("patientList").innerHTML=rows.length?rows.map(patient=>`<button class="clinical-patient ${patient.key===selectedId?"active":""}" data-patient="${patient.key}"><b>${esc(patient.label)}</b><small>患者番号：${esc(patient.id)} ・ ${esc(patient.department)} ・ ${esc(patient.status)}</small></button>`).join(""):"<small>該当する患者はいません。</small>";
}

function tabButtons(){
  return `<div class="clinical-tabs">${[["overview","患者サマリー"],["calendar","時系列カレンダー"],["entry","職種別入力"],["records","多職種カルテ"],["orders","指示・予定"],["charts","グラフ・データ"],["audit","監査・書き出し"]].map(([id,label])=>`<button class="${tab===id?"active":""}" data-tab="${id}">${label}</button>`).join("")}</div>`;
}

function overview(patient){
  const statusOptions=["外来","入院中","退院","転院","死亡","その他"];
  return `<div class="clinical-editor"><h3>患者サマリー</h3><div class="clinical-form-grid"><label>患者区分<select id="patientStatusEdit" ${canEdit?"":"disabled"}>${statusOptions.map(status=>`<option ${patient.status===status?"selected":""}>${status}</option>`).join("")}</select></label><label>診療科<input id="patientDepartmentEdit" value="${esc(patient.department)}" ${canEdit?"":"readonly"}></label><label>主訴<input id="patientChiefComplaintEdit" value="${esc(patient.chiefComplaint||"")}" ${canEdit?"":"readonly"}></label></div><label>既往歴・経歴<textarea id="patientHistoryEdit" ${canEdit?"":"readonly"}>${esc(patient.history||"")}</textarea></label><label>サマリー<textarea id="summaryText" ${canEdit?"":"readonly"}>${esc(patient.summary)}</textarea></label>${canEdit?'<div class="clinical-toolbar"><button id="saveSummary" class="btn btn-primary">患者情報・サマリーを保存</button><button id="deletePatient" class="btn btn-secondary">この患者情報を削除</button></div>':""}<div class="clinical-data-grid"><div class="card"><small>記録件数</small><b>${patient.records.length}件</b></div><div class="card"><small>現在の職種</small><b>${esc(roleName[currentRole]||"職員")}</b></div></div></div>`;
}

function registrationPanel(){
  return `<div class="clinical-editor"><h2>患者を登録</h2><div class="clinical-form-grid"><label>氏名<input id="patientName" placeholder="氏名"></label><label>性別<select id="patientSex"><option>未設定</option><option>男性</option><option>女性</option><option>その他</option></select></label><label>生年月日<input id="patientBirth" type="date"></label><label>患者区分<select id="patientStatus"><option>外来</option><option>入院中</option><option>退院</option></select></label><label>診療科<input id="patientDepartment" placeholder="例：内科"></label><label>患者ID<input id="patientIdentifier" placeholder="院内患者ID"></label></div><label>既往歴・経歴<textarea id="patientHistory" placeholder="既往歴、アレルギー等"></textarea></label><label>主訴<textarea id="patientChiefComplaint" placeholder="主訴、来院理由"></textarea></label><label>患者サマリー<textarea id="patientSummary" placeholder="治療経過・注意事項等"></textarea></label><button id="savePatient" class="btn btn-primary">患者を登録してカルテを開く</button></div>`;
}
function emptyPatientPanel(){return `<div class="clinical-empty"><h2>患者が登録されていません</h2><p>左の「患者を追加」から登録できます。</p><button id="startPatientRegistration" class="btn btn-primary">患者を追加</button></div>`}

function rolePicker(){
  if(currentRole!=="administrator")return `<span class="clinical-role-chip">${esc(roleName[currentRole]||"職員")}</span>`;
  return `<label>編集する職種<select id="editorRole">${editableRoles.map(role=>`<option value="${role}" ${editorRole===role?"selected":""}>${roleName[role]}</option>`).join("")}</select></label>`;
}

function nurseEditor(record=null){
  const vitals=record?.vitals||{};const parts=String(record?.body||"").split("\nO：");const subjective=parts[0].replace(/^S：/,"");const objective=parts.slice(1).join("\nO：");
  const menstrual=currentPatient()?.sex==="女性"?`<div class="clinical-record-type"><h4>月経記録</h4><div class="clinical-form-grid"><label>月経開始日<input id="menstrualLast" type="date" value="${esc(vitals.menstrualLast||"")}"></label><label>月経終了日<input id="menstrualEnd" type="date" value="${esc(vitals.menstrualEnd||"")}"></label><label>周期（日）<input id="menstrualCycle" inputmode="numeric" value="${esc(vitals.menstrualCycle||"")}" placeholder="例：28"></label><label>経血量<select id="menstrualFlow"><option value="">未記録</option>${["少ない","普通","多い"].map(item=>`<option ${vitals.menstrualFlow===item?"selected":""}>${item}</option>`).join("")}</select></label><label>月経痛（0〜10）<input id="menstrualPain" inputmode="numeric" value="${esc(vitals.menstrualPain||"")}" placeholder="例：0"></label><label>関連症状<input id="menstrualSymptoms" value="${esc(vitals.menstrualSymptoms||"")}" placeholder="例：腹痛、頭痛、悪心"></label></div><label>月経に関する記録<textarea id="menstrualNote" placeholder="周期・症状・留意事項">${esc(vitals.menstrualNote||"")}</textarea></label></div>`:"";
  return `<div class="clinical-record-type"><h3>看護記録</h3><p class="clinical-note">バイタル・身体計測・観察・S/Oデータを入力します。</p><div class="clinical-form-grid"><label>体温（℃）<input id="vitalTemp" inputmode="decimal" value="${esc(vitals.temp||"")}" placeholder="例：36.5"></label><label>脈拍（回/分）<input id="vitalPulse" inputmode="numeric" value="${esc(vitals.pulse||"")}" placeholder="例：72"></label><label>呼吸数（回/分）<input id="vitalRespiratory" inputmode="numeric" value="${esc(vitals.respiratory||"")}" placeholder="例：16"></label><label>SpO₂（%）<input id="vitalSpo2" inputmode="numeric" value="${esc(vitals.spo2||"")}" placeholder="例：98"></label><label>収縮期BP<input id="vitalSys" inputmode="numeric" value="${esc(vitals.sys||"")}" placeholder="例：118"></label><label>拡張期BP<input id="vitalDia" inputmode="numeric" value="${esc(vitals.dia||"")}" placeholder="例：72"></label><label>身長（cm）<input id="vitalHeight" inputmode="decimal" value="${esc(vitals.height||"")}" placeholder="例：160"></label><label>体重（kg）<input id="vitalWeight" inputmode="decimal" value="${esc(vitals.weight||"")}" placeholder="例：52.0"></label><label>疼痛スケール<input id="painScale" inputmode="numeric" value="${esc(vitals.pain||"")}" placeholder="例：0"></label><label>意識レベル<input id="consciousness" value="${esc(vitals.consciousness||"")}" placeholder="例：清明 / JCS"></label><label>摂取量（mL）<input id="intake" inputmode="numeric" value="${esc(vitals.intake||"")}"></label><label>排出量（mL）<input id="output" inputmode="numeric" value="${esc(vitals.output||"")}"></label></div>${menstrual}<label>S：主観的情報<textarea id="subjective" placeholder="患者の訴え・自覚症状">${esc(subjective)}</textarea></label><label>O：客観的情報<textarea id="objective" placeholder="観察事項・測定値・実施ケア">${esc(objective)}</textarea></label></div>`;
}

function doctorEditor(){
  return `<div class="clinical-record-type"><h3>医師記録・指示</h3><p class="clinical-note">診療記録と、検査・処置・薬剤などの指示を編集します。</p><label>診療記録（SOAP等）<textarea id="medicalRecord" placeholder="診察所見、評価、計画を入力"></textarea></label><label>主病名・診断名<textarea id="diagnosis" placeholder="診断名・病態評価"></textarea></label><label>新規指示<textarea id="doctorOrders" placeholder="検査・処置・薬剤・安静度など"></textarea></label></div>`;
}

function pharmacyEditor(){
  return `<div class="clinical-record-type"><h3>薬剤管理記録</h3><p class="clinical-note">薬剤の確認・服薬状況・副作用評価を記録します。医師の指示自体は変更できません。</p><label>持参薬・服薬状況<textarea id="medicationHistory" placeholder="持参薬、服薬状況、相互作用確認"></textarea></label><label>薬学的評価<textarea id="pharmacyAssessment" placeholder="用法・用量、腎機能、相互作用、副作用評価"></textarea></label><label>医師への提案<textarea id="pharmacySuggestion" placeholder="疑義照会・処方提案"></textarea></label></div>`;
}

function rehabEditor(){
  const discipline=editorRole==="pt"?"理学療法":editorRole==="ot"?"作業療法":"言語聴覚療法";
  return `<div class="clinical-record-type"><h3>${discipline}記録</h3><p class="clinical-note">評価・目標・実施内容・次回計画を記録します。</p><label>評価<textarea id="rehabAssessment" placeholder="身体・活動・参加の評価"></textarea></label><label>目標<textarea id="rehabGoal" placeholder="短期目標・長期目標"></textarea></label><label>実施内容<textarea id="rehabIntervention" placeholder="実施した訓練・反応"></textarea></label><label>次回計画<textarea id="rehabPlan" placeholder="次回の予定・連携事項"></textarea></label></div>`;
}

function clerkEditor(){
  return `<div class="clinical-record-type"><h3>医事・受付記録</h3><p class="clinical-note">受付・入退院・連絡事項を記録します。診療内容や医師指示は編集できません。</p><label>受付・事務記録<textarea id="clerkRecord" placeholder="受付、予約、連絡、書類管理等"></textarea></label><label>連絡事項<textarea id="clerkNotice" placeholder="患者・家族・院内連携への連絡事項"></textarea></label></div>`;
}

function entryPanel(){
  if(!canEdit)return `<h3>職種別入力</h3><div class="clinical-empty">この職種は記録の閲覧のみです。</div>`;
  let form=editorRole==="nurse"?nurseEditor():editorRole==="doctor"?doctorEditor():editorRole==="pharmacist"?pharmacyEditor():["pt","ot","st"].includes(editorRole)?rehabEditor():clerkEditor();
  const now=new Date();
  return `<div class="clinical-editor"><div class="clinical-toolbar"><h3>職種別入力</h3>${rolePicker()}</div><div class="clinical-form-grid two"><label>記録日<input id="entryDate" type="date" value="${esc(calendarDay)}"></label><label>記録時刻<input id="entryTime" type="time" value="${now.toTimeString().slice(0,5)}"></label></div>${form}<label>記録タイトル<input id="entryTitle" maxlength="120" placeholder="例：午前の経過記録"></label><button id="saveRoleEntry" class="btn btn-primary">${esc(roleName[editorRole])}として記録を保存</button></div>`;
}

function recordsPanel(patient){
  if(editingRecordIndex!==null){
    const record=patient.records[editingRecordIndex];
    if(!record){editingRecordIndex=null;return recordsPanel(patient)}
    const fields=record.role==="nurse"?nurseEditor(record):`<label>記録内容<textarea id="recordEditBody">${esc(record.body)}</textarea></label><label>補足・詳細<textarea id="recordEditDetails">${esc(record.details||"")}</textarea></label>`;
    return `<div class="clinical-editor"><div class="clinical-toolbar"><h3>記録を編集</h3><span class="clinical-role-chip">${esc(roleName[record.role]||record.role)}</span></div><label>記録タイトル<input id="recordEditTitle" value="${esc(record.title)}"></label>${fields}<label>記録日<input id="recordEditDate" type="date" value="${esc(record.date||calendarDay)}"></label><div class="clinical-toolbar"><button id="saveRecordEdit" class="btn btn-primary">変更を保存</button><button id="cancelRecordEdit" class="btn btn-secondary">一覧へ戻る</button></div></div>`;
  }
  const lines=patient.records.map((record,index)=>`<article class="clinical-entry"><small>${esc(roleName[record.role]||record.role)} ・ ${esc(record.time)}</small><br><b>${esc(record.title)}</b><p>${esc(record.body).replace(/\n/g,"<br>")}</p>${record.details?`<small>${esc(record.details).replace(/\n/g,"<br>")}</small>`:""}${(currentRole==="administrator"||currentRole===record.role)?`<p><button class="btn btn-secondary" data-edit-record="${index}">記録を編集</button></p>`:""}</article>`).join("");
  return `<h3>多職種カルテ</h3>${lines||"<p>記録はありません。</p>"}`;
}

function ordersPanel(patient){
  const canEditOrders=currentRole==="administrator"||currentRole==="doctor";
  const canEditSchedule=canEditOrders||currentRole==="clerk";
  return `<div class="clinical-editor"><h3>指示・予定</h3><label>診療・処置・薬剤等の指示<textarea id="ordersText" rows="6" ${canEditOrders?"":"readonly"}>${esc(patient.orders)}</textarea></label>${canEditOrders?'<button id="saveOrders" class="btn btn-primary">指示を更新</button>':'<p class="clinical-note">指示は閲覧できますが、編集できるのは医師と病院管理者だけです。</p>'}<label>検査・処置・リハビリ等の予定<textarea id="scheduleText" rows="5" ${canEditSchedule?"":"readonly"}>${esc(patient.schedule)}</textarea></label>${canEditSchedule?'<button id="saveSchedule" class="btn btn-secondary">予定を更新</button>':'<p class="clinical-note">予定は閲覧のみです。</p>'}</div>`;
}

function chartsPanel(patient){
  const series=patient.vitalSeries||[];
  const graph=(label,key,unit)=>{
    const points=series.map((item,index)=>({value:Number(item[key]),date:item.date||`記録${index+1}`})).filter(item=>Number.isFinite(item.value)&&item.value>0);
    if(!points.length)return `<section class="clinical-record-type"><h3>${label}</h3><p class="clinical-note">記録はありません。</p></section>`;
    const min=Math.floor(Math.min(...points.map(item=>item.value)));const max=Math.ceil(Math.max(...points.map(item=>item.value)))+(points.length===1?1:0);const range=Math.max(1,max-min);const width=760,height=240,left=54,right=20,top=20,bottom=42;const x=index=>points.length===1?(left+width-right)/2:left+index*(width-left-right)/(points.length-1);const y=value=>top+(max-value)*(height-top-bottom)/range;const path=points.map((item,index)=>`${index?"L":"M"}${x(index).toFixed(1)},${y(item.value).toFixed(1)}`).join(" ");
    return `<section class="clinical-record-type"><h3>${label}</h3><svg class="clinical-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}の時系列折れ線グラフ"><line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${height-bottom}"/><line class="axis" x1="${left}" y1="${height-bottom}" x2="${width-right}" y2="${height-bottom}"/>${[0,.25,.5,.75,1].map(r=>`<line class="grid" x1="${left}" y1="${top+r*(height-top-bottom)}" x2="${width-right}" y2="${top+r*(height-top-bottom)}"/><text x="8" y="${top+r*(height-top-bottom)+4}" font-size="11" fill="#64748b">${(max-r*range).toFixed(1)}</text>`).join("")}<path class="series" d="${path}"/>${points.map((item,index)=>`<circle cx="${x(index)}" cy="${y(item.value)}" r="5"><title>${esc(item.date)}：${item.value}${unit}</title></circle>`).join("")}</svg><div class="clinical-chart-axis">${points.map(item=>`<span>${esc(item.date)}</span>`).join("")}</div></section>`;
  };
  return `<div class="clinical-editor"><h2>グラフ・データ</h2>${graph("体温","temp","℃")}${graph("脈拍","pulse","回/分")}${graph("呼吸数","respiratory","回/分")}${graph("血圧（収縮期）","sys","mmHg")}${graph("血圧（拡張期）","dia","mmHg")}${graph("SpO₂","spo2","%")}${graph("体重","weight","kg")}</div>`;
}

function dateKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`}
function patientEvents(patient){
  return [...(patient.calendarEvents||[]),...patient.records.filter(record=>record.date).map(record=>({date:record.date,time:record.time,type:["pt","ot","st"].includes(record.role)?"rehab":record.role,label:`${roleName[record.role]||"職員"}：${record.title}`,detail:record.body,recordId:record.id}))];
}
function calendarPanel(patient){
  const monthStart=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1);
  const gridStart=new Date(monthStart);gridStart.setDate(1-monthStart.getDay());
  const events=patientEvents(patient);
  const days=Array.from({length:42},(_,offset)=>{const date=new Date(gridStart);date.setDate(gridStart.getDate()+offset);const key=dateKey(date);const inside=date.getMonth()===monthStart.getMonth();const items=events.filter(item=>item.date===key);return `<button class="clinical-calendar-day ${inside?"":"empty"} ${calendarDay===key?"selected":""}" data-calendar-day="${key}" ${inside?"":"tabindex=-1"}><time>${date.getDate()}</time><span class="clinical-calendar-events">${items.slice(0,3).map(item=>`<span class="clinical-calendar-event ${esc(item.type)}">${esc(item.label)}</span>`).join("")}${items.length>3?`<small>+${items.length-3}件</small>`:""}</span></button>`}).join("");
  const selected=events.filter(item=>item.date===calendarDay);
  const selectedLabel=new Intl.DateTimeFormat("ja-JP",{year:"numeric",month:"long",day:"numeric",weekday:"short"}).format(new Date(`${calendarDay}T00:00:00`));
  return `<div class="clinical-calendar-toolbar"><h3>時系列カレンダー</h3><div class="clinical-calendar-controls"><button data-calendar-nav="-1">前月</button><b>${calendarMonth.getFullYear()}年 ${calendarMonth.getMonth()+1}月</b><button data-calendar-nav="1">翌月</button></div></div><p class="clinical-note">日付を選ぶと、その日の職種別記録・指示・予定を右側に表示します。</p><div class="clinical-calendar-layout"><div><div class="clinical-calendar-weekdays"><span>日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span></div><div class="clinical-calendar-grid">${days}</div></div><section class="clinical-day-detail"><h4>${selectedLabel}</h4>${selected.length?selected.map(item=>`<div class="clinical-timeline-line"><b>${esc(item.label)}</b><br><small>${esc(item.time?`${item.time} ・ `:"")}${esc(item.detail)}</small></div>`).join(""):'<p>この日の記録・予定はありません。</p>'}</section></div>`;
}

function auditPanel(){
  return `<h3>監査・書き出し</h3><p>本番運用では、記録の閲覧・変更・確定・出力を、利用者ID・日時・対象・操作内容とともに監査します。</p><button class="btn btn-secondary" disabled>書き出しは安全基盤の整備後に有効化</button>`;
}

function panel(patient){
  if(tab==="register")return registrationPanel();
  if(tab==="overview")return overview(patient);
  if(tab==="calendar")return calendarPanel(patient);
  if(tab==="entry")return entryPanel();
  if(tab==="records")return recordsPanel(patient);
  if(tab==="orders")return ordersPanel(patient);
  if(tab==="charts")return chartsPanel(patient);
  return auditPanel();
}

function render(){
  const patient=currentPatient();
  renderPatients();
  if(!patient){$("workspace").innerHTML=tab==="register"?registrationPanel():emptyPatientPanel();return}
  $("workspace").innerHTML=`<div class="clinical-patient-head"><div><h2>${esc(patient.label)}</h2><p class="clinical-note">患者番号：${esc(patient.id)}　｜　性別：${esc(patient.sex||"未設定")}　｜　年齢：${patientAge(patient.birth)}</p><div class="clinical-badges"><span class="clinical-badge">${esc(patient.department)}</span><span class="clinical-badge">${esc(patient.status)}</span></div></div></div>${tabButtons()}<div id="panel">${panel(patient)}</div>`;
}

function value(id){return $(id)?.value.trim()||""}
function saveRoleEntry(){
  const patient=currentPatient();
  if(event.target.id==="startPatientRegistration"){tab="register";render();return}
  const title=value("entryTitle")||`${roleName[editorRole]}記録`;
  let body="",details="",vitals=null;
  if(editorRole==="nurse"){
    body=`S：${value("subjective")}\nO：${value("objective")}`;
    vitals={temp:value("vitalTemp"),pulse:value("vitalPulse"),respiratory:value("vitalRespiratory"),spo2:value("vitalSpo2"),sys:value("vitalSys"),dia:value("vitalDia"),height:value("vitalHeight"),weight:value("vitalWeight"),pain:value("painScale"),consciousness:value("consciousness"),intake:value("intake"),output:value("output"),menstrualLast:value("menstrualLast"),menstrualEnd:value("menstrualEnd"),menstrualCycle:value("menstrualCycle"),menstrualFlow:value("menstrualFlow"),menstrualPain:value("menstrualPain"),menstrualSymptoms:value("menstrualSymptoms"),menstrualNote:value("menstrualNote")};
    details=`体温 ${vitals.temp||"—"}℃ ／ 脈拍 ${vitals.pulse||"—"} ／ 呼吸 ${vitals.respiratory||"—"} ／ SpO₂ ${vitals.spo2||"—"}% ／ BP ${vitals.sys||"—"}/${vitals.dia||"—"} ／ 身長 ${vitals.height||"—"}cm ／ 体重 ${vitals.weight||"—"}kg ／ 摂取/排出 ${vitals.intake||"—"}/${vitals.output||"—"}mL ／ 疼痛 ${vitals.pain||"—"}`;
    if(Number(vitals.temp)>0)patient.vitals.push(Number(vitals.temp));
    patient.vitalSeries=patient.vitalSeries||[];
  }else if(editorRole==="doctor"){
    body=value("medicalRecord");details=`主病名・診断名：${value("diagnosis")}`;
    const newOrders=value("doctorOrders");if(newOrders)patient.orders=newOrders;
  }else if(editorRole==="pharmacist"){
    body=value("pharmacyAssessment");details=`服薬状況：${value("medicationHistory")}\n医師への提案：${value("pharmacySuggestion")}`;
  }else if(["pt","ot","st"].includes(editorRole)){
    body=value("rehabIntervention");details=`評価：${value("rehabAssessment")}\n目標：${value("rehabGoal")}\n次回計画：${value("rehabPlan")}`;
  }else{body=value("clerkRecord");details=`連絡事項：${value("clerkNotice")}`}
  if(!body&&!details)return alert("記録内容を入力してください。");
  const recordId=crypto.randomUUID();
  const entryDate=value("entryDate")||calendarDay;
  const entryTime=value("entryTime")||new Date().toTimeString().slice(0,5);
  if(editorRole==="nurse")patient.vitalSeries.push({...vitals,date:entryDate,time:entryTime,recordId});
  patient.records.unshift({id:recordId,role:editorRole,title,body:body||"記録を保存しました。",details,time:entryTime,date:entryDate,vitals:editorRole==="nurse"?vitals:undefined});
  saveToICloud();
  tab="records";
  render();
}

$("patientSearch").oninput=renderPatients;
$("addPatient").textContent="＋ 患者を追加";
$("addPatient").onclick=()=>{selectedId="";tab="register";render()};
document.addEventListener("change",event=>{if(event.target.id==="editorRole"){editorRole=event.target.value;render()}});
document.addEventListener("click",async event=>{
  const patientButton=event.target.closest("[data-patient]");
  const tabButton=event.target.closest("[data-tab]");
  const calendarDayButton=event.target.closest("[data-calendar-day]");
  const calendarNavButton=event.target.closest("[data-calendar-nav]");
  if(patientButton){selectedId=patientButton.dataset.patient;tab="overview";editingRecordIndex=null;render();return}
  if(tabButton){tab=tabButton.dataset.tab;editingRecordIndex=null;render();return}
  if(calendarDayButton){calendarDay=calendarDayButton.dataset.calendarDay;render();return}
  if(calendarNavButton){calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+Number(calendarNavButton.dataset.calendarNav),1);calendarDay=dateKey(calendarMonth);render();return}
  const patient=currentPatient();
  if(event.target.id==="savePatient"){const name=value("patientName");if(!name)return alert("氏名を入力してください。");const id=value("patientIdentifier")||`PAT-${Date.now().toString().slice(-6)}`;const key=crypto.randomUUID();patients.push({key,id,label:name,sex:value("patientSex"),birth:value("patientBirth"),history:value("patientHistory"),chiefComplaint:value("patientChiefComplaint"),department:value("patientDepartment")||"未設定",status:value("patientStatus"),summary:value("patientSummary"),vitals:[],vitalSeries:[],calendarEvents:[],records:[],orders:"",schedule:""});selectedId=key;tab="overview";saveToICloud();render();return}
  if(!patient)return;
  if(event.target.id==="saveSummary"){patient.summary=value("summaryText");patient.status=value("patientStatusEdit");patient.department=value("patientDepartmentEdit");patient.chiefComplaint=value("patientChiefComplaintEdit");patient.history=value("patientHistoryEdit");saveToICloud();render();return}
  if(event.target.id==="deletePatient"){if(!confirm(`「${patient.label}」の患者情報と記録を削除します。`))return;patients=patients.filter(item=>item.key!==patient.key);if(clinicalDirectoryHandle){try{await clinicalDirectoryHandle.removeEntry(patientFileName(patient))}catch(error){}}selectedId=patients[0]?.key||"";tab="overview";saveToICloud();render();return}
  const editRecordButton=event.target.closest("[data-edit-record]");
  if(editRecordButton){editingRecordIndex=Number(editRecordButton.dataset.editRecord);tab="records";render();return}
  if(event.target.id==="cancelRecordEdit"){editingRecordIndex=null;render();return}
  if(event.target.id==="saveRecordEdit"){const record=patient.records[editingRecordIndex];record.title=value("recordEditTitle");record.date=value("recordEditDate");if(record.role==="nurse"){const vitals={temp:value("vitalTemp"),pulse:value("vitalPulse"),respiratory:value("vitalRespiratory"),spo2:value("vitalSpo2"),sys:value("vitalSys"),dia:value("vitalDia"),height:value("vitalHeight"),weight:value("vitalWeight"),pain:value("painScale"),consciousness:value("consciousness"),intake:value("intake"),output:value("output"),menstrualLast:value("menstrualLast"),menstrualEnd:value("menstrualEnd"),menstrualCycle:value("menstrualCycle"),menstrualFlow:value("menstrualFlow"),menstrualPain:value("menstrualPain"),menstrualSymptoms:value("menstrualSymptoms"),menstrualNote:value("menstrualNote")};record.vitals=vitals;record.body=`S：${value("subjective")}\nO：${value("objective")}`;record.details=`体温 ${vitals.temp||"—"}℃ ／ 脈拍 ${vitals.pulse||"—"} ／ 呼吸 ${vitals.respiratory||"—"} ／ SpO₂ ${vitals.spo2||"—"}% ／ BP ${vitals.sys||"—"}/${vitals.dia||"—"} ／ 身長 ${vitals.height||"—"}cm ／ 体重 ${vitals.weight||"—"}kg ／ 摂取/排出 ${vitals.intake||"—"}/${vitals.output||"—"}mL ／ 疼痛 ${vitals.pain||"—"}`;const index=patient.vitalSeries.findIndex(item=>item.recordId===record.id);const next={...vitals,date:record.date,recordId:record.id};if(index>=0)patient.vitalSeries[index]=next;else patient.vitalSeries.push(next)}else{record.body=value("recordEditBody");record.details=value("recordEditDetails")}record.time="編集済み";editingRecordIndex=null;saveToICloud();render();return}
  if(event.target.id==="saveRoleEntry")saveRoleEntry();
  if(event.target.id==="saveOrders"){patient.orders=value("ordersText");saveToICloud();render()}
  if(event.target.id==="saveSchedule"){patient.schedule=value("scheduleText");saveToICloud();render()}
});
$("setICloudFile")?.addEventListener("click",configureICloudFile);
$("loadICloudFile")?.addEventListener("click",chooseICloudFile);
restoreICloudFile();
render();
