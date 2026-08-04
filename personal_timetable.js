import {setupTheme,initializePage,loadProfileImage,db,studentNumber} from "./common.js";
import {loadPersonalTimetableData} from "./personal_timetable_data.js";
import {doc,getDoc,updateDoc} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
const list=document.getElementById("personalTimetableList"),count=document.getElementById("timetableCourseCount");
const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const formatDate=(value,fallback)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return fallback||value;const d=new Date(`${value}T00:00:00`);return `${d.getMonth()+1}月${d.getDate()}日（${"日月火水木金土"[d.getDay()]}）`};
setupTheme(document.getElementById("themeButton"));document.getElementById("backButton").onclick=()=>history.back();document.getElementById("profileButton").onclick=()=>location.href="profile.html";

let userPreferences={};async function preference(subject){if(!Object.keys(userPreferences).length)userPreferences=(await getDoc(doc(db,"users",studentNumber))).data()?.attendancePreferences||{};return userPreferences[encodeURIComponent(subject)]?.classGroup||""}
async function chooseGroup(subject,group){if(!confirm(`${subject}の通知を「${group}」に設定しますか？`))return;await updateDoc(doc(db,"users",studentNumber),{[`attendancePreferences.${encodeURIComponent(subject)}`]:{subject,classGroup:group,selectedAt:new Date().toISOString(),source:"personalTimetable"}});userPreferences={};await load()}

async function load(){
    try{
        const result=await loadPersonalTimetableData();count.textContent=`履修登録 ${result.enrolled.length}科目・時間割 ${result.entries.length}コマ`;
        if(!result.enrolled.length){list.innerHTML='<div class="card setting-card"><h3>履修科目がありません</h3><p>先に履修登録を完了してください。</p><a class="btn btn-primary" href="course_registration.html">履修登録を開く</a></div>';return}
        if(!result.entries.length){list.innerHTML='<div class="card setting-card"><h3>該当する時間割がありません</h3><p>大学時間割に未掲載か、科目名が履修科目マスタと一致していない可能性があります。</p></div>';return}
        const choices=new Map();
        for(const entry of result.entries){if(!entry.classGroup)continue;const key=`${entry.subject}_${entry.date}_${entry.period}`;if(!choices.has(key))choices.set(key,new Set());choices.get(key).add(entry.classGroup)}
        const preferences=new Map();for(const entry of result.entries){if(!preferences.has(entry.subject))preferences.set(entry.subject,await preference(entry.subject))}
        const groups=new Map();for(const entry of result.entries){const key=entry.date||entry.dayTitle;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(entry)}
        list.innerHTML=[...groups.entries()].map(([key,entries])=>`<section class="personal-timetable-day"><div class="personal-timetable-date"><b>${escapeHtml(formatDate(key,entries[0].dayTitle))}</b><span>${entries.length}コマ</span></div>${entries.map(entry=>{const choiceKey=`${entry.subject}_${entry.date}_${entry.period}`,options=[...(choices.get(choiceKey)||[])],selected=preferences.get(entry.subject)||"";return `<article class="card personal-timetable-lesson" data-subject="${escapeHtml(entry.subject)}"><div class="lesson-period">${entry.period||"-"}</div><div><h3>${escapeHtml(entry.subject)}${entry.classGroup?` <span class="lesson-class-group">${escapeHtml(entry.classGroup)}</span>`:""}</h3><p>${escapeHtml([entry.building,entry.room].filter(Boolean).join(" ")||"教室未設定")}${entry.teacher?`<br>${escapeHtml(entry.teacher)}`:""}</p><small>${escapeHtml(entry.startTime)}〜${escapeHtml(entry.endTime)}・${entry.isPractical?"実習 4/5以上":"実習以外 2/3以上"}</small>${options.length>1?`<div class="class-group-choice"><span>通知クラス：${escapeHtml(selected||"未選択（両方通知）")}</span>${options.map(group=>`<button data-subject="${escapeHtml(entry.subject)}" data-group="${escapeHtml(group)}" class="btn ${selected===group?"btn-primary":""}">${escapeHtml(group)}</button>`).join("")}</div>`:""}</div></article>`}).join("")}</section>`).join("");
        list.querySelectorAll("[data-group]").forEach(button=>button.onclick=()=>chooseGroup(button.dataset.subject,button.dataset.group).catch(error=>alert(error.message)));
    }catch(error){console.error("個人時間割取得エラー",error);list.innerHTML='<div class="card setting-card">時間割を取得できませんでした。</div>'}
}
await initializePage([loadProfileImage(document.getElementById("topProfileImage")),load()]);
