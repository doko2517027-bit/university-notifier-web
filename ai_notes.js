import {
  db,
  studentNumber,
  setupTheme,
  initializePage,
  loadProfileImage,
  loadUserName,
  loadMyRanking,
  setupAdminTab,
} from "./common.js";
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

const NOTE_USERS = new Set(["2510044", "2510054"]);

let notesRef = null;

const state = {
  notes: [],

  selected: null,

  recognition: null,

  isListening: false,

  keepListening: false,

  finalTranscript: "",

  interim: "",

  drawing: false,

  lastPoint: null,

  drawTool: "pen",

  paper: "blank",

  inkMode: false,

  selectedPlacedImageId: null,

  questions: [],

  questionUnsubscribe: null,

  questionsNoteId: null,

  problemView: "solve",

  problemType: "quiz",

  questionFilter: "all",

  questionIndex: 0,

  selectedAnswer: null,

  quizAnswered: false,

  answerVisible: false,

  editingQuestionId: null,
};

const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>\"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );

setupTheme($("themeButton"));

await initializePage([
  setupAdminTab(),
  loadUserName($("userName")),
  loadMyRanking(),
  loadProfileImage($("topProfileImage")),
]);

if (!NOTE_USERS.has(studentNumber)) {
  $("denied").hidden = false;

  document.body.classList.remove("page-loading");
} else {
  $("noteApp").hidden = false;

  notesRef = collection(db, "digitalNotes", studentNumber, "notes");

  onSnapshot(
    query(notesRef, orderBy("updatedAt", "desc")),
    (snapshot) => {
      state.notes = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      if (!state.selected && state.notes[0]) {
        state.selected = state.notes[0].id;
      }

      subscribeQuestions(state.selected);

      render();
    },
    (error) => {
      console.error(error);

      $("noteList").textContent = "ノートを読み込めませんでした。";
    },
  );

  $("newNoteDrawer").onclick = createNewNote;

  async function createNewNote() {
    const created = await addDoc(notesRef, {
      title: "新しいノート",

      body: "",

      bodyHtml: "",

      transcript: "",

      maskTerms: [],

      todos: [],

      images: [],

      placedImages: [],

      createdAt: serverTimestamp(),

      updatedAt: serverTimestamp(),
    });

    state.selected = created.id;

    $("noteDrawer").classList.remove("is-open");

    $("drawerBackdrop").classList.remove("is-open");
  }

  $("deleteNote").onclick = deleteCurrentNote;

  $("saveNote").onclick = saveCurrent;

  $("noteSearch").oninput = renderList;

  $("addTodo").onclick = () => {
    const note = current();

    if (!note) {
      return;
    }

    note.todos = [
      ...(note.todos || []),
      {
        text: "",
        done: false,
      },
    ];

    renderTodos();
  };

  $("voiceButton").onclick = toggleVoice;

  $("copyTranscript")?.addEventListener("click", copyTranscript);

  $("openSummary").onclick = () => openChatGPT("要約");

  $("openQuiz").onclick = () => openChatGPT("問題作成");

  setupImages();

  setupDrawer();

  document
    .querySelectorAll(".workspace-tab")
    .forEach(
      (button) => (button.onclick = () => selectPanel(button.dataset.panel)),
    );

  document
    .querySelectorAll("[data-feature]")
    .forEach(
      (button) => (button.onclick = () => selectPanel(button.dataset.feature)),
    );

  $("penColor").oninput = () => setDrawTool("pen");

  /*
    ペン太さは setupToolControls() 側で
    バー・つまみ・数値をまとめて同期する。
    */

  document
    .querySelectorAll("[data-draw-tool]")
    .forEach(
      (button) => (button.onclick = () => setDrawTool(button.dataset.drawTool)),
    );

  document.querySelectorAll("[data-color]").forEach(
    (button) =>
      (button.onclick = () => {
        $("penColor").value = button.dataset.color;

        setDrawTool("pen");

        document
          .querySelectorAll("[data-color]")
          .forEach((item) => item.classList.toggle("active", item === button));
      }),
  );

  document
    .querySelectorAll("[data-paper]")
    .forEach(
      (button) => (button.onclick = () => setPaper(button.dataset.paper)),
    );

  $("clearBoard")?.addEventListener("click", clearBoard);

  setupBoard();

  setupUnifiedNote();

  setupInkOverlay();

  setupToolControls();

  ["noteTitle", "noteBody", "maskTerms"].forEach((id) =>
    $(id).addEventListener("input", renderPreview),
  );

  $("noteDocument").addEventListener("input", () => {
    syncPlainBody();

    renderPreview();
  });

  document.addEventListener("click", (event) => {
    const select = event.target.closest(".note-entry");

    if (select) {
      state.selected = select.dataset.id;

      subscribeQuestions(state.selected);

      render();

      $("noteDrawer").classList.remove("is-open");

      $("drawerBackdrop").classList.remove("is-open");

      return;
    }

    const mask = event.target.closest(".mask-word");

    if (mask) {
      mask.classList.toggle("is-open");
    }

    handleProblemAction(event);
  });

  document.addEventListener("change", handleProblemChange);

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (form.id !== "questionForm") {
      return;
    }
    event.preventDefault();
    try {
      await saveQuestion(form);
    } catch (error) {
      console.error(error);
      alert("問題を保存できませんでした。");
    }
  });

  document.body.classList.remove("page-loading");
}

function current() {
  return state.notes.find((note) => note.id === state.selected);
}

function render() {
  renderList();

  const note = current();

  if (!note) {
    $("noteTitle").value = "";

    $("noteBody").value = "";

    $("noteDocument").innerHTML = "";

    const imageLayer = $("noteImageLayer");

    if (imageLayer) {
      imageLayer.innerHTML = "";
    }

    state.finalTranscript = "";

    state.interim = "";

    renderLiveTranscript();

    $("maskTerms").value = "";

    $("todoList").innerHTML = "";

    renderImages();

    renderPreview();

    clearInkOverlay();

    return;
  }

  /*
    旧方式で本文内へ保存されていた画像を
    新しい自由配置画像へ移行する。
    */
  migrateLegacyInlineImages(note);

  $("noteTitle").value = note.title || "";

  setDocumentHtml(note.bodyHtml || plainTextToHtml(note.body || ""));

  /*
    音声認識中にsnapshotが来ても
    認識中の文章を巻き戻さない。
    */
  if (!state.keepListening) {
    state.finalTranscript = String(note.transcript || "")
      .replace(/\s+/g, " ")
      .trim();

    state.interim = "";
  }

  renderLiveTranscript();

  $("maskTerms").value = (note.maskTerms || []).join(", ");

  renderTodos();

  renderImages();

  renderPlacedImages();

  renderPreview();

  restoreBoard();

  restoreInkOverlay(note.inkData || "");
}

function renderList() {
  const filter = $("noteSearch").value.trim().toLowerCase();

  const notes = state.notes.filter((note) =>
    `${note.title || ""}\n${note.body || ""}`.toLowerCase().includes(filter),
  );

  $("noteList").innerHTML = notes.length
    ? notes
        .map(
          (note) => `
                    <button
                        class="note-entry ${
                          note.id === state.selected ? "active" : ""
                        }"
                        data-id="${note.id}">

                        <b>
                            ${escapeHtml(note.title || "無題のノート")}
                        </b>

                        <p>
                            ${escapeHtml(note.body || "メモはまだありません")}
                        </p>

                        <small>
                            ${dateLabel(note.updatedAt)}
                        </small>

                    </button>
                `,
        )
        .join("")
    : "<p>該当するノートはありません。</p>";
}

function renderTodos() {
  const note = current();

  $("todoList").innerHTML =
    (note?.todos || [])
      .map(
        (todo, index) => `
                    <div class="todo-row">

                        <input
                            type="checkbox"
                            data-todo-done="${index}"
                            ${todo.done ? "checked" : ""}>

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
                `,
      )
      .join("") || '<p class="note-hint">ToDoはまだありません。</p>';

  $("todoList")
    .querySelectorAll("input,button")
    .forEach((item) => item.addEventListener("change", todoChange));

  $("todoList")
    .querySelectorAll("button")
    .forEach((item) => item.addEventListener("click", todoChange));
}

