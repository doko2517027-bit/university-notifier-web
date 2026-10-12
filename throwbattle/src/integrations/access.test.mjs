import test from 'node:test';
import assert from 'node:assert/strict';
import { throbAccessState } from './access.js';

test('all students see the tab but only verified 2510044 reaches the game', () => {
  assert.equal(throbAccessState({ loggedIn: false, localStudentNumber: null }), 'login');
  assert.equal(throbAccessState({ loggedIn: true, localStudentNumber: '2510054' }), 'maintenance');
  assert.equal(throbAccessState({ loggedIn: true, localStudentNumber: '2510044' }), 'checking');
  assert.equal(throbAccessState({ loggedIn: true, localStudentNumber: '2510044', verifiedStudentNumber: null }), 'login');
  assert.equal(throbAccessState({ loggedIn: true, localStudentNumber: '2510044', verifiedStudentNumber: '2510044' }), 'allowed');
});
