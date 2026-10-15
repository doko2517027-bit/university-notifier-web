const access = document.getElementById('access');
const message = document.getElementById('access-message');
const app = document.getElementById('app');

try {
  const { verifyDarumaPilot } = await import('./pilotAuth.js');
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('verification timeout')), 12000));
  const allowed = await Promise.race([verifyDarumaPilot(), timeout]);
  if (!allowed) {
    message.textContent = '現在は学籍番号2510044のアカウントだけが利用できます。';
  } else {
    app.hidden = false;
    access.hidden = true;
    await import('./app.js');
  }
} catch (error) {
  console.warn('試験版の本人確認に失敗しました。', error);
  app.hidden = true;
  access.hidden = false;
  message.textContent = '本人確認ができませんでした。CareMateにログインし直してから開いてください。';
}
