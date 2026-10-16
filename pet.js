import { auth, functions, studentNumber } from "./common.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

const $ = (id) => document.getElementById(id);
const state = { data: null, selectedSpecies: "", busy: false, selectedFood: null, roamTimer: 0, petGesture: false, lastBottom: 11 };
const lizardAssets = {
  idle: "assets/pets/lizard/rito_idle.png",
  feed: "assets/pets/lizard/rito_feed.png",
  play: "assets/pets/lizard/rito_play.png",
  pet: "assets/pets/lizard/rito_pet.png",
  sleep: "assets/pets/lizard/rito_sleep.png",
  walkToward: "assets/pets/lizard/rito_walk_toward_strip.png",
  walkAway: "assets/pets/lizard/rito_walk_away_strip.png",
};
const careCopy = {
  feed: { text: "おいしいごはんを食べて、リトはごきげん！", mark: "♡" },
  play: { text: "葉っぱのおもちゃでたくさん遊んだよ！", mark: "♪" },
  pet: { text: "なでてもらって、うっとりしているよ。", mark: "♡" },
};

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
  state.selectedFood = state.data?.catalog?.find((item) => item.id === button.dataset.food);
  if (state.selectedFood) openFoodDetail(state.selectedFood);
});
$("foodPickerClose").addEventListener("click", () => { $("foodPicker").hidden = true; });
$("foodDetailClose").addEventListener("click", closeFoodDetail);
$("foodCancel").addEventListener("click", closeFoodDetail);
$("feedConfirm").addEventListener("click", () => {
  if (state.selectedFood) careForPet("feed", state.selectedFood.id);
});
$("toyButton").addEventListener("click", openToyPicker);
$("toyPickerClose").addEventListener("click", () => { $("toyPicker").hidden = true; });
$("toyChoices").addEventListener("click", (event) => {
  const button = event.target.closest("[data-toy]");
  if (button) setRoomToy(button.dataset.toy);
});
$("toyPutAway").addEventListener("click", () => setRoomToy(""));
$("petShopButton").addEventListener("click", openPetShop);
$("petShopClose").addEventListener("click", () => { $("petShop").hidden = true; });
$("shopItems").addEventListener("click", (event) => {
  const button = event.target.closest("[data-buy]");
  if (button) buyShopItem(button.dataset.buy);
});
const creature = $("petCreature");
creature.addEventListener("pointerdown", (event) => {
  if (state.busy || !state.data?.profile || state.data.profile.isSleeping) return;
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
  window.setInterval(loadPetState, 60_000);
}

async function loadPetState() {
  try {
    const result = await httpsCallable(functions, "getPetGameState")();
    state.data = result.data || {};
    if (!state.data.eligible) {
      $("petLocked").hidden = false;
      status("友達招待6人でペットとの暮らしが解放されます");
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
  const labels = [["dog", "いぬ", "🐶"], ["cat", "ねこ", "🐱"], ["lizard", "トカゲ", "🦎"], ["fox", "きつね", "🦊"], ["rabbit", "うさぎ", "🐰"]];
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
  if (!name || name.length > 12) { status("名前は1〜12文字で入力してください"); return; }
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
  if (state.busy || isSleeping()) return;
  renderFoodChoices();
  $("petShop").hidden = true;
  $("toyPicker").hidden = true;
  $("foodPicker").hidden = false;
}

function renderFoodChoices() {
  const foods = (state.data?.catalog || []).filter((item) => item.kind === "food");
  $("foodChoices").replaceChildren(...foods.map((food) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.food = food.id;
    button.className = "food-choice food-library-item";
    button.innerHTML = `<img src="${safeAsset(food.imagePath)}" alt="" /><span class="food-choice-copy"><b>${escapeHtml(food.name)}</b><small>${escapeHtml(food.preference || "普通")} · 満足度 ${Number(food.satisfaction) || 0}</small></span><small class="food-stock-corner">${food.infinite ? "無限" : `×${Number(state.data.profile?.inventory?.[food.id] || 0)}`}</small>`;
    button.disabled = !food.infinite && Number(state.data.profile?.inventory?.[food.id] || 0) <= 0;
    return button;
  }));
}

function openFoodDetail(food) {
  $("foodDetailImage").src = safeAsset(food.imagePath);
  $("foodDetailName").textContent = food.name;
  $("foodDetailPreference").textContent = food.preference || "普通";
  $("foodDetailSatisfaction").textContent = `+${Number(food.satisfaction) || 0}`;
  $("foodDetailFullness").textContent = `+${Number(food.fullnessGain) || 0}%`;
  $("foodDetailStock").textContent = food.infinite ? "ライブラリから無限に選べます" : `残り ${Number(state.data.profile?.inventory?.[food.id] || 0)} 個`;
  $("feedConfirm").disabled = isSleeping() || (Number(state.data.profile?.fullness || 0) >= 95);
  $("foodDetailDialog").hidden = false;
}

function closeFoodDetail() {
  $("foodDetailDialog").hidden = true;
  state.selectedFood = null;
}

async function careForPet(action, foodId = "") {
  if (state.busy || !careCopy[action] || isSleeping()) return;
  setBusy(true);
  $("petReaction").textContent = careCopy[action].mark;
  try {
    const result = await httpsCallable(functions, "updatePetGameState")({ action: "care", careAction: action, foodId });
    if (action === "feed") { closeFoodDetail(); $("foodPicker").hidden = true; }
    renderPet(result.data.profile, action);
    if (action === "feed") {
      const food = state.data?.catalog?.find((item) => item.id === foodId);
      const meal = result.data.profile.lastMeal;
      status(`${food?.name || "ごはん"}を食べたよ · ${meal?.preference || "普通"} · 満足度 +${meal?.satisfaction || 0} · 満腹度 ${result.data.profile.fullness}%`);
    } else status(careCopy[action].text.replaceAll("リト", result.data.profile.name));
  } catch (error) {
    console.error("お世話を保存できませんでした:", error);
    const code = error.code || "";
    status(code.includes("failed-precondition") ? (error.message || "今はできないみたい") : "お世話を保存できませんでした。通信を確認してください。");
    await loadPetState();
  } finally { setBusy(false); }
}

function renderPet(profile, action = "") {
  if (state.data) state.data.profile = profile;
  document.querySelector(".pet-app").classList.add("is-in-room");
  $("petStatus").hidden = true;
  $("petChoose").hidden = true;
  $("petHome").hidden = false;
  $("petName").textContent = profile.name;
  $("petRoomLabel").textContent = `${profile.name}のお部屋`;
  $("petStage").setAttribute("aria-label", `${profile.name}のお部屋`);
  $("petCreature").setAttribute("aria-label", `${profile.name}をなでる。押したまま動かしてなでてね`);
  $("petFriendship").textContent = String(profile.friendship || 0);
  $("petStreak").textContent = String(profile.currentStreak || 0);
  $("petCoinCount").textContent = String(profile.petCoins || 0);
  const fullness = Math.max(0, Math.min(100, Number(profile.fullness ?? 8)));
  $("petFullnessFill").style.width = `${fullness}%`;
  $("petFullnessValue").textContent = `${fullness}%`;
  $("petFullnessFill").classList.toggle("is-low", fullness < 25);
  setTimeOfDay();
  const night = Boolean(profile.isSleeping) || isNightByClock();
  const currentAction = night ? "sleep" : action;
  const image = $("petImage");
  image.src = lizardAssets[currentAction] || lizardAssets.idle;
  const stage = $("petStage");
  stage.classList.remove("is-feeding", "is-playing", "is-petting", "is-sleeping", "has-reaction");
  stage.classList.add("is-in-room");
  const motionClass = { feed: "is-feeding", play: "is-playing", pet: "is-petting", sleep: "is-sleeping" }[currentAction];
  if (motionClass) stage.classList.add(motionClass);
  $("petReaction").textContent = night ? "☾" : action ? careCopy[action].mark : "";
  if (action || night) stage.classList.add("has-reaction");
  $("petMood").textContent = night ? "すやすや眠っているよ" : action ? careCopy[action].text.replaceAll("リト", profile.name) : "のんびりしているよ";
  const activeToy = (state.data?.catalog || []).find((item) => item.id === profile.activeToyId && item.kind === "toy");
  $("petRoomPropToy").hidden = !activeToy;
  if (activeToy) $("activeToyImage").src = safeAsset(activeToy.imagePath);
  document.querySelectorAll("[data-care]").forEach((button) => { button.disabled = state.busy || night || (button.dataset.care === "feed" && fullness >= 95); });
  $("toyButton").disabled = state.busy || night;
  $("petShopButton").disabled = state.busy;
  if (action && action !== "sleep") window.setTimeout(() => {
    if (night) return;
    stage.classList.remove("is-feeding", "is-playing", "is-petting", "has-reaction");
    image.src = lizardAssets.idle;
    $("petMood").textContent = "のんびりしているよ";
    $("petReaction").textContent = "";
  }, action === "play" ? 2600 : 1800);
  if (night) window.clearTimeout(state.roamTimer);
  else startRoomRoam();
}

function startRoomRoam() {
  window.clearTimeout(state.roamTimer);
  const profile = state.data?.profile;
  if (!profile || profile.isSleeping || isNightByClock()) return;
  state.roamTimer = window.setTimeout(() => {
    const stage = $("petStage");
    if (state.busy || stage.classList.contains("is-feeding") || stage.classList.contains("is-playing") || stage.classList.contains("is-petting")) { startRoomRoam(); return; }
    const previousBottom = state.lastBottom;
    const left = 28 + Math.random() * 44;
    const bottom = Math.random() < 0.52 ? 28 + Math.random() * 8 : 11 + Math.random() * 7;
    const walkingAway = bottom > previousBottom + 3;
    const walkingToward = bottom < previousBottom - 3;
    const depth = Math.max(0.53, Math.min(0.92, 0.94 - ((bottom - 11) / 25) * 0.36));
    state.lastBottom = bottom;
    const creatureEl = $("petCreature");
    creatureEl.style.left = `${left}%`;
    creatureEl.style.bottom = `${bottom}%`;
    creatureEl.style.setProperty("--pet-depth", depth.toFixed(2));
    $("petRoomDepthShadow").style.left = `${left}%`;
    $("petRoomDepthShadow").style.bottom = `${bottom - 1}%`;
    stage.classList.toggle("is-walking-away", walkingAway);
    stage.classList.toggle("is-walking-toward", walkingToward);
    stage.classList.add("is-walking");
    window.setTimeout(() => { stage.classList.remove("is-walking", "is-walking-away", "is-walking-toward"); }, 2700);
    state.roamTimer = window.setTimeout(startRoomRoam, 2700);
  }, 4200 + Math.random() * 3000);
}

function openToyPicker() {
  if (state.busy || isSleeping()) return;
  const owned = (state.data?.catalog || []).filter((item) => item.kind === "toy" && Number(state.data.profile?.inventory?.[item.id] || 0) > 0);
  $("toyChoices").replaceChildren(...owned.map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.toy = item.id;
    button.className = "food-choice";
    const label = state.data.profile.activeToyId === item.id ? "部屋に出ています" : `×${Number(state.data.profile.inventory[item.id])}`;
    button.innerHTML = `<img src="${safeAsset(item.imagePath)}" alt="" /><span class="food-choice-copy"><b>${escapeHtml(item.name)}</b><small>${label}</small></span>`;
    return button;
  }));
  $("toyPicker").hidden = false;
}

