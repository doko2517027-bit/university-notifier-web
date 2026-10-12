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
    const { connectCareMate } = await import('./integrations/caremate.js');
    const connection = await connectCareMate();
    if (!connection) {
      renderCloudStatus('offline', '本人確認できません。記録はこの端末だけに保存します。');
      return;
    }
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
  byId('inventoryIntro').textContent = `練習パーツ ${profile.inventory.trainingParts}個 ・ ガチャ・ショップによる追加は後の段階で実装します。`;
  for (const [title, items] of groups) {
    const section = document.createElement('section');
    const heading = document.createElement('h3'); heading.textContent = title;
    const list = document.createElement('ul');
    for (const name of items) { const item = document.createElement('li'); item.textContent = name; list.appendChild(item); }
    section.append(heading, list); grid.appendChild(section);
  }
}

function show(name) {
  for (const screen of Object.values(screens)) screen.classList.toggle('active', screen.id === name);
  if (name === 'menuScreen') { renderMenu(); preview.start().catch(showFatal); }
  else preview.stop();
  if (name === 'characterScreen') renderCharacter();
  if (name === 'equipmentScreen') renderEquipment();
  if (name === 'upgradeScreen') renderUpgrade();
  if (name === 'inventoryScreen') renderInventory();
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

const menuScreens = { キャラクター: 'characterScreen', 武器: 'equipmentScreen', 倉庫: 'inventoryScreen' };
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