function todoChange(event) {
  const note = current();

  const target = event.target;

  if (!note) {
    return;
  }

  const index = Number(
    target.dataset.todoDone ??
      target.dataset.todoText ??
      target.dataset.todoDelete,
  );

  if (target.dataset.todoDelete !== undefined) {
    note.todos.splice(index, 1);
  } else if (target.dataset.todoDone !== undefined) {
    note.todos[index].done = target.checked;
  } else {
    note.todos[index].text = target.value;
  }

  renderTodos();
}

function setupImages() {
  const input = $("noteImageInput");

  const editor = $("noteDocument");

  if (input) {
    input.onchange = uploadNoteImage;
  }

  if (!editor) {
    return;
  }

  /*
    contenteditable内へ
    ファイルを直接ドロップさせない。
    */
  editor.addEventListener("dragover", (event) => {
    if (event.dataTransfer?.types?.includes("Files")) {
      event.preventDefault();
    }
  });

  editor.addEventListener("drop", (event) => {
    if (event.dataTransfer?.files?.length) {
      event.preventDefault();
    }
  });

  /*
    クリップボードから画像だけを
    contenteditableへ直接貼り付ける処理も禁止。

    普通の文字コピー＆ペーストはそのまま使える。
    */
  editor.addEventListener("paste", (event) => {
    const items = [...(event.clipboardData?.items || [])];

    const hasImageFile = items.some((item) =>
      String(item.type || "").startsWith("image/"),
    );

    const html = event.clipboardData?.getData("text/html") || "";

    const hasHtmlImage = /<img[\s>]/i.test(html);

    if (hasImageFile || hasHtmlImage) {
      event.preventDefault();
    }
  });

  const wrap = $("noteDocumentWrap");

  wrap?.addEventListener("pointerdown", (event) => {
    /*
            画像本体・×・リサイズ丸を
            タップした場合はそのまま。
            */
    if (event.target.closest(".placed-note-image")) {
      return;
    }

    /*
            ノートの余白や文字部分を
            タップしたら選択解除。
            */
    deselectPlacedImages();
  });
}

async function uploadNoteImage(event) {
  const note = current();

  const file = event.target.files?.[0];

  const stateLabel = $("noteImageState");

  if (!note) {
    alert("先にノートを作成してください。");

    return;
  }

  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    alert("画像ファイルを選んでください。");

    return;
  }

  if (file.size > 50 * 1024 * 1024) {
    alert("50MB以下の画像を選んでください。");

    return;
  }

  event.target.disabled = true;

  if (stateLabel) {
    stateLabel.textContent = "画像を追加しています…";
  }

  try {
    const form = new FormData();

    form.append("file", file);

    form.append("upload_preset", "caremate_upload");

    const response = await fetch(
      "https://api.cloudinary.com/v1_1/vpctonjf/image/upload",
      {
        method: "POST",

        body: form,
      },
    );

    const data = await response.json();

    if (!response.ok || !data.secure_url) {
      throw new Error(data.error?.message || "アップロードに失敗しました。");
    }

    const asset = {
      id: createImageId(),

      url: data.secure_url,

      publicId: data.public_id || "",

      width: Number(data.width || 0),

      height: Number(data.height || 0),
    };

    const nextImages = [...(note.images || []), asset];

    const nextPlacedImages = [
      ...getPlacedImages(note),
      createDefaultPlacement(asset, getPlacedImages(note).length),
    ];

    note.images = nextImages;

    note.placedImages = nextPlacedImages;

    renderImages();

    renderPlacedImages();

    await updateDoc(doc(notesRef, note.id), {
      images: nextImages,

      placedImages: nextPlacedImages,

      updatedAt: serverTimestamp(),
    });

    if (stateLabel) {
      stateLabel.textContent =
        "画像を追加しました。ドラッグで自由に移動、周囲の8個の丸で大きさを変更できます。";
    }
  } catch (error) {
    console.error(error);

    if (stateLabel) {
      stateLabel.textContent = "画像を追加できませんでした。";
    }

    alert(
      `写真を追加できませんでした。\n${
        error.message || "通信を確認して、もう一度お試しください。"
      }`,
    );
  } finally {
    event.target.value = "";

    event.target.disabled = false;
  }
}

function renderImages() {
  const list = $("noteImageList");

  if (!list) {
    return;
  }

  const note = current();

  const images = note?.images || [];

  if (!images.length) {
    list.innerHTML = "";

    return;
  }

  list.innerHTML = images
    .map(
      (image, index) => `

                    <div
                        class="note-image-card"
                        data-image-index="${index}">

                        <img
                            src="${escapeHtml(image.url)}"
                            alt="添付画像"
                            draggable="false">

                        <button
                            type="button"
                            data-image-delete="${index}"
                            aria-label="画像を削除">
                            ×
                        </button>

                    </div>

                `,
    )
    .join("");

  list.querySelectorAll("[data-image-delete]").forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();

      event.stopPropagation();

      removeAttachmentImage(Number(button.dataset.imageDelete));
    };
  });

  /*
    長押し画像メニューを出さない。
    */
  list.oncontextmenu = (event) => event.preventDefault();
}

