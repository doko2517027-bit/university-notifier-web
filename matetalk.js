import {
  auth,
  db,
  functions,
  studentNumber,
  setupTheme,
  initializePage,
  showToast,
} from "./common.js?v=20261016-2";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  limit,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

const ADMIN_ID = "2510044";
const $ = (id) => document.getElementById(id);
const shell = document.querySelector(".mate-shell");
const initializeMateTalk = httpsCallable(functions, "initializeMateTalk");
const saveMateTalkSettings = httpsCallable(functions, "saveMateTalkSettings");
const connectMateTalkFriend = httpsCallable(functions, "connectMateTalkFriend");
const sendMateTalkMessage = httpsCallable(functions, "sendMateTalkMessage");
const getMateTalkSchedule = httpsCallable(functions, "getMateTalkSchedule");
const setMateTalkScheduleVisibility = httpsCallable(functions, "setMateTalkScheduleVisibility");
const createMateTalkGroup = httpsCallable(functions, "createMateTalkGroup");
const rotateMateTalkExchangeId = httpsCallable(functions, "rotateMateTalkExchangeId");
const markMateTalkRead = httpsCallable(functions, "markMateTalkRead");

let myProfile = {};
let isSystemAdmin = false;
let mode = "student";
let rooms = [];
let guaranteedAdminRoom = null;
let profiles = new Map();
let publicUsers = new Map();
let adminDirectory = new Map();
let aliases = new Map();
let activeRoom = null;
let stopMessages = null;
let scheduleData = { mine: [], theirs: [] };
let scheduleFilter = "both";
let scanStream = null;
let scanFrame = 0;
let lastMarkedMessageAt = 0;

setupTheme();

if (!studentNumber) location.href = "login.html";

await initializePage([startMateTalk()]);

async function startMateTalk() {
  await auth.authStateReady();
  const result = await initializeMateTalk({});
  myProfile = result.data?.profile || {};
  isSystemAdmin = result.data?.isSystemAdmin === true;
  // 初期化が完了した時点でサーバー側の管理者ルームは作成済み。
  // 一覧クエリの反映を待たずに学生の入口を表示する。
  const adminRoomId = studentNumber === ADMIN_ID ? "" : `admin_${studentNumber}`;
  guaranteedAdminRoom = adminRoomId ? {
    id: adminRoomId,
    roomType: "admin",
    participants: [ADMIN_ID, studentNumber],
  } : null;
  adminDirectory = new Map((result.data?.adminDirectory || []).map((entry) => [entry.studentNumber, entry.name]));
  $("mateModeSwitch").hidden = !isSystemAdmin;
  if (!myProfile.nickname) openSettings(true);
  const [profileSnapshot, publicSnapshot, aliasSnapshot] = await Promise.all([
    getDocs(collection(db, "mateTalkProfiles")),
    getDocs(collection(db, "publicUsers")),
    getDocs(collection(db, "users", studentNumber, "mateTalkAliases")),
  ]);
  profiles = new Map(profileSnapshot.docs.map((item) => [item.id, item.data()]));
  publicUsers = new Map(publicSnapshot.docs.map((item) => [item.id, item.data()]));
  aliases = new Map(aliasSnapshot.docs.map((item) => [item.id, String(item.data()?.alias || "")]));
  $("mateMyName").textContent = myProfile.nickname || "自分のプロフィール";
  $("mateMyPhoto").src = publicUsers.get(studentNumber)?.photo || myProfile.photoUrl || "images/default.png";
  fillSettings();
  subscribeRooms();
  const connectId = new URLSearchParams(location.search).get("connect");
  if (connectId) {
    $("mateFriendIdInput").value = connectId;
    openOverlay("mateExchangeOverlay");
  }
}

