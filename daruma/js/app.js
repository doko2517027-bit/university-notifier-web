import { DarumaMatch } from './simulation.js';
import { GameRenderer } from './renderer.js';
import { GameInput } from './input.js';

const $ = (id) => document.getElementById(id);
const screens = ['menu', 'mode', 'setup', 'settings', 'pause', 'result'];
let settings;
try { settings = { camera: 'tps', sensitivity: 1, quality: 'auto', ...JSON.parse(localStorage.getItem('daruma-settings') || '{}') }; }
catch { settings = { camera: 'tps', sensitivity: 1, quality: 'auto' }; }
let renderer = null;
let input = null;
let match = null;
let paused = false;
let sceneName = 'menu';
let lastEvent = 0;
let toastTimer;
let previousTime = 0;

function screen(name) {
  sceneName = name;
  for (const id of screens) $(id).hidden = id !== name;
  $('hud').hidden = name !== 'battle';
  $('game-canvas').style.visibility = ['battle', 'pause', 'result'].includes(name) ? 'visible' : 'hidden';
}

function toast(text) {
  $('toast').textContent = text;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2200);
}

function updateRole() {
  if (!match) return;
  const isOni = match.oniId === 'player';
  $('role-label').textContent = isOni ? 'あなたは鬼' : 'あなたは逃走者';
  $('round-label').textContent = `第${match.round}ラウンド`;
  for (const element of document.querySelectorAll('.oni-action')) element.hidden = !isOni;
  for (const element of document.querySelectorAll('.runner-action')) element.hidden = isOni;
  input?.resetCamera();
}

function updateHud() {
  if (!match) return;
  const isOni = match.oniId === 'player';
  $('alive-label').textContent = `生存 ${match.aliveRunners.length}人`;
  $('lives-label').textContent = `鬼の残機 ${'♥'.repeat(match.oniLives)}${'♡'.repeat(3 - match.oniLives)}`;
  $('state-label').textContent = match.looking
    ? `鬼が見ている · 残り${Math.max(0, match.lookTime).toFixed(1)}秒`
    : `鬼は背を向けている${isOni && match.turnCooldown > 0 ? ` · 準備 ${match.turnCooldown.toFixed(1)}秒` : ''}`;
  $('turn-button').disabled = match.looking || match.turnCooldown > 0;
  $('lower-button').disabled = !match.looking;
  $('crosshair').hidden = input?.mode !== 'fps';
}

function readEvents() {
  while (lastEvent < match.events.length) {
    const event = match.events[lastEvent++];
    if (event.type !== 'round') toast(event.text);
    if (event.type === 'end') result();
  }
}

function result() {
  if (!match || sceneName === 'result') return;
  const playerIsOni = match.oniId === 'player';
  const playerWon = (playerIsOni && match.winner === 'oni') || (!playerIsOni && match.winner === 'runners');
  $('result-title').textContent = playerWon ? '勝利！' : '敗北';
  $('result-reason').textContent = match.endReason;
  $('continue-button').textContent = playerIsOni && match.endReason?.includes('タッチ') ? '鬼を続ける' : '次のラウンド';
  $('continue-button').hidden = match.oniLives <= 0;
  $('change-button').hidden = !(playerIsOni && match.endReason?.includes('タッチ'));
  screen('result');
}

function selectActor(x, y) {
  if (!match || paused || match.status !== 'playing') return;
  const selected = renderer.pickActor(x, y, match);
  if (!selected) return;
  if (match.oniId === 'player') {
    const result = match.accuse(selected.id, selected.point);
    if (!result.accepted) toast(result.reason === 'not-visible' ? '障害物に隠れている相手は指摘できません' : '振り向いている間だけ指摘できます');
  } else if (selected.id === match.oniId) {
    if (!match.touch('player')) toast('鬼にもっと近づいてください');
  }
  readEvents();
}

function start() {
  const playerCount = Number($('player-count').value);
  const role = $('player-role').value;
  match = new DarumaMatch({ playerCount, role });
  if (!renderer) renderer = new GameRenderer($('game-canvas'), settings.quality);
  renderer.syncActors(match);
  if (!input) {
    input = new GameInput($('game-canvas'), {
      joystick: $('joystick-zone'), knob: $('joystick-knob'), dash: $('dash-button'),
      touch: $('touch-button'), turn: $('turn-button'), lower: $('lower-button'), view: $('view-button'),
    }, settings, selectActor, togglePause,
    () => { if (match?.oniId === 'player' && match.turnOni()) toast('逃走者を観察して指摘！'); },
    () => match?.oniId === 'player' && match.lowerOni(),
    () => { if (!match?.touch('player')) toast('鬼にもっと近づいてください'); },
    () => { if (input) { input.toggleView(); toast(input.mode === 'fps' ? '一人称視点' : '三人称視点'); } },
    );
  }
  input.mode = settings.camera;
  input.resetCamera();
  paused = false;
  lastEvent = match.events.length;
  updateRole();
  screen('battle');
  toast(match.events[0].text);
}

function togglePause() {
  if (!match || match.status !== 'playing') return;
  if (sceneName === 'battle') { paused = true; screen('pause'); }
  else if (sceneName === 'pause') { paused = false; screen('battle'); }
}

function nextRound(continueOni) {
  if (!match?.nextRound(continueOni)) return;
  renderer.syncActors(match);
  lastEvent = match.events.length;
  updateRole();
  paused = false;
  screen('battle');
  toast(match.events.at(-1).text);
}

function frame(time) {
  requestAnimationFrame(frame);
  const dt = previousTime ? Math.min(.05, (time - previousTime) / 1000) : .016;
  previousTime = time;
  if (!match || !renderer || !input) return;
  if (!paused && match.status === 'playing' && sceneName === 'battle') {
    match.tick(dt, input.movement());
    readEvents();
    updateHud();
  }
  if (['battle', 'pause', 'result'].includes(sceneName)) renderer.render(match, input);
}

$('play-button').addEventListener('click', () => screen('mode'));
$('settings-button').addEventListener('click', () => screen('settings'));
$('cpu-button').addEventListener('click', () => screen('setup'));
$('start-button').addEventListener('click', start);
$('pause-button').addEventListener('click', togglePause);
$('resume-button').addEventListener('click', togglePause);
$('quit-button').addEventListener('click', () => { match = null; paused = false; screen('menu'); });
$('continue-button').addEventListener('click', () => nextRound(true));
$('change-button').addEventListener('click', () => nextRound(false));
$('result-menu-button').addEventListener('click', () => { match = null; screen('menu'); });
for (const back of document.querySelectorAll('[data-back]')) back.addEventListener('click', () => screen(back.dataset.back));
for (const [id, property] of [['camera-setting', 'camera'], ['sensitivity-setting', 'sensitivity'], ['quality-setting', 'quality']]) {
  $(id).value = settings[property];
  $(id).addEventListener('change', () => { settings[property] = $(id).value; localStorage.setItem('daruma-settings', JSON.stringify(settings)); });
}
window.addEventListener('visibilitychange', () => {
  if (document.hidden && sceneName === 'battle') togglePause();
});
screen('menu');
requestAnimationFrame(frame);
