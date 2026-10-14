import assert from 'node:assert/strict';
import test from 'node:test';
import { RECONNECT_GRACE_MS, resumableSession, sessionExpired } from './resume.js';

const token = '0e231b48-99cc-41a3-9def-0123456789ab';
const makeSessions = (disconnectedAt) => new Map([['participant-1', {
  resumeToken: token, identity: { uid: 'caremate-2510044' }, disconnectedAt,
}]]);

test('only the matching verified account and unexpired secret can resume', () => {
  const sessions = makeSessions(1000);
  assert.equal(resumableSession(sessions, token, 'caremate-2510044', 1000 + RECONNECT_GRACE_MS - 1)?.id, 'participant-1');
  assert.equal(resumableSession(sessions, token, 'caremate-2510044', 1000 + RECONNECT_GRACE_MS), null);
  assert.equal(resumableSession(sessions, token, 'caremate-other', 2000), null);
  assert.equal(resumableSession(sessions, 'invalid', 'caremate-2510044', 2000), null);
});

test('disconnected sessions expire, but active sessions do not', () => {
  assert.equal(sessionExpired(makeSessions(1000).get('participant-1'), 1000 + RECONNECT_GRACE_MS), true);
  assert.equal(sessionExpired(makeSessions(0).get('participant-1'), 999999), false);
});