function subscribeRooms() {
  const roomQuery = query(
    collection(db, "mateTalkRooms"),
    where("participants", "array-contains", studentNumber),
  );
  onSnapshot(roomQuery, (snapshot) => {
    rooms = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    if (guaranteedAdminRoom && !rooms.some((room) => room.id === guaranteedAdminRoom.id)) {
      rooms.unshift(guaranteedAdminRoom);
    }
    rooms.sort((left, right) => timestampMillis(right.lastMessageAt) - timestampMillis(left.lastMessageAt));
    renderRooms();
    const requestedRoom = new URLSearchParams(location.search).get("room");
    if (!activeRoom && requestedRoom) {
      const room = rooms.find((item) => item.id === requestedRoom && roomVisibleInMode(item));
      if (room) openRoom(room);
    }
  }, (error) => {
    console.error("メイトーク一覧取得エラー", error);
    if (guaranteedAdminRoom) {
      rooms = [guaranteedAdminRoom];
      renderRooms();
    } else {
      $("mateRoomList").innerHTML = '<div class="mate-loading-card">トークを読み込めませんでした。再読み込みしてください。</div>';
    }
  });
}

function roomVisibleInMode(room) {
  if (!isSystemAdmin) return true;
  return mode === "admin" ? room.roomType === "admin" : room.roomType !== "admin";
}

function otherId(room) {
  return (room.participants || []).find((value) => value !== studentNumber) || "";
}

function displayName(room) {
  if (room.roomType === "group") return room.title || "グループ";
  const friendId = otherId(room);
  if (room.roomType === "admin") {
    if (mode === "admin" && isSystemAdmin) {
      return `${friendId} ${String(adminDirectory.get(friendId) || publicUsers.get(friendId)?.name || "氏名未登録")}`;
    }
    return "システム管理者";
  }
  return aliases.get(friendId) || profiles.get(friendId)?.nickname || "メイトークユーザー";
}

function photoFor(room) {
  if (room.roomType === "group") return "images/default.png";
  if (room.roomType === "admin" && !(mode === "admin" && isSystemAdmin)) {
    return "images/default.png";
  }
  const friendId = otherId(room);
  return publicUsers.get(friendId)?.photo || profiles.get(friendId)?.photoUrl || "images/default.png";
}

function renderRooms() {
  const search = $("mateRoomSearch").value.trim().toLowerCase();
  const visible = rooms.filter(roomVisibleInMode).filter((room) => {
    const name = displayName(room).toLowerCase();
    return !search || name.includes(search) || otherId(room).includes(search);
  });
  $("mateRoomHeading").textContent = mode === "admin" ? "学生トーク" : "トーク";
  $("mateRoomCount").textContent = `${visible.length}件`;
  $("mateAddFriendButton").hidden = mode === "admin";
  $("mateCreateGroupButton").hidden = mode === "admin";
  $("mateMyProfileButton").hidden = mode === "admin";
  if (!visible.length) {
    $("mateRoomList").innerHTML = `<div class="mate-loading-card">${mode === "admin" ? "登録学生を準備中です。" : "システム管理者とのトーク、または交換した友達が表示されます。"}</div>`;
    return;
  }
  $("mateRoomList").innerHTML = visible.map((room) => `
    <button type="button" class="mate-room-card${activeRoom?.id === room.id ? " active" : ""}" data-room-id="${escapeHtml(room.id)}">
      <img src="${escapeHtml(photoFor(room))}" alt="">
      <span><b>${escapeHtml(displayName(room))}${room.roomType === "admin" ? '<i class="mate-admin-mark">管理者</i>' : ""}</b><small>${escapeHtml(room.lastMessage || "トークを始めましょう")}</small></span>
      <span class="mate-room-meta"><time>${escapeHtml(shortTime(room.lastMessageAt))}</time>${unreadFor(room) ? `<em class="mate-unread">${unreadFor(room)}</em>` : ""}</span>
    </button>`).join("");
  $("mateRoomList").querySelectorAll("[data-room-id]").forEach((button) => {
    button.onclick = () => {
      const room = rooms.find((item) => item.id === button.dataset.roomId);
      if (room) openRoom(room);
    };
  });
}

