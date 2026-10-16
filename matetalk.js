import {
  auth,
  db,
  functions,
  studentNumber,
  setupTheme,
  initializePage,
  showToast,
} from "./common.js?v=20261016-1";
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
  if (!visible.length) {
    $("mateRoomList").innerHTML = `<div class="mate-loading-card">${mode === "admin" ? "登録学生を準備中です。" : "システム管理者とのトーク、または交換した友達が表示されます。"}</div>`;
    return;
  }
  $("mateRoomList").innerHTML = visible.map((room) => `
    <button type="button" class="mate-room-card${activeRoom?.id === room.id ? " active" : ""}" data-room-id="${escapeHtml(room.id)}">
      <img src="${escapeHtml(photoFor(room))}" alt="">
      <span><b>${escapeHtml(displayName(room))}${room.roomType === "admin" ? '<i class="mate-admin-mark">管理者</i>' : ""}</b><small>${escapeHtml(room.lastMessage || "トークを始めましょう")}</small></span>
      <time>${escapeHtml(shortTime(room.lastMessageAt))}</time>
    </button>`).join("");
  $("mateRoomList").querySelectorAll("[data-room-id]").forEach((button) => {
    button.onclick = () => {
      const room = rooms.find((item) => item.id === button.dataset.roomId);
      if (room) openRoom(room);
    };
  });
}

function openRoom(room) {
  activeRoom = room;
  renderRooms();
  $("mateEmptyState").hidden = true;
  $("mateConversation").hidden = false;
  shell.classList.add("chat-open");
  $("mateChatName").textContent = displayName(room);
  $("mateChatPhoto").src = photoFor(room);
  $("mateChatStatus").textContent = room.roomType === "admin"
    ? (mode === "admin" ? "システム管理者として対応" : "CareMate システム管理者")
    : "アカウント交換済み";
  $("mateRenameButton").hidden = room.roomType === "admin";
  history.replaceState(null, "", `matetalk.html?room=${encodeURIComponent(room.id)}`);
  subscribeMessages(room.id);
}

function subscribeMessages(roomId) {
  stopMessages?.();
  $("mateMessageList").innerHTML = '<div class="mate-loading-card">メッセージを読み込み中…</div>';
  const messageQuery = query(
    collection(db, "mateTalkRooms", roomId, "messages"),
    orderBy("createdAt", "asc"),
    limit(300),
  );
  stopMessages = onSnapshot(messageQuery, (snapshot) => {
    const messages = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderMessages(messages);
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
    return `${divider}<div class="mate-message-row${message.senderId === studentNumber ? " mine" : ""}"><div class="mate-message-bubble">${escapeHtml(message.body).replace(/\n/g, "<br>")}<time>${escapeHtml(shortTime(message.createdAt))}</time></div></div>`;
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

function fillSettings() {
  $("mateNicknameInput").value = myProfile.nickname || "";
  $("mateExchangeEnabled").checked = myProfile.exchangeEnabled === true;
  $("mateExchangeIdInput").value = myProfile.exchangeId || "";
  updateExchangeFields();
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
  const box = $("mateQrCode");
  box.innerHTML = "";
  $("mateQrBox").hidden = !$("mateExchangeEnabled").checked || !exchangeId;
  if (!exchangeId || !window.QRCode) return;
  new window.QRCode(box, {
    text: `${location.origin}${location.pathname.replace(/matetalk\.html$/, "matetalk.html")}?connect=${encodeURIComponent(exchangeId)}`,
    width: 190, height: 190, correctLevel: window.QRCode.CorrectLevel.M,
  });
}

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
  button.onclick = () => closeOverlay({ settings: "mateSettingsOverlay", exchange: "mateExchangeOverlay", schedule: "mateScheduleOverlay", rename: "mateRenameOverlay" }[button.dataset.close]);
});
document.querySelectorAll(".mate-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.hidden = true; });
});
function openOverlay(id) { $(id).hidden = false; }
function closeOverlay(id) { if (id) $(id).hidden = true; }

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
