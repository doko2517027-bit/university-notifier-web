import test from 'node:test';
import assert from 'node:assert/strict';
import { loginErrorMessage } from './login_error.js';
test('outages do not ask users to change their passwords', () => {
  for (const code of ['functions/internal','functions/unavailable','functions/deadline-exceeded']) {
    assert.match(loginErrorMessage({code}), /パスワードを変更する必要はありません/);
  }
});
test('rate limit and expired entrance have actionable separate guidance', () => {
  assert.match(loginErrorMessage({code:'functions/resource-exhausted'}), /15分/);
  assert.match(loginErrorMessage({code:'functions/failed-precondition'}), /新しい文言/);
  assert.match(loginErrorMessage({code:'functions/permission-denied'}), /許可/);
});
