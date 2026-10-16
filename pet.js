import { auth, functions, studentNumber } from "./common.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

const $ = (id) => document.getElementById(id);
const state = { data: null, selectedSpecies: "", busy: false, selectedFood: "", roamTimer: 0, petGesture: false };
const assets = {
  lizard: {
    idle: "assets/pets/lizard/rito_idle.png",
    feed: "assets/pets/lizard/rito_feed.png",
    play: "assets/pets/lizard/rito_play.png",
    pet: "assets/pets/lizard/rito_pet.png",
    sleep: "assets/pets/lizard/rito_sleep.png",
  },
};
const careCopy = {
  feed: { text: "おいしいごはんを食べて、リトはごきげん！", emoji: "💛" },
  play: { text: "葉っぱのおもちゃでたくさん遊んだよ！", emoji: "🍃" },
  pet: { text: "なでてもらって、うっとりしているよ。", emoji: "♡" },
  sleep: { text: "すやすや…ゆっくりおやすみ。", emoji: "☾" },
};
const foods = [
  { id: "cricket", name: "こおろぎ", note: "リトの大好物", emoji: "🦗" },
  { id: "greens", name: "やわらかい葉っぱ", note: "もぐもぐ健康ごはん", emoji: "🥬" },
  { id: "berry", name: "ごほうびベリー", note: "今日は特別なおやつ", emoji: "🫐" },
];

$("petHomeButton").addEventListener("click", () => location.assign("index.html"));
$("petRoomHomeButton").addEventListener("click", () => location.assign("index.html"));
$("petChooseForm").addEventListener("submit", choosePet);
$("petSpeciesGrid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-species]");
  if (!button || button.disabled) return;
  state.selectedSpecies = button.dataset.species;
  renderSpeciesChoices();
  $("petChooseSubmit").disabled = false;
});
document.querySelectorAll("[data-care]").forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.care === "feed") openFoodPicker();
  else careForPet(button.dataset.care);
}));
$("foodChoices").addEventListener("click", (event) => {
  const button = event.target.closest("[data-food]");
  if (!button) return;
  state.selectedFood = button.dataset.food;
  renderFoodChoices();
});
$("foodPickerClose").addEventListener("click", closeFoodPicker);
$("feedConfirm").addEventListener("click", () => {
  if (state.selectedFood) careForPet("feed", state.selectedFood);
});
const creature = $("petCreature");
creature.addEventListener("pointerdown", (event) => {
  if (state.busy || !state.data?.profile) return;
  event.preventDefault();
  state.petGesture = true;
  creature.setPointerCapture?.(event.pointerId);
  $("petStage").classList.add("is-petting", "has-reaction");
  $("petReaction").textContent = "♡";
  $("petMood").textContent = "いい気持ち…";
});
creature.addEventListener("pointerup", (event) => {
  if (!state.petGesture) return;
  state.petGesture = false;
  if (creature.hasPointerCapture?.(event.pointerId)) creature.releasePointerCapture(event.pointerId);
  careForPet("pet");
});
creature.addEventListener("pointercancel", () => { state.petGesture = false; });
creature.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); careForPet("pet"); }
});

await auth.authStateReady();
if (!auth.currentUser || auth.currentUser.uid !== `caremate-${studentNumber}`) {
  location.replace("login.html");
} else {
  await loadPetState();
}

async function loadPetState() {
  try {
    const result = await httpsCallable(functions, "getPetGameState")();
    state.data = result.data || {};
    if (!state.data.eligible) {
      $("petLocked").hidden = false;
      status("友達招待の特典を確認しました");
      return;
    }
    if (state.data.profile) renderPet(state.data.profile);
    else {
      $("petChoose").hidden = false;
      renderSpeciesChoices();
      status(state.data.pilot ? "テスト用にトカゲのリトをお迎えできます" : "6人招待の特典が解放されました");
    }
  } catch (error) {
    console.error("ペット情報の読み込みに失敗しました:", error);
    status("ペット情報を読み込めませんでした。通信を確認して再読み込みしてください。");
  }
}

