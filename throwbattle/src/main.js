import { ASSETS, MENU_ITEMS } from './data/config.js';
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

function show(name) {
  for (const screen of Object.values(screens)) screen.classList.toggle('active', screen.id === name);
  if (name === 'menuScreen') preview.start().catch(showFatal);
  else preview.stop();
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

function showResult(result) {
  game?.destroy();
  game = null;
  byId('pauseOverlay').hidden = true;
  byId('resultTitle').textContent = result.winner === 'player' ? 'WIN' : result.winner === 'cpu' ? 'LOSE' : 'DRAW';
  byId('resultReason').textContent = result.reason === 'left' ? '対戦を終了しました' : result.reason === 'timeup' ? '制限時間で決着' : result.reason === 'sudden-death-timeout' ? 'サドンデスも引き分け' : result.winner === 'player' ? 'CPUに勝利しました！' : 'CPUに敗れました';
  byId('resultKills').textContent = String(result.player.kills);
  byId('resultDamage').textContent = String(result.player.damage);
  byId('resultLives').textContent = String(result.player.lives);
  show('resultScreen');
}

async function startBattle() {
  preview.stop();
  game?.destroy();
  game = null;
  lastSettings = { difficulty: byId('difficultySelect').value, rule: byId('ruleSelect').value };
  byId('beginBattleButton').disabled = true;
  byId('beginBattleButton').textContent = 'ステージを読み込み中…';
  show('battleScreen');
  byId('battleNotice').textContent = 'ステージを読み込み中…';
  try {
    game = new GameApp({ container: byId('game'), settings: lastSettings, onResult: showResult,
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

for (const [name, description] of MENU_ITEMS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.disabled = true;
  button.setAttribute('aria-label', `${name}・開発中`);
  const heading = document.createElement('strong');
  heading.textContent = name;
  const hint = document.createElement('span');
  hint.textContent = `開発中・${description}`;
  button.append(heading, hint);
  byId('menuGrid').appendChild(button);
}

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
window.addEventListener('pagehide', () => { preview.stop(); game?.destroy(); audio.stop(); }, { once: true });
