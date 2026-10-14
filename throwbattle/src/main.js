import { ASSETS, MENU_ITEMS, WEAPONS } from './data/config.js';
import { ARMOR, PROGRESSION, SKILLS } from './data/progression.js';
import { createProfile, loadProfile, saveProfile, deriveStats, battleLoadout, allocateStat, equip, upgradeWeapon, applyBattleResult } from './services/profile.js';
import { PrototypeCloudSync, THROB_TEST_STUDENTS } from './services/cloudSync.js';
import { GameApp } from './game/GameApp.js';
import { MenuPreview } from './screens/MenuPreview.js';
import { AudioManager } from './audio/AudioManager.js';
import { pilotBonuses } from './services/pilotBonuses.js';
import { RealtimeLobbyClient } from './services/realtimeLobby.js?v=2';
import { OnlineBattleApp } from './game/OnlineBattleApp.js?v=5';
import { rankedMatchPlayers } from './game/onlineHud.js';

const screens = Object.fromEntries([...document.querySelectorAll('.screen')].map((screen) => [screen.id, screen]));
const byId = (id) => document.getElementById(id);
const preview = new MenuPreview(byId('menuModel'));
const audio = new AudioManager();
let game = null;
let lastSettings = { difficulty: 'normal', rule: 'elimination' };
let noticeTimer = null;
let tutorialReturn = 'menuScreen';
let { profile, recovered: recoveredProfile } = loadProfile();
let currentMatchId = null;
let currentReward = null;
let cloudSync = null;
let cloudInitializationPending = null;
let gachaApi = null;
let gachaBusy = false;
let gachaState = null;
const GACHA_PENDING_KEY = 'throb:gacha:pending:v1';
const SHOP_PENDING_KEY = 'throb:shop:pending:v1';
let shopBusy = false;
let onlineEquipBusy = false;
let realtimeLobby = null;
let realtimeRoom = null;
let realtimeParticipantId = null;
let onlineBattle = null;
let onlineBattleLoading = false;
let pendingBattleState = null;
let onlineResult = false;
const GACHA_TYPES = Object.freeze([
  ['character', 'キャラクター', 50, 500],
  ['gear', '武器・防具', 30, 300],
  ['accessory', 'アクセサリー', 20, 200],
  ['skill', 'スキル', 50, 500],
]);

function pendingGacha() {
  try {
    const value = JSON.parse(localStorage.getItem(GACHA_PENDING_KEY) || 'null');
    return value && GACHA_TYPES.some(([key]) => key === value.category) &&
      [1, 10].includes(value.count) && typeof value.operationId === 'string' ? value : null;
  } catch { return null; }
}

function renderGachaState() {
  byId('gachaBalance').textContent = gachaState ? `${gachaState.balance} pt` : '未接続';
  const rates = gachaState?.rarityBasisPoints;
  byId('gachaRatesSummary').textContent = rates
    ? ['N', 'R', 'SR', 'SSR', 'UR', 'LR'].map((id) => `${id} ${rates[id] / 100}%`).join(' / ')
    : '排出率を確認中…';
  const pending = pendingGacha();
  byId('gachaRetryButton').hidden = !pending;
  document.querySelectorAll('.gacha-draw').forEach((button) => {
    const cost = gachaState?.gachaPrices?.[button.dataset.category]?.[button.dataset.count];
    if (Number.isSafeInteger(cost)) {
      button.dataset.cost = String(cost);
      button.textContent = `${button.dataset.count === '1' ? '1回' : '10連'} ${cost}pt`;
    }
    button.disabled = gachaBusy || !gachaApi || !gachaState || !!pending ||
      gachaState.balance < Number(button.dataset.cost);
  });
  const inventory = byId('gachaInventory');
  inventory.replaceChildren();
  for (const item of gachaState?.inventory || []) {
    const row = document.createElement('div');
    row.className = `gacha-item rarity-${item.rarity}`;
    row.textContent = `${item.rarity}　${item.name}　Lv.${item.level}`;
    inventory.appendChild(row);
  }
  if (!inventory.children.length) inventory.textContent = 'まだ獲得品はありません。';
}

async function loadGachaState() {
  if (!gachaApi) {
    byId('gachaStatus').textContent = '本人確認またはサーバー接続が完了していません。';
    renderGachaState();
    return;
  }
  byId('gachaStatus').textContent = '残高と獲得品を確認中…';
  try {
    gachaState = await gachaApi.state();
    const pending = pendingGacha();
    if (pending && gachaState.recent?.some((entry) => entry.operationId === pending.operationId)) {
      localStorage.removeItem(GACHA_PENDING_KEY);
      byId('gachaStatus').textContent = '直前の抽選は保存済みです。獲得品を確認してください。';
    } else {
      byId('gachaStatus').textContent = pending ? '直前の抽選を確認できます。' : '抽選の準備ができました。';
    }
  } catch (error) {
    console.warn('Throb gacha state unavailable:', error);
    gachaState = null;
    byId('gachaStatus').textContent = 'ガチャに接続できません。通信を確認して開き直してください。';
  }
  renderGachaState();
}