function createImageId() {
  if (window.crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return `note-image-${Date.now()}-` + Math.random().toString(36).slice(2);
}

function getPlacedImages(note) {
  if (!note) {
    return [];
  }

  if (!Array.isArray(note.placedImages)) {
    note.placedImages = [];
  }

  return note.placedImages;
}

function createDefaultPlacement(asset, index = 0) {
  const layer = $("noteImageLayer");

  const layerWidth = layer?.clientWidth || 700;

  const layerHeight = layer?.clientHeight || 560;

  const imageWidth = Number(asset.width || 0);

  const imageHeight = Number(asset.height || 0);

  const ratio =
    imageWidth > 0 && imageHeight > 0 ? imageWidth / imageHeight : 4 / 3;

  const widthPercent = 42;

  const pixelWidth = (layerWidth * widthPercent) / 100;

  const pixelHeight = pixelWidth / ratio;

  const heightPercent = Math.min(
    70,
    Math.max(15, (pixelHeight / layerHeight) * 100),
  );

  return {
    id: createImageId(),

    assetId: asset.id || "",

    url: asset.url,

    publicId: asset.publicId || "",

    x: Math.min(10 + index * 4, 45),

    y: Math.min(8 + index * 5, 55),

    width: widthPercent,

    height: heightPercent,
  };
}

/*
旧bodyHtmlの中にある画像を
contenteditable外へ移行する。
*/
function migrateLegacyInlineImages(note) {
  if (!note || !note.bodyHtml) {
    return;
  }

  const container = document.createElement("div");

  container.innerHTML = note.bodyHtml;

  const oldImages = [...container.querySelectorAll("img")];

  if (!oldImages.length) {
    return;
  }

  const assets = [...(note.images || [])];

  const placements = [...getPlacedImages(note)];

  oldImages.forEach((image, index) => {
    const url = image.getAttribute("src") || image.src;

    if (!url) {
      image.remove();

      return;
    }

    let asset = assets.find((item) => item.url === url);

    if (!asset) {
      asset = {
        id: createImageId(),

        url,

        publicId: "",

        width: 0,

        height: 0,
      };

      assets.push(asset);
    }

    const alreadyPlaced = placements.some(
      (item) => item.assetId === asset.id || item.url === url,
    );

    if (!alreadyPlaced) {
      placements.push(createDefaultPlacement(asset, index));
    }

    /*
            旧画像を本文から完全に外す。
            */
    image.remove();
  });

  note.images = assets;

  note.placedImages = placements;

  note.bodyHtml = container.innerHTML;
}

function renderPlacedImages() {
  const layer = $("noteImageLayer");

  const note = current();

  if (!layer || !note) {
    return;
  }

  const placements = getPlacedImages(note);

  layer.innerHTML = placements
    .map((placement) => {
      const x = clampNumber(placement.x, 0, 95);

      const y = clampNumber(placement.y, 0, 95);

      const width = clampNumber(placement.width, 10, 95);

      const height = clampNumber(placement.height, 10, 95);

      const selected = state.selectedPlacedImageId === placement.id;

      return `

                        <div
                            class="placed-note-image ${
                              selected ? "is-selected" : ""
                            }"
                            data-placement-id="${escapeHtml(placement.id)}"
                            style="
                                left:${x}%;
                                top:${y}%;
                                width:${width}%;
                                height:${height}%;
                            ">

                            <img
                                src="${escapeHtml(placement.url)}"
                                alt="ノート画像"
                                draggable="false">

                            <button
                                type="button"
                                class="placed-image-remove"
                                aria-label="画像を削除">
                                ×
                            </button>

                            ${renderResizeHandles()}

                        </div>

                    `;
    })
    .join("");

  const nodes = [...layer.querySelectorAll(".placed-note-image")];

  placements.forEach((placement) => {
    const node = nodes.find(
      (element) => element.dataset.placementId === placement.id,
    );

    if (!node) {
      return;
    }

    setupPlacedImageInteraction(node, placement);
  });

  layer.oncontextmenu = (event) => event.preventDefault();
}

function selectPlacedImage(placementId) {
  state.selectedPlacedImageId = placementId;

  document.querySelectorAll(".placed-note-image").forEach((element) => {
    element.classList.toggle(
      "is-selected",
      element.dataset.placementId === placementId,
    );
  });
}

function deselectPlacedImages() {
  state.selectedPlacedImageId = null;

  document.querySelectorAll(".placed-note-image").forEach((element) => {
    element.classList.remove("is-selected");
  });
}

function renderResizeHandles() {
  return ["nw", "n", "ne", "e", "se", "s", "sw", "w"]
    .map(
      (direction) => `

                <span
                    class="image-resize-handle"
                    data-direction="${direction}">
                </span>

            `,
    )
    .join("");
}

function setupPlacedImageInteraction(node, placement) {
  const removeButton = node.querySelector(".placed-image-remove");

  removeButton?.addEventListener("pointerdown", (event) => {
    event.preventDefault();

    event.stopPropagation();
  });

  removeButton?.addEventListener("click", (event) => {
    event.preventDefault();

    event.stopPropagation();

    removePlacedImage(placement.id);
  });

  /*
    ブラウザ標準の画像ドラッグや選択を禁止。
    */
  node.addEventListener("dragstart", (event) => event.preventDefault());

  node.addEventListener("selectstart", (event) => event.preventDefault());

  node.addEventListener("contextmenu", (event) => event.preventDefault());

  /*
    画像本体ドラッグ = 移動
    */
  node.addEventListener("pointerdown", (event) => {
    /*
            まず画像を選択。
            ×とリサイズ丸を表示する。
            */
    selectPlacedImage(placement.id);

    if (
      event.target.closest(".placed-image-remove") ||
      event.target.closest(".image-resize-handle")
    ) {
      return;
    }

    startImageMove(event, node, placement);
  });

  /*
    8方向リサイズ
    */
  node.querySelectorAll(".image-resize-handle").forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();

      event.stopPropagation();

      startImageResize(event, node, placement, handle.dataset.direction);
    });
  });
}

function startImageMove(event, node, placement) {
  event.preventDefault();

  const layer = $("noteImageLayer");

  if (!layer) {
    return;
  }

  const startPointerX = event.clientX;

  const startPointerY = event.clientY;

  const startLeft = node.offsetLeft;

  const startTop = node.offsetTop;

  node.classList.add("is-moving");

  const move = (moveEvent) => {
    moveEvent.preventDefault();

    const deltaX = moveEvent.clientX - startPointerX;

    const deltaY = moveEvent.clientY - startPointerY;

    const maxLeft = Math.max(0, layer.clientWidth - node.offsetWidth);

    const maxTop = Math.max(0, layer.clientHeight - node.offsetHeight);

    const left = clampNumber(startLeft + deltaX, 0, maxLeft);

    const top = clampNumber(startTop + deltaY, 0, maxTop);

    node.style.left = `${left}px`;

    node.style.top = `${top}px`;

    placement.x = layer.clientWidth ? (left / layer.clientWidth) * 100 : 0;

    placement.y = layer.clientHeight ? (top / layer.clientHeight) * 100 : 0;
  };

  const finish = () => {
    node.classList.remove("is-moving");

    window.removeEventListener("pointermove", move);

    window.removeEventListener("pointerup", finish);

    window.removeEventListener("pointercancel", finish);

    const note = current();

    if (note) {
      persistImageState(note);
    }
  };

  window.addEventListener("pointermove", move, {
    passive: false,
  });

  window.addEventListener("pointerup", finish, {
    once: true,
  });

  window.addEventListener("pointercancel", finish, {
    once: true,
  });
}

function startImageResize(event, node, placement, direction) {
  event.preventDefault();

  const layer = $("noteImageLayer");

  if (!layer) {
    return;
  }

  const startPointerX = event.clientX;

  const startPointerY = event.clientY;

  const startLeft = node.offsetLeft;

  const startTop = node.offsetTop;

  const startWidth = node.offsetWidth;

  const startHeight = node.offsetHeight;

  const minimumWidth = 72;

  const minimumHeight = 60;

  node.classList.add("is-resizing");

  const move = (moveEvent) => {
    moveEvent.preventDefault();

    const dx = moveEvent.clientX - startPointerX;

    const dy = moveEvent.clientY - startPointerY;

    let left = startLeft;

    let top = startTop;

    let width = startWidth;

    let height = startHeight;

    /*
            右
            */
    if (direction.includes("e")) {
      width = startWidth + dx;
    }

    /*
            左
            */
    if (direction.includes("w")) {
      width = startWidth - dx;

      left = startLeft + dx;
    }

    /*
            下
            */
    if (direction.includes("s")) {
      height = startHeight + dy;
    }

    /*
            上
            */
    if (direction.includes("n")) {
      height = startHeight - dy;

      top = startTop + dy;
    }

    /*
            最小サイズ
            */
    if (width < minimumWidth) {
      if (direction.includes("w")) {
        left = startLeft + startWidth - minimumWidth;
      }

      width = minimumWidth;
    }

    if (height < minimumHeight) {
      if (direction.includes("n")) {
        top = startTop + startHeight - minimumHeight;
      }

      height = minimumHeight;
    }

    /*
            左上を領域内へ。
            */
    if (left < 0) {
      if (direction.includes("w")) {
        width += left;
      }

      left = 0;
    }

    if (top < 0) {
      if (direction.includes("n")) {
        height += top;
      }

      top = 0;
    }

    /*
            右端を超えない。
            */
    if (left + width > layer.clientWidth) {
      width = layer.clientWidth - left;
    }

    /*
            下端を超えない。
            */
    if (top + height > layer.clientHeight) {
      height = layer.clientHeight - top;
    }

    width = Math.max(minimumWidth, width);

    height = Math.max(minimumHeight, height);

    node.style.left = `${left}px`;

    node.style.top = `${top}px`;

    node.style.width = `${width}px`;

    node.style.height = `${height}px`;

    placement.x = layer.clientWidth ? (left / layer.clientWidth) * 100 : 0;

    placement.y = layer.clientHeight ? (top / layer.clientHeight) * 100 : 0;

    placement.width = layer.clientWidth
      ? (width / layer.clientWidth) * 100
      : placement.width;

    placement.height = layer.clientHeight
      ? (height / layer.clientHeight) * 100
      : placement.height;
  };

  const finish = () => {
    node.classList.remove("is-resizing");

    window.removeEventListener("pointermove", move);

    window.removeEventListener("pointerup", finish);

    window.removeEventListener("pointercancel", finish);

    const note = current();

    if (note) {
      persistImageState(note);
    }
  };

  window.addEventListener("pointermove", move, {
    passive: false,
  });

  window.addEventListener("pointerup", finish, {
    once: true,
  });

  window.addEventListener("pointercancel", finish, {
    once: true,
  });
}

