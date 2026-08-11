import { db, studentNumber, setupTheme, initializePage, isAdmin, setupAdminTab } from "./common.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const list=document.getElementById("contactList");
setupTheme(document.getElementById("themeButton"));
document.getElementById("backButton").onclick=()=>history.length>1?history.back():location.replace("admin.html");
await initializePage([setupAdminTab()]);

if(studentNumber!=="2510044"||!(await isAdmin())){
  list.innerHTML='<div class="card setting-card">この画面を利用できません。</div>';
}else{
  onSnapshot(collection(db,"contacts"),snapshot=>{
    const groups=new Map();
    snapshot.docs.forEach(item=>{
      const contact={id:item.id,...item.data()},key=String(contact.studentNumber||"不明");
      const group=groups.get(key)||{studentNumber:key,items:[]};
      group.items.push(contact);groups.set(key,group);
    });
    const students=[...groups.values()].map(group=>{
      group.items.sort((a,b)=>timeOf(b.lastMessageAt||b.createdAt)-timeOf(a.lastMessageAt||a.createdAt));
      group.latest=group.items[0];
      group.open=group.items.filter(item=>!['done','resolved'].includes(item.status||'new')).length;
      return group;
    }).sort((a,b)=>timeOf(b.latest.lastMessageAt||b.latest.createdAt)-timeOf(a.latest.lastMessageAt||a.latest.createdAt));
    list.innerHTML=students.length?`<section class="contact-student-list">${students.map(renderStudent).join("")}</section>`:'<div class="card setting-card">お問い合わせはありません。</div>';
  },error=>{console.error(error);list.innerHTML='<div class="card setting-card">お問い合わせを読み込めませんでした。</div>'});
}
function renderStudent(group){const latest=group.latest,preview=String(latest.message||'追加メッセージがあります').replace(/\s+/g,' ').slice(0,70);return `<button type="button" class="card setting-card" style="width:100%;text-align:left;cursor:pointer" onclick="location.href='contact_admin_chat.html?studentNumber=${encodeURIComponent(group.studentNumber)}'"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><h3 style="margin:0">👤 ${escapeHtml(group.studentNumber)}</h3><span>${group.open?`<b style="color:#dc2626">未対応 ${group.open}件</b>`:'対応済み'}</span></div><p style="margin:.5rem 0 0"><b>${escapeHtml(latest.category||'お問い合わせ')}</b>　${escapeHtml(preview)}</p><small>${formatTime(latest.lastMessageAt||latest.createdAt)}　タップしてチャットを開く</small></button>`}
function timeOf(value){return value?.toMillis?.()||0}function formatTime(value){return value?.toDate?.().toLocaleString('ja-JP')||'送信直後'}function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