function unreadFor(room) {
  const count = Number(room.unreadCount?.[studentNumber] || 0);
  if (count) return Math.min(99, count);
  return room.lastSenderId && room.lastSenderId !== studentNumber &&
    timestampMillis(room.lastMessageAt) > timestampMillis(room.readAt?.[studentNumber]) ? 1 : 0;
}

function openRoom(room) {
  activeRoom = room;
  lastMarkedMessageAt = 0;
  renderRooms();
  $("mateEmptyState").hidden = true;
  $("mateConversation").hidden = false;
  shell.classList.add("chat-open");
  $("mateChatName").textContent = displayName(room);
  $("mateChatPhoto").src = photoFor(room);
  $("mateChatStatus").textContent = room.roomType === "group" ? `${room.participants?.length || 0}人のグループ` : room.roomType === "admin"
    ? (mode === "admin" ? "システム管理者として対応" : "CareMate システム管理者")
    : "アカウント交換済み";
  $("mateRenameButton").hidden = room.roomType !== "student";
  $("mateScheduleButton").hidden = room.roomType === "group";
  history.replaceState(null, "", `matetalk.html?room=${encodeURIComponent(room.id)}`);
  subscribeMessages(room.id);
  if (unreadFor(room)) markMateTalkRead({ roomId: room.id }).catch(console.error);
}

function subscribeMessages(roomId) {
  stopMessages?.();
  $("mateMessageList").innerHTML = '<div class="mate-loading-card">メッセージを読み込み中…</div>';
  const messageQuery = query(
    collection(db, "mateTalkRooms", roomId, "messages"),
    orderBy("createdAt", "desc"),
    limit(100),
  );
  stopMessages = onSnapshot(messageQuery, (snapshot) => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const messages = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .filter((message) => timestampMillis(message.createdAt) > cutoff).reverse();
    renderMessages(messages);
    const newest = messages.at(-1);
    const newestAt = timestampMillis(newest?.createdAt);
    if (activeRoom?.id === roomId && newest?.senderId !== studentNumber && newestAt > lastMarkedMessageAt) {
      lastMarkedMessageAt = newestAt;
      markMateTalkRead({ roomId }).catch(console.error);
    }
  }, (error) => {
    console.error("メッセージ取得エラー", error);
    $("mateMessageList").innerHTML = '<div class="mate-loading-card">メッセージを読み込めませんでした。</div>';
  });
}

function renderMessages(messages) {
  if (!messages.length) {
    $("mateMessageList").innerHTML = '<div class="mate-loading-card">最初のメッセージを送ってみましょう。</div>';
    return;
  }
  let lastDate = "";
  $("mateMessageList").innerHTML = messages.map((message) => {
    const date = dateLabel(message.createdAt);
    const divider = date !== lastDate ? `<div class="mate-day-divider"><span>${escapeHtml(date)}</span></div>` : "";
    lastDate = date;
    const image = message.type === "image" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(message.imageData || "")
      ? `<img class="mate-message-photo" src="${escapeHtml(message.imageData)}" alt="送信された写真" loading="lazy">` : "";
    const sender = activeRoom?.roomType === "group" && message.senderId !== studentNumber
      ? `<small class="mate-message-sender">${escapeHtml(profiles.get(message.senderId)?.nickname || "メンバー")}</small>` : "";
    return `${divider}<div class="mate-message-row${message.senderId === studentNumber ? " mine" : ""}"><div class="mate-message-bubble">${sender}${image}${escapeHtml(message.body || "").replace(/\n/g, "<br>")}<time>${escapeHtml(shortTime(message.createdAt))}</time></div></div>`;
  }).join("");
  $("mateMessageList").scrollTop = $("mateMessageList").scrollHeight;
}