async function removePlacedImage(placementId) {
  const note = current();

  if (!note) {
    return;
  }

  const placement = getPlacedImages(note).find(
    (item) => item.id === placementId,
  );

  if (!placement) {
    return;
  }

  if (state.selectedPlacedImageId === placementId) {
    state.selectedPlacedImageId = null;
  }

  /*
    ×を押した時だけ
    画像を削除する。
    */
  note.placedImages = getPlacedImages(note).filter(
    (item) => item.id !== placementId,
  );

  /*
    同じ画像が他の配置で使われているか確認。
    */
  const stillUsed = note.placedImages.some(
    (item) =>
      (placement.assetId && item.assetId === placement.assetId) ||
      item.url === placement.url,
  );

  if (!stillUsed) {
    note.images = (note.images || []).filter((image) => {
      if (placement.assetId && image.id === placement.assetId) {
        return false;
      }

      return image.url !== placement.url;
    });
  }

  renderPlacedImages();

  renderImages();

  await persistImageState(note);
}

async function removeAttachmentImage(index) {
  const note = current();

  if (!note) {
    return;
  }

  const images = [...(note.images || [])];

  const asset = images[index];

  if (!asset) {
    return;
  }

  images.splice(index, 1);

  note.images = images;

  /*
    下の添付一覧の×を押した場合も
    ノート上から同じ画像を削除。
    */
  note.placedImages = getPlacedImages(note).filter((placement) => {
    if (asset.id && placement.assetId === asset.id) {
      return false;
    }

    return placement.url !== asset.url;
  });

  renderImages();

  renderPlacedImages();

  await persistImageState(note);
}

async function persistImageState(note) {
  if (!note?.id) {
    return;
  }

  try {
    await updateDoc(doc(notesRef, note.id), {
      images: note.images || [],

      placedImages: getPlacedImages(note),

      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("画像位置の保存に失敗しました。", error);
  }
}

function clampNumber(value, minimum, maximum) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, number));
}

async function deleteCurrentNote() {
  const note = current();

  if (!note) {
    return alert("削除するノートを選んでください。");
  }

  if (
    !confirm(
      `「${note.title || "無題のノート"}」を削除しますか？\n本文とこの端末の手書きは元に戻せません。`,
    )
  ) {
    return;
  }

  try {
    localStorage.removeItem(`careMateHandwriting:${studentNumber}:${note.id}`);

    localStorage.removeItem(`careMatePaper:${studentNumber}:${note.id}`);

    await deleteDoc(doc(notesRef, note.id));

    state.selected = null;

    alert("ノートを削除しました。");
  } catch (error) {
    console.error(error);

    alert("ノートを削除できませんでした。");
  }
}

function selectPanel(id) {
  const external = id === "todoPanel" || id === "problemPanel";

  $("todoPanel")?.classList.toggle("active", id === "todoPanel");

  $("problemPanel")?.classList.toggle("active", id === "problemPanel");

  const shell = document.querySelector(".note-shell");

  if (shell) {
    shell.hidden = external;
  }

  document.querySelectorAll(".workspace-tab").forEach((item) => {
    item.classList.toggle("active", item.dataset.panel === id);
  });

  document.querySelectorAll(".workspace-panel").forEach((item) => {
    item.classList.toggle("active", item.id === id);
  });

  document.querySelectorAll("[data-feature]").forEach((item) => {
    item.classList.toggle("active", item.dataset.feature === id);
  });

  if (id === "typedPanel") {
    requestAnimationFrame(() => {
      resizeBoard();

      renderPlacedImages();
    });
  }

  if (id === "problemPanel") {
    renderQuestions();
  }
}

function questionCollection(noteId = state.selected) {
  return noteId && notesRef
    ? collection(notesRef, noteId, "questions")
    : null;
}

function subscribeQuestions(noteId) {
  if (state.questionsNoteId === noteId) {
    return;
  }

  state.questionUnsubscribe?.();
  state.questionUnsubscribe = null;
  state.questionsNoteId = noteId || null;
  state.questions = [];
  state.questionIndex = 0;
  state.selectedAnswer = null;
  state.quizAnswered = false;
  state.answerVisible = false;

  const questionsRef = questionCollection(noteId);
  if (!questionsRef) {
    renderQuestions();
    return;
  }

  state.questionUnsubscribe = onSnapshot(
    query(questionsRef, orderBy("updatedAt", "desc")),
    (snapshot) => {
      state.questions = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));
      state.questionIndex = Math.min(
        state.questionIndex,
        Math.max(state.questions.length - 1, 0),
      );
      renderQuestions();
    },
    (error) => {
      console.error(error);
      $("problemApp").innerHTML =
        '<p class="note-hint">問題を読み込めませんでした。</p>';
    },
  );
}

function filteredQuestions() {
  return state.questions.filter(
    (item) => state.questionFilter === "all" || item.type === state.questionFilter,
  );
}

function safeAnswerColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ""))
    ? value
    : "#1976d2";
}

function blankSentence(sentence, blankWord, answerColor, reveal) {
  const escapedWord = escapeHtml(blankWord);
  const parts = escapeHtml(sentence).split(escapedWord);
  if (parts.length < 2) {
    return escapeHtml(sentence);
  }
  const replacement = reveal
    ? `<strong class="blank-answer" style="color:${safeAnswerColor(answerColor)}">${escapedWord}</strong>`
    : '<span class="blank-slot">（　　　）</span>';
  return parts.join(replacement);
}

function renderQuestions() {
  const root = $("problemApp");
  if (!root) {
    return;
  }

  const note = current();
  if (!note) {
    root.innerHTML = '<p class="note-hint">ノートを選択してから問題を使ってください。</p>';
    return;
  }

  root.innerHTML = `
    <div class="problem-heading">
      <div>
        <p class="problem-eyebrow">ノート専用問題集</p>
        <h2>${escapeHtml(note.title || "無題のノート")}</h2>
      </div>
      <div class="problem-view-switch" role="tablist" aria-label="問題の画面切替">
        <button class="${state.problemView === "solve" ? "active" : ""}" data-problem-action="view-solve">問題を解く</button>
        <button class="${state.problemView === "create" ? "active" : ""}" data-problem-action="view-create">問題を作る</button>
      </div>
    </div>
    ${state.problemView === "create" ? renderQuestionEditor() : renderQuestionSolver()}
  `;
}

function renderQuestionSolver() {
  const questions = filteredQuestions();
  const question = questions[state.questionIndex];
  const controls = `
    <div class="problem-filter" aria-label="問題形式の絞り込み">
      ${[
        ["all", "すべて"],
        ["quiz", "四択のみ"],
        ["fill_blank", "穴埋めのみ"],
      ]
        .map(
          ([value, label]) => `<button class="${state.questionFilter === value ? "active" : ""}" data-problem-filter="${value}">${label}</button>`,
        )
        .join("")}
    </div>`;

  if (!question) {
    return `${controls}<div class="problem-empty"><p>まだ問題がありません。</p><button class="btn btn-secondary" data-problem-action="view-create">問題を作成する</button></div>`;
  }

  const position = `<p class="problem-position">問題 ${state.questionIndex + 1} / ${questions.length}</p>`;
  const navigation = `<div class="problem-navigation"><button class="btn btn-secondary" data-problem-action="previous-question" ${state.questionIndex === 0 ? "disabled" : ""}>← 前の問題</button><button class="btn btn-secondary" data-problem-action="next-question" ${state.questionIndex >= questions.length - 1 ? "disabled" : ""}>次の問題 →</button></div>`;

  if (question.type === "fill_blank") {
    return `${controls}${position}
      <article class="problem-card">
        <p class="problem-type">穴埋め問題</p>
        <p class="fill-sentence">${blankSentence(question.sentence, question.blankWord, question.answerColor, state.answerVisible)}</p>
        <button class="btn btn-primary" data-problem-action="toggle-fill-answer">${state.answerVisible ? "回答を隠す" : "回答を見る"}</button>
      </article>${navigation}`;
  }

  const choiceList = (question.choices || [])
    .map(
      (choice, index) => {
        const selected = state.selectedAnswer === index + 1;
        const correct = state.quizAnswered && question.answer === index + 1;
        const incorrect = state.quizAnswered && selected && !correct;
        return `<button class="quiz-choice ${selected ? "selected" : ""} ${correct ? "correct" : ""} ${incorrect ? "incorrect" : ""}" data-problem-choice="${index + 1}" ${state.quizAnswered ? "disabled" : ""}><span>${index + 1}</span>${escapeHtml(choice)}</button>`;
      })
    .join("");
  const answerResult = state.quizAnswered
    ? `<div class="quiz-result ${state.selectedAnswer === question.answer ? "is-correct" : "is-incorrect"}"><b>${state.selectedAnswer === question.answer ? "正解です" : "不正解です"}</b><p>正解：${escapeHtml((question.choices || [])[question.answer - 1] || "")}</p>${question.explanation ? `<p>解説：${escapeHtml(question.explanation)}</p>` : ""}</div>`
    : "";
  return `${controls}${position}
    <article class="problem-card"><p class="problem-type">四択問題</p><h3>${escapeHtml(question.question)}</h3><div class="quiz-choices">${choiceList}</div>${answerResult}<button class="btn btn-primary" data-problem-action="answer-quiz" ${state.selectedAnswer ? "" : "disabled"}>回答する</button></article>${navigation}`;
}

