import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizedIdentity } from './identity.js';

test('only the verified pilot uid and student claim can enter', () => {
  assert.deepEqual(authorizedIdentity({ uid: 'caremate-2510044', studentNumber: '2510044' }),
    { uid: 'caremate-2510044', studentNumber: '2510044', name: '2510044' });
  assert.equal(authorizedIdentity({ uid: 'caremate-2510045', studentNumber: '2510045' }), null);
  assert.equal(authorizedIdentity({ uid: 'caremate-2510044', studentNumber: '2510045' }), null);
  assert.equal(authorizedIdentity({ uid: 'caremate-2510044' }), null);
});
