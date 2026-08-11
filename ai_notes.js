import {db,studentNumber,setupTheme,initializePage,loadProfileImage,loadUserName,loadMyRanking,setupAdminTab} from "./common.js";
import {collection,doc,addDoc,deleteDoc,onSnapshot,orderBy,query,serverTimestamp,setDoc,updateDoc} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const $=id=>document.getElementById(id);
const state={notes:[],selected:null,recognition:null,isListening:false,interim:"",drawing:false,lastPoint:null,drawTool:"pen",paper:"blank"};
const escapeHtml=value=>String(value??"").replace(/[&<>\"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[char]);
setupTheme($("themeButton"));
await initializePage([setupAdminTab(),loadUserName($("userName")),loadMyRanking(),loadProfileImage($("topProfileImage"))]);

if(studentNumber!=="2510044"){
  $("denied").hidden=false;
  document.body.classList.remove("page-loading");
}else{
  $("noteApp").hidden=false;
  const notesRef=collection(db,"digitalNotes","2510044","notes");
  onSnapshot(query(notesRef,orderBy("updatedAt","desc")),snapshot=>{
    state.notes=snapshot.docs.map(item=>({id:item.id,...item.data()}));
    if(!state.selected&&state.notes[0]) state.selected=state.notes[0].id;
    render();
  },error=>{console.error(error);$("noteList").textContent="ノートを読み込めませんでした。"});
  $("newNote").onclick=async()=>{
    const created=await addDoc(notesRef,{title:"新しいノート",body:"",maskTerms:[],todos:[],createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    state.selected=created.id;
  };
  $("deleteNote").onclick=deleteCurrentNote;
  $("saveNote").onclick=saveCurrent;
  $("noteSearch").oninput=renderList;
  $("addTodo").onclick=()=>{const note=current();if(!note)return;note.todos=[...(note.todos||[]),{text:"",done:false}];renderTodos()};
  $("voiceButton").onclick=toggleVoice;
  $("openSummary").onclick=()=>openChatGPT("要約");
  $("openQuiz").onclick=()=>openChatGPT("問題作成");
  document.querySelectorAll(".workspace-tab").forEach(button=>button.onclick=()=>selectPanel(button.dataset.panel));
  $("penColor").oninput=()=>setDrawTool("pen");
  $("penSize").oninput=()=>$("penSizeValue").textContent=`${$("penSize").value}px`;
  document.querySelectorAll("[data-draw-tool]").forEach(button=>button.onclick=()=>setDrawTool(button.dataset.drawTool));
  document.querySelectorAll("[data-color]").forEach(button=>button.onclick=()=>{ $("penColor").value=button.dataset.color;setDrawTool("pen");document.querySelectorAll("[data-color]").forEach(item=>item.classList.toggle("active",item===button)) });
  document.querySelectorAll("[data-paper]").forEach(button=>button.onclick=()=>setPaper(button.dataset.paper));
  $("clearBoard").onclick=clearBoard;
  setupBoard();
  ["noteTitle","noteBody","maskTerms"].forEach(id=>$(id).addEventListener("input",renderPreview));
  document.addEventListener("click",event=>{
    const select=event.target.closest(".note-entry");if(select){state.selected=select.dataset.id;render();return}
    const mask=event.target.closest(".mask-word");if(mask)mask.classList.toggle("is-open");
  });
  document.body.classList.remove("page-loading");
}

function current(){return state.notes.find(note=>note.id===state.selected)}
function render(){renderList();const note=current();if(!note){$("noteTitle").value="";$("noteBody").value="";$("maskTerms").value="";$("todoList").innerHTML="";renderPreview();return}$("noteTitle").value=note.title||"";$("noteBody").value=note.body||"";$("maskTerms").value=(note.maskTerms||[]).join(", ");renderTodos();renderPreview();restoreBoard()}
function renderList(){const filter=$("noteSearch").value.trim().toLowerCase();const notes=state.notes.filter(note=>`${note.title||""}\n${note.body||""}`.toLowerCase().includes(filter));$("noteList").innerHTML=notes.length?notes.map(note=>`<button class="note-entry ${note.id===state.selected?"active":""}" data-id="${note.id}"><b>${escapeHtml(note.title||"無題のノート")}</b><p>${escapeHtml(note.body||"メモはまだありません")}</p><small>${dateLabel(note.updatedAt)}</small></button>`).join(""):"<p>該当するノートはありません。</p>"}
function renderTodos(){const note=current();$("todoList").innerHTML=(note?.todos||[]).map((todo,index)=>`<div class="todo-row"><input type="checkbox" data-todo-done="${index}" ${todo.done?"checked":""}><input data-todo-text="${index}" value="${escapeHtml(todo.text)}" placeholder="例：レポートを提出"><button class="btn btn-danger" data-todo-delete="${index}">削除</button></div>`).join("")||"<p class=\"note-hint\">ToDoはまだありません。</p>";$("todoList").querySelectorAll("input,button").forEach(item=>item.addEventListener("change",todoChange));$("todoList").querySelectorAll("button").forEach(item=>item.addEventListener("click",todoChange))}
function todoChange(event){const note=current(),target=event.target;if(!note)return;const index=Number(target.dataset.todoDone??target.dataset.todoText??target.dataset.todoDelete);if(target.dataset.todoDelete!==undefined){note.todos.splice(index,1)}else if(target.dataset.todoDone!==undefined){note.todos[index].done=target.checked}else{note.todos[index].text=target.value}renderTodos()}
async function deleteCurrentNote(){const note=current();if(!note)return alert("削除するノートを選んでください。");if(!confirm(`「${note.title||"無題のノート"}」を削除しますか？\n本文とこの端末の手書きは元に戻せません。`))return;try{localStorage.removeItem(`careMateHandwriting:${note.id}`);localStorage.removeItem(`careMatePaper:${note.id}`);await deleteDoc(doc(db,"digitalNotes","2510044","notes",note.id));state.selected=null;alert("ノートを削除しました。")}catch(error){console.error(error);alert("ノートを削除できませんでした。")}}
function selectPanel(id){document.querySelectorAll(".workspace-tab").forEach(item=>item.classList.toggle("active",item.dataset.panel===id));document.querySelectorAll(".workspace-panel").forEach(item=>item.classList.toggle("active",item.id===id));if(id==="writePanel")resizeBoard()}
function setupBoard(){const board=$("writingBoard");["pointerdown","pointermove","pointerup","pointercancel","pointerleave"].forEach(type=>board.addEventListener(type,drawPointer));window.addEventListener("resize",resizeBoard);resizeBoard()}
function resizeBoard(){const board=$("writingBoard");if(!board||!board.offsetWidth)return;const previous=board.toDataURL();const ratio=window.devicePixelRatio||1;board.width=Math.round(board.clientWidth*ratio);board.height=Math.round(board.clientHeight*ratio);const ctx=board.getContext("2d");ctx.scale(ratio,ratio);if(previous&&previous!=="data:,"){const image=new Image();image.onload=()=>ctx.drawImage(image,0,0,board.clientWidth,board.clientHeight);image.src=previous}}
function setDrawTool(tool){state.drawTool=tool;document.querySelectorAll("[data-draw-tool]").forEach(item=>item.classList.toggle("active",item.dataset.drawTool===tool))}
function setPaper(paper){state.paper=paper;document.querySelectorAll("[data-paper]").forEach(item=>item.classList.toggle("active",item.dataset.paper===paper));const board=$("writingBoard");board.classList.toggle("is-lined",paper==="lined");board.classList.toggle("is-grid",paper==="grid");const note=current();if(note)localStorage.setItem(`careMatePaper:${note.id}`,paper)}
function drawPointer(event){const board=$("writingBoard");const rect=board.getBoundingClientRect();const point={x:event.clientX-rect.left,y:event.clientY-rect.top};if(event.type==="pointerdown"){state.drawing=true;state.lastPoint=point;board.setPointerCapture(event.pointerId);return}if(!state.drawing)return;if(event.type==="pointermove"){const ctx=board.getContext("2d"),base=Number($("penSize").value),tool=state.drawTool;ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=tool==="highlighter"?base*3:tool==="marker"?base*1.7:base;ctx.globalCompositeOperation=tool==="eraser"?"destination-out":"source-over";ctx.globalAlpha=tool==="highlighter"?.28:tool==="marker"?.58:1;ctx.strokeStyle=$("penColor").value;ctx.beginPath();ctx.moveTo(state.lastPoint.x,state.lastPoint.y);ctx.lineTo(point.x,point.y);ctx.stroke();ctx.globalAlpha=1;state.lastPoint=point;return}state.drawing=false;state.lastPoint=null;saveBoard()}
function boardKey(){return state.selected?`careMateHandwriting:${state.selected}`:""}
function saveBoard(){const key=boardKey();if(!key)return;try{localStorage.setItem(key,$("writingBoard").toDataURL("image/png"));$("boardStatus").textContent="この端末に手書きを保存しました。"}catch(error){console.warn(error);$("boardStatus").textContent="手書きの保存容量が不足しています。"}}
function restoreBoard(){const board=$("writingBoard"),key=boardKey();if(!board||!key)return;setPaper(localStorage.getItem(`careMatePaper:${state.selected}`)||"blank");const ctx=board.getContext("2d");ctx.clearRect(0,0,board.clientWidth,board.clientHeight);const data=localStorage.getItem(key);if(!data)return;const image=new Image();image.onload=()=>ctx.drawImage(image,0,0,board.clientWidth,board.clientHeight);image.src=data}
function clearBoard(){const key=boardKey();if(!key||!confirm("このノートの手書きをすべて消しますか？"))return;const board=$("writingBoard");board.getContext("2d").clearRect(0,0,board.clientWidth,board.clientHeight);localStorage.removeItem(key);$("boardStatus").textContent="手書きを消しました。"}
function renderPreview(){let text=$("noteBody").value||"";const terms=$("maskTerms").value.split(",").map(value=>value.trim()).filter(Boolean).sort((a,b)=>b.length-a.length);const escaped=escapeHtml(text);if(!terms.length){$("notePreview").textContent=text;return}const pattern=new RegExp(`(${terms.map(term=>term.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")})`,"g");$("notePreview").innerHTML=escaped.replace(pattern,"<button class=\"mask-word\" type=\"button\">$1</button>")}
async function saveCurrent(){const note=current();if(!note)return;const title=$("noteTitle").value.trim()||"無題のノート";const body=$("noteBody").value;const maskTerms=$("maskTerms").value.split(",").map(value=>value.trim()).filter(Boolean);await updateDoc(doc(db,"digitalNotes","2510044","notes",note.id),{title,body,maskTerms,todos:note.todos||[],updatedAt:serverTimestamp()});alert("ノートを保存しました。")}
function toggleVoice(){const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SpeechRecognition){alert("このブラウザではリアルタイム文字起こしに対応していません。Chromeなどの対応ブラウザでお試しください。");return}if(state.isListening){state.recognition?.stop();return}const recognition=new SpeechRecognition();state.recognition=recognition;recognition.lang="ja-JP";recognition.interimResults=true;recognition.continuous=true;recognition.onstart=()=>{state.isListening=true;$("voiceButton").textContent="■ 文字起こしを停止";$("liveTranscript").hidden=false;$("voiceState").textContent="文字起こし中です。結果はノートに追加されます。"};recognition.onresult=event=>{let confirmed="",interim="";for(let i=event.resultIndex;i<event.results.length;i++){const text=event.results[i][0].transcript;if(event.results[i].isFinal)confirmed+=text;else interim+=text}if(confirmed){$("noteBody").value+=`${$("noteBody").value?"\n":""}${confirmed}`;renderPreview()}state.interim=interim;$("liveTranscript").textContent=interim||"聞き取り中…"};recognition.onend=()=>{state.isListening=false;$("voiceButton").textContent="🎙 文字起こしを開始";$("voiceState").textContent="文字起こしを停止しました。保存するとノートへ残ります。"};recognition.onerror=event=>{console.error(event.error);$("voiceState").textContent=`文字起こしを開始できませんでした：${event.error}`};recognition.start()}
async function openChatGPT(kind){const note=current();if(!note)return alert("先にノートを作成してください。");const body=$("noteBody").value.trim();if(!body)return alert("メモを入力してから使ってください。");const prompt=kind==="要約"?`以下の講義メモを、重要語句・要点・次に確認することに分けて日本語で要約してください。\n\n${body}`:`以下の講義メモから、4択問題と穴埋め問題を作成してください。各問題に答えと簡潔な解説を付け、JSONでも出力してください。\n\n${body}`;try{await navigator.clipboard.writeText(prompt)}catch(error){console.warn(error)}window.open("https://chatgpt.com/","_blank","noopener");alert(`${kind}用の指示とメモをコピーしました。開いたChatGPTに貼り付けてください。`)}
function dateLabel(value){return typeof value?.toDate==="function"?value.toDate().toLocaleString("ja-JP"):"更新日時未設定"}
