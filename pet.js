import { auth, functions, studentNumber } from "./common.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

const $ = (id) => document.getElementById(id);
const state = { data: null, selectedSpecies: "", busy: false };
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
  feed: { text: "おいしいごはんを食べて、リトはごきげん！", emoji: "🍓" },
  play: { text: "葉っぱのおもちゃでたくさん遊んだよ！", emoji: "🍃" },
  pet: { text: "なでてもらって、うっとりしているよ。", emoji: "♡" },
  sleep: { text: "すやすや…ゆっくりおやすみ。", emoji: "☾" },
};

$("petHomeButton").addEventListener("click", () => location.assign("index.html"));
$("petChooseForm").addEventListener("submit", choosePet);
$("petSpeciesGrid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-species]");
  if (!button || button.disabled) return;
  state.selectedSpecies = button.dataset.species;
  renderSpeciesChoices();
  $("petChooseSubmit").disabled = false;
});
document.querySelectorAll("[data-care]").forEach((button) => button.addEventListener("click", () => careForPet(button.dataset.care)));

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

async function careForPet(action) {
  if (state.busy || !careCopy[action]) return;
  setBusy(true);
  try {
    const result = await httpsCallable(functions, "updatePetGameState")({ action: "care", careAction: action });
    renderPet(result.data.profile, action);
    status(careCopy[action].text);
  } catch (error) {
    console.error("お世話を保存できませんでした:", error);
    status(error.code?.includes("already-exists") || error.message?.includes("今日は") ? "今日はこのお世話をしました。また明日ね。" : "お世話を保存できませんでした。通信を確認してください。");
    await loadPetState();
  } finally { setBusy(false); }
}

function renderPet(profile, action = "") {
  if (state.data) state.data.profile = profile;
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
  const currentAction = action || profile.lastAction || "";
  const imageSet = assets[profile.species];
  const image = $("petImage");
  if (imageSet) image.src = imageSet[currentAction] || imageSet.idle;
  else image.hidden = true;
  const stage = $("petStage");
  stage.classList.remove("is-feeding", "is-playing", "is-petting", "is-sleeping", "has-reaction");
  const motionClass = { feed: "is-feeding", play: "is-playing", pet: "is-petting", sleep: "is-sleeping" }[currentAction];
  if (motionClass) stage.classList.add(motionClass);
  $("petReaction").textContent = action ? careCopy[action].emoji : "";
  if (action) stage.classList.add("has-reaction");
  $("petMood").textContent = action ? careCopy[action].text : profile.lastAction === "sleep" ? "すやすやおやすみ中" : "のんびりしているよ";
}

function setBusy(busy) {
  state.busy = busy;
  $("petChooseSubmit").disabled = busy || !state.selectedSpecies;
  document.querySelectorAll("[data-care]").forEach((button) => {
    button.disabled = busy || state.data?.profile?.dailyCare?.date === new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) && state.data?.profile?.dailyCare?.actions?.[button.dataset.care] === true;
  });
}

function status(message) { $("petStatus").textContent = message; }
