import { ASSETS, MENU_ITEMS, WEAPONS } from './data/config.js';
import { ARMOR, PROGRESSION, SKILLS } from './data/progression.js';
import { createProfile, loadProfile, saveProfile, deriveStats, battleLoadout, allocateStat, equip, upgradeWeapon, applyBattleResult } from './services/profile.js';
import { PrototypeCloudSync, THROB_TEST_STUDENTS } from './services/cloudSync.js';
import { GameApp } from './game/GameApp.js';
import { MenuPreview } from './screens/MenuPreview.js';
import { AudioManager } from './audio/AudioManager.js';

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
  const pending = pendingGacha();
  byId('gachaRetryButton').hidden = !pending;
  document.querySelectorAll('.gacha-draw').forEach((button) => {
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
  byId('menuLoadout').textContent = recoveredProfile ? '古い保存データを読み込めず、初期状態で開始しました。'
    : `Lv.${profile.character.level} ・ ${weapons.join(' / ')}`;
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
  byId('inventoryIntro').textContent = `練習パーツ ${profile.inventory.trainingParts}個 ・ テスト用獲得品の装備・出撃反映は開発中です。`;
  for (const [title, items] of groups) {
    const section = document.createElement('section');
    const heading = document.createElement('h3'); heading.textContent = title;
    const list = document.createElement('ul');
    for (const name of items) { const item = document.createElement('li'); item.textContent = name; list.appendChild(item); }
    section.append(heading, list); grid.appendChild(section);
  }
}

async function loadOnlineInventory() {
  const list = byId('inventoryOnline');
  list.textContent = '獲得品を確認中…';
  if (!gachaApi) { list.textContent = '本人確認またはサーバー接続が完了していません。'; return; }
  try {
    gachaState = await gachaApi.state();
    list.replaceChildren();
    for (const item of gachaState.inventory || []) {
      const row = document.createElement('div');
      row.className = `gacha-item rarity-${item.rarity}`;
      row.textContent = `${item.rarity}　${item.name}　Lv.${item.level}`;
      list.appendChild(row);
    }
    if (!list.children.length) list.textContent = 'まだ獲得品はありません。';
  } catch (error) {
    console.warn('Throb online inventory unavailable:', error);
    list.textContent = '獲得品を読み込めませんでした。';
  }
}

function show(name) {
  for (const screen of Object.values(screens)) screen.classList.toggle('active', screen.id === name);
  if (name === 'menuScreen') { renderMenu(); preview.start().catch(showFatal); }
  else preview.stop();
  if (name === 'characterScreen') renderCharacter();
  if (name === 'equipmentScreen') renderEquipment();
  if (name === 'upgradeScreen') renderUpgrade();
  if (name === 'inventoryScreen') { renderInventory(); void loadOnlineInventory(); }
  if (name === 'gachaScreen') void loadGachaState();
  if (name === 'shopScreen') void loadShopState();
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
  preview.stop();
  game?.destroy();
  game = null;
  currentMatchId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  currentReward = null;
  lastSettings = { difficulty: byId('difficultySelect').value, rule: byId('ruleSelect').value };
  byId('beginBattleButton').disabled = true;
  byId('beginBattleButton').textContent = 'ステージを読み込み中…';
  show('battleScreen');
  byId('battleNotice').textContent = 'ステージを読み込み中…';
  try {
    game = new GameApp({ container: byId('game'), settings: lastSettings, loadout: battleLoadout(profile),
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
byId('beginBattleButton').addEventListener('click', startBattle);
byId('pauseButton').addEventListener('click', () => game?.setPaused(!game.paused));
byId('resumeButton').addEventListener('click', () => game?.setPaused(false));
byId('leaveBattleButton').addEventListener('click', () => game?.leave());
byId('rematchButton').addEventListener('click', () => { byId('difficultySelect').value = lastSettings.difficulty; byId('ruleSelect').value = lastSettings.rule; startBattle(); });
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
window.addEventListener('pagehide', () => { preview.stop(); game?.destroy(); audio.stop(); }, { once: true });