$("mateMessageForm").onsubmit = async (event) => {
  event.preventDefault();
  const body = $("mateMessageInput").value.trim();
  if (!body || !activeRoom) return;
  $("mateSendButton").disabled = true;
  try {
    await sendMateTalkMessage({ roomId: activeRoom.id, body, mode });
    $("mateMessageInput").value = "";
    resizeMessageInput();
  } catch (error) {
    console.error("メッセージ送信エラー", error);
    alert(readableError(error, "メッセージを送信できませんでした。"));
  } finally {
    $("mateSendButton").disabled = false;
  }
};

$("mateMessageInput").addEventListener("input", resizeMessageInput);
$("mateMessageInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing && innerWidth > 760) {
    event.preventDefault();
    $("mateMessageForm").requestSubmit();
  }
});
function resizeMessageInput() {
  const input = $("mateMessageInput");
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
}

$("matePhotoButton").onclick = () => $("matePhotoInput").click();
$("matePhotoInput").onchange = async () => {
  const file = $("matePhotoInput").files?.[0];
  $("matePhotoInput").value = "";
  if (!file || !activeRoom) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 20 * 1024 * 1024) {
    alert("20MB以下のJPEG・PNG・WebPを選んでください。");
    return;
  }
  $("matePhotoButton").disabled = true;
  try {
    const imageData = await compressMatePhoto(file);
    if (!confirm("この写真をトークに送信しますか？")) return;
    await sendMateTalkMessage({ roomId: activeRoom.id, mode, imageData });
  } catch (error) {
    alert(readableError(error, "写真を送信できませんでした。"));
  } finally {
    $("matePhotoButton").disabled = false;
  }
};

async function compressMatePhoto(file) {
  const source = await createImageBitmap(file);
  try {
    let scale = Math.min(1, 900 / Math.max(source.width, source.height));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(source.width * scale));
      canvas.height = Math.max(1, Math.round(source.height * scale));
      const context = canvas.getContext("2d");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const encoded = canvas.toDataURL("image/jpeg", Math.max(.55, .78 - attempt * .06));
      if (encoded.length < 230000) return encoded;
      scale *= .75;
    }
    throw new Error("写真が大きすぎます。別の画像を選んでください。");
  } finally {
    source.close();
  }
}

document.querySelectorAll("#mateModeSwitch button").forEach((button) => {
  button.onclick = () => {
    mode = button.dataset.mode;
    document.querySelectorAll("#mateModeSwitch button").forEach((item) => item.classList.toggle("active", item === button));
    closeRoom();
    renderRooms();
  };
});

function closeRoom() {
  stopMessages?.();
  stopMessages = null;
  activeRoom = null;
  shell.classList.remove("chat-open");
  $("mateConversation").hidden = true;
  $("mateEmptyState").hidden = false;
  history.replaceState(null, "", "matetalk.html");
  renderRooms();
}

$("mateChatBack").onclick = closeRoom;
$("mateRoomSearch").oninput = renderRooms;
$("mateSettingsButton").onclick = () => openSettings(false);
$("mateAddFriendButton").onclick = () => openOverlay("mateExchangeOverlay");
$("mateMyProfileButton").onclick = () => openSettings(false);
$("mateCreateGroupButton").onclick = () => {
  const friends = rooms.filter((room) => room.roomType === "student").map((room) => otherId(room));
  $("mateGroupFriends").innerHTML = friends.length ? friends.map((friendId) =>
    `<label class="mate-group-friend"><input type="checkbox" value="${friendId}"><span>${escapeHtml(aliases.get(friendId) || profiles.get(friendId)?.nickname || friendId)}</span></label>`).join("")
    : '<p>まず友達を追加してください。</p>';
  $("mateGroupMessage").textContent = "";
  openOverlay("mateGroupOverlay");
};
$("mateSaveGroup").onclick = async () => {
  const friendIds = [...$("mateGroupFriends").querySelectorAll("input:checked")].map((input) => input.value);
  $("mateSaveGroup").disabled = true;
  try {
    const result = await createMateTalkGroup({ title: $("mateGroupName").value, friendIds });
    closeOverlay("mateGroupOverlay");
    history.replaceState(null, "", `matetalk.html?room=${encodeURIComponent(result.data.roomId)}`);
    showToast("グループを作成しました");
  } catch (error) {
    $("mateGroupMessage").textContent = readableError(error, "グループを作成できませんでした。");
  } finally {
    $("mateSaveGroup").disabled = false;
  }
};