async function drawGacha(category, count, retry = false) {
  if (gachaBusy || !gachaApi) return;
  const existing = pendingGacha();
  if (existing && !retry) return;
  const operation = existing || { category, count, operationId: crypto.randomUUID() };
  if (!existing) {
    try { localStorage.setItem(GACHA_PENDING_KEY, JSON.stringify(operation)); }
    catch { byId('gachaStatus').textContent = '抽選の受付番号を保存できません。ブラウザの保存設定を確認してください。'; return; }
  }
  gachaBusy = true;
  renderGachaState();
  byId('gachaStatus').textContent = '抽選を確定して保存中…';
  try {
    const result = await gachaApi.draw(operation);
    localStorage.removeItem(GACHA_PENDING_KEY);
    const results = byId('gachaResults');
    results.replaceChildren();
    for (const item of result.results) {
      const card = document.createElement('div');
      card.className = `gacha-item rarity-${item.rarity}`;
      card.textContent = `${item.rarity}　${item.name}`;
      results.appendChild(card);
    }
    byId('gachaStatus').textContent = result.repeated ? '保存済みの抽選結果を再表示しました。' : `${result.results.length}件を獲得しました。`;
    gachaState = { ...(gachaState || {}), balance: result.balance,
      inventory: [...result.results.map((item) => ({ ...item, level: 1 })),
        ...(gachaState?.inventory || []).filter((item) => !result.results.some((newItem) => newItem.itemId === item.itemId))].slice(0, 100) };
    try { gachaState = await gachaApi.state(); }
    catch { byId('gachaStatus').textContent += ' 残高は保存済みですが、一覧の更新は次回開いたときに確認できます。'; }
  } catch (error) {
    console.warn('Throb gacha draw unavailable:', error);
    byId('gachaStatus').textContent = '抽選結果を確認できません。受付番号を保持しています。「確認・再試行」を押してください。';
  } finally {
    gachaBusy = false;
    renderGachaState();
  }
}

function createGachaButtons() {
  for (const [category, title, single, ten] of GACHA_TYPES) {
    const card = document.createElement('section');
    card.className = 'gacha-type';
    const name = document.createElement('strong');
    name.textContent = title;
    card.appendChild(name);
    for (const [count, cost] of [[1, single], [10, ten]]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'primary gacha-draw';
      button.dataset.cost = String(cost);
      button.dataset.category = category;
      button.dataset.count = String(count);
      button.textContent = `${count === 1 ? '1回' : '10連'} ${cost}pt`;
      button.disabled = true;
      button.addEventListener('click', () => void drawGacha(category, count));
      card.appendChild(button);
    }
    byId('gachaTypes').appendChild(card);
  }
}

function pendingShopPurchase() {
  try {
    const value = JSON.parse(localStorage.getItem(SHOP_PENDING_KEY) || 'null');
    return value && typeof value.offerId === 'string' && typeof value.operationId === 'string' ? value : null;
  } catch { return null; }
}

