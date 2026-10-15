import { loadSystemFighter } from './data.js';
import { Match } from './core/Match.js';
import { CanvasRenderer } from './rendering/CanvasRenderer.js';
import { InputManager } from './input/InputManager.js';

const $ = (id) => document.getElementById(id);
const screens = ['titleScreen', 'menuScreen', 'battleScreen', 'resultScreen'];
let systemFighter = null;
let difficulty = 'normal';
let match = null;
let renderer = null;
let input = null;
let frameId = 0;
let lastTime = 0;
let messageUntil = 0;
let resultAt = 0;

function showScreen(id) {
  for (const screen of screens) $(screen).hidden = screen !== id;
  $('orientationNotice').hidden = id !== 'battleScreen' || !needsLandscape();
}

function needsLandscape() {
  return matchMedia('(pointer: coarse) and (orientation: portrait)').matches;
}

function notify(message, seconds = 1.5) {
  $('battleMessage').textContent = message;
  messageUntil = performance.now() + seconds * 1000;
}

function openModal(html) {
  $('modalBody').innerHTML = html;
  $('modal').hidden = false;
}

function closeModal() { $('modal').hidden = true; }

function showSetup() {
  openModal('<h2>CPU対戦の設定</h2><p>キャラクター画像を使わない操作試験です。HPが0、または場外に落ちると1ストック失います。残りがあれば10秒後に復活します。</p><label>CPUの強さ<select id="difficultySelect"><option value="easy">Easy｜はじめて</option><option value="normal" selected>Normal｜標準</option><option value="hard">Hard｜上級</option></select></label><button id="startBattleButton" class="primary-button">対戦を始める</button>');
  $('difficultySelect').value = difficulty;
  $('startBattleButton').addEventListener('click', () => {
    difficulty = $('difficultySelect').value;
    closeModal(); startBattle();
  });
}

function startBattle() {
  cancelAnimationFrame(frameId);
  resultAt = 0;
  match = new Match({ character: systemFighter, difficulty });
  renderer ||= new CanvasRenderer($('gameCanvas'));
  renderer.preload([systemFighter]);
  input ||= new InputManager($('battleScreen'));
  input.reset();
  $('pauseOverlay').hidden = true;
  showScreen('battleScreen');
  notify('READY?  投げて勝ち残れ！', 1.9);
  lastTime = performance.now();
  frameId = requestAnimationFrame(loop);
}

function loop(now) {
  if (!match || $('battleScreen').hidden) return;
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  const snapshot = input.snapshot();
  if (snapshot.pause) togglePause();
  if (!match.paused && !needsLandscape()) match.tick(dt, snapshot);
  for (const event of match.consumeEvents()) {
    if (event.type === 'hit') renderer.shake = Math.max(renderer.shake, 10);
    if (event.type === 'death') notify(event.id === 'player' ? 'ダウン！' : 'CPUをダウン！', 1.4);
    if (event.type === 'respawn') notify(event.id === 'player' ? '復活！ 3秒間無敵' : 'CPUが復活', 1.4);
    if (event.type === 'finish') { resultAt = now + 650; notify(event.winner === 'player' ? 'WIN!' : '試合終了', 0.6); }
  }
  renderer.draw(match, dt);
  updateHud();
  if (messageUntil && now > messageUntil) { $('battleMessage').textContent = ''; messageUntil = 0; }
  if (resultAt && now >= resultAt) { showResult(); return; }
  frameId = requestAnimationFrame(loop);
}

function updateHud() {
  for (const fighter of match.fighters) {
    $(fighter.id + 'Hp').style.width = `${100 * fighter.hp / fighter.maxHp}%`;
    $(fighter.id + 'Stocks').textContent = '●'.repeat(Math.max(0, fighter.stocks)) + '○'.repeat(3 - Math.max(0, fighter.stocks));
  }
  const seconds = Math.ceil(match.remaining);
  $('matchTimer').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  $('skillHud').textContent = match.player.boostLeft > 0 ? `投擲強化中 ${match.player.boostLeft.toFixed(1)} 秒` : match.player.skillLeft > 0 ? `強化：あと ${match.player.skillLeft.toFixed(1)} 秒` : '強化：使用可能';
}

function togglePause(force = null) {
  if (!match || match.finished) return;
  match.paused = force === null ? !match.paused : force;
  $('pauseOverlay').hidden = !match.paused;
  if (match.paused) input.reset();
  lastTime = performance.now();
}

function showResult() {
  cancelAnimationFrame(frameId);
  $('resultTitle').textContent = match.winner === 'player' ? 'WIN' : match.winner === 'cpu' ? 'LOSE' : 'DRAW';
  $('resultReason').textContent = match.finishReason === 'time' ? '時間切れ' : match.finishReason === 'pit' ? '場外落下で決着' : '相手のストックがなくなりました';
  $('resultKills').textContent = String(match.player.kills);
  $('resultDamage').textContent = String(match.player.damageDone);
  showScreen('resultScreen');
}

function returnMenu() {
  cancelAnimationFrame(frameId); resultAt = 0; match = null; input?.reset();
  showScreen('menuScreen');
}

async function boot() {
  try {
    systemFighter = await loadSystemFighter();
  } catch (error) {
    $('titleStart').disabled = true;
    $('titleStart').textContent = '読み込みに失敗しました';
    $('titleStart').title = error.message;
    return;
  }
  $('titleStart').addEventListener('click', () => showScreen('menuScreen'));
  $('battleSetup').addEventListener('click', showSetup);
  $('settingsMenu').addEventListener('click', () => openModal('<h2>操作方法</h2><p>PC：A / D で移動、Space でジャンプ、J で投げる、K で投擲強化、L で回避、Esc で一時停止。</p><p>スマホ：横向きにして、左スティックと右のボタンを同時に操作できます。</p><p>画面には操作マーカーだけを表示します。正式キャラクター・オンライン対戦・音声は未実装です。</p>'));
  $('closeModal').addEventListener('click', closeModal);
  $('modal').addEventListener('pointerdown', (event) => { if (event.target === $('modal')) closeModal(); });
  $('pauseButton').addEventListener('click', () => togglePause());
  $('resumeButton').addEventListener('click', () => togglePause(false));
  $('quitButton').addEventListener('click', returnMenu);
  $('retryButton').addEventListener('click', startBattle);
  $('resultMenuButton').addEventListener('click', returnMenu);
  window.addEventListener('resize', () => { $('orientationNotice').hidden = $('battleScreen').hidden || !needsLandscape(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && match && !match.finished) togglePause(true); });
}

boot();
