import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { ensureThrobNavTab } from './throb_nav.mjs';

function fixture() {
  const links = [];
  const makeLink = (href) => ({ href, className: '', classes: new Set(),
    classList: { add(name) { this.owner.classes.add(name); } },
    setAttribute(name, value) { this[name] = value; },
    insertAdjacentElement(_position, item) { links.push(item); },
  });
  const requestLink = makeLink('requests.html');
  requestLink.classList.owner = requestLink;
  links.push(requestLink);
  const nav = { querySelector(selector) {
    if (selector === '.throb-nav-link') return links.find((link) => link.className === 'throb-nav-link' || link.classes?.has('throb-nav-link'));
    if (selector === 'a[href="requests.html"]') return links.find((link) => link.href === 'requests.html');
    return null;
  } };
  const document = { querySelectorAll: () => [nav], createElement: () => makeLink('') };
  return { document, links, requestLink };
}

test('2510044 gets Throb in the former request slot without an extra tab', () => {
  const { document, links, requestLink } = fixture();
  ensureThrobNavTab(document, true, '2510044');
  ensureThrobNavTab(document, true, '2510044');
  assert.equal(links.length, 1);
  assert.equal(requestLink.href, 'throwbattle/');
  assert.match(requestLink.innerHTML, /Throb/);
});

test('other students retain Requests and also see the Throb maintenance entry', () => {
  const { document, links, requestLink } = fixture();
  ensureThrobNavTab(document, true, '2510054');
  ensureThrobNavTab(document, true, '2510054');
  assert.equal(links.length, 2);
  assert.equal(requestLink.href, 'requests.html');
  assert.equal(links[1].href, 'throwbattle/');
});

test('direct Requests URL redirects only 2510044 before loading its content', () => {
  const html = readFileSync(new URL('./requests.html', import.meta.url), 'utf8');
  const source = html.match(/<script>\s*(window\.hideRequestsForThrobPilot[\s\S]*?)<\/script>/)?.[1];
  assert.ok(source);
  assert.match(html, /if \(!window\.hideRequestsForThrobPilot\) await import\("\.\/requests\.js"\)/);
  function run(studentNumber) {
    const redirects = [];
    const document = { documentElement: { style: {} } };
    const window = {};
    const localStorage = { getItem: (key) => ({ loggedIn: 'true', studentNumber })[key] };
    vm.runInNewContext(source, { window, document, localStorage,
      location: { replace: (url) => redirects.push(url) } });
    return { redirects, hidden: document.documentElement.style.display };
  }
  assert.deepEqual(run('2510044'), { redirects: ['throwbattle/'], hidden: 'none' });
  assert.deepEqual(run('2510054'), { redirects: [], hidden: undefined });
});
