import {db,studentNumber,setupTheme,initializePage,loadProfileImage,loadUserName,loadMyRanking,setupAdminTab} from "./common.js";
import {collection,doc,addDoc,deleteDoc,onSnapshot,orderBy,query,serverTimestamp,setDoc,updateDoc} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const $=id=>document.getElementById(id);

const state={
    notes:[],
    selected:null,

    recognition:null,

    isListening:false,

    /*
    ユーザーが明示的に停止するまで
    音声認識を継続する。
    */
    keepListening:false,

    /*
    確定済み文字列と
    聞き取り途中文字列を分離する。
    */
    finalTranscript:"",
    interim:"",

    drawing:false,
    lastPoint:null,
    drawTool:"pen",
    paper:"blank"
};

const escapeHtml=value=>String(value??"").replace(
    /[&<>\"']/g,
    char=>({
        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        "\"":"&quot;",
        "'":"&#39;"
    })[char]
);

setupTheme(
    $("themeButton")
);

await initializePage([
    setupAdminTab(),
    loadUserName(
        $("userName")
    ),
    loadMyRanking(),
    loadProfileImage(
        $("topProfileImage")
    )
]);


if(
    studentNumber!=="2510044"
){

    $("denied").hidden=false;

    document.body.classList.remove(
        "page-loading"
    );

}else{

    $("noteApp").hidden=false;


    const notesRef=
        collection(
            db,
            "digitalNotes",
            "2510044",
            "notes"
        );


    onSnapshot(
        query(
            notesRef,
            orderBy(
                "updatedAt",
                "desc"
            )
        ),
        snapshot=>{

            state.notes=
                snapshot.docs.map(
                    item=>({
                        id:item.id,
                        ...item.data()
                    })
                );


            if(
                !state.selected &&
                state.notes[0]
            ){

                state.selected=
                    state.notes[0].id;

            }


            render();

        },
        error=>{

            console.error(
                error
            );

            $("noteList").textContent=
                "ノートを読み込めませんでした。";

        }
    );


    $("newNoteDrawer").onclick=
        createNewNote;


    async function createNewNote(){

        const created=
            await addDoc(
                notesRef,
                {
                    title:
                        "新しいノート",

                    body:
                        "",

                    maskTerms:
                        [],

                    todos:
                        [],

                    createdAt:
                        serverTimestamp(),

                    updatedAt:
                        serverTimestamp()
                }
            );


        state.selected=
            created.id;


        $("noteDrawer")
            .classList.remove(
                "is-open"
            );


        $("drawerBackdrop")
            .classList.remove(
                "is-open"
            );

    }


    $("deleteNote").onclick=
        deleteCurrentNote;


    $("saveNote").onclick=
        saveCurrent;


    $("noteSearch").oninput=
        renderList;


    $("addTodo").onclick=
        ()=>{

            const note=
                current();


            if(!note){
                return;
            }


            note.todos=[
                ...(note.todos||[]),
                {
                    text:"",
                    done:false
                }
            ];


            renderTodos();

        };


    $("voiceButton").onclick=
        toggleVoice;


    $("openSummary").onclick=
        ()=>openChatGPT(
            "要約"
        );


    $("openQuiz").onclick=
        ()=>openChatGPT(
            "問題作成"
        );


    setupImages();

    setupDrawer();


    document
        .querySelectorAll(
            ".workspace-tab"
        )
        .forEach(
            button=>
                button.onclick=
                    ()=>selectPanel(
                        button.dataset.panel
                    )
        );


    document
        .querySelectorAll(
            "[data-feature]"
        )
        .forEach(
            button=>
                button.onclick=
                    ()=>selectPanel(
                        button.dataset.feature
                    )
        );


    $("penColor").oninput=
        ()=>setDrawTool(
            "pen"
        );


    $("penSize").oninput=
        ()=>
            $("penSizeValue").textContent=
                `${$("penSize").value}px`;


    document
        .querySelectorAll(
            "[data-draw-tool]"
        )
        .forEach(
            button=>
                button.onclick=
                    ()=>setDrawTool(
                        button.dataset.drawTool
                    )
        );


    document
        .querySelectorAll(
            "[data-color]"
        )
        .forEach(
            button=>
                button.onclick=
                    ()=>{

                        $("penColor").value=
                            button.dataset.color;


                        setDrawTool(
                            "pen"
                        );


                        document
                            .querySelectorAll(
                                "[data-color]"
                            )
                            .forEach(
                                item=>
                                    item.classList.toggle(
                                        "active",
                                        item===button
                                    )
                            );

                    }
        );


    document
        .querySelectorAll(
            "[data-paper]"
        )
        .forEach(
            button=>
                button.onclick=
                    ()=>setPaper(
                        button.dataset.paper
                    )
        );


    $("clearBoard")
        ?.addEventListener(
            "click",
            clearBoard
        );


    setupBoard();

    setupUnifiedNote();

    setupInkOverlay();

    setupToolControls();


    [
        "noteTitle",
        "noteBody",
        "maskTerms"
    ].forEach(
        id=>
            $(id).addEventListener(
                "input",
                renderPreview
            )
    );


    $("noteDocument")
        .addEventListener(
            "input",
            ()=>{

                syncPlainBody();

                renderPreview();

            }
        );


    document.addEventListener(
        "click",
        event=>{

            const select=
                event.target.closest(
                    ".note-entry"
                );


            if(select){

                state.selected=
                    select.dataset.id;


                render();


                $("noteDrawer")
                    .classList.remove(
                        "is-open"
                    );


                $("drawerBackdrop")
                    .classList.remove(
                        "is-open"
                    );


                return;

            }


            const mask=
                event.target.closest(
                    ".mask-word"
                );


            if(mask){

                mask.classList.toggle(
                    "is-open"
                );

            }

        }
    );


    document.body.classList.remove(
        "page-loading"
    );

}


function current(){

    return state.notes.find(
        note=>
            note.id===
            state.selected
    );

}


function render(){

    renderList();


    const note=
        current();


    if(!note){

        $("noteTitle").value="";

        $("noteBody").value="";

        $("noteDocument").innerHTML="";

        $("liveTranscript").textContent=
            "まだ文字起こしは始まっていません。";

        $("maskTerms").value="";

        $("todoList").innerHTML="";

        renderImages();

        renderPreview();

        clearInkOverlay();

        return;

    }


    $("noteTitle").value=
        note.title||"";


    setDocumentHtml(
        note.bodyHtml||
        plainTextToHtml(
            note.body||""
        )
    );


    $("liveTranscript").textContent=
        note.transcript||
        "まだ文字起こしは始まっていません。";


    $("maskTerms").value=
        (note.maskTerms||[])
            .join(
                ", "
            );


    renderTodos();

    renderImages();

    renderPreview();

    restoreBoard();

    restoreInkOverlay(
        note.inkData||""
    );

}


function renderList(){

    const filter=
        $("noteSearch")
            .value
            .trim()
            .toLowerCase();


    const notes=
        state.notes.filter(
            note=>
                `${note.title||""}\n${note.body||""}`
                    .toLowerCase()
                    .includes(
                        filter
                    )
        );


    $("noteList").innerHTML=
        notes.length
            ? notes.map(
                note=>`
                    <button
                        class="note-entry ${
                            note.id===state.selected
                                ? "active"
                                : ""
                        }"
                        data-id="${note.id}">

                        <b>
                            ${escapeHtml(
                                note.title||
                                "無題のノート"
                            )}
                        </b>

                        <p>
                            ${escapeHtml(
                                note.body||
                                "メモはまだありません"
                            )}
                        </p>

                        <small>
                            ${dateLabel(
                                note.updatedAt
                            )}
                        </small>

                    </button>
                `
            ).join("")
            : "<p>該当するノートはありません。</p>";

}


function renderTodos(){

    const note=
        current();


    $("todoList").innerHTML=
        (note?.todos||[])
            .map(
                (todo,index)=>`
                    <div class="todo-row">

                        <input
                            type="checkbox"
                            data-todo-done="${index}"
                            ${todo.done?"checked":""}>

                        <input
                            data-todo-text="${index}"
                            value="${escapeHtml(todo.text)}"
                            placeholder="例：レポートを提出">

                        <button
                            class="btn btn-danger"
                            data-todo-delete="${index}">
                            削除
                        </button>

                    </div>
                `
            )
            .join("")||
        "<p class=\"note-hint\">ToDoはまだありません。</p>";


    $("todoList")
        .querySelectorAll(
            "input,button"
        )
        .forEach(
            item=>
                item.addEventListener(
                    "change",
                    todoChange
                )
        );


    $("todoList")
        .querySelectorAll(
            "button"
        )
        .forEach(
            item=>
                item.addEventListener(
                    "click",
                    todoChange
                )
        );

}


function todoChange(
    event
){

    const note=
        current();

    const target=
        event.target;


    if(!note){
        return;
    }


    const index=
        Number(
            target.dataset.todoDone ??
            target.dataset.todoText ??
            target.dataset.todoDelete
        );


    if(
        target.dataset.todoDelete !==
        undefined
    ){

        note.todos.splice(
            index,
            1
        );

    }else if(
        target.dataset.todoDone !==
        undefined
    ){

        note.todos[index].done=
            target.checked;

    }else{

        note.todos[index].text=
            target.value;

    }


    renderTodos();

}


function setupImages(){

    $("noteImageInput").onchange=
        uploadNoteImage;


    const documentArea=
        $("noteDocument");


    documentArea.addEventListener(
        "dragover",
        event=>
            event.preventDefault()
    );


    documentArea.addEventListener(
        "drop",
        event=>{

            event.preventDefault();


            const url=
                event.dataTransfer.getData(
                    "text/caremate-note-image"
                );


            const imageId=
                event.dataTransfer.getData(
                    "text/caremate-document-image"
                );


            if(url){

                insertImageAtPoint(
                    url,
                    event.clientX,
                    event.clientY
                );

            }


            if(imageId){

                const image=
                    document.getElementById(
                        imageId
                    );


                if(image){

                    const range=
                        document.caretRangeFromPoint?.(
                            event.clientX,
                            event.clientY
                        );


                    if(range){

                        range.insertNode(
                            image
                        );

                        syncPlainBody();

                    }

                }

            }

        }
    );

}


async function uploadNoteImage(
    event
){

    const note=
        current();


    const file=
        event.target.files?.[0];


    const stateLabel=
        $("noteImageState");


    if(!note){

        return alert(
            "先にノートを作成してください。"
        );

    }


    if(!file){
        return;
    }


    if(
        !file.type.startsWith(
            "image/"
        )
    ){

        return alert(
            "画像ファイルを選んでください。"
        );

    }


    if(
        file.size >
        50*1024*1024
    ){

        return alert(
            "50MB以下の画像を選んでください。"
        );

    }


    event.target.disabled=
        true;


    stateLabel.textContent=
        "画像をノートへ追加しています…";


    try{

        const form=
            new FormData();


        form.append(
            "file",
            file
        );


        form.append(
            "upload_preset",
            "caremate_upload"
        );


        const response=
            await fetch(
                "https://api.cloudinary.com/v1_1/vpctonjf/image/upload",
                {
                    method:"POST",
                    body:form
                }
            );


        const data=
            await response.json();


        if(
            !response.ok ||
            !data.secure_url
        ){

            throw new Error(
                data.error?.message||
                "アップロードに失敗しました。"
            );

        }


        await updateDoc(
            doc(
                db,
                "digitalNotes",
                "2510044",
                "notes",
                note.id
            ),
            {
                images:[
                    ...(note.images||[]),
                    {
                        url:
                            data.secure_url,

                        publicId:
                            data.public_id
                    }
                ],

                updatedAt:
                    serverTimestamp()
            }
        );


        stateLabel.textContent=
            "講義メモに画像を追加しました。ドラッグで並べ替えできます。";


    }catch(error){

        console.error(
            error
        );


        stateLabel.textContent=
            "画像を追加できませんでした。";


        alert(
            `写真を講義メモに追加できませんでした。\n${
                error.message||
                "通信を確認して、もう一度お試しください。"
            }`
        );


    }finally{

        event.target.value="";

        event.target.disabled=
            false;

    }

}


function renderImages(){

    const list=
        $("noteImageList");


    if(!list){
        return;
    }


    const note=
        current();


    const images=
        note?.images||[];


    list.innerHTML=
        images.map(
            (image,index)=>`
                <div
                    class="note-image-card"
                    draggable="true"
                    data-image-index="${index}">

                    <img
                        src="${escapeHtml(image.url)}"
                        alt="添付画像">

                    <button
                        data-image-delete="${index}"
                        aria-label="画像を外す">
                        ×
                    </button>

                </div>
            `
        ).join("");


    list
        .querySelectorAll(
            "[data-image-delete]"
        )
        .forEach(
            button=>
                button.onclick=
                    async()=>{

                        const next=[
                            ...(current()?.images||[])
                        ];


                        next.splice(
                            Number(
                                button.dataset.imageDelete
                            ),
                            1
                        );


                        await updateDoc(
                            doc(
                                db,
                                "digitalNotes",
                                "2510044",
                                "notes",
                                current().id
                            ),
                            {
                                images:
                                    next,

                                updatedAt:
                                    serverTimestamp()
                            }
                        );

                    }
        );


    list
        .querySelectorAll(
            ".note-image-card"
        )
        .forEach(
            card=>
                card.ondragstart=
                    event=>{

                        event.dataTransfer.effectAllowed=
                            "copy";


                        event.dataTransfer.setData(
                            "text/caremate-note-image",
                            images[
                                Number(
                                    card.dataset.imageIndex
                                )
                            ].url
                        );

                    }
        );

}


async function deleteCurrentNote(){

    const note=
        current();


    if(!note){

        return alert(
            "削除するノートを選んでください。"
        );

    }


    if(
        !confirm(
            `「${note.title||"無題のノート"}」を削除しますか？\n本文とこの端末の手書きは元に戻せません。`
        )
    ){

        return;

    }


    try{

        localStorage.removeItem(
            `careMateHandwriting:${note.id}`
        );


        localStorage.removeItem(
            `careMatePaper:${note.id}`
        );


        await deleteDoc(
            doc(
                db,
                "digitalNotes",
                "2510044",
                "notes",
                note.id
            )
        );


        state.selected=
            null;


        alert(
            "ノートを削除しました。"
        );


    }catch(error){

        console.error(
            error
        );


        alert(
            "ノートを削除できませんでした。"
        );

    }

}


function selectPanel(
    id
){

    const external=
        [
            "todoPanel",
            "studyPanel"
        ].includes(
            id
        );


    $("todoPanel").classList.toggle(
        "active",
        id==="todoPanel"
    );


    $("studyPanel").classList.toggle(
        "active",
        id==="studyPanel"
    );


    document.querySelector(
        ".note-shell"
    ).hidden=
        external;


    document
        .querySelectorAll(
            ".workspace-tab"
        )
        .forEach(
            item=>
                item.classList.toggle(
                    "active",
                    item.dataset.panel===id
                )
        );


    document
        .querySelectorAll(
            ".workspace-panel"
        )
        .forEach(
            item=>
                item.classList.toggle(
                    "active",
                    item.id===id
                )
        );


    document
        .querySelectorAll(
            "[data-feature]"
        )
        .forEach(
            item=>
                item.classList.toggle(
                    "active",
                    item.dataset.feature===id
                )
        );


    if(
        id==="typedPanel"
    ){

        requestAnimationFrame(
            resizeBoard
        );

    }

}


function setupDrawer(){

    const drawer=
        $("noteDrawer");


    const backdrop=
        $("drawerBackdrop");


    const open=
        ()=>{

            drawer.classList.add(
                "is-open"
            );

            backdrop.classList.add(
                "is-open"
            );

        };


    const close=
        ()=>{

            drawer.classList.remove(
                "is-open"
            );

            backdrop.classList.remove(
                "is-open"
            );

        };


    $("noteMenuButton").onclick=
        open;


    $("closeDrawer").onclick=
        close;


    backdrop.onclick=
        close;


    const noteAside=
        document.querySelector(
            ".note-shell>aside"
        );


    if(noteAside){

        $("drawerNotesMount")
            .append(
                noteAside
            );

    }


    document
        .querySelectorAll(
            "[data-drawer-panel]"
        )
        .forEach(
            button=>
                button.onclick=
                    ()=>{

                        selectPanel(
                            button.dataset.drawerPanel
                        );

                        close();

                    }
        );


    document
        .querySelectorAll(
            "[data-drawer-target]"
        )
        .forEach(
            button=>
                button.onclick=
                    ()=>{

                        const target=
                            button.dataset.drawerTarget==="todos"
                                ? $("todoList").closest("section")
                                : $("todoList")
                                    .closest("section")
                                    .nextElementSibling;


                        target?.scrollIntoView({
                            behavior:"smooth",
                            block:"start"
                        });


                        close();

                    }
        );

}


function setupBoard(){

    const board=
        $("writingBoard");


    [
        "pointerdown",
        "pointermove",
        "pointerup",
        "pointercancel",
        "pointerleave"
    ].forEach(
        type=>
            board.addEventListener(
                type,
                drawPointer
            )
    );


    window.addEventListener(
        "resize",
        resizeBoard
    );


    resizeBoard();

}


function setupUnifiedNote(){

    const button=
        $("handwritingMode");


    const overlay=
        $("inkOverlay");


    if(
        !button ||
        !overlay
    ){

        return;

    }


    button.onclick=
        ()=>{

            state.inkMode=
                !state.inkMode;


            overlay.classList.toggle(
                "is-drawing",
                state.inkMode
            );


            button.classList.toggle(
                "active",
                state.inkMode
            );


            button.textContent=
                state.inkMode
                    ? "手書き中（押すと文字入力）"
                    : "手書きモード";


            button.title=
                state.inkMode
                    ? "今はノート上に手書きできます。もう一度押すと文字入力へ戻ります。"
                    : "押すとノート上に手書きできます。";

        };


    document
        .querySelectorAll(
            "[data-drawer-panel],[data-drawer-target]"
        )
        .forEach(
            item=>
                item.remove()
        );

}


async function convertHandwriting(){

    const button=
        $("convertHandwriting");


    const board=
        $("writingBoard");


    if(
        !window.Tesseract
    ){

        return alert(
            "活字化の準備がまだできていません。接続を確認してもう一度お試しください。"
        );

    }


    button.disabled=
        true;


    button.textContent=
        "活字化しています…";


    try{

        const result=
            await window.Tesseract.recognize(
                board.toDataURL(
                    "image/png"
                ),
                "jpn"
            );


        const text=
            result.data.text.trim();


        if(!text){

            return alert(
                "文字を読み取れませんでした。濃く大きく書いてお試しください。"
            );

        }


        $("noteBody").value+=
            `${
                $("noteBody").value
                    ? "\n"
                    : ""
            }${text}`;


        renderPreview();


        selectPanel(
            "typedPanel"
        );


        alert(
            "読み取った文字を本文へ追加しました。"
        );


    }catch(error){

        console.error(
            error
        );


        alert(
            "活字化に失敗しました。手書きはそのまま残っています。"
        );


    }finally{

        button.disabled=
            false;


        button.textContent=
            "🔤 手書きを活字化して本文へ入れる";

    }

}


function resizeBoard(){

    const board=
        $("writingBoard");


    const rect=
        board?.getBoundingClientRect();


    if(
        !board ||
        !rect?.width ||
        !rect?.height
    ){

        return;

    }


    const previous=
        board.toDataURL();


    const ratio=
        window.devicePixelRatio||1;


    const width=
        Math.round(
            rect.width*ratio
        );


    const height=
        Math.round(
            rect.height*ratio
        );


    if(
        board.width===width &&
        board.height===height
    ){

        return;

    }


    board.width=
        width;


    board.height=
        height;


    const ctx=
        board.getContext(
            "2d"
        );


    ctx.setTransform(
        ratio,
        0,
        0,
        ratio,
        0,
        0
    );


    if(
        previous &&
        previous!=="data:,"
    ){

        const image=
            new Image();


        image.onload=
            ()=>ctx.drawImage(
                image,
                0,
                0,
                rect.width,
                rect.height
            );


        image.src=
            previous;

    }

}


function setDrawTool(
    tool
){

    state.drawTool=
        tool;


    document
        .querySelectorAll(
            "[data-draw-tool]"
        )
        .forEach(
            item=>
                item.classList.toggle(
                    "active",
                    item.dataset.drawTool===tool
                )
        );

}


function setPaper(
    paper
){

    state.paper=
        paper;


    document
        .querySelectorAll(
            "[data-paper]"
        )
        .forEach(
            item=>
                item.classList.toggle(
                    "active",
                    item.dataset.paper===paper
                )
        );


    const board=
        $("writingBoard");


    board.classList.toggle(
        "is-lined",
        paper==="lined"
    );


    board.classList.toggle(
        "is-grid",
        paper==="grid"
    );


    const note=
        current();


    if(note){

        localStorage.setItem(
            `careMatePaper:${note.id}`,
            paper
        );

    }

}


function drawPointer(
    event
){

    const board=
        $("writingBoard");


    const rect=
        board.getBoundingClientRect();


    const point={
        x:
            event.clientX-
            rect.left,

        y:
            event.clientY-
            rect.top
    };


    if(
        event.type===
        "pointerdown"
    ){

        state.drawing=
            true;


        state.lastPoint=
            point;


        board.setPointerCapture(
            event.pointerId
        );


        return;

    }


    if(
        !state.drawing
    ){

        return;

    }


    if(
        event.type===
        "pointermove"
    ){

        const ctx=
            board.getContext(
                "2d"
            );


        const base=
            Number(
                $("penSize").value
            );


        const tool=
            state.drawTool;


        ctx.lineCap=
            "round";


        ctx.lineJoin=
            "round";


        ctx.lineWidth=
            tool==="highlighter"
                ? base*3
                : tool==="marker"
                    ? base*1.7
                    : base;


        ctx.globalCompositeOperation=
            tool==="eraser"
                ? "destination-out"
                : "source-over";


        ctx.globalAlpha=
            tool==="highlighter"
                ? .28
                : tool==="marker"
                    ? .58
                    : 1;


        ctx.strokeStyle=
            $("penColor").value;


        ctx.beginPath();


        ctx.moveTo(
            state.lastPoint.x,
            state.lastPoint.y
        );


        ctx.lineTo(
            point.x,
            point.y
        );


        ctx.stroke();


        ctx.globalAlpha=
            1;


        state.lastPoint=
            point;


        return;

    }


    state.drawing=
        false;


    state.lastPoint=
        null;


    saveBoard();

}


function boardKey(){

    return state.selected
        ? `careMateHandwriting:${state.selected}`
        : "";

}


function saveBoard(){

    const key=
        boardKey();


    if(!key){
        return;
    }


    try{

        localStorage.setItem(
            key,
            $("writingBoard").toDataURL(
                "image/png"
            )
        );


        const status=
            $("boardStatus");


        if(status){

            status.textContent=
                "この端末に手書きを保存しました。";

        }


    }catch(error){

        console.warn(
            error
        );


        const status=
            $("boardStatus");


        if(status){

            status.textContent=
                "手書きの保存容量が不足しています。";

        }

    }

}


function restoreBoard(){

    const board=
        $("writingBoard");


    const key=
        boardKey();


    if(
        !board ||
        !key
    ){

        return;

    }


    setPaper(
        localStorage.getItem(
            `careMatePaper:${state.selected}`
        )||
        "blank"
    );


    const ctx=
        board.getContext(
            "2d"
        );


    ctx.clearRect(
        0,
        0,
        board.clientWidth,
        board.clientHeight
    );


    const data=
        localStorage.getItem(
            key
        );


    if(!data){
        return;
    }


    const image=
        new Image();


    image.onload=
        ()=>ctx.drawImage(
            image,
            0,
            0,
            board.clientWidth,
            board.clientHeight
        );


    image.src=
        data;

}


function clearBoard(){

    const key=
        boardKey();


    if(
        !key ||
        !confirm(
            "このノートの手書きをすべて消しますか？"
        )
    ){

        return;

    }


    const board=
        $("writingBoard");


    board.getContext(
        "2d"
    ).clearRect(
        0,
        0,
        board.clientWidth,
        board.clientHeight
    );


    localStorage.removeItem(
        key
    );


    const status=
        $("boardStatus");


    if(status){

        status.textContent=
            "手書きを消しました。";

    }

}


function renderPreview(){

    let text=
        $("noteBody").value||"";


    const terms=
        $("maskTerms")
            .value
            .split(",")
            .map(
                value=>
                    value.trim()
            )
            .filter(
                Boolean
            )
            .sort(
                (a,b)=>
                    b.length-
                    a.length
            );


    const escaped=
        escapeHtml(
            text
        );


    if(
        !terms.length
    ){

        $("notePreview").textContent=
            text;

        return;

    }


    const pattern=
        new RegExp(
            `(${
                terms
                    .map(
                        term=>
                            term.replace(
                                /[.*+?^${}()|[\]\\]/g,
                                "\\$&"
                            )
                    )
                    .join("|")
            })`,
            "g"
        );


    $("notePreview").innerHTML=
        escaped.replace(
            pattern,
            "<button class=\"mask-word\" type=\"button\">$1</button>"
        );

}


async function saveCurrent(){

    const note=
        current();


    if(!note){
        return;
    }


    syncPlainBody();


    const title=
        $("noteTitle")
            .value
            .trim()||
        "無題のノート";


    const body=
        $("noteBody").value;


    const bodyHtml=
        $("noteDocument").innerHTML;


    const maskTerms=
        $("maskTerms")
            .value
            .split(",")
            .map(
                value=>
                    value.trim()
            )
            .filter(
                Boolean
            );


    /*
    interimではなく
    確定済み文字起こしを優先して保存する。
    */
    let transcript=
        String(
            state.finalTranscript||
            ""
        ).trim();


    if(
        !transcript
    ){

        transcript=
            $("liveTranscript").textContent===
            "まだ文字起こしは始まっていません。"
                ? ""
                : $("liveTranscript").textContent.trim();

    }


    await updateDoc(
        doc(
            db,
            "digitalNotes",
            "2510044",
            "notes",
            note.id
        ),
        {
            title,

            body,

            bodyHtml,

            inkData:
                $("inkOverlay")
                    .toDataURL(
                        "image/png"
                    ),

            transcript,

            maskTerms,

            todos:
                note.todos||[],

            updatedAt:
                serverTimestamp()
        }
    );


    alert(
        "ノートを保存しました。"
    );

}


/* ========================================
   連続リアルタイム文字起こし
======================================== */

function toggleVoice(){

    const SpeechRecognition=
        window.SpeechRecognition||
        window.webkitSpeechRecognition;


    if(
        !SpeechRecognition
    ){

        alert(
            "このブラウザではリアルタイム文字起こしに対応していません。Chromeなどの対応ブラウザでお試しください。"
        );

        return;

    }


    /*
    すでに文字起こし中なら
    今回はユーザーによる停止。
    */
    if(
        state.keepListening
    ){

        state.keepListening=
            false;


        state.isListening=
            false;


        state.interim=
            "";


        try{

            state.recognition?.stop();

        }catch(error){

            console.warn(
                "音声認識停止エラー:",
                error
            );

        }


        $("voiceButton").textContent=
            "🎙 文字起こしを開始";


        $("voiceState").textContent=
            "文字起こしを停止しました。保存すると文字起こしタブへ残ります。";


        renderLiveTranscript();


        return;

    }


    /*
    保存済み文字起こしがあれば
    そこから続きを開始する。
    */
    const existingText=
        $("liveTranscript")
            .textContent
            .replace(
                "まだ文字起こしは始まっていません。",
                ""
            )
            .trim();


    state.finalTranscript=
        existingText;


    state.interim=
        "";


    state.keepListening=
        true;


    startSpeechRecognition();


    function startSpeechRecognition(){

        /*
        停止ボタンが押されていたら
        再起動しない。
        */
        if(
            !state.keepListening
        ){

            return;

        }


        const recognition=
            new SpeechRecognition();


        state.recognition=
            recognition;


        recognition.lang=
            "ja-JP";


        /*
        聞き取り途中もリアルタイム表示。
        */
        recognition.interimResults=
            true;


        /*
        対応ブラウザでは
        できるだけ長く認識を続ける。
        */
        recognition.continuous=
            true;


        recognition.maxAlternatives=
            1;


        recognition.onstart=
            ()=>{

                state.isListening=
                    true;


                $("voiceButton").textContent=
                    "■ 文字起こしを停止";


                $("liveTranscript").hidden=
                    false;


                $("voiceState").textContent=
                    "文字起こし中です。話すのを止めても、そのまま聞き取りを続けます。";

            };


        recognition.onresult=
            event=>{

                let newFinal=
                    "";


                let newInterim=
                    "";


                /*
                今回更新された認識結果だけ処理。
                過去の認識結果を再追加しない。
                */
                for(
                    let i=
                        event.resultIndex;

                    i<
                        event.results.length;

                    i++
                ){

                    const result=
                        event.results[i];


                    const text=
                        result[0]
                            ?.transcript
                            ?.trim()||
                        "";


                    if(
                        !text
                    ){

                        continue;

                    }


                    /*
                    確定した文章。
                    */
                    if(
                        result.isFinal
                    ){

                        newFinal+=
                            (
                                newFinal
                                    ? " "
                                    : ""
                            )+
                            text;


                    /*
                    まだ聞き取り途中の文章。
                    */
                    }else{

                        newInterim+=
                            (
                                newInterim
                                    ? " "
                                    : ""
                            )+
                            text;

                    }

                }


                /*
                確定した文章だけ
                本文へ追加する。

                interimはここには絶対に入れない。
                */
                if(
                    newFinal
                ){

                    state.finalTranscript=
                        appendTranscriptText(
                            state.finalTranscript,
                            newFinal
                        );

                }


                state.interim=
                    newInterim;


                renderLiveTranscript();

            };


        recognition.onerror=
            event=>{

                console.warn(
                    "音声認識エラー:",
                    event.error
                );


                /*
                マイク権限など、
                自動再起動しても直らない場合。
                */
                if(
                    [
                        "not-allowed",
                        "service-not-allowed",
                        "audio-capture"
                    ].includes(
                        event.error
                    )
                ){

                    state.keepListening=
                        false;


                    state.isListening=
                        false;


                    state.interim=
                        "";


                    $("voiceButton").textContent=
                        "🎙 文字起こしを開始";


                    $("voiceState").textContent=
                        `文字起こしを開始できませんでした：${event.error}`;


                    renderLiveTranscript();


                    return;

                }


                /*
                no-speech / network等で
                認識セッションが終了しても、
                onend側で必要なら再開する。
                */

            };


        recognition.onend=
            ()=>{

                state.isListening=
                    false;


                /*
                終了した認識セッションの
                仮文字列だけ消す。

                確定文字列は残す。
                */
                state.interim=
                    "";


                renderLiveTranscript();


                /*
                ユーザーが停止していない場合は
                自動的に新しい認識セッションを開始。

                これで話していない時間があっても
                「文字起こし中」の状態を継続する。
                */
                if(
                    state.keepListening
                ){

                    $("voiceState").textContent=
                        "文字起こしを継続しています…";


                    setTimeout(
                        ()=>{

                            if(
                                state.keepListening
                            ){

                                startSpeechRecognition();

                            }

                        },
                        250
                    );


                    return;

                }


                $("voiceButton").textContent=
                    "🎙 文字起こしを開始";


                $("voiceState").textContent=
                    "文字起こしを停止しました。保存すると文字起こしタブへ残ります。";

            };


        try{

            recognition.start();


        }catch(error){

            console.warn(
                "音声認識開始エラー:",
                error
            );


            /*
            セッション切替直後などに
            start()が失敗した場合は
            少し待って再試行。
            */
            if(
                state.keepListening
            ){

                setTimeout(
                    startSpeechRecognition,
                    500
                );

            }

        }

    }

}


/*
確定した発話を
横方向へ続けて追加する。

発話ごとの改行はしない。

例：
おはよう 今日は テストを します

横幅いっぱいになったら
CSS/ブラウザが自動的に折り返す。
*/
function appendTranscriptText(
    current,
    addition
){

    const before=
        String(
            current||""
        )
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    const next=
        String(
            addition||""
        )
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    if(
        !next
    ){

        return before;

    }


    if(
        !before
    ){

        return next;

    }


    return `${before} ${next}`;

}


/*
確定文章＋聞き取り途中を
一続きの文章として表示する。

interimは画面上にだけ存在し、
確定すると置き換わる。
*/
function renderLiveTranscript(){

    const element=
        $("liveTranscript");


    if(
        !element
    ){

        return;

    }


    const finalText=
        String(
            state.finalTranscript||
            ""
        )
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    const interimText=
        String(
            state.interim||
            ""
        )
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    if(
        !finalText &&
        !interimText
    ){

        element.textContent=
            "まだ文字起こしは始まっていません。";


        return;

    }


    /*
    改行を入れず、
    半角スペースだけで横へつなぐ。

    横幅を超えれば
    ブラウザが自動折り返しする。
    */
    element.textContent=
        finalText+
        (
            interimText
                ? `${
                    finalText
                        ? " "
                        : ""
                }${interimText}`
                : ""
        );

}


async function openChatGPT(
    kind
){

    const note=
        current();


    if(!note){

        return alert(
            "先にノートを作成してください。"
        );

    }


    const body=
        $("noteBody")
            .value
            .trim();


    if(!body){

        return alert(
            "メモを入力してから使ってください。"
        );

    }


    const prompt=
        kind==="要約"
            ? `以下の講義メモを、重要語句・要点・次に確認することに分けて日本語で要約してください。\n\n${body}`
            : `以下の講義メモから、4択問題と穴埋め問題を作成してください。各問題に答えと簡潔な解説を付け、JSONでも出力してください。\n\n${body}`;


    try{

        await navigator.clipboard.writeText(
            prompt
        );

    }catch(error){

        console.warn(
            error
        );

    }


    window.open(
        "https://chatgpt.com/",
        "_blank",
        "noopener"
    );


    alert(
        `${kind}用の指示とメモをコピーしました。開いたChatGPTに貼り付けてください。`
    );

}


function dateLabel(
    value
){

    return typeof value?.toDate==="function"
        ? value.toDate().toLocaleString(
            "ja-JP"
        )
        : "更新日時未設定";

}


function plainTextToHtml(
    text
){

    return escapeHtml(
        text
    ).replace(
        /\n/g,
        "<br>"
    );

}


function setupInkOverlay(){

    const canvas=
        $("inkOverlay");


    const wrap=
        $("noteDocumentWrap");


    if(
        !canvas ||
        !wrap
    ){

        return;

    }


    const resize=
        ()=>{

            const rect=
                wrap.getBoundingClientRect();


            const old=
                canvas.toDataURL();


            const ratio=
                window.devicePixelRatio||1;


            if(
                !rect.width ||
                !rect.height
            ){

                return;

            }


            canvas.width=
                Math.round(
                    rect.width*ratio
                );


            canvas.height=
                Math.round(
                    rect.height*ratio
                );


            const ctx=
                canvas.getContext(
                    "2d"
                );


            ctx.setTransform(
                ratio,
                0,
                0,
                ratio,
                0,
                0
            );


            if(
                old!=="data:,"
            ){

                const image=
                    new Image();


                image.onload=
                    ()=>ctx.drawImage(
                        image,
                        0,
                        0,
                        rect.width,
                        rect.height
                    );


                image.src=
                    old;

            }

        };


    resize();


    window.addEventListener(
        "resize",
        resize
    );


    let drawing=
        false;


    let last;


    const point=
        event=>{

            const rect=
                canvas.getBoundingClientRect();


            return{
                x:
                    event.clientX-
                    rect.left,

                y:
                    event.clientY-
                    rect.top
            };

        };


    canvas.addEventListener(
        "pointerdown",
        event=>{

            drawing=
                true;


            last=
                point(
                    event
                );


            canvas.setPointerCapture(
                event.pointerId
            );


            event.preventDefault();

        }
    );


    canvas.addEventListener(
        "pointermove",
        event=>{

            if(
                !drawing
            ){

                return;

            }


            const next=
                point(
                    event
                );


            const ctx=
                canvas.getContext(
                    "2d"
                );


            const tool=
                state.drawTool;


            const base=
                Number(
                    $("penSize").value
                );


            ctx.lineCap=
                "round";


            ctx.lineJoin=
                "round";


            ctx.lineWidth=
                tool==="highlighter"
                    ? base*3
                    : tool==="marker"
                        ? base*1.7
                        : base;


            ctx.globalCompositeOperation=
                tool==="eraser"
                    ? "destination-out"
                    : "source-over";


            ctx.globalAlpha=
                tool==="highlighter"
                    ? .28
                    : tool==="marker"
                        ? .58
                        : 1;


            ctx.strokeStyle=
                $("penColor").value;


            ctx.beginPath();


            ctx.moveTo(
                last.x,
                last.y
            );


            ctx.lineTo(
                next.x,
                next.y
            );


            ctx.stroke();


            ctx.globalAlpha=
                1;


            last=
                next;


            event.preventDefault();

        }
    );


    [
        "pointerup",
        "pointercancel"
    ].forEach(
        type=>
            canvas.addEventListener(
                type,
                ()=>drawing=false
            )
    );


    $("eraseBoard")
        ?.addEventListener(
            "click",
            ()=>{

                const ctx=
                    canvas.getContext(
                        "2d"
                    );


                const rect=
                    canvas.getBoundingClientRect();


                ctx.clearRect(
                    0,
                    0,
                    rect.width,
                    rect.height
                );

            }
        );

}


function setupToolControls(){

    const tools=
        document.querySelector(
            ".rich-note-tools"
        );


    const pen=
        $("penSize");


    const imageSize=
        $("imageSize");


    if(
        !tools ||
        !pen
    ){

        return;

    }


    pen.max=
        "80";


    const oldPenOutput=
        $("penSizeValue");


    const parent=
        pen.parentNode;


    const control=
        document.createElement(
            "label"
        );


    const penOutput=
        document.createElement(
            "output"
        );


    control.className=
        "tool-control";


    control.append(
        document.createTextNode(
            "ペンの太さ"
        )
    );


    penOutput.id=
        "penSizeValue";


    penOutput.textContent=
        `${pen.value}px`;


    parent.insertBefore(
        control,
        pen
    );


    control.append(
        pen,
        penOutput
    );


    oldPenOutput?.remove();


    pen.oninput=
        ()=>{

            penOutput.textContent=
                `${pen.value}px`;

        };


    imageSize
        ?.closest(
            "label"
        )
        ?.remove();


    $("handwritingMode").textContent=
        "手書きモード";


    $("handwritingMode").title=
        "押すと手書き開始、もう一度押すと文字入力へ戻ります";


    document
        .querySelector(
            ".image-attach-button"
        )
        ?.replaceChildren(
            document.createTextNode(
                "画像を追加"
            ),
            $("noteImageInput")
        );


    document
        .querySelectorAll(
            "[data-color]"
        )
        .forEach(
            button=>{

                button.textContent=
                    "";


                button.title=
                    button.getAttribute(
                        "aria-label"
                    )||
                    "色を選ぶ";

            }
        );

}


function clearInkOverlay(){

    const canvas=
        $("inkOverlay");


    if(!canvas){
        return;
    }


    const ctx=
        canvas.getContext(
            "2d"
        );


    const rect=
        canvas.getBoundingClientRect();


    ctx.clearRect(
        0,
        0,
        rect.width,
        rect.height
    );

}


function restoreInkOverlay(
    data
){

    clearInkOverlay();


    if(!data){
        return;
    }


    const canvas=
        $("inkOverlay");


    const rect=
        canvas.getBoundingClientRect();


    const ctx=
        canvas.getContext(
            "2d"
        );


    const image=
        new Image();


    image.onload=
        ()=>ctx.drawImage(
            image,
            0,
            0,
            rect.width,
            rect.height
        );


    image.src=
        data;

}


function syncPlainBody(){

    $("noteBody").value=
        $("noteDocument").innerText||
        "";

}


function setDocumentHtml(
    html
){

    $("noteDocument").innerHTML=
        html||"";


    syncPlainBody();

}


function insertNodeAtCursor(
    node
){

    const editor=
        $("noteDocument");


    const selection=
        window.getSelection();


    if(
        !selection.rangeCount ||
        !editor.contains(
            selection.anchorNode
        )
    ){

        editor.append(
            node
        );


        return;

    }


    const range=
        selection.getRangeAt(
            0
        );


    range.deleteContents();


    range.insertNode(
        node
    );


    range.setStartAfter(
        node
    );


    range.collapse(
        true
    );


    selection.removeAllRanges();


    selection.addRange(
        range
    );

}


function insertTextAtCursor(
    text
){

    const editor=
        $("noteDocument");


    editor.focus();


    insertNodeAtCursor(
        document.createTextNode(
            text
        )
    );

}


function insertImageAtPoint(
    url,
    x,
    y
){

    const editor=
        $("noteDocument");


    const selection=
        window.getSelection();


    let range;


    if(
        document.caretRangeFromPoint
    ){

        range=
            document.caretRangeFromPoint(
                x,
                y
            );

    }


    if(
        range &&
        editor.contains(
            range.startContainer
        )
    ){

        selection.removeAllRanges();


        selection.addRange(
            range
        );

    }


    const image=
        document.createElement(
            "img"
        );


    image.id=
        `note-image-${Date.now()}-${Math.random().toString(36).slice(2)}`;


    image.src=
        url;


    image.alt=
        "ノートに添付した画像";


    image.className=
        "note-image-left";


    image.draggable=
        true;


    image.style.width=
        "65%";


    image.ondragstart=
        event=>
            event.dataTransfer.setData(
                "text/caremate-document-image",
                image.id
            );


    image.addEventListener(
        "click",
        ()=>selectNoteImage(
            image
        )
    );


    insertNodeAtCursor(
        image
    );


    selectNoteImage(
        image
    );


    syncPlainBody();


    renderPreview();


    $("noteImageState").textContent=
        "画像をノートへ配置しました。光る枠の画像は四隅・辺をドラッグして大きさを変えられます。";

}


function selectNoteImage(
    image
){

    $("noteDocument")
        .querySelectorAll(
            "img"
        )
        .forEach(
            item=>
                item.classList.toggle(
                    "is-selected",
                    item===image
                )
        );


    state.selectedImage=
        image;


    let remove=
        $("removeSelectedImage");


    if(!remove){

        remove=
            document.createElement(
                "button"
            );


        remove.id=
            "removeSelectedImage";


        remove.type=
            "button";


        remove.textContent=
            "×";


        remove.title=
            "選択した画像を削除";


        $("noteDocumentWrap")
            .append(
                remove
            );


        remove.onclick=
            ()=>{

                state.selectedImage
                    ?.remove();


                state.selectedImage=
                    null;


                remove.hidden=
                    true;


                syncPlainBody();


                renderPreview();

            };

    }


    remove.hidden=
        false;


    const imageRect=
        image.getBoundingClientRect();


    const wrapRect=
        $("noteDocumentWrap")
            .getBoundingClientRect();


    remove.style.left=
        `${
            imageRect.right-
            wrapRect.left-
            18
        }px`;


    remove.style.top=
        `${
            imageRect.top-
            wrapRect.top-
            18
        }px`;

}


function cycleImageLayout(
    image
){

    const layouts=[
        "note-image-left",
        "note-image-right",
        "note-image-center"
    ];


    const current=
        layouts.findIndex(
            item=>
                image.classList.contains(
                    item
                )
        );


    image.classList.remove(
        ...layouts
    );


    image.classList.add(
        layouts[
            (current+1)%
            layouts.length
        ]
    );


    syncPlainBody();

}


function enableInlineDrawing(
    canvas
){

    const ctx=
        canvas.getContext(
            "2d"
        );


    const ratio=
        window.devicePixelRatio||1;


    const resize=
        ()=>{

            const width=
                canvas.clientWidth||
                720;


            const height=
                width*
                300/
                720;


            const data=
                canvas.toDataURL();


            canvas.width=
                Math.round(
                    width*ratio
                );


            canvas.height=
                Math.round(
                    height*ratio
                );


            ctx.setTransform(
                ratio,
                0,
                0,
                ratio,
                0,
                0
            );


            if(
                data!=="data:,"
            ){

                const image=
                    new Image();


                image.onload=
                    ()=>ctx.drawImage(
                        image,
                        0,
                        0,
                        width,
                        height
                    );


                image.src=
                    data;

            }

        };


    resize();


    let drawing=
        false;


    let last;


    const point=
        event=>{

            const rect=
                canvas.getBoundingClientRect();


            return{
                x:
                    event.clientX-
                    rect.left,

                y:
                    event.clientY-
                    rect.top
            };

        };


    canvas.addEventListener(
        "pointerdown",
        event=>{

            drawing=
                true;


            last=
                point(
                    event
                );


            canvas.setPointerCapture(
                event.pointerId
            );


            event.preventDefault();

        }
    );


    canvas.addEventListener(
        "pointermove",
        event=>{

            if(
                !drawing
            ){

                return;

            }


            const next=
                point(
                    event
                );


            const tool=
                state.drawTool;


            const base=
                Number(
                    $("penSize").value
                );


            ctx.lineCap=
                "round";


            ctx.lineJoin=
                "round";


            ctx.lineWidth=
                tool==="highlighter"
                    ? base*3
                    : tool==="marker"
                        ? base*1.7
                        : base;


            ctx.globalCompositeOperation=
                tool==="eraser"
                    ? "destination-out"
                    : "source-over";


            ctx.globalAlpha=
                tool==="highlighter"
                    ? .28
                    : tool==="marker"
                        ? .58
                        : 1;


            ctx.strokeStyle=
                $("penColor").value;


            ctx.beginPath();


            ctx.moveTo(
                last.x,
                last.y
            );


            ctx.lineTo(
                next.x,
                next.y
            );


            ctx.stroke();


            ctx.globalAlpha=
                1;


            last=
                next;


            event.preventDefault();

        }
    );


    [
        "pointerup",
        "pointercancel"
    ].forEach(
        type=>
            canvas.addEventListener(
                type,
                ()=>drawing=false
            )
    );

}


function inlineCanvasesToImages(){

    $("noteDocument")
        .querySelectorAll(
            "canvas.note-ink-canvas"
        )
        .forEach(
            canvas=>{

                const image=
                    document.createElement(
                        "img"
                    );


                image.src=
                    canvas.toDataURL(
                        "image/png"
                    );


                image.alt=
                    "手書きメモ";


                image.className=
                    "note-image-left";


                image.addEventListener(
                    "click",
                    ()=>cycleImageLayout(
                        image
                    )
                );


                canvas.replaceWith(
                    image
                );

            }
        );

}