function fillSettings() {
  $("mateNicknameInput").value = myProfile.nickname || "";
  $("mateExchangeEnabled").checked = myProfile.exchangeEnabled === true;
  $("mateExchangeIdInput").value = myProfile.exchangeId || "";
  updateExchangeFields();
  $("mateMyName").textContent = myProfile.nickname || "自分のプロフィール";
}

function openSettings(firstOpen) {
  fillSettings();
  $("mateSkipSettings").hidden = !firstOpen;
  openOverlay("mateSettingsOverlay");
}

$("mateExchangeEnabled").onchange = updateExchangeFields;
$("mateExchangeIdInput").oninput = updateQr;
function updateExchangeFields() {
  const enabled = $("mateExchangeEnabled").checked;
  $("mateExchangeIdField").hidden = !enabled;
  $("mateQrBox").hidden = !enabled || !$("mateExchangeIdInput").value.trim();
  if (enabled) updateQr();
}

function updateQr() {
  const exchangeId = $("mateExchangeIdInput").value.trim().toLowerCase();
  $("mateQrBox").hidden = !$("mateExchangeEnabled").checked || !exchangeId;
  renderQr("mateQrCode", exchangeId);
}

function renderQr(targetId, exchangeId) {
  const box = $(targetId);
  box.innerHTML = "";
  if (!exchangeId || !window.QRCode) return;
  new window.QRCode(box, {
    text: `${location.origin}${location.pathname.replace(/matetalk\.html$/, "matetalk.html")}?connect=${encodeURIComponent(exchangeId)}`,
    width: 190, height: 190, correctLevel: window.QRCode.CorrectLevel.M,
  });
}

$("mateShowOwnQr").onclick = () => {
  const enabled = myProfile.exchangeEnabled === true;
  const exchangeId = enabled ? myProfile.exchangeId : "";
  $("mateOwnQrBox").hidden = false;
  $("mateOwnQrId").textContent = exchangeId ? `交換ID：${exchangeId}` : "QRの利用にはプロフィールで交換IDを設定してください。";
  renderQr("mateOwnQrCode", exchangeId);
};

async function rotateQr() {
  if (!confirm("交換IDとQRを更新しますか？以前のQRは使えなくなります。")) return;
  const result = await rotateMateTalkExchangeId({});
  myProfile = { ...myProfile, ...result.data };
  fillSettings();
  $("mateShowOwnQr").click();
  showToast("QRを更新しました");
}
$("mateRotateQr").onclick = () => rotateQr().catch((error) => alert(readableError(error, "更新できませんでした。")));
$("mateRotateQrSettings").onclick = () => rotateQr().catch((error) => { $("mateSettingsMessage").textContent = readableError(error, "更新できませんでした。"); });

$("mateScanQr").onclick = async () => {
  if (!("BarcodeDetector" in window)) {
    $("mateExchangeMessage").textContent = "この端末はカメラ読み取りに対応していません。交換IDを入力してください。";
    return;
  }
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    $("mateQrVideo").srcObject = scanStream;
    $("mateScanBox").hidden = false;
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const scan = async () => {
      if (!scanStream) return;
      try {
        const codes = await detector.detect($("mateQrVideo"));
        if (!codes.length) { scanFrame = requestAnimationFrame(scan); return; }
        const url = new URL(codes[0].rawValue, location.href);
        const value = url.origin === location.origin ? url.searchParams.get("connect") : "";
        if (value) {
          $("mateFriendIdInput").value = value;
          $("mateExchangeMessage").textContent = "QRを読み取りました。交換ボタンで確定してください。";
          stopQrScan();
          return;
        }
      } catch { /* カメラが映るまで待つ */ }
      scanFrame = requestAnimationFrame(scan);
    };
    scanFrame = requestAnimationFrame(scan);
  } catch (error) {
    stopQrScan();
    $("mateExchangeMessage").textContent = "カメラを利用できません。交換IDを入力してください。";
  }
};
function stopQrScan() {
  cancelAnimationFrame(scanFrame);
  scanStream?.getTracks().forEach((track) => track.stop());
  scanStream = null;
  $("mateQrVideo").srcObject = null;
  $("mateScanBox").hidden = true;
}
$("mateStopScan").onclick = stopQrScan;