async function setRoomToy(itemId) {
  if (state.busy) return;
  setBusy(true);
  try {
    const result = await httpsCallable(functions, "updatePetGameState")({ action: "set-toy", itemId });
    state.data.profile = result.data.profile;
    $("toyPicker").hidden = true;
    renderPet(result.data.profile);
    status(itemId ? "おもちゃをお部屋に出したよ" : "おもちゃをしまったよ");
  } catch (error) { status(error.message || "おもちゃを変更できませんでした"); }
  finally { setBusy(false); }
}

function openPetShop() {
  if (state.busy) return;
  $("petCoinCount").textContent = String(state.data?.profile?.petCoins || 0);
  const items = (state.data?.catalog || []).filter((item) => item.shopAvailable !== false);
  $("shopItems").replaceChildren(...items.map((item) => {
    const owned = Number(state.data.profile?.inventory?.[item.id] || 0);
    const infinite = item.infinite === true;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.buy = item.id;
    button.className = "food-choice shop-item";
    button.innerHTML = `<img src="${safeAsset(item.imagePath)}" alt="" /><span class="food-choice-copy"><b>${escapeHtml(item.name)}</b><small>${item.kind === "food" ? `${escapeHtml(item.preference || "普通")} · 満足度 ${Number(item.satisfaction) || 0}` : "おもちゃ"}</small></span><strong class="shop-price">${infinite ? "無限" : `${Number(item.price) || 0} コイン`}</strong>${infinite ? "" : `<small>${owned ? `所持 ×${owned}` : "購入"}</small>`}`;
    button.disabled = infinite;
    return button;
  }));
  $("petShop").hidden = false;
}

