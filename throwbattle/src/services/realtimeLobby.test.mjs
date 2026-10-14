import assert from 'node:assert/strict';
import test from 'node:test';
import { RealtimeLobbyClient } from './realtimeLobby.js';

class FakeSocket extends EventTarget {
  readyState = 0;
  sent = [];
  send(message) { this.sent.push(JSON.parse(message)); }
  close() { this.readyState = 3; this.dispatchEvent(new Event('close')); }
  open() { this.readyState = 1; this.dispatchEvent(new Event('open')); }
  receive(message) {
    const event = new Event('message');
    Object.defineProperty(event, 'data', { value: JSON.stringify(message) });
    this.dispatchEvent(event);
  }
}

test('waits for verified server acknowledgement before enabling room actions', async () => {
  const socket = new FakeSocket();
  const messages = [];
  const client = new RealtimeLobbyClient({ tokenProvider: async () => 'private-token',
    socketFactory: () => socket, onMessage: (value) => messages.push(value) });
  const pending = client.connect();
  assert.equal(client.send('create-room'), false);
  socket.open();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(socket.sent, [{ type: 'authenticate', token: 'private-token', resumeToken: null }]);
  assert.equal(client.send('create-room'), false);
  socket.receive({ type: 'authenticated', studentNumber: '2510044' });
  await pending;
  assert.equal(client.send('create-room'), true);
  assert.deepEqual(socket.sent[1], { type: 'create-room' });
  assert.equal(messages[0].studentNumber, '2510044');
  client.disconnect();
  assert.equal(client.send('create-room'), false);
});

test('failed connection never enables sending', async () => {
  const socket = new FakeSocket();
  const client = new RealtimeLobbyClient({ tokenProvider: async () => 'invalid', socketFactory: () => socket });
  const pending = client.connect();
  socket.close();
  await assert.rejects(pending, /connection-closed/);
  assert.equal(client.send('create-room'), false);
});

test('an interrupted socket automatically resumes using its private session token', async () => {
  const sockets = [new FakeSocket(), new FakeSocket()];
  const stored = new Map();
  const storage = {
    getItem: (key) => stored.get(key) || null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: (key) => stored.delete(key),
  };
  const statuses = [];
  const client = new RealtimeLobbyClient({ tokenProvider: async () => 'private-token',
    socketFactory: () => sockets.shift(), storage, retryDelayMs: 5, graceMs: 500,
    onStatus: (value) => statuses.push(value) });
  const connected = client.connect();
  const first = client.socket;
  first.open();
  await new Promise((resolve) => setImmediate(resolve));
  first.receive({ type: 'authenticated', participantId: 'participant-1',
    resumeToken: '0e231b48-99cc-41a3-9def-0123456789ab', resumed: false });
  await connected;
  first.close();
  assert.equal(client.send('battle-input'), false);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const second = client.socket;
  assert.ok(second);
  second.open();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(second.sent[0].resumeToken, '0e231b48-99cc-41a3-9def-0123456789ab');
  second.receive({ type: 'authenticated', participantId: 'participant-1',
    resumeToken: '0e231b48-99cc-41a3-9def-0123456789ab', resumed: true });
  assert.equal(client.send('battle-input'), true);
  assert.ok(statuses.includes('reconnecting'));
  client.disconnect();
  assert.equal(stored.size, 0);
});