$("mateSaveSettings").onclick = async () => {
  $("mateSettingsMessage").textContent = "";
  $("mateSaveSettings").disabled = true;
  try {
    const result = await saveMateTalkSettings({
      nickname: $("mateNicknameInput").value,
      exchangeEnabled: $("mateExchangeEnabled").checked,
      exchangeId: $("mateExchangeIdInput").value,
    });
    myProfile = { ...myProfile, ...result.data };
    profiles.set(studentNumber, myProfile);
    $("mateMyName").textContent = myProfile.nickname;
    closeOverlay("mateSettingsOverlay");
    showToast("メイトーク設定を保存しました");
  } catch (error) {
    $("mateSettingsMessage").textContent = readableError(error, "設定を保存できませんでした。");
  } finally {
    $("mateSaveSettings").disabled = false;
  }
};
$("mateSkipSettings").onclick = () => closeOverlay("mateSettingsOverlay");

$("mateConnectFriend").onclick = async () => {
  $("mateExchangeMessage").textContent = "";
  $("mateConnectFriend").disabled = true;
  try {
    const result = await connectMateTalkFriend({ exchangeId: $("mateFriendIdInput").value });
    closeOverlay("mateExchangeOverlay");
    history.replaceState(null, "", `matetalk.html?room=${encodeURIComponent(result.data.roomId)}`);
    showToast("アカウントを交換しました");
  } catch (error) {
    $("mateExchangeMessage").textContent = readableError(error, "交換できませんでした。");
  } finally {
    $("mateConnectFriend").disabled = false;
  }
};

$("mateRenameButton").onclick = () => {
  if (!activeRoom) return;
  $("mateAliasInput").value = aliases.get(otherId(activeRoom)) || "";
  openOverlay("mateRenameOverlay");
};
$("mateSaveAlias").onclick = async () => {
  if (!activeRoom) return;
  const friendId = otherId(activeRoom);
  const alias = $("mateAliasInput").value.trim().slice(0, 30);
  await setDoc(doc(db, "users", studentNumber, "mateTalkAliases", friendId), {
    alias, updatedAt: serverTimestamp(),
  });
  aliases.set(friendId, alias);
  closeOverlay("mateRenameOverlay");
  $("mateChatName").textContent = displayName(activeRoom);
  renderRooms();
};

$("mateScheduleButton").onclick = async () => {
  if (!activeRoom) return;
  openOverlay("mateScheduleOverlay");
  $("mateScheduleList").innerHTML = '<div class="mate-loading-card">予定を読み込み中…</div>';
  try {
    const result = await getMateTalkSchedule({ roomId: activeRoom.id });
    scheduleData = result.data || { mine: [], theirs: [] };
    $("mateMineScheduleTab").textContent = `${myProfile.nickname || "自分"}の予定`;
    $("mateTheirScheduleTab").textContent = `${displayName(activeRoom)}の予定`;
    renderSchedule();
  } catch (error) {
    console.error("予定共有取得エラー", error);
    $("mateScheduleList").innerHTML = '<div class="mate-loading-card">予定を読み込めませんでした。</div>';
  }
};

document.querySelectorAll(".mate-schedule-switch button").forEach((button) => {
  button.onclick = () => {
    scheduleFilter = button.dataset.owner;
    document.querySelectorAll(".mate-schedule-switch button").forEach((item) => item.classList.toggle("active", item === button));
    renderSchedule();
  };
});

