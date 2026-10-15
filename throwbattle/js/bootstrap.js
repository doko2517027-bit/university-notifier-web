const access = document.getElementById('accessScreen');
const message = document.getElementById('accessMessage');
const app = document.getElementById('app');

try {
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('認証の確認が時間切れになりました')), 10000));
  const { verifyThrobPilot } = await Promise.race([import('./integrations/pilotAuth.js'), timeout]);
  if (!await Promise.race([verifyThrobPilot(), timeout])) {
    message.textContent = '現在は学籍番号2510044のアカウントだけが利用できます。';
  } else {
    app.hidden = false;
    access.hidden = true;
    await import('./main.js');
  }
} catch (error) {
  console.warn('Throbの本人確認に失敗しました。', error);
  app.hidden = true;
  access.hidden = false;
  message.textContent = 'ログイン情報を確認できません。通信状態を確認してCareMateから開き直してください。';
}