function renderQuestionEditor() {
  const editing = state.questions.find((item) => item.id === state.editingQuestionId);
  const type = editing?.type || state.problemType;
  const quiz = type === "quiz";
  const questionList = state.questions.length
    ? state.questions
        .map(
          (item) => `<li><div><b>${item.type === "quiz" ? "四択" : "穴埋め"}</b><span>${escapeHtml(item.question || item.sentence || "無題の問題")}</span></div><div><button data-problem-action="edit-question" data-question-id="${item.id}">編集</button><button class="danger-link" data-problem-action="delete-question" data-question-id="${item.id}">削除</button></div></li>`,
        )
        .join("")
    : '<li class="note-hint">このノートにはまだ問題がありません。</li>';
  return `
    <div class="problem-type-switch"><button class="${quiz ? "active" : ""}" data-problem-action="set-quiz">四択問題</button><button class="${!quiz ? "active" : ""}" data-problem-action="set-fill">穴埋め問題</button></div>
    <form id="questionForm" class="question-editor">
      ${quiz ? `
        <label>問題文<textarea name="question" required placeholder="問題文を入力">${escapeHtml(editing?.question || "")}</textarea></label>
        ${[0, 1, 2, 3].map((index) => `<label>選択肢${index + 1}<input name="choice${index + 1}" required value="${escapeHtml(editing?.choices?.[index] || "")}" /></label>`).join("")}
        <label>正解<select name="answer" required>${[1, 2, 3, 4].map((value) => `<option value="${value}" ${Number(editing?.answer || 1) === value ? "selected" : ""}>選択肢${value}</option>`).join("")}</select></label>
        <label>解説<textarea name="explanation" placeholder="解説を入力（任意）">${escapeHtml(editing?.explanation || "")}</textarea></label>
      ` : `
        <label>文章<textarea name="sentence" required placeholder="例：心臓は全身に血液を送り出すポンプとして働く。">${escapeHtml(editing?.sentence || "")}</textarea></label>
        <label>穴埋めにする語句<input name="blankWord" required value="${escapeHtml(editing?.blankWord || "")}" placeholder="例：心臓" /></label>
        <label class="answer-color-label">回答の色<input name="answerColor" type="color" value="${safeAnswerColor(editing?.answerColor)}" /><span>回答を見るときの色</span></label>
      `}
      <div class="question-editor-actions"><button class="btn btn-primary" type="submit">${editing ? "問題を更新する" : "問題を保存する"}</button>${editing ? '<button class="btn btn-secondary" type="button" data-problem-action="cancel-edit">編集をやめる</button>' : ""}</div>
    </form>
    <section class="question-manage"><h3>このノートの問題</h3><ul>${questionList}</ul></section>`;
}

