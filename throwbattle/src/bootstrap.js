import { throbAccessState } from './integrations/access.js';

const gate = document.getElementById('accessScreen');
const title = document.getElementById('accessTitle');
const detail = document.getElementById('accessDetail');
const badge = document.getElementById('accessBadge');
const status = document.getElementById('accessStatus');

function showGate(state) {
  gate.dataset.state = state;
  if (state === 'maintenance') {
    badge.textContent = 'COMING SOON';
    title.textContent = 'ただいまメンテナンス中';
    detail.textContent = 'みんなが気持ちよく遊べるよう、対戦環境を調整しています。公開まで、もう少しお待ちください。';
    status.textContent = '現在は限定テスト中です';
  } else {
    badge.textContent = 'CARE MATE';
    title.textContent = 'ログインが必要です';
    detail.textContent = 'CareMateにログインしてから、Throbを開いてください。';
    status.textContent = 'ゲーム画面は読み込まれていません';
  }
}

const localStudentNumber = localStorage.getItem('studentNumber');
const loggedIn = localStorage.getItem('loggedIn') === 'true';
const initial = throbAccessState({ loggedIn, localStudentNumber });
const previewMaintenance = ['localhost', '127.0.0.1'].includes(location.hostname) &&
  new URLSearchParams(location.search).has('preview-maintenance');

if (previewMaintenance || initial === 'maintenance' || initial === 'login') {
  showGate(previewMaintenance ? 'maintenance' : initial);
} else {
  try {
    const { connectCareMate } = await import('./integrations/caremate.js?v=3');
    const connection = await connectCareMate();
    const access = throbAccessState({ loggedIn, localStudentNumber,
      verifiedStudentNumber: connection?.studentNumber || null });
    if (access !== 'allowed') showGate(access);
    else {
      window.__throbConnection = connection;
      await import('./main.js?v=10');
      document.getElementById('app').style.display = '';
      gate.hidden = true;
    }
  } catch (error) {
    console.warn('Throb access check failed:', error);
    showGate('login');
  }
}