async function buyShopItem(itemId) {
  if (state.busy) return;
  setBusy(true);
  try {
    const result = await httpsCallable(functions, "updatePetGameState")({ action: "buy", itemId });
    state.data.profile = result.data.profile;
    renderPet(result.data.profile);
    openPetShop();
    status("お買いものを受け取りました");
  } catch (error) { status(error.message || "購入できませんでした"); }
  finally { setBusy(false); }
}

function setBusy(busy) {
  state.busy = busy;
  $("petChooseSubmit").disabled = busy || !state.selectedSpecies;
  document.querySelectorAll("[data-care]").forEach((button) => { button.disabled = busy || isSleeping() || (button.dataset.care === "feed" && Number(state.data?.profile?.fullness || 0) >= 95); });
  $("toyButton").disabled = busy || isSleeping();
  $("petShopButton").disabled = busy;
  $("feedConfirm").disabled = busy || isSleeping() || Number(state.data?.profile?.fullness || 0) >= 95;
}

function isNightByClock() {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  return hour >= 22 || hour < 6;
}
function isSleeping() { return Boolean(state.data?.profile?.isSleeping) || isNightByClock(); }
function setTimeOfDay() {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  const stage = $("petStage");
  stage.classList.remove("time-morning", "time-day", "time-evening", "time-night");
  stage.classList.add(hour >= 22 || hour < 5 ? "time-night" : hour < 10 ? "time-morning" : hour < 17 ? "time-day" : "time-evening");
}
function safeAsset(path) { return /^assets\/pets\/(food|toys|lizard)\/[a-z0-9._-]+\.png$/i.test(String(path || "")) ? path : "assets/pets/food/komatsuna.png"; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function status(message) { $("petStatus").textContent = message; $("petRoomStatus").textContent = message; }
