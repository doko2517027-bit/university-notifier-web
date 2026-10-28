import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = (await readFile(new URL('./backend_client.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '').replaceAll('export async function', 'async function') + '\nglobalThis.call = callCareMate;';
function client(fetch, currentUser = null) {
  const transport = (url, options) => url.endsWith('/health')
    ? Promise.resolve({ ok: true, json: async () => ({ ready: true }) }) : fetch(url, options);
  const context = vm.createContext({ fetch: transport, AbortController, DOMException, setTimeout, clearTimeout, getApp: () => ({}), getAuth: () => ({ authStateReady: async () => {}, currentUser }) });
  vm.runInContext(source, context);
  return context.call;
}
test('public login does not attach an old authentication token or send credentials to a configurable host', async () => {
  const call = client(async (url, options) => {
    assert.equal(url, 'https://caremate-auth.onrender.com/api/authenticateCareMate');
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    return { ok: true, json: async () => ({ data: { token: 'test' } }) };
  });
  assert.equal((await call('authenticateCareMate', { studentNumber: '2510044' })).data.token, 'test');
});
test('protected requests require a current Firebase user and carry an ID token', async () => {
  await assert.rejects(client(() => assert.fail())('checkCareMateAccess'), { code: 'functions/unauthenticated' });
  const call = client(async (_, options) => {
    assert.equal(options.headers.Authorization, 'Bearer verified-token');
    return { ok: true, json: async () => ({ data: { active: true } }) };
  }, { getIdToken: async () => 'verified-token' });
  assert.equal((await call('checkCareMateAccess')).data.active, true);
});
test('permission failures retain existing error codes and startup HTML is handled', async () => {
  const user = { getIdToken: async () => 'token' };
  await assert.rejects(client(async () => ({ ok: false, json: async () => ({ error: { status: 'permission-denied', message: 'denied' } }) }), user)('issueEntrancePhrase'), { code: 'functions/permission-denied' });
  await assert.rejects(client(async () => ({ ok: false, json: async () => { throw Error('HTML'); } }))('authenticateCareMate'), { code: 'functions/unavailable' });
});
