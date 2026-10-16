import { auth, functions, setupTheme, initializePage, loadProfileImage, loadUserName, loadMyRanking, isAdmin } from "./common.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

const $ = (id) => document.getElementById(id);
const form = $("petItemForm");
const state = { items: [], editingId: "" };
setupTheme($("themeButton"));
$("backToUsers").addEventListener("click", () => location.assign("users_admin.html"));
$("petItemNew").addEventListener("click", resetForm);
$("itemKind").addEventListener("change", updateFields);
$("petItemList").addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit]");
  const remove = event.target.closest("[data-delete]");
  if (edit) editItem(edit.dataset.edit);
  if (remove) deleteItem(remove.dataset.delete);
});
form.addEventListener("submit", saveItem);

if (!(await isAdmin())) {
  alert("管理者のみアクセスできます。");
  location.replace("index.html");
} else {
  await initializePage([loadUserName($("userName")), loadMyRanking(), loadProfileImage($("topProfileImage"))]);
  await loadItems();
}

async function loadItems() {
  try {
    const result = await httpsCallable(functions, "getPetShopCatalogAdmin")();
    state.items = result.data?.items || [];
    renderItems();
    updateFields();
  } catch (error) {
    console.error(error);
    $("petItemList").textContent = "商品設定を読み込めませんでした。管理者権限と通信を確認してください。";
    status(error.message || "読み込みに失敗しました");
  }
}

function renderItems() {
  if (!state.items.length) { $("petItemList").textContent = "商品はありません"; return; }
  $("petItemList").replaceChildren(...state.items.map((item) => {
    const card = document.createElement("article");
    card.className = `pet-admin-item${item.enabled === false ? " is-disabled" : ""}`;
    const image = safeAsset(item.imagePath) || "";
    card.innerHTML = `<img src="${image}" alt="" /><div class="pet-admin-item-copy"><strong>${escapeHtml(item.name)}</strong><small>${item.kind === "food" ? `ごはん · ${escapeHtml(item.preference || "普通")} · 満足度 ${Number(item.satisfaction) || 0} · 満腹 +${Number(item.fullnessGain) || 0}%` : "おもちゃ"}</small><small>${item.infinite ? "在庫 無限" : `価格 ${Number(item.price) || 0} コイン`} · ${item.enabled === false ? "無効" : item.shopAvailable === false ? "ショップ非表示" : "販売中"}</small><code>${escapeHtml(item.id)}</code></div><div class="pet-admin-item-actions"><button class="btn" type="button" data-edit="${escapeHtml(item.id)}">編集</button>${item.isDefault ? "" : `<button class="btn" type="button" data-delete="${escapeHtml(item.id)}">削除</button>`}</div>`;
    return card;
  }));
}

function editItem(id) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) return;
  state.editingId = id;
  $("petItemFormTitle").textContent = `「${item.name}」を編集`;
  $("itemKind").value = item.kind;
  $("itemKind").disabled = item.isDefault === true;
  $("itemId").value = item.id;
  $("itemId").disabled = true;
  $("itemName").value = item.name;
  $("itemImagePath").value = item.imagePath;
  $("itemPrice").value = Number(item.price) || 0;
  $("itemPreference").value = item.preference || "普通";
  $("itemSatisfaction").value = Number(item.satisfaction) || 0;
  $("itemFullnessGain").value = Number(item.fullnessGain) || 0;
  $("itemInfinite").checked = item.infinite === true;
  $("itemShopAvailable").checked = item.shopAvailable !== false;
  $("itemEnabled").checked = item.enabled !== false;
  updateFields();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveItem(event) {
  event.preventDefault();
  const kind = $("itemKind").value;
  const item = {
    id: $("itemId").value.trim().toLowerCase(), kind, name: $("itemName").value.trim(), imagePath: $("itemImagePath").value.trim(), price: Number($("itemPrice").value),
    preference: $("itemPreference").value, satisfaction: Number($("itemSatisfaction").value), fullnessGain: Number($("itemFullnessGain").value), infinite: kind === "food" && $("itemInfinite").checked,
    shopAvailable: $("itemShopAvailable").checked, enabled: $("itemEnabled").checked,
  };
  busy(true);
  try {
    await httpsCallable(functions, "savePetShopCatalogItem")({ action: "save", id: state.editingId, item });
    status("商品を保存しました");
    resetForm();
    await loadItems();
  } catch (error) { console.error(error); status(error.message || "商品を保存できませんでした"); }
  finally { busy(false); }
}

async function deleteItem(id) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item || item.isDefault || !confirm(`「${item.name}」を商品設定から削除します。よろしいですか？`)) return;
  busy(true);
  try {
    await httpsCallable(functions, "savePetShopCatalogItem")({ action: "delete", id });
    status("商品設定を削除しました");
    await loadItems();
  } catch (error) { console.error(error); status(error.message || "削除できませんでした"); }
  finally { busy(false); }
}

function resetForm() {
  form.reset();
  state.editingId = "";
  $("itemId").disabled = false;
  $("itemKind").disabled = false;
  $("itemPrice").value = 10;
  $("itemSatisfaction").value = 20;
  $("itemFullnessGain").value = 20;
  $("itemShopAvailable").checked = true;
  $("itemEnabled").checked = true;
  $("petItemFormTitle").textContent = "商品を追加";
  updateFields();
}

function updateFields() {
  document.querySelectorAll(".food-only").forEach((node) => { node.hidden = $("itemKind").value !== "food"; });
  if (!state.editingId) $("itemImagePath").placeholder = `assets/pets/${$("itemKind").value === "food" ? "food" : "toys"}/item.png`;
}
function busy(value) { $("petItemSave").disabled = value; $("petItemNew").disabled = value; }
function status(message) { $("petAdminStatus").textContent = message; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function safeAsset(path) { return /^assets\/pets\/(food|toys)\/[a-z0-9._-]+\.png$/i.test(String(path || "")) ? path : ""; }