function renderSchedule() {
  const mine = (scheduleData.mine || []).map((event) => ({ ...event, owners: ["mine"] }));
  const theirs = (scheduleData.theirs || []).map((event) => ({ ...event, owners: ["theirs"] }));
  let source = scheduleFilter === "mine" ? mine : scheduleFilter === "theirs" ? theirs : [...mine, ...theirs];
  const merged = new Map();
  for (const event of source) {
    const key = [event.date, event.startTime, event.title].join("|");
    if (!merged.has(key)) merged.set(key, { ...event });
    else merged.get(key).owners.push(...event.owners);
  }
  const events = [...merged.values()].sort((left, right) => `${left.date}${left.startTime}`.localeCompare(`${right.date}${right.startTime}`));
  if (!events.length) {
    $("mateScheduleList").innerHTML = '<div class="mate-loading-card">表示できる予定はありません。</div>';
    return;
  }
  let day = "";
  $("mateScheduleList").innerHTML = events.map((event) => {
    const heading = event.date !== day ? `<div class="mate-schedule-day">${escapeHtml(formatDate(event.date))}</div>` : "";
    day = event.date;
    const ownerLabels = event.owners.map((owner) => `<span class="mate-owner-chip">${escapeHtml(owner === "mine" ? (myProfile.nickname || "自分") : displayName(activeRoom))}</span>`).join("");
    const includesMine = event.owners.includes("mine");
    return `${heading}<article class="mate-schedule-item"><div><b>${escapeHtml(event.title)}</b><small>${escapeHtml([event.startTime && `${event.startTime}${event.endTime ? `〜${event.endTime}` : ""}`, event.classGroup, event.location].filter(Boolean).join("・"))}</small><div class="mate-schedule-owners">${ownerLabels}</div></div>${includesMine ? `<label class="mate-visibility"><input type="checkbox" data-visibility-key="${escapeHtml(event.key)}" ${event.hidden ? "" : "checked"}>相手に見せる</label>` : ""}</article>`;
  }).join("");
  $("mateScheduleList").querySelectorAll("[data-visibility-key]").forEach((input) => {
    input.onchange = async () => {
      input.disabled = true;
      try {
        await setMateTalkScheduleVisibility({ eventKey: input.dataset.visibilityKey, hidden: !input.checked });
        const target = scheduleData.mine.find((item) => item.key === input.dataset.visibilityKey);
        if (target) target.hidden = !input.checked;
      } catch (error) {
        input.checked = !input.checked;
        alert(readableError(error, "公開設定を変更できませんでした。"));
      } finally {
        input.disabled = false;
      }
    };
  });
}

document.querySelectorAll("[data-close]").forEach((button) => {
  button.onclick = () => closeOverlay({ settings: "mateSettingsOverlay", exchange: "mateExchangeOverlay", group: "mateGroupOverlay", schedule: "mateScheduleOverlay", rename: "mateRenameOverlay" }[button.dataset.close]);
});
document.querySelectorAll(".mate-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (event) => { if (event.target === overlay) closeOverlay(overlay.id); });
});
function openOverlay(id) { $(id).hidden = false; }
function closeOverlay(id) { if (id) $(id).hidden = true; if (id === "mateExchangeOverlay") stopQrScan(); }

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (Number.isFinite(value._seconds)) return value._seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function shortTime(value) {
  const millis = timestampMillis(value);
  return millis ? new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(millis)) : "";
}
function dateLabel(value) {
  const millis = timestampMillis(value);
  return millis ? new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric" }).format(new Date(millis)) : "";
}
function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : `${date.getMonth() + 1}月${date.getDate()}日（${"日月火水木金土"[date.getDay()]}）`;
}
function readableError(error, fallback) {
  return String(error?.message || "").replace(/^FirebaseError:\s*/i, "").replace(/^\w+-precondition:\s*/i, "") || fallback;
}
function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