function renderSpeciesChoices() {
  const labels = [
    ["dog", "いぬ", "🐶"], ["cat", "ねこ", "🐱"], ["lizard", "トカゲ", "🦎"],
    ["fox", "きつね", "🦊"], ["rabbit", "うさぎ", "🐰"],
  ];
  const allowed = new Set(state.data?.choices || []);
  $("petSpeciesGrid").replaceChildren(...labels.map(([id, name, emoji]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pet-species-option${allowed.has(id) ? " is-available" : ""}${state.selectedSpecies === id ? " is-selected" : ""}`;
    button.dataset.species = id;
    button.disabled = !allowed.has(id);
    button.innerHTML = `<span class="pet-silhouette" aria-hidden="true">${emoji}</span><b>${name}</b><small>${allowed.has(id) ? "お迎え候補" : "これから追加"}</small>`;
    return button;
  }));
}

async function choosePet(event) {
  event.preventDefault();
  if (state.busy || !state.selectedSpecies) return;
  const name = $("petNameInput").value.trim();
  if (!name || name.length > 12) {
    status("名前は1〜12文字で入力してください");
    return;
  }
  setBusy(true);
  try {
    const result = await httpsCallable(functions, "updatePetGameState")({ action: "choose", species: state.selectedSpecies, name });
    $("petChoose").hidden = true;
    renderPet(result.data.profile);
    status(`${result.data.profile.name}をお迎えしました`);
  } catch (error) {
    console.error("ペットをお迎えできませんでした:", error);
    status(error.message?.includes("permission") ? "ペット特典を確認できませんでした" : "お迎えを保存できませんでした。もう一度お試しください。");
  } finally { setBusy(false); }
}

function openFoodPicker() {
  if (state.busy) return;
  state.selectedFood = "";
  renderFoodChoices();
  $("foodPicker").hidden = false;
}

function closeFoodPicker() {
  $("foodPicker").hidden = true;
  state.selectedFood = "";
}

function renderFoodChoices() {
  $("foodChoices").replaceChildren(...foods.map((food) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.food = food.id;
    button.className = `food-choice${state.selectedFood === food.id ? " is-selected" : ""}`;
    button.innerHTML = `<span aria-hidden="true">${food.emoji}</span><span><b>${food.name}</b><small>${food.note}</small></span>`;
    return button;
  }));
  $("feedConfirm").disabled = !state.selectedFood || state.busy;
}

async function careForPet(action, foodId = "") {
  if (state.busy || !careCopy[action]) return;
  if (action === "pet") {
    $("petStage").classList.add("is-petting", "has-reaction");
    $("petReaction").textContent = "♡";
    $("petMood").textContent = "いい気持ち…";
  }
  setBusy(true);
  try {
    const result = await httpsCallable(functions, "updatePetGameState")({ action: "care", careAction: action, foodId });
    if (action === "feed") closeFoodPicker();
    renderPet(result.data.profile, action);
    const food = foods.find((item) => item.id === foodId);
    status(action === "feed" && food ? `${food.name}を食べて、${result.data.profile.name}はごきげん！` : careCopy[action].text);
  } catch (error) {
    console.error("お世話を保存できませんでした:", error);
    status(error.code?.includes("already-exists") || error.message?.includes("今日は") ? "今日はこのお世話をしました。また明日ね。" : "お世話を保存できませんでした。通信を確認してください。");
    await loadPetState();
  } finally { setBusy(false); }
}

function renderPet(profile, action = "") {
  if (state.data) state.data.profile = profile;
  document.querySelector(".pet-app").classList.add("is-in-room");
  $("petStatus").hidden = true;
  $("petChoose").hidden = true;
  $("petHome").hidden = false;
  const species = state.data?.species?.[profile.species] || { name: "ペット", emoji: "🐾" };
  $("petName").textContent = profile.name;
  $("petSpeciesLabel").textContent = `${species.emoji} ${species.name}`;
  $("petFriendship").textContent = String(profile.friendship || 0);
  $("petStreak").textContent = String(profile.currentStreak || 0);
  const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const today = profile.dailyCare?.date === dateKey ? profile.dailyCare : { actions: {} };
  const done = today.actions || {};
  const actionCount = Object.values(done).filter(Boolean).length;
  $("petDailyCount").textContent = String(actionCount);
  $("petTodayLabel").textContent = `${new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", timeZone: "Asia/Tokyo" }).format(new Date())}`;
  document.querySelectorAll("[data-care]").forEach((button) => {
    const completed = done[button.dataset.care] === true;
    button.disabled = completed || state.busy;
    button.classList.toggle("is-done", completed);
    const small = button.querySelector("small");
    if (completed) small.textContent = "今日はお世話済み";
  });
  const currentAction = action || (profile.lastAction === "sleep" ? "sleep" : "");
  const imageSet = assets[profile.species];
  const image = $("petImage");
  if (imageSet) image.src = imageSet[currentAction] || imageSet.idle;
  else image.hidden = true;
  const stage = $("petStage");
  stage.classList.remove("is-feeding", "is-playing", "is-petting", "is-sleeping", "has-reaction");
  stage.classList.add("is-in-room");
  const motionClass = { feed: "is-feeding", play: "is-playing", pet: "is-petting", sleep: "is-sleeping" }[currentAction];
  if (motionClass) stage.classList.add(motionClass);
  $("petReaction").textContent = action ? careCopy[action].emoji : "";
  if (action) stage.classList.add("has-reaction");
  $("petMood").textContent = action ? careCopy[action].text : profile.lastAction === "sleep" ? "すやすやおやすみ中" : "のんびりしているよ";
  if (action && action !== "sleep") window.setTimeout(() => {
    stage.classList.remove("is-feeding", "is-playing", "is-petting", "has-reaction");
    image.src = imageSet?.idle || image.src;
    $("petMood").textContent = "のんびりしているよ";
    $("petReaction").textContent = "";
  }, action === "play" ? 2600 : 1800);
  startRoomRoam();
}

function startRoomRoam() {
  window.clearTimeout(state.roamTimer);
  const profile = state.data?.profile;
  if (!profile || profile.lastAction === "sleep") return;
  state.roamTimer = window.setTimeout(() => {
    const stage = $("petStage");
    if (state.busy || stage.classList.contains("is-feeding") || stage.classList.contains("is-playing") || stage.classList.contains("is-petting")) {
      startRoomRoam();
      return;
    }
    const left = 29 + Math.random() * 43;
    const bottom = 11 + Math.random() * 18;
    const depth = 0.62 + ((bottom - 11) / 18) * 0.31;
    $("petCreature").style.left = `${left}%`;
    $("petCreature").style.bottom = `${bottom}%`;
    $("petCreature").style.setProperty("--pet-depth", depth.toFixed(2));
    $("petRoomDepthShadow").style.left = `${left}%`;
    $("petRoomDepthShadow").style.bottom = `${bottom - 1}%`;
    stage.classList.add("is-walking");
    window.setTimeout(() => stage.classList.remove("is-walking"), 2400);
    state.roamTimer = window.setTimeout(startRoomRoam, 2400);
  }, 4200 + Math.random() * 3000);
}

function setBusy(busy) {
  state.busy = busy;
  $("petChooseSubmit").disabled = busy || !state.selectedSpecies;
  document.querySelectorAll("[data-care]").forEach((button) => {
    button.disabled = busy || state.data?.profile?.dailyCare?.date === new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) && state.data?.profile?.dailyCare?.actions?.[button.dataset.care] === true;
  });
}

function status(message) {
  $("petStatus").textContent = message;
  $("petRoomStatus").textContent = message;
}