async function saveQuestion(form) {
  const note = current();
  const questionsRef = questionCollection();
  if (!note || !questionsRef) {
    return;
  }
  const formData = new FormData(form);
  const type = state.editingQuestionId
    ? state.questions.find((item) => item.id === state.editingQuestionId)?.type
    : state.problemType;
  let payload;
  if (type === "quiz") {
    const choices = [1, 2, 3, 4].map((index) => String(formData.get(`choice${index}`) || "").trim());
    const question = String(formData.get("question") || "").trim();
    if (!question || choices.some((choice) => !choice)) {
      alert("問題文と4つの選択肢を入力してください。");
      return;
    }
    payload = { type: "quiz", question, choices, answer: Number(formData.get("answer")), explanation: String(formData.get("explanation") || "").trim() };
  } else {
    const sentence = String(formData.get("sentence") || "").trim();
    const blankWord = String(formData.get("blankWord") || "").trim();
    if (!sentence || !blankWord || !sentence.includes(blankWord)) {
      alert("文章と、文章内に含まれる穴埋め語句を入力してください。");
      return;
    }
    payload = { type: "fill_blank", sentence, blankWord, answerColor: safeAnswerColor(formData.get("answerColor")) };
  }
  if (state.editingQuestionId) {
    await updateDoc(doc(questionsRef, state.editingQuestionId), { ...payload, updatedAt: serverTimestamp() });
  } else {
    await addDoc(questionsRef, { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  state.editingQuestionId = null;
  state.problemView = "solve";
}

function handleProblemChange(event) {
  if (event.target.id === "questionForm") {
    return;
  }
  if (event.target.closest("#questionForm")) {
    return;
  }
}

async function handleProblemAction(event) {
  const form = event.target.closest("#questionForm");
  if (form && event.target.type === "submit") {
    event.preventDefault();
    try {
      await saveQuestion(form);
    } catch (error) {
      console.error(error);
      alert("問題を保存できませんでした。");
    }
    return;
  }
  const button = event.target.closest("[data-problem-action], [data-problem-filter], [data-problem-choice]");
  if (!button) return;
  if (button.dataset.problemFilter) {
    state.questionFilter = button.dataset.problemFilter;
    state.questionIndex = 0;
    state.selectedAnswer = null;
    state.quizAnswered = false;
    state.answerVisible = false;
    renderQuestions();
    return;
  }
  if (button.dataset.problemChoice) {
    state.selectedAnswer = Number(button.dataset.problemChoice);
    renderQuestions();
    return;
  }
  const action = button.dataset.problemAction;
  if (!action) return;
  if (action === "view-solve" || action === "view-create") {
    state.problemView = action === "view-solve" ? "solve" : "create";
    state.editingQuestionId = null;
  } else if (action === "set-quiz" || action === "set-fill") {
    state.problemType = action === "set-quiz" ? "quiz" : "fill_blank";
    state.editingQuestionId = null;
  } else if (action === "previous-question" || action === "next-question") {
    const questions = filteredQuestions();
    state.questionIndex += action === "previous-question" ? -1 : 1;
    state.questionIndex = Math.max(0, Math.min(state.questionIndex, questions.length - 1));
    state.selectedAnswer = null;
    state.quizAnswered = false;
    state.answerVisible = false;
  } else if (action === "answer-quiz") {
    state.quizAnswered = true;
  } else if (action === "toggle-fill-answer") {
    state.answerVisible = !state.answerVisible;
  } else if (action === "edit-question") {
    state.editingQuestionId = button.dataset.questionId;
    state.problemView = "create";
  } else if (action === "cancel-edit") {
    state.editingQuestionId = null;
  } else if (action === "delete-question") {
    const item = state.questions.find((question) => question.id === button.dataset.questionId);
    if (item && confirm("この問題を削除しますか？")) {
      try {
        await deleteDoc(doc(questionCollection(), item.id));
      } catch (error) {
        console.error(error);
        alert("問題を削除できませんでした。");
      }
    }
  }
  renderQuestions();
}

function setupDrawer() {
  const drawer = $("noteDrawer");

  const backdrop = $("drawerBackdrop");

  const open = () => {
    drawer.classList.add("is-open");

    backdrop.classList.add("is-open");
  };

  const close = () => {
    drawer.classList.remove("is-open");

    backdrop.classList.remove("is-open");
  };

  $("noteMenuButton").onclick = open;

  $("closeDrawer").onclick = close;

  backdrop.onclick = close;

  const noteAside = document.querySelector(".note-shell>aside");

  if (noteAside) {
    $("drawerNotesMount").append(noteAside);
  }

  document.querySelectorAll("[data-drawer-panel]").forEach(
    (button) =>
      (button.onclick = () => {
        selectPanel(button.dataset.drawerPanel);

        close();
      }),
  );

  document.querySelectorAll("[data-drawer-target]").forEach(
    (button) =>
      (button.onclick = () => {
        const target =
          button.dataset.drawerTarget === "todos"
            ? $("todoList").closest("section")
            : $("todoList").closest("section").nextElementSibling;

        target?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });

        close();
      }),
  );
}

function setupBoard() {
  const board = $("writingBoard");

  [
    "pointerdown",
    "pointermove",
    "pointerup",
    "pointercancel",
    "pointerleave",
  ].forEach((type) => board.addEventListener(type, drawPointer));

  window.addEventListener("resize", resizeBoard);

  resizeBoard();
}

function setupUnifiedNote() {
  const button = $("handwritingMode");

  const overlay = $("inkOverlay");

  if (!button || !overlay) {
    return;
  }

  button.onclick = () => {
    state.inkMode = !state.inkMode;

    overlay.classList.toggle("is-drawing", state.inkMode);

    button.classList.toggle("active", state.inkMode);

    button.textContent = state.inkMode
      ? "手書き中（押すと文字入力）"
      : "手書きモード";

    button.title = state.inkMode
      ? "今はノート上に手書きできます。もう一度押すと文字入力へ戻ります。"
      : "押すとノート上に手書きできます。";
  };

  document
    .querySelectorAll("[data-drawer-panel],[data-drawer-target]")
    .forEach((item) => item.remove());
}

async function convertHandwriting() {
  const button = $("convertHandwriting");

  const board = $("writingBoard");

  if (!window.Tesseract) {
    return alert(
      "活字化の準備がまだできていません。接続を確認してもう一度お試しください。",
    );
  }

  button.disabled = true;

  button.textContent = "活字化しています…";

  try {
    const result = await window.Tesseract.recognize(
      board.toDataURL("image/png"),
      "jpn",
    );

    const text = result.data.text.trim();

    if (!text) {
      return alert(
        "文字を読み取れませんでした。濃く大きく書いてお試しください。",
      );
    }

    $("noteBody").value += `${$("noteBody").value ? "\n" : ""}${text}`;

    renderPreview();

    selectPanel("typedPanel");

    alert("読み取った文字を本文へ追加しました。");
  } catch (error) {
    console.error(error);

    alert("活字化に失敗しました。手書きはそのまま残っています。");
  } finally {
    button.disabled = false;

    button.textContent = "🔤 手書きを活字化して本文へ入れる";
  }
}

function resizeBoard() {
  const board = $("writingBoard");

  const rect = board?.getBoundingClientRect();

  if (!board || !rect?.width || !rect?.height) {
    return;
  }

  const previous = board.toDataURL();

  const ratio = window.devicePixelRatio || 1;

  const width = Math.round(rect.width * ratio);

  const height = Math.round(rect.height * ratio);

  if (board.width === width && board.height === height) {
    return;
  }

  board.width = width;

  board.height = height;

  const ctx = board.getContext("2d");

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  if (previous && previous !== "data:,") {
    const image = new Image();

    image.onload = () => ctx.drawImage(image, 0, 0, rect.width, rect.height);

    image.src = previous;
  }
}

function setDrawTool(tool) {
  state.drawTool = tool;

  document.querySelectorAll("[data-draw-tool]").forEach((item) => {
    item.classList.toggle("active", item.dataset.drawTool === tool);
  });

  updateToolSizeLabel();
}

function configureDrawingTool(ctx, tool, base) {
  ctx.lineCap = "round";

  ctx.lineJoin = "round";

  /*
    ibisPaintの消しゴムと同じ考え方。

    白で塗るのではなく、
    なぞった部分だけ透明にする。
    */
  if (tool === "eraser") {
    ctx.lineWidth = Math.max(4, base * 2);

    ctx.globalCompositeOperation = "destination-out";

    ctx.globalAlpha = 1;

    return;
  }

  ctx.globalCompositeOperation = "source-over";

  if (tool === "highlighter") {
    ctx.lineWidth = base * 3;

    ctx.globalAlpha = 0.28;
  } else if (tool === "marker") {
    ctx.lineWidth = base * 1.7;

    ctx.globalAlpha = 0.58;
  } else {
    ctx.lineWidth = base;

    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = $("penColor").value;
}

function setPaper(paper) {
  state.paper = paper;

  document
    .querySelectorAll("[data-paper]")
    .forEach((item) =>
      item.classList.toggle("active", item.dataset.paper === paper),
    );

  const board = $("writingBoard");

  board.classList.toggle("is-lined", paper === "lined");

  board.classList.toggle("is-grid", paper === "grid");

  const note = current();

  if (note) {
    localStorage.setItem(`careMatePaper:${studentNumber}:${note.id}`, paper);
  }
}

function drawPointer(event) {
  const board = $("writingBoard");

  if (!board) {
    return;
  }

  const rect = board.getBoundingClientRect();

  const point = {
    x: event.clientX - rect.left,

    y: event.clientY - rect.top,
  };

  if (event.type === "pointerdown") {
    state.drawing = true;

    state.lastPoint = point;

    try {
      board.setPointerCapture(event.pointerId);
    } catch {}

    return;
  }

  if (!state.drawing) {
    return;
  }

  if (event.type === "pointermove") {
    const ctx = board.getContext("2d");

    const base = Number($("penSize").value);

    configureDrawingTool(ctx, state.drawTool, base);

    ctx.beginPath();

    ctx.moveTo(state.lastPoint.x, state.lastPoint.y);

    ctx.lineTo(point.x, point.y);

    ctx.stroke();

    ctx.globalAlpha = 1;

    state.lastPoint = point;

    return;
  }

  state.drawing = false;

  state.lastPoint = null;

  saveBoard();
}

function boardKey() {
  return state.selected
    ? `careMateHandwriting:${studentNumber}:${state.selected}`
    : "";
}

function saveBoard() {
  const key = boardKey();

  if (!key) {
    return;
  }

  try {
    localStorage.setItem(key, $("writingBoard").toDataURL("image/png"));

    const status = $("boardStatus");

    if (status) {
      status.textContent = "この端末に手書きを保存しました。";
    }
  } catch (error) {
    console.warn(error);

    const status = $("boardStatus");

    if (status) {
      status.textContent = "手書きの保存容量が不足しています。";
    }
  }
}

function restoreBoard() {
  const board = $("writingBoard");

  const key = boardKey();

  if (!board || !key) {
    return;
  }

  const paperKey = `careMatePaper:${studentNumber}:${state.selected}`;
  const legacyPaperKey = `careMatePaper:${state.selected}`;
  const savedPaper =
    localStorage.getItem(paperKey) ||
    (studentNumber === "2510044" ? localStorage.getItem(legacyPaperKey) : null) ||
    "blank";
  if (studentNumber === "2510044" && !localStorage.getItem(paperKey)) {
    localStorage.setItem(paperKey, savedPaper);
  }
  setPaper(savedPaper);

  const ctx = board.getContext("2d");

  ctx.clearRect(0, 0, board.clientWidth, board.clientHeight);

  const data =
    localStorage.getItem(key) ||
    (studentNumber === "2510044"
      ? localStorage.getItem(`careMateHandwriting:${state.selected}`)
      : null);

  if (data && studentNumber === "2510044" && !localStorage.getItem(key)) {
    localStorage.setItem(key, data);
  }

  if (!data) {
    return;
  }

  const image = new Image();

  image.onload = () =>
    ctx.drawImage(image, 0, 0, board.clientWidth, board.clientHeight);

  image.src = data;
}

function clearBoard() {
  const key = boardKey();

  if (!key || !confirm("このノートの手書きをすべて消しますか？")) {
    return;
  }

  const board = $("writingBoard");

  board.getContext("2d").clearRect(0, 0, board.clientWidth, board.clientHeight);

  localStorage.removeItem(key);

  const status = $("boardStatus");

  if (status) {
    status.textContent = "手書きを消しました。";
  }
}

function renderPreview() {
  let text = $("noteBody").value || "";

  const terms = $("maskTerms")
    .value.split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const escaped = escapeHtml(text);

  if (!terms.length) {
    $("notePreview").textContent = text;

    return;
  }

  const pattern = new RegExp(
    `(${terms
      .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})`,
    "g",
  );

  $("notePreview").innerHTML = escaped.replace(
    pattern,
    '<button class="mask-word" type="button">$1</button>',
  );
}

async function saveCurrent() {
  const note = current();

  if (!note) {
    return;
  }

  syncPlainBody();

  const title = $("noteTitle").value.trim() || "無題のノート";

  const body = $("noteBody").value;

  const bodyHtml = $("noteDocument").innerHTML;

  const maskTerms = $("maskTerms")
    .value.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  /*
    interimは保存しない。
    確定文章だけ保存する。
    */
  const transcript = String(state.finalTranscript || "")
    .replace(/\s+/g, " ")
    .trim();

  await updateDoc(doc(notesRef, note.id), {
    title,

    body,

    bodyHtml,

    inkData: $("inkOverlay").toDataURL("image/png"),

    transcript,

    maskTerms,

    todos: note.todos || [],

    images: note.images || [],

    placedImages: getPlacedImages(note),

    updatedAt: serverTimestamp(),
  });

  alert("ノートを保存しました。");
}

/* ========================================
   連続リアルタイム文字起こし
======================================== */

function toggleVoice() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert(
      "このブラウザではリアルタイム文字起こしに対応していません。Chromeなどの対応ブラウザでお試しください。",
    );

    return;
  }

  /*
    すでに文字起こし中なら
    今回はユーザーによる停止。
    */
  if (state.keepListening) {
    state.keepListening = false;

    state.isListening = false;

    state.interim = "";

    try {
      state.recognition?.stop();
    } catch (error) {
      console.warn("音声認識停止エラー:", error);
    }

    $("voiceButton").textContent = "🎙 文字起こしを開始";

    $("voiceState").textContent =
      "文字起こしを停止しました。保存すると文字起こしタブへ残ります。";

    renderLiveTranscript();

    return;
  }

  /*
    保存済み文字起こしがあれば
    そこから続きを開始する。
    */
  const existingText = $("liveTranscript")
    .textContent.replace("まだ文字起こしは始まっていません。", "")
    .trim();

  state.finalTranscript = existingText;

  state.interim = "";

  state.keepListening = true;

  startSpeechRecognition();

  function startSpeechRecognition() {
    /*
        停止ボタンが押されていたら
        再起動しない。
        */
    if (!state.keepListening) {
      return;
    }

    const recognition = new SpeechRecognition();

    state.recognition = recognition;

    recognition.lang = "ja-JP";

    /*
        聞き取り途中もリアルタイム表示。
        */
    recognition.interimResults = true;

    /*
        対応ブラウザでは
        できるだけ長く認識を続ける。
        */
    recognition.continuous = true;

    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      state.isListening = true;

      $("voiceButton").textContent = "■ 文字起こしを停止";

      $("liveTranscript").hidden = false;

      $("voiceState").textContent =
        "文字起こし中です。話すのを止めても、そのまま聞き取りを続けます。";
    };

    recognition.onresult = (event) => {
      let newFinal = "";

      let newInterim = "";

      /*
                今回更新された認識結果だけ処理。
                過去の認識結果を再追加しない。
                */
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        const text = result[0]?.transcript?.trim() || "";

        if (!text) {
          continue;
        }

        /*
                    確定した文章。
                    */
        if (result.isFinal) {
          newFinal += (newFinal ? " " : "") + text;

          /*
                    まだ聞き取り途中の文章。
                    */
        } else {
          newInterim += (newInterim ? " " : "") + text;
        }
      }

      /*
                確定した文章だけ
                本文へ追加する。

                interimはここには絶対に入れない。
                */
      if (newFinal) {
        state.finalTranscript = appendTranscriptText(
          state.finalTranscript,
          newFinal,
        );
      }

      state.interim = newInterim;

      renderLiveTranscript();
    };

    recognition.onerror = (event) => {
      console.warn("音声認識エラー:", event.error);

      /*
                マイク権限など、
                自動再起動しても直らない場合。
                */
      if (
        ["not-allowed", "service-not-allowed", "audio-capture"].includes(
          event.error,
        )
      ) {
        state.keepListening = false;

        state.isListening = false;

        state.interim = "";

        $("voiceButton").textContent = "🎙 文字起こしを開始";

        $("voiceState").textContent =
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

    recognition.onend = () => {
      state.isListening = false;

      /*
                終了した認識セッションの
                仮文字列だけ消す。

                確定文字列は残す。
                */
      state.interim = "";

      renderLiveTranscript();

      /*
                ユーザーが停止していない場合は
                自動的に新しい認識セッションを開始。

                これで話していない時間があっても
                「文字起こし中」の状態を継続する。
                */
      if (state.keepListening) {
        $("voiceState").textContent = "文字起こしを継続しています…";

        setTimeout(() => {
          if (state.keepListening) {
            startSpeechRecognition();
          }
        }, 250);

        return;
      }

      $("voiceButton").textContent = "🎙 文字起こしを開始";

      $("voiceState").textContent =
        "文字起こしを停止しました。保存すると文字起こしタブへ残ります。";
    };

    try {
      recognition.start();
    } catch (error) {
      console.warn("音声認識開始エラー:", error);

      /*
            セッション切替直後などに
            start()が失敗した場合は
            少し待って再試行。
            */
      if (state.keepListening) {
        setTimeout(startSpeechRecognition, 500);
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
function appendTranscriptText(current, addition) {
  const before = String(current || "")
    .replace(/\s+/g, " ")
    .trim();

  const next = String(addition || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!next) {
    return before;
  }

  if (!before) {
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
function renderLiveTranscript() {
  const element = $("liveTranscript");

  if (!element) {
    return;
  }

  const finalText = String(state.finalTranscript || "")
    .replace(/\s+/g, " ")
    .trim();

  const interimText = String(state.interim || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!finalText && !interimText) {
    element.textContent = "まだ文字起こしは始まっていません。";

    return;
  }

  element.textContent =
    finalText + (interimText ? `${finalText ? " " : ""}${interimText}` : "");
}

async function copyTranscript() {
  const element = $("liveTranscript");

  const button = $("copyTranscript");

  if (!element || !button) {
    return;
  }

  const text = String(state.finalTranscript || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    alert("コピーする文字起こしがありません。");

    return;
  }

  /*
    画面上でも全文選択する。
    */
  const selection = window.getSelection();

  const range = document.createRange();

  range.selectNodeContents(element);

  selection.removeAllRanges();

  selection.addRange(range);

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      document.execCommand("copy");
    }

    const before = button.textContent;

    button.textContent = "✓ 全文コピーしました";

    setTimeout(() => {
      button.textContent = before;
    }, 1500);
  } catch (error) {
    console.error(error);

    /*
        選択状態は残すので
        手動コピーも可能。
        */
    alert("全文を選択しました。コピー操作をしてください。");
  }
}

async function openChatGPT(kind) {
  const note = current();

  if (!note) {
    return alert("先にノートを作成してください。");
  }

  const body = $("noteBody").value.trim();

  if (!body) {
    return alert("メモを入力してから使ってください。");
  }

  const prompt =
    kind === "要約"
      ? `以下の講義メモを、重要語句・要点・次に確認することに分けて日本語で要約してください。\n\n${body}`
      : `以下の講義メモから、4択問題と穴埋め問題を作成してください。各問題に答えと簡潔な解説を付け、JSONでも出力してください。\n\n${body}`;

  try {
    await navigator.clipboard.writeText(prompt);
  } catch (error) {
    console.warn(error);
  }

  window.open("https://chatgpt.com/", "_blank", "noopener");

  alert(
    `${kind}用の指示とメモをコピーしました。開いたChatGPTに貼り付けてください。`,
  );
}

function dateLabel(value) {
  return typeof value?.toDate === "function"
    ? value.toDate().toLocaleString("ja-JP")
    : "更新日時未設定";
}

function plainTextToHtml(text) {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

function setupInkOverlay() {
  const canvas = $("inkOverlay");

  const wrap = $("noteDocumentWrap");

  if (!canvas || !wrap) {
    return;
  }

  const resize = () => {
    const rect = wrap.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return;
    }

    const previous = canvas.toDataURL();

    const ratio = window.devicePixelRatio || 1;

    canvas.width = Math.round(rect.width * ratio);

    canvas.height = Math.round(rect.height * ratio);

    const ctx = canvas.getContext("2d");

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    if (previous !== "data:,") {
      const image = new Image();

      image.onload = () => {
        ctx.drawImage(image, 0, 0, rect.width, rect.height);
      };

      image.src = previous;
    }
  };

  resize();

  window.addEventListener("resize", resize);

  let drawing = false;

  let last = null;

  const getPoint = (event) => {
    const rect = canvas.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,

      y: event.clientY - rect.top,
    };
  };

  canvas.addEventListener("pointerdown", (event) => {
    drawing = true;

    last = getPoint(event);

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {}

    /*
            タップしただけでも
            ペン・消しゴムが反映されるように点を描く。
            */
    const ctx = canvas.getContext("2d");

    const base = Number($("penSize").value);

    configureDrawingTool(ctx, state.drawTool, base);

    ctx.beginPath();

    ctx.moveTo(last.x, last.y);

    ctx.lineTo(last.x + 0.01, last.y + 0.01);

    ctx.stroke();

    ctx.globalAlpha = 1;

    event.preventDefault();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!drawing || !last) {
      return;
    }

    const next = getPoint(event);

    const ctx = canvas.getContext("2d");

    const base = Number($("penSize").value);

    configureDrawingTool(ctx, state.drawTool, base);

    ctx.beginPath();

    ctx.moveTo(last.x, last.y);

    ctx.lineTo(next.x, next.y);

    ctx.stroke();

    ctx.globalAlpha = 1;

    last = next;

    event.preventDefault();
  });

  const finish = () => {
    drawing = false;

    last = null;
  };

  canvas.addEventListener("pointerup", finish);

  canvas.addEventListener("pointercancel", finish);

  /*
    重要：

    eraseBoardクリック時のclearRectは
    一切入れない。

    eraseBoardは
    data-draw-tool="eraser" によって
    消しゴムを選択するだけ。
    */
}

function setupToolControls() {
  const tools = document.querySelector(".rich-note-tools");

  const pen = $("penSize");

  if (!tools || !pen) {
    return;
  }

  pen.min = "1";

  pen.max = "80";

  /*
    すでにtool-controlへ移動済みなら
    二重生成しない。
    */
  let control = pen.closest(".tool-control");

  let label;

  let output;

  if (!control) {
    const oldOutput = $("penSizeValue");

    const parent = pen.parentNode;

    control = document.createElement("label");

    control.className = "tool-control";

    label = document.createElement("span");

    label.id = "toolSizeLabel";

    output = document.createElement("output");

    output.id = "penSizeValue";

    parent.insertBefore(control, pen);

    control.append(label, pen, output);

    oldOutput?.remove();
  } else {
    label = $("toolSizeLabel");

    if (!label) {
      label = document.createElement("span");

      label.id = "toolSizeLabel";

      control.prepend(label);
    }

    output = $("penSizeValue");

    if (!output) {
      output = document.createElement("output");

      output.id = "penSizeValue";

      control.append(output);
    }
  }

  const update = () => {
    const minimum = Number(pen.min);

    const maximum = Number(pen.max);

    const value = Number(pen.value);

    const progress = ((value - minimum) / (maximum - minimum)) * 100;

    /*
            バーの塗りと
            つまみの値を完全同期。
            */
    pen.style.setProperty("--range-progress", `${progress}%`);

    output.textContent = `${value}px`;

    updateToolSizeLabel();
  };

  /*
    以前のoninputを上書き。
    */
  pen.oninput = update;

  pen.onchange = update;

  update();

  const handwritingButton = $("handwritingMode");

  if (handwritingButton) {
    handwritingButton.textContent = "手書きモード";

    handwritingButton.title =
      "押すと手書き開始、もう一度押すと文字入力へ戻ります";
  }

  document.querySelectorAll("[data-color]").forEach((button) => {
    button.textContent = "";

    button.title = button.getAttribute("aria-label") || "色を選ぶ";
  });
}

function updateToolSizeLabel() {
  const label = $("toolSizeLabel");

  if (!label) {
    return;
  }

  if (state.drawTool === "eraser") {
    label.textContent = "消しゴムの太さ";
  } else if (state.drawTool === "highlighter") {
    label.textContent = "蛍光ペンの太さ";
  } else if (state.drawTool === "marker") {
    label.textContent = "マーカーの太さ";
  } else {
    label.textContent = "ペンの太さ";
  }
}

function clearInkOverlay() {
  const canvas = $("inkOverlay");

  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");

  const rect = canvas.getBoundingClientRect();

  ctx.clearRect(0, 0, rect.width, rect.height);
}

function restoreInkOverlay(data) {
  clearInkOverlay();

  if (!data) {
    return;
  }

  const canvas = $("inkOverlay");

  const rect = canvas.getBoundingClientRect();

  const ctx = canvas.getContext("2d");

  const image = new Image();

  image.onload = () => ctx.drawImage(image, 0, 0, rect.width, rect.height);

  image.src = data;
}

function syncPlainBody() {
  $("noteBody").value = $("noteDocument").innerText || "";
}

function setDocumentHtml(html) {
  $("noteDocument").innerHTML = html || "";

  syncPlainBody();
}

function insertNodeAtCursor(node) {
  const editor = $("noteDocument");

  const selection = window.getSelection();

  if (!selection.rangeCount || !editor.contains(selection.anchorNode)) {
    editor.append(node);

    return;
  }

  const range = selection.getRangeAt(0);

  range.deleteContents();

  range.insertNode(node);

  range.setStartAfter(node);

  range.collapse(true);

  selection.removeAllRanges();

  selection.addRange(range);
}

function insertTextAtCursor(text) {
  const editor = $("noteDocument");

  editor.focus();

  insertNodeAtCursor(document.createTextNode(text));
}

/*
削除。

画像は現在、
noteImageLayer内の
placed-note-imageとして管理する。
*/

function enableInlineDrawing(canvas) {
  const ctx = canvas.getContext("2d");

  const ratio = window.devicePixelRatio || 1;

  const resize = () => {
    const width = canvas.clientWidth || 720;

    const height = (width * 300) / 720;

    const data = canvas.toDataURL();

    canvas.width = Math.round(width * ratio);

    canvas.height = Math.round(height * ratio);

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    if (data !== "data:,") {
      const image = new Image();

      image.onload = () => ctx.drawImage(image, 0, 0, width, height);

      image.src = data;
    }
  };

  resize();

  let drawing = false;

  let last;

  const point = (event) => {
    const rect = canvas.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,

      y: event.clientY - rect.top,
    };
  };

  canvas.addEventListener("pointerdown", (event) => {
    drawing = true;

    last = point(event);

    canvas.setPointerCapture(event.pointerId);

    event.preventDefault();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!drawing) {
      return;
    }

    const next = point(event);

    const tool = state.drawTool;

    const base = Number($("penSize").value);

    ctx.lineCap = "round";

    ctx.lineJoin = "round";

    ctx.lineWidth =
      tool === "highlighter" ? base * 3 : tool === "marker" ? base * 1.7 : base;

    ctx.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : "source-over";

    ctx.globalAlpha =
      tool === "highlighter" ? 0.28 : tool === "marker" ? 0.58 : 1;

    ctx.strokeStyle = $("penColor").value;

    ctx.beginPath();

    ctx.moveTo(last.x, last.y);

    ctx.lineTo(next.x, next.y);

    ctx.stroke();

    ctx.globalAlpha = 1;

    last = next;

    event.preventDefault();
  });

  ["pointerup", "pointercancel"].forEach((type) =>
    canvas.addEventListener(type, () => (drawing = false)),
  );
}
