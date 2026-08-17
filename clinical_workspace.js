import {auth,setupTheme,initializePage,loadProfileImage,loadUserName,setupAdminTab} from "./common.js";
import {getIdTokenResult} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

const $=id=>document.getElementById(id);
const roleName={administrator:"病院管理者",doctor:"医師",nurse:"看護師",pharmacist:"薬剤師",pt:"理学療法士（PT）",ot:"作業療法士（OT）",st:"言語聴覚士（ST）",clerk:"医事・受付",auditor:"監査担当"};
const editableRoles=["doctor","nurse","pharmacist","pt","ot","st","clerk"];

document.head.insertAdjacentHTML("beforeend",`<style>
  .clinical-workspace{max-width:1540px;padding:0 28px 112px}.clinical-layout{grid-template-columns:320px minmax(0,1fr);gap:20px;align-items:start}.clinical-sidebar{top:18px;padding:18px}.clinical-sidebar h2{margin:0 0 12px;font-size:1.18rem}.clinical-patient{padding:13px 14px;margin:9px 0;font-size:.98rem}.clinical-patient:hover{border-color:#0f766e}.clinical-tabs{gap:9px;margin:18px 0 14px}.clinical-tabs button{padding:0 16px;min-height:44px;font-weight:700}.clinical-patient-head{padding-bottom:4px}.clinical-patient-head h2{font-size:1.45rem}.clinical-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0}.clinical-editor{display:grid;gap:14px;max-width:1040px}.clinical-editor h3{margin:0}.clinical-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.clinical-form-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.clinical-editor label{display:grid;gap:7px;font-weight:700}.clinical-editor input,.clinical-editor textarea,.clinical-editor select{box-sizing:border-box;width:100%;font:inherit;padding:11px 12px;border:1px solid var(--border);border-radius:10px;background:var(--card);color:inherit}.clinical-editor textarea{resize:vertical;min-height:108px;line-height:1.6}.clinical-role-chip{padding:6px 11px;border-radius:999px;background:#e0f2fe;color:#075985;font-weight:700;font-size:.85rem}.clinical-record-type{border:1px solid var(--border);border-radius:14px;padding:16px;background:color-mix(in srgb,#0f766e 4%,var(--card))}.clinical-chart-values{display:flex;justify-content:space-between;gap:8px;margin-top:8px;color:var(--subtext);font-size:.85rem}@media(max-width:1100px){.clinical-workspace{padding-inline:18px}.clinical-layout{grid-template-columns:270px minmax(0,1fr);gap:14px}.clinical-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:780px){.clinical-workspace{padding:0 12px 92px}.clinical-layout{grid-template-columns:1fr;gap:12px}.clinical-sidebar{position:static;padding:14px}.clinical-form-grid,.clinical-form-grid.two{grid-template-columns:1fr}.clinical-toolbar{align-items:stretch}.clinical-toolbar .btn,.clinical-toolbar select{width:100%}.clinical-tabs{margin-inline:-2px}.clinical-tabs button{padding:0 13px}.clinical-record-type{padding:13px}}
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

let editorRole=currentRole==="administrator"?"nurse":currentRole;
let tab="overview";
let selectedId="CASE-001";
let patients=[
  {id:"CASE-001",label:"検証ケース 001",department:"内科",status:"入院中",summary:"検証用の患者サマリーです。",vitals:[36.4,36.6,36.5,36.7],records:[{role:"nurse",title:"看護記録",body:"観察・ケア記録（検証用）",time:"本日 09:00",details:"S：体調変化なし\nO：安静時、呼吸状態安定"}],orders:"点滴・検査・処置の指示は医師または病院管理者のみ編集できます。",schedule:"10:00 検査予定\n14:00 リハビリ予定"},
  {id:"CASE-002",label:"検証ケース 002",department:"整形外科",status:"外来",summary:"検証用の患者サマリーです。",vitals:[36.2,36.4,36.3,36.5],records:[],orders:"指示は未登録です。",schedule:"予定は未登録です。"}
];

const esc=value=>String(value??"").replace(/[&<>\"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[char]));
const currentPatient=()=>patients.find(patient=>patient.id===selectedId);
const allowEditor=()=>currentRole==="administrator"||currentRole===editorRole;

function renderPatients(){
  const keyword=$("patientSearch").value.trim().toLowerCase();
  const rows=patients.filter(patient=>`${patient.id} ${patient.label}`.toLowerCase().includes(keyword));
  $("patientList").innerHTML=rows.length?rows.map(patient=>`<button class="clinical-patient ${patient.id===selectedId?"active":""}" data-patient="${patient.id}"><b>${esc(patient.label)}</b><small>${esc(patient.id)} ・ ${esc(patient.department)} ・ ${esc(patient.status)}</small></button>`).join(""):"<small>該当するケースはありません。</small>";
}

function tabButtons(){
  return `<div class="clinical-tabs">${[["overview","患者サマリー"],["entry","職種別入力"],["records","多職種カルテ"],["orders","指示・予定"],["charts","グラフ・データ"],["audit","監査・書き出し"]].map(([id,label])=>`<button class="${tab===id?"active":""}" data-tab="${id}">${label}</button>`).join("")}</div>`;
}

function overview(patient){
  return `<h3>患者サマリー</h3><p>${esc(patient.summary)}</p><div class="clinical-data-grid"><div class="card"><small>患者区分</small><b>${esc(patient.status)}</b></div><div class="card"><small>診療科</small><b>${esc(patient.department)}</b></div><div class="card"><small>記録件数</small><b>${patient.records.length}件</b></div><div class="card"><small>現在の職種</small><b>${esc(roleName[currentRole]||"職員")}</b></div></div>`;
}

function rolePicker(){
  if(currentRole!=="administrator")return `<span class="clinical-role-chip">${esc(roleName[currentRole]||"職員")}</span>`;
  return `<label>編集する職種<select id="editorRole">${editableRoles.map(role=>`<option value="${role}" ${editorRole===role?"selected":""}>${roleName[role]}</option>`).join("")}</select></label>`;
}

function nurseEditor(){
  return `<div class="clinical-record-type"><h3>看護記録</h3><p class="clinical-note">バイタルサインとS/Oデータを入力します。</p><div class="clinical-form-grid"><label>体温（℃）<input id="vitalTemp" inputmode="decimal" placeholder="例：36.5"></label><label>脈拍（回/分）<input id="vitalPulse" inputmode="numeric" placeholder="例：72"></label><label>SpO₂（%）<input id="vitalSpo2" inputmode="numeric" placeholder="例：98"></label><label>収縮期BP<input id="vitalSys" inputmode="numeric" placeholder="例：118"></label><label>拡張期BP<input id="vitalDia" inputmode="numeric" placeholder="例：72"></label><label>疼痛スケール<input id="painScale" inputmode="numeric" placeholder="例：0"></label></div><label>S：主観的情報<textarea id="subjective" placeholder="患者の訴え・自覚症状"></textarea></label><label>O：客観的情報<textarea id="objective" placeholder="観察事項・測定値・実施ケア"></textarea></label></div>`;
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
  return `<div class="clinical-editor"><div class="clinical-toolbar"><h3>職種別入力</h3>${rolePicker()}</div>${form}<label>記録タイトル<input id="entryTitle" maxlength="120" placeholder="例：午前の経過記録"></label><button id="saveRoleEntry" class="btn btn-primary">${esc(roleName[editorRole])}として記録を保存</button></div>`;
}

function recordsPanel(patient){
  const lines=patient.records.map(record=>`<article class="clinical-entry"><small>${esc(roleName[record.role]||record.role)} ・ ${esc(record.time)}</small><br><b>${esc(record.title)}</b><p>${esc(record.body).replace(/\n/g,"<br>")}</p>${record.details?`<small>${esc(record.details).replace(/\n/g,"<br>")}</small>`:""}</article>`).join("");
  return `<h3>多職種カルテ</h3>${lines||"<p>記録はありません。</p>"}`;
}

function ordersPanel(patient){
  const canEditOrders=currentRole==="administrator"||currentRole==="doctor";
  const canEditSchedule=canEditOrders||currentRole==="clerk";
  return `<div class="clinical-editor"><h3>指示・予定</h3><label>診療・処置・薬剤等の指示<textarea id="ordersText" rows="6" ${canEditOrders?"":"readonly"}>${esc(patient.orders)}</textarea></label>${canEditOrders?'<button id="saveOrders" class="btn btn-primary">指示を更新</button>':'<p class="clinical-note">指示は閲覧できますが、編集できるのは医師と病院管理者だけです。</p>'}<label>検査・処置・リハビリ等の予定<textarea id="scheduleText" rows="5" ${canEditSchedule?"":"readonly"}>${esc(patient.schedule)}</textarea></label>${canEditSchedule?'<button id="saveSchedule" class="btn btn-secondary">予定を更新</button>':'<p class="clinical-note">予定は閲覧のみです。</p>'}</div>`;
}

function chartsPanel(patient){
  return `<h3>グラフ・データ</h3><p class="clinical-note">検証ケースの体温推移</p>${patient.vitals.length?`<div class="clinical-chart">${patient.vitals.map(value=>`<i style="height:${Math.max(8,Math.min(100,(value-34)*20))}%" title="${value}℃"></i>`).join("")}</div><div class="clinical-chart-values">${patient.vitals.map(value=>`<span>${value}℃</span>`).join("")}</div>`:'<div class="clinical-empty">バイタル記録を保存すると推移を表示します。</div>'}`;
}

function auditPanel(){
  return `<h3>監査・書き出し</h3><p>本番運用では、記録の閲覧・変更・確定・出力を、利用者ID・日時・対象・操作内容とともに監査します。</p><button class="btn btn-secondary" disabled>書き出しは安全基盤の整備後に有効化</button>`;
}

function panel(patient){
  if(tab==="overview")return overview(patient);
  if(tab==="entry")return entryPanel();
  if(tab==="records")return recordsPanel(patient);
  if(tab==="orders")return ordersPanel(patient);
  if(tab==="charts")return chartsPanel(patient);
  return auditPanel();
}

function render(){
  const patient=currentPatient();
  renderPatients();
  $("workspace").innerHTML=`<div class="clinical-patient-head"><div><h2>${esc(patient.label)}</h2><small>${esc(patient.id)}</small><div class="clinical-badges"><span class="clinical-badge">${esc(patient.department)}</span><span class="clinical-badge">${esc(patient.status)}</span></div></div></div>${tabButtons()}<div id="panel">${panel(patient)}</div>`;
}

function value(id){return $(id)?.value.trim()||""}
function saveRoleEntry(){
  const patient=currentPatient();
  const title=value("entryTitle")||`${roleName[editorRole]}記録`;
  let body="",details="";
  if(editorRole==="nurse"){
    body=`S：${value("subjective")}\nO：${value("objective")}`;
    const vitals={temp:value("vitalTemp"),pulse:value("vitalPulse"),spo2:value("vitalSpo2"),sys:value("vitalSys"),dia:value("vitalDia"),pain:value("painScale")};
    details=`体温 ${vitals.temp||"—"}℃ ／ 脈拍 ${vitals.pulse||"—"} ／ SpO₂ ${vitals.spo2||"—"}% ／ BP ${vitals.sys||"—"}/${vitals.dia||"—"} ／ 疼痛 ${vitals.pain||"—"}`;
    if(Number(vitals.temp)>0)patient.vitals.push(Number(vitals.temp));
  }else if(editorRole==="doctor"){
    body=value("medicalRecord");details=`主病名・診断名：${value("diagnosis")}`;
    const newOrders=value("doctorOrders");if(newOrders)patient.orders=newOrders;
  }else if(editorRole==="pharmacist"){
    body=value("pharmacyAssessment");details=`服薬状況：${value("medicationHistory")}\n医師への提案：${value("pharmacySuggestion")}`;
  }else if(["pt","ot","st"].includes(editorRole)){
    body=value("rehabIntervention");details=`評価：${value("rehabAssessment")}\n目標：${value("rehabGoal")}\n次回計画：${value("rehabPlan")}`;
  }else{body=value("clerkRecord");details=`連絡事項：${value("clerkNotice")}`}
  if(!body&&!details)return alert("記録内容を入力してください。");
  patient.records.unshift({role:editorRole,title,body:body||"記録を保存しました。",details,time:"保存直後"});
  tab="records";
  render();
}

$("patientSearch").oninput=renderPatients;
$("addPatient").onclick=()=>{const id=`CASE-${String(patients.length+1).padStart(3,"0")}`;patients.push({id,label:`検証ケース ${id.slice(-3)}`,department:"未設定",status:"受付",summary:"検証ケースです。",vitals:[],records:[],orders:"指示は未登録です。",schedule:"予定は未登録です。"});selectedId=id;render()};
document.addEventListener("change",event=>{if(event.target.id==="editorRole"){editorRole=event.target.value;render()}});
document.addEventListener("click",event=>{
  const patientButton=event.target.closest("[data-patient]");
  const tabButton=event.target.closest("[data-tab]");
  if(patientButton){selectedId=patientButton.dataset.patient;render();return}
  if(tabButton){tab=tabButton.dataset.tab;render();return}
  const patient=currentPatient();
  if(event.target.id==="saveRoleEntry")saveRoleEntry();
  if(event.target.id==="saveOrders"){patient.orders=value("ordersText");render()}
  if(event.target.id==="saveSchedule"){patient.schedule=value("scheduleText");render()}
});
render();
