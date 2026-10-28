/* Show only a neutral status while protected page content stays hidden. */
(() => {
  let failed = false;
  let render;
  window.addEventListener('error', () => { failed = true; render?.(); }, true);
  window.addEventListener('unhandledrejection', () => { failed = true; render?.(); });
  const start = () => {
    if (!document.querySelector('script[data-care-page]') || document.documentElement.classList.contains('caremate-access-approved')) return;
    const status = document.createElement('section');
    status.id = 'carematePageStatus';
    status.setAttribute('role', 'status');
    status.style.cssText = 'visibility:visible;position:fixed;inset:20vh 16px auto;max-width:420px;margin:auto;padding:24px;border-radius:20px;background:var(--cm-card,#fff);color:var(--cm-text,#111);box-shadow:0 8px 28px #0002;text-align:center;z-index:1000';
    const message = document.createElement('p');
    const retry = document.createElement('button');
    retry.type = 'button'; retry.className = 'cm-button cm-button-primary'; retry.textContent = '再読み込み';
    retry.addEventListener('click', () => location.reload());
    const login = document.createElement('a');
    login.href = 'index.html'; login.textContent = 'ログイン画面へ'; login.style.cssText = 'display:block;margin-top:16px;color:var(--cm-primary,#0f9d8a)';
    status.append(message, retry, login); document.body.append(status);
    render = () => {
      message.textContent = failed ? '画面を読み込めませんでした。通信状態を確認して、もう一度お試しください。' : '利用権限を確認しています…';
      retry.hidden = login.hidden = !failed;
    };
    render();
    const timer = setTimeout(() => { failed = true; render(); }, 15000);
    const observer = new MutationObserver(() => {
      if (document.documentElement.classList.contains('caremate-access-approved')) {
        status.remove(); observer.disconnect(); clearTimeout(timer); render = undefined;
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
