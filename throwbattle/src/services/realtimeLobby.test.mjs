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
  assert.deepEqual(socket.sent, [{ type: 'authenticate', token: 'private-token' }]);
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
