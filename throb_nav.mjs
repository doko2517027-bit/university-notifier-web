const THROB_TAB_CONTENT = '<span class="nav-icon-wrap"><span class="nav-icon">🎯</span></span><span>Throb</span>';

// Keep the request feature for other students. The pilot uses its former slot.
export function ensureThrobNavTab(document, loggedIn, studentNumber) {
  const pilot = loggedIn && studentNumber === '2510044';
  for (const nav of document.querySelectorAll('.bottom-nav')) {
    if (nav.querySelector('.throb-nav-link')) continue;
    const requests = nav.querySelector('a[href="requests.html"]');
    if (!requests) continue;
    if (pilot) {
      requests.href = 'throwbattle/';
      requests.classList.add('throb-nav-link');
      requests.setAttribute('aria-label', 'Throb');
      requests.innerHTML = THROB_TAB_CONTENT;
      continue;
    }
    const link = document.createElement('a');
    link.href = 'throwbattle/';
    link.className = 'throb-nav-link';
    link.setAttribute('aria-label', 'Throb');
    link.innerHTML = THROB_TAB_CONTENT;
    requests.insertAdjacentElement('afterend', link);
  }
}