function renderShopState() {
  byId('shopBalance').textContent = gachaState ? `${gachaState.balance} pt` : '未接続';
  const pending = pendingShopPurchase();
  byId('shopRetryButton').hidden = !pending;
  const list = byId('shopOffers');
  list.replaceChildren();
  for (const offer of gachaState?.shopOffers || []) {
    const card = document.createElement('section');
    card.className = `shop-offer rarity-${offer.rarity}`;
    const name = document.createElement('strong');
    name.textContent = `${offer.rarity}　${offer.name}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'primary';
    button.textContent = `${offer.price}ptで購入`;
    button.disabled = shopBusy || !gachaApi || !!pending || gachaState.balance < offer.price;
    button.addEventListener('click', () => void buyShopItem(offer.offerId));
    card.append(name, button);
    list.appendChild(card);
  }
  if (!list.children.length) list.textContent = '商品を読み込めませんでした。';
}

async function loadShopState() {
  if (!gachaApi) {
    byId('shopStatus').textContent = '本人確認またはサーバー接続が完了していません。';
    renderShopState();
    return;
  }
  byId('shopStatus').textContent = '商品と残高を確認中…';
  try {
    gachaState = await gachaApi.state();
    const pending = pendingShopPurchase();
    if (pending && gachaState.recent?.some((entry) => entry.operationId === pending.operationId)) {
      localStorage.removeItem(SHOP_PENDING_KEY);
      byId('shopStatus').textContent = '直前の購入は保存済みです。倉庫を確認してください。';
    } else {
      byId('shopStatus').textContent = pending ? '直前の購入を確認できます。' : '商品を選んでください。';
    }
  } catch (error) {
    console.warn('Throb shop unavailable:', error);
    gachaState = null;
    byId('shopStatus').textContent = 'ショップに接続できません。通信を確認してください。';
  }
  renderShopState();
}

async function buyShopItem(offerId, retry = false) {
  if (shopBusy || !gachaApi) return;
  const existing = pendingShopPurchase();
  if (existing && !retry) return;
  const operation = existing || { offerId, operationId: crypto.randomUUID() };
  if (!existing) {
    try { localStorage.setItem(SHOP_PENDING_KEY, JSON.stringify(operation)); }
    catch { byId('shopStatus').textContent = '受付番号を保存できません。ブラウザの保存設定を確認してください。'; return; }
  }
  shopBusy = true;
  renderShopState();
  byId('shopStatus').textContent = '購入を確定して保存中…';
  try {
    const result = await gachaApi.buy(operation);
    localStorage.removeItem(SHOP_PENDING_KEY);
    const resultList = byId('shopResults');
    resultList.replaceChildren();
    for (const item of result.results) {
      const card = document.createElement('div');
      card.className = `gacha-item rarity-${item.rarity}`;
      card.textContent = `${item.rarity}　${item.name} を獲得`;
      resultList.appendChild(card);
    }
    byId('shopStatus').textContent = result.repeated ? '保存済みの購入結果を再表示しました。' : '購入したアイテムを倉庫に保存しました。';
    gachaState = { ...(gachaState || {}), balance: result.balance };
    try { gachaState = await gachaApi.state(); }
    catch { byId('shopStatus').textContent += ' 残高の一覧更新は次回開いたときに確認できます。'; }
  } catch (error) {
    console.warn('Throb shop purchase unavailable:', error);
    byId('shopStatus').textContent = '購入結果を確認できません。受付番号を保持しています。「確認・再試行」を押してください。';
  } finally {
    shopBusy = false;
    renderShopState();
  }
}

function renderCloudStatus(state, message) {
  byId('cloudStatus').textContent = message;
  byId('cloudStatus').dataset.state = state;
  byId('cloudActions').hidden = !['conflict', 'import'].includes(state);
  byId('chooseCloudButton').hidden = state === 'import';
  byId('chooseLocalButton').textContent = state === 'import' ? 'この端末の記録を移す' : 'この端末を使う';
}

function acceptCloudProfile(remote) {
  const local = JSON.stringify(profile);
  if (local !== JSON.stringify(createProfile()) && local !== JSON.stringify(remote)) {
    try { localStorage.setItem('throb:standalone-profile-backup:v1', local); }
    catch { renderCloudStatus('error', '端末のバックアップを保存できないため、切り替えませんでした。'); return false; }
  }
  if (!saveProfile(remote)) return false;
  profile = remote;
  recoveredProfile = false;
  renderMenu();
  const active = document.querySelector('.screen.active')?.id;
  if (active === 'characterScreen') renderCharacter();
  if (active === 'equipmentScreen') renderEquipment();
  if (active === 'upgradeScreen') renderUpgrade();
  if (active === 'inventoryScreen') renderInventory();
  return true;
}

async function initializeCloud() {
  const localStudentNumber = localStorage.getItem('studentNumber');
  if (!THROB_TEST_STUDENTS.includes(localStudentNumber) || localStorage.getItem('loggedIn') !== 'true') return;
  renderCloudStatus('loading', 'CareMateの認証を確認中…');
  try {
    const connection = window.__throbConnection;
    if (!connection) {
      renderCloudStatus('offline', '本人確認できません。記録はこの端末だけに保存します。');
      return;
    }
    gachaApi = connection.gacha;
    if (connection.learningPoints !== null) {
      const element = byId('careMatePoints');
      element.textContent = `学習ポイント ${connection.learningPoints}pt（表示のみ）`;
      element.hidden = false;
    }
    cloudSync = new PrototypeCloudSync({ adapter: connection.adapter, getLocal: () => profile,
      acceptRemote: acceptCloudProfile, onStatus: renderCloudStatus });
    await cloudSync.connect(connection.studentNumber);
  } catch (error) {
    console.warn('Throb cloud sync unavailable:', error);
    renderCloudStatus('offline', 'クラウドに接続できません。記録はこの端末に保存します。');
  }
}

function tryCloudInitialization() {
  if (cloudInitializationPending) return cloudInitializationPending;
  cloudInitializationPending = initializeCloud().finally(() => { cloudInitializationPending = null; });
  return cloudInitializationPending;
}

function persist(next) {
  if (!saveProfile(next)) {
    byId('menuLoadout').textContent = '保存できません。ブラウザの保存設定を確認してください。';
    return false;
  }
  profile = next;
  recoveredProfile = false;
  void cloudSync?.save(next);
  return true;
}

function renderMenu() {
  preview.weaponId = profile.equipped.weapons[0];
  const weapons = profile.equipped.weapons.map((id) => WEAPONS.find((item) => item.id === id)?.name || id);
  const selectedCharacter = gachaState?.inventory?.find((item) =>
    item.itemId === gachaState?.equippedItems?.character);
  byId('menuLoadout').textContent = recoveredProfile ? '古い保存データを読み込めず、初期状態で開始しました。'
    : `Lv.${profile.character.level} ・ ${selectedCharacter ? `${selectedCharacter.name} ・ ` : ''}${weapons.join(' / ')}`;
}

function renderCharacter() {
  const { character, record } = profile;
  const needed = PROGRESSION.xpForNextLevel(character.level);
  byId('characterLevel').textContent = `Lv.${character.level}`;
  byId('characterCap').textContent = `上限 Lv.${character.cap}`;
  byId('characterRecord').textContent = `${record.matches}試合・${record.wins}勝`;
  byId('characterXpBar').style.width = `${character.level >= character.cap ? 100 : Math.min(100, character.xp / needed * 100)}%`;
  byId('characterXpText').textContent = character.level >= character.cap
    ? `上限到達・保留中のEXP ${character.xp}` : `次のレベルまで ${Math.max(0, needed - character.xp)} EXP`;
  byId('characterPoints').textContent = `振り分け可能：${character.points}ポイント`;
  const grid = byId('statGrid');
  grid.replaceChildren();
  const stats = deriveStats(profile);
  const values = { hp: stats.maxHp, attack: stats.attack, defense: stats.defense,
    speed: stats.walkSpeed.toFixed(2), strength: `${Math.round((stats.throwPower - 1) * 100)}%` };
  for (const [key, definition] of Object.entries(PROGRESSION.stats)) {
    const row = document.createElement('div'); row.className = 'phase5-stat';
    const label = document.createElement('span');
    label.textContent = `${definition.label} ${values[key]}（+${character.allocated[key]}pt）`;
    const button = document.createElement('button'); button.type = 'button'; button.textContent = '＋';
    button.setAttribute('aria-label', `${definition.label}に1ポイント振る`);
    button.disabled = character.points < 1;
    button.addEventListener('click', () => { const next = allocateStat(profile, key); if (next && persist(next)) renderCharacter(); });
    row.append(label, button); grid.appendChild(row);
  }
}

function renderEquipment() {
  const grid = byId('equipmentGrid');
  grid.replaceChildren();
  const addSelect = (title, category, slot, options, selected) => {
    const label = document.createElement('label'); label.textContent = title;
    const select = document.createElement('select');
    for (const [id, name] of options) {
      const option = document.createElement('option'); option.value = id; option.textContent = name;
      select.appendChild(option);
    }
    select.value = selected ?? '';
    select.addEventListener('change', () => {
      const next = equip(profile, category, slot, select.value || null);
      if (next && persist(next)) { renderEquipment(); renderMenu(); }
      else select.value = selected ?? '';
    });
    label.appendChild(select); grid.appendChild(label);
  };
  const weapons = profile.inventory.weapons.map((id) => [id, WEAPONS.find((item) => item.id === id).name]);
  profile.equipped.weapons.forEach((id, slot) => addSelect(`武器 ${slot + 1}`, 'weapons', slot, weapons, id));
  for (const [slot, title] of [['head', '頭防具'], ['body', '胴防具']]) {
    const choices = [['', '装備しない'], ...profile.inventory.armor.filter((id) => ARMOR[id].slot === slot).map((id) => [id, ARMOR[id].name])];
    addSelect(title, 'armor', slot, choices, profile.equipped.armor[slot]);
  }
  const skills = profile.inventory.skills.map((id) => [id, `${SKILLS[id].name}：${SKILLS[id].description}`]);
  profile.equipped.skills.forEach((id, slot) => addSelect(`スキル ${slot + 1}（${slot ? 'E' : 'Q'}）`, 'skills', slot, skills, id));
  const upgradeLink = document.createElement('div'); upgradeLink.className = 'phase5-upgrade-link';
  const upgradeButton = document.createElement('button'); upgradeButton.type = 'button'; upgradeButton.className = 'ghost';
  upgradeButton.textContent = '武器を強化 ›';
  upgradeButton.addEventListener('click', () => show('upgradeScreen'));
  upgradeLink.appendChild(upgradeButton); grid.appendChild(upgradeLink);
  const stats = deriveStats(profile);
  byId('equipmentStats').textContent = `出撃時：HP ${stats.maxHp} ・ 防御 ${stats.defense} ・ 移動 ${stats.walkSpeed.toFixed(2)}`;
}

function renderUpgrade() {
  byId('trainingParts').textContent = `練習パーツ ${profile.inventory.trainingParts}個`;
  const grid = byId('upgradeGrid'); grid.replaceChildren();
  for (const id of profile.inventory.weapons) {
    const weapon = WEAPONS.find((item) => item.id === id);
    const level = profile.inventory.weaponLevels[id];
    const maxed = level >= PROGRESSION.weaponUpgrade.maxLevel;
    const cost = maxed ? 0 : PROGRESSION.weaponUpgrade.costForNext(level);
    const card = document.createElement('div'); card.className = 'phase5-upgrade-card';
    const name = document.createElement('strong'); name.textContent = `${weapon.name} Lv.${level}`;
    const damage = document.createElement('span');
    damage.textContent = `威力 ${weapon.damage + (level - 1) * PROGRESSION.weaponUpgrade.damagePerLevel}`;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'primary';
    button.textContent = maxed ? '最大強化' : `強化する（${cost}個）`;
    button.disabled = maxed || profile.inventory.trainingParts < cost;
    button.addEventListener('click', () => {
      const next = upgradeWeapon(profile, id);
      if (next && persist(next)) { renderUpgrade(); renderInventory(); }
    });
    card.append(name, damage, button); grid.appendChild(card);
  }
}

function renderInventory() {
  const groups = [
    ['武器', profile.inventory.weapons.map((id) => `${WEAPONS.find((item) => item.id === id).name} Lv.${profile.inventory.weaponLevels[id]}`)],
    ['防具', profile.inventory.armor.map((id) => ARMOR[id].name)],
    ['スキル', profile.inventory.skills.map((id) => `${SKILLS[id].name}（${SKILLS[id].description}）`)],
  ];
  const grid = byId('inventoryGrid'); grid.replaceChildren();
  byId('inventoryIntro').textContent = `練習パーツ ${profile.inventory.trainingParts}個 ・ 獲得品は各カテゴリ1個を選び、CPU戦に試作ボーナスが反映されます。`;
  for (const [title, items] of groups) {
    const section = document.createElement('section');
    const heading = document.createElement('h3'); heading.textContent = title;
    const list = document.createElement('ul');
    for (const name of items) { const item = document.createElement('li'); item.textContent = name; list.appendChild(item); }
    section.append(heading, list); grid.appendChild(section);
  }
}

function renderOnlineInventory() {
  const list = byId('inventoryOnline');
  list.replaceChildren();
  for (const item of gachaState?.inventory || []) {
    const row = document.createElement('div');
    row.className = `gacha-item rarity-${item.rarity}`;
    const name = document.createElement('strong');
    name.textContent = `${item.rarity}　${item.name}　Lv.${item.level}`;
    const selected = gachaState.equippedItems?.[item.category] === item.itemId;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghost';
    button.textContent = selected ? '選択を外す' : '選択する';
    button.disabled = onlineEquipBusy;
    button.addEventListener('click', () => void equipOnlineItem(item.itemId, !selected));
    row.append(name, button);
    list.appendChild(row);
  }
  if (!list.children.length) list.textContent = 'まだ獲得品はありません。';
}

async function loadOnlineInventory() {
  const list = byId('inventoryOnline');
  list.textContent = '獲得品を確認中…';
  if (!gachaApi) { list.textContent = '本人確認またはサーバー接続が完了していません。'; return; }
  try {
    gachaState = await gachaApi.state();
    renderOnlineInventory();
    byId('inventoryOnlineStatus').textContent = '選択はクラウドに保存されます。キャラはHP、武器・防具は投擲威力、アクセサリーは速度、スキルは再使用時間に反映。';
  } catch (error) {
    console.warn('Throb online inventory unavailable:', error);
    list.textContent = '獲得品を読み込めませんでした。';
  }
}

async function equipOnlineItem(itemId, equip) {
  if (onlineEquipBusy || !gachaApi) return;
  onlineEquipBusy = true;
  renderOnlineInventory();
  byId('inventoryOnlineStatus').textContent = '選択を保存中…';
  try {
    await gachaApi.equip({ itemId, equip });
    gachaState = await gachaApi.state();
    renderOnlineInventory();
    byId('inventoryOnlineStatus').textContent = equip ? '選択を保存しました。次のCPU戦から反映されます。' : '選択を外しました。';
  } catch (error) {
    console.warn('Throb item equip unavailable:', error);
    byId('inventoryOnlineStatus').textContent = '保存結果を確認できません。画面を開き直して確認してください。';
  } finally {
    onlineEquipBusy = false;
    renderOnlineInventory();
  }
}

function show(name) {
  const previous = document.querySelector('.screen.active')?.id;
  if (previous === 'lobbyScreen' && !['lobbyScreen', 'battleScreen', 'resultScreen'].includes(name)) {
    realtimeLobby?.send('leave-room');
    realtimeLobby?.disconnect();
    realtimeRoom = null;
    realtimeParticipantId = null;
  }
  for (const screen of Object.values(screens)) screen.classList.toggle('active', screen.id === name);
  if (name === 'menuScreen') { renderMenu(); preview.start().catch(showFatal); }
  else preview.stop();
  if (name === 'characterScreen') renderCharacter();
  if (name === 'equipmentScreen') renderEquipment();
  if (name === 'upgradeScreen') renderUpgrade();
  if (name === 'inventoryScreen') { renderInventory(); void loadOnlineInventory(); }
  if (name === 'gachaScreen') void loadGachaState();
  if (name === 'shopScreen') void loadShopState();
  if (name === 'lobbyScreen') void openRealtimeLobby();
}

function renderRealtimeRoom() {
  byId('lobbyRoom').hidden = !realtimeRoom;
  byId('lobbyActions').hidden = Boolean(realtimeRoom);
  if (!realtimeRoom) return;
  byId('lobbyCode').textContent = `ルーム番号 ${realtimeRoom.code}`;
  byId('lobbyCount').textContent = `${realtimeRoom.players.length} / ${realtimeRoom.maxPlayers}人`;
  const list = byId('lobbyPlayers');
  list.replaceChildren();
  for (const player of realtimeRoom.players) {
    const item = document.createElement('li');
    item.textContent = `${player.name}${player.id === realtimeRoom.hostId ? '（ホスト）' : ''} ・ ${player.connected === false ? '再接続待ち' : player.ready ? '準備完了' : '待機中'}`;
    list.appendChild(item);
  }
  const ownReady = realtimeRoom.players.find((player) => player.id === realtimeParticipantId)?.ready === true;
  byId('lobbyReadyButton').textContent = ownReady ? '準備を取り消す' : '準備完了';
  byId('lobbyReadyButton').dataset.ready = String(ownReady);
  byId('lobbyStartButton').hidden = realtimeRoom.hostId !== realtimeParticipantId;
  byId('lobbyStartButton').disabled = realtimeRoom.status !== 'waiting' ||
    realtimeRoom.players.length < 2 || !realtimeRoom.players.every((player) => player.ready && player.connected !== false);
}

async function startOnlineBattle() {
  if (onlineBattle || onlineBattleLoading || !pendingBattleState || !realtimeParticipantId) return;
  onlineBattleLoading = true;
  onlineResult = false;
  game?.destroy(); game = null;
  preview.stop();
  show('battleScreen');
  byId('battleScreen').classList.add('online-battle');
  byId('battleNotice').textContent = 'オンライン対戦を準備中…';
  byId('pauseOverlay').hidden = true;
  try {
    const battle = new OnlineBattleApp({ container: byId('game'), participantId: realtimeParticipantId,
      sendInput: (input) => realtimeLobby?.send('battle-input', { input }), onNotice: notice });
    onlineBattle = battle;
    await battle.start();
    if (onlineBattle !== battle) { battle.destroy(); return; }
    if (pendingBattleState) battle.receive(pendingBattleState);
    notice('相手に狙いを定めて投げよう！');
  } catch (error) {
    console.error('Throb online battle failed:', error);
    onlineBattle?.destroy(); onlineBattle = null;
    realtimeLobby?.send('leave-room');
    byId('battleScreen').classList.remove('online-battle');
    show('lobbyScreen');
    byId('lobbyStatus').textContent = '対戦画面を読み込めませんでした。もう一度お試しください。';
  } finally { onlineBattleLoading = false; }
}

function showOnlineResult(result) {
  if (!result?.players?.some((player) => player.id === realtimeParticipantId)) return;
  onlineBattle?.destroy(); onlineBattle = null;
  pendingBattleState = null;
  onlineResult = true;
  byId('battleScreen').classList.remove('online-battle');
  byId('pauseOverlay').hidden = true;
  const own = result.players.find((player) => player.id === realtimeParticipantId);
  const ranked = rankedMatchPlayers(result);
  const ownResult = ranked.find((player) => player.id === realtimeParticipantId);
  byId('resultTitle').textContent = ownResult?.outcome === '勝利' ? 'WIN'
    : ownResult?.outcome === '引き分け' ? 'DRAW' : 'LOSE';
  const reason = result.reason === 'disconnected' ? '通信の終了で決着しました'
    : result.reason === 'timeup' ? '制限時間で決着しました' : '残機で勝負が決まりました';
  byId('resultReason').textContent = `全${ranked.length}人中${ownResult?.rank || '-'}位 ・ ${reason}`;
  byId('resultKills').textContent = String(own?.kills || 0);
  byId('resultDamage').textContent = String(own?.damage || 0);
  byId('resultLives').textContent = String(own?.lives || 0);
  const board = byId('onlineResultPlayers');
  board.replaceChildren();
  for (const player of ranked) {
    const row = document.createElement('div');
    row.className = `online-result-row${player.id === realtimeParticipantId ? ' is-self' : ''}`;
    const name = document.createElement('strong');
    name.textContent = `${player.rank}位 ${player.name}`;
    const record = document.createElement('span');
    record.textContent = `${player.outcome} ・ 撃破${player.kills} ・ 残機${player.lives}`;
    row.append(name, record);
    board.appendChild(row);
  }
  byId('onlineResultBoard').hidden = false;
  byId('resultScreen').classList.add('online-result');
  byId('resultReward').textContent = '2510044限定の通信テスト：公式EXP・ポイント・戦績は付与しません';
  byId('rematchButton').textContent = '待機室へ戻る';
  show('resultScreen');
}

function onRealtimeMessage(message) {
  if (message.type === 'authenticated') {
    if (onlineBattle && message.resumed !== true) {
      onlineBattle.destroy(); onlineBattle = null;
      pendingBattleState = null;
      byId('battleScreen').classList.remove('online-battle');
      show('lobbyScreen');
      byId('lobbyStatus').textContent = '以前の試合は終了しました。新しいルームを作成してください。';
    }
    realtimeParticipantId = message.participantId;
  } else if (message.type === 'room') {
    realtimeRoom = message.room;
    renderRealtimeRoom();
    byId('lobbyStatus').textContent = realtimeRoom.status === 'playing'
      ? '対戦を準備しています…' : 'ルームに接続中。ほかの参加者を待っています。';
  } else if (message.type === 'battle-state') {
    pendingBattleState = message.state;
    if (onlineBattle) onlineBattle.receive(message.state);
    else void startOnlineBattle();
  } else if (message.type === 'battle-result') {
    showOnlineResult(message.result);
  } else if (message.type === 'left-room' || message.type === 'room-expired') {
    realtimeRoom = null;
    renderRealtimeRoom();
    byId('lobbyStatus').textContent = message.type === 'room-expired'
      ? '待機室の時間が終了しました。もう一度作成してください。' : 'ルームから退出しました。';
  } else if (message.type === 'error') {
    const errors = {
      'room-unavailable': 'ルームが見つかりません。番号を確認してください。',
      'room-full': 'このルームは満員です。',
      'already-in-room': 'この端末はすでにルームへ参加しています。',
      'invalid-code': '6桁のルーム番号を入力してください。',
      'not-all-ready': '2人以上が参加し、全員が準備完了になると開始できます。',
      'host-only': '対戦を開始できるのはホストだけです。',
      'battle-in-progress': '対戦中です。終了してから操作してください。',
    };
    byId('lobbyStatus').textContent = errors[message.reason] || '操作できませんでした。もう一度お試しください。';
  }
}

async function openRealtimeLobby() {
  const connection = window.__throbConnection;
  if (!connection?.getIdToken) {
    byId('lobbyStatus').textContent = 'CareMateの本人確認が必要です。ログインし直してください。';
    return;
  }
  if (!realtimeLobby) {
    realtimeLobby = new RealtimeLobbyClient({ tokenProvider: connection.getIdToken,
      onMessage: onRealtimeMessage,
      onStatus: (state) => {
        const connected = state === 'connected';
        byId('createRoomButton').disabled = !connected;
        byId('joinRoomButton').disabled = !connected;
        if (state === 'reconnecting') {
          onlineBattle?.setConnected(false);
          if (onlineBattle) {
            clearTimeout(noticeTimer);
            byId('battleNotice').textContent = '通信を復旧中… 操作を一時停止しています';
          } else if (document.querySelector('.screen.active')?.id === 'lobbyScreen')
            byId('lobbyStatus').textContent = '通信を復旧中… 最大60秒間、自動で再接続します。';
        }
        if (connected && onlineBattle) {
          onlineBattle.setConnected(true);
          notice('通信を復旧しました');
        }
        if (state === 'disconnected') {
          if (onlineBattle) {
            onlineBattle.destroy(); onlineBattle = null;
            byId('battleScreen').classList.remove('online-battle');
            show('lobbyScreen');
          }
          realtimeRoom = null;
          realtimeParticipantId = null;
          renderRealtimeRoom();
          if (document.querySelector('.screen.active')?.id === 'lobbyScreen')
            byId('lobbyStatus').textContent = '通信が切れました。再接続するには待機室を開き直してください。';
        }
      } });
  }
  byId('lobbyStatus').textContent = '待機室に接続中…無料サーバーの起動には1分ほどかかる場合があります。';
  try {
    await realtimeLobby.connect();
    if (document.querySelector('.screen.active')?.id === 'lobbyScreen')
      byId('lobbyStatus').textContent = realtimeRoom ? 'ルームに接続中。' : '接続しました。ルームを作成できます。';
  } catch (error) {
    console.warn('Throb realtime lobby unavailable:', error);
    byId('lobbyStatus').textContent = '待機室へ接続できません。時間をおいて開き直してください。';
  }
}

function applyVisualAssets() {
  const image = (path, apply) => {
    if (!path) return;
    const probe = new Image();
    probe.onload = () => apply(path);
    probe.onerror = () => console.warn('Throb image fallback:', path);
    probe.src = path;
  };
  image(ASSETS.ui.backgrounds.title, (path) => { byId('titleScreen').style.backgroundImage = `url("${path}")`; });
  image(ASSETS.ui.backgrounds.menu, (path) => { byId('menuScreen').style.backgroundImage = `url("${path}")`; });
  image(ASSETS.ui.logo, (path) => {
    const logo = document.createElement('img');
    logo.src = path;
    logo.alt = 'Throb';
    logo.className = 'custom-title-logo';
    logo.style.cssText = 'display:block;width:min(70vw,520px);height:min(24vh,180px);object-fit:contain;margin:.2rem auto';
    byId('titleScreen').querySelector('h1').replaceWith(logo);
  });
  image(ASSETS.ui.buttons.primary, (path) => {
    document.querySelectorAll('.primary').forEach((button) => {
      button.style.backgroundImage = `url("${path}")`;
      button.style.backgroundSize = 'cover';
    });
  });
}

function showFatal(error) {
  console.error('Throb startup failed:', error);
  byId('loadStatus').textContent = '3D表示を開始できませんでした。ブラウザを更新して再度お試しください。';
  byId('startButton').disabled = true;
  show('titleScreen');
}

function notice(message) {
  const element = byId('battleNotice');
  element.textContent = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { if (element.textContent === message) element.textContent = ''; }, 3000);
}

function openMenu() {
  game?.destroy();
  game = null;
  onlineBattle?.destroy(); onlineBattle = null;
  if (realtimeLobby?.connected) { realtimeLobby.send('leave-room'); realtimeLobby.disconnect(); }
  onlineResult = false;
  byId('battleScreen').classList.remove('online-battle');
  byId('pauseOverlay').hidden = true;
  show('menuScreen');
}

function recordResult(result) {
  if (!currentMatchId) return;
  const reward = applyBattleResult(profile, result, currentMatchId);
  if (reward.duplicate) return;
  if (persist(reward.profile)) currentReward = reward;
  else currentReward = { xp: 0, levels: 0, saveFailed: true };
}

function showResult(result) {
  recordResult(result);
  game?.destroy();
  game = null;
  byId('onlineResultBoard').hidden = true;
  byId('resultScreen').classList.remove('online-result');
  byId('pauseOverlay').hidden = true;
  byId('resultTitle').textContent = result.winner === 'player' ? 'WIN' : result.winner === 'cpu' ? 'LOSE' : 'DRAW';
  byId('resultReason').textContent = result.reason === 'left' ? '対戦を終了しました' : result.reason === 'timeup' ? '制限時間で決着' : result.reason === 'sudden-death-timeout' ? 'サドンデスも引き分け' : result.winner === 'player' ? 'CPUに勝利しました！' : 'CPUに敗れました';
  byId('resultKills').textContent = String(result.player.kills);
  byId('resultDamage').textContent = String(result.player.damage);
  byId('resultLives').textContent = String(result.player.lives);
  byId('resultReward').textContent = currentReward?.saveFailed ? '記録を保存できませんでした'
    : `獲得EXP +${currentReward?.xp || 0} ・ 練習パーツ +${currentReward?.parts || 0}${currentReward?.levels ? ` ・ ${currentReward.levels}レベルアップ！` : ''}`;
  show('resultScreen');
}

async function startBattle() {
  onlineResult = false;
  byId('rematchButton').textContent = 'もう一度';
  document.querySelector('#battleHud .enemy strong').textContent = 'CPU';
  preview.stop();
  game?.destroy();
  game = null;
  currentMatchId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  currentReward = null;
  lastSettings = { difficulty: byId('difficultySelect').value, rule: byId('ruleSelect').value };
  byId('beginBattleButton').disabled = true;
  byId('beginBattleButton').textContent = 'ステージを読み込み中…';
  if (gachaApi) {
    try { gachaState = await gachaApi.state(); }
    catch (error) { console.warn('Throb pilot bonus unavailable; using base stats:', error); gachaState = null; }
  }
  show('battleScreen');
  byId('battleNotice').textContent = 'ステージを読み込み中…';
  try {
    game = new GameApp({ container: byId('game'), settings: lastSettings,
      loadout: battleLoadout(profile, pilotBonuses(gachaState)),
      onMatchFinished: recordResult, onResult: showResult,
      onPause: (paused) => { byId('pauseOverlay').hidden = !paused; }, onNotice: notice,
      onSound: (name) => audio.play(name) });
    await game.start();
  } catch (error) {
    game?.destroy();
    game = null;
    console.error('Throb battle failed:', error);
    show('setupScreen');
    byId('beginBattleButton').textContent = '読み込み失敗・再試行';
  } finally {
    byId('beginBattleButton').disabled = false;
    if (byId('beginBattleButton').textContent !== '読み込み失敗・再試行') byId('beginBattleButton').textContent = 'CPU戦を始める';
  }
}

const menuScreens = { キャラクター: 'characterScreen', 武器: 'equipmentScreen', 倉庫: 'inventoryScreen', ガチャ: 'gachaScreen', ショップ: 'shopScreen' };
for (const [name, description] of MENU_ITEMS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.disabled = !menuScreens[name];
  button.setAttribute('aria-label', menuScreens[name] ? name : `${name}・開発中`);
  const heading = document.createElement('strong');
  heading.textContent = name;
  const hint = document.createElement('span');
  hint.textContent = `${menuScreens[name] ? '' : '開発中・'}${description}`;
  button.append(heading, hint);
  if (menuScreens[name]) button.addEventListener('click', () => show(menuScreens[name]));
  byId('menuGrid').appendChild(button);
}
document.querySelectorAll('.phase5-back').forEach((button) => button.addEventListener('click', openMenu));
byId('gachaBackButton').addEventListener('click', openMenu);
byId('shopBackButton').addEventListener('click', openMenu);
byId('shopRetryButton').addEventListener('click', () => {
  const pending = pendingShopPurchase();
  if (pending) void buyShopItem(pending.offerId, true);
});
byId('gachaRetryButton').addEventListener('click', () => {
  const pending = pendingGacha();
  if (pending) void drawGacha(pending.category, pending.count, true);
});
createGachaButtons();
byId('upgradeBackButton').addEventListener('click', () => show('equipmentScreen'));
byId('chooseCloudButton').addEventListener('click', async () => {
  if (window.confirm('この端末の記録をバックアップして、クラウドの記録に切り替えますか？')) await cloudSync?.chooseRemote();
});
byId('chooseLocalButton').addEventListener('click', async () => {
  const question = cloudSync?.state === 'import'
    ? 'この端末の旧試作記録が本人のものなら、クラウドへ移しますか？'
    : 'クラウド側の記録を、この端末の記録で上書きしますか？';
  if (window.confirm(question)) await cloudSync?.chooseLocal();
});

byId('startButton').addEventListener('click', () => {
  audio.playBgm();
  if (!localStorage.getItem('throb:tutorialSeen:v1')) {
    tutorialReturn = 'menuScreen';
    show('tutorialScreen');
  } else show('menuScreen');
});
const finishTutorial = () => { localStorage.setItem('throb:tutorialSeen:v1', '1'); show(tutorialReturn); };
byId('skipTutorial').addEventListener('click', finishTutorial);
byId('finishTutorial').addEventListener('click', finishTutorial);
byId('menuHelpButton').addEventListener('click', () => { tutorialReturn = 'menuScreen'; show('tutorialScreen'); });
byId('battleMenuButton').addEventListener('click', () => show('setupScreen'));
byId('setupBackButton').addEventListener('click', () => show('menuScreen'));
byId('openLobbyButton').addEventListener('click', () => show('lobbyScreen'));
byId('lobbyBackButton').addEventListener('click', () => show('setupScreen'));
byId('createRoomButton').addEventListener('click', () => realtimeLobby?.send('create-room'));
byId('joinRoomButton').addEventListener('click', () => {
  const code = byId('joinRoomCode').value.trim();
  if (!/^\d{6}$/.test(code)) { byId('lobbyStatus').textContent = '6桁のルーム番号を入力してください。'; return; }
  realtimeLobby?.send('join-room', { code });
});
byId('lobbyReadyButton').addEventListener('click', () =>
  realtimeLobby?.send('ready', { ready: byId('lobbyReadyButton').dataset.ready !== 'true' }));
byId('lobbyStartButton').addEventListener('click', () => realtimeLobby?.send('start-match'));
byId('lobbyLeaveButton').addEventListener('click', () => realtimeLobby?.send('leave-room'));
byId('beginBattleButton').addEventListener('click', startBattle);
byId('pauseButton').addEventListener('click', () => {
  if (onlineBattle) {
    byId('pauseOverlay').querySelector('p').textContent = 'オンライン対戦は一時停止できません。退出すると敗北扱いになります。';
    byId('pauseOverlay').hidden = false;
  } else game?.setPaused(!game.paused);
});
byId('resumeButton').addEventListener('click', () => { if (onlineBattle) byId('pauseOverlay').hidden = true; else game?.setPaused(false); });
byId('leaveBattleButton').addEventListener('click', () => { if (onlineBattle) realtimeLobby?.send('leave-room'); else game?.leave(); });
byId('rematchButton').addEventListener('click', () => {
  if (onlineResult) { onlineResult = false; show('lobbyScreen'); return; }
  byId('difficultySelect').value = lastSettings.difficulty; byId('ruleSelect').value = lastSettings.rule; startBattle();
});
byId('resultMenuButton').addEventListener('click', openMenu);

byId('startButton').disabled = false;
byId('startButton').textContent = 'タップしてスタート';
byId('loadStatus').textContent = '準備完了';
window.__throbReady = true;
applyVisualAssets();
void tryCloudInitialization();
window.addEventListener('online', () => {
  if (!cloudSync || ['offline', 'unavailable'].includes(cloudSync.state)) void tryCloudInitialization();
});
window.addEventListener('pagehide', () => { preview.stop(); game?.destroy(); realtimeLobby?.disconnect(); audio.stop(); }, { once: true });
