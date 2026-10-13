import http from 'node:http';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { WebSocket, WebSocketServer } from 'ws';
import { RoomRegistry } from './rooms.js';
import { authorizedIdentity, DEFAULT_ALLOWED_STUDENTS } from './identity.js';

const projectId = process.env.FIREBASE_PROJECT_ID || 'universitynotifier-67517';
const auth = getAuth(initializeApp({ projectId }));
const allowedStudents = process.env.THROB_ALLOWED_STUDENTS
  ? process.env.THROB_ALLOWED_STUDENTS.split(',').map((value) => value.trim()).filter(Boolean)
  : DEFAULT_ALLOWED_STUDENTS;
const allowedOrigins = new Set([
  'https://doko2517027-bit.github.io',
  ...(process.env.NODE_ENV === 'production' ? [] : ['http://127.0.0.1:4177', 'http://localhost:4177']),
]);
const rooms = new RoomRegistry();
const sessions = new Map();
const upgradeAttempts = new Map();
const server = http.createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ ok: true, service: 'throb-realtime-pilot' }));
    return;
  }
  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('Not found');
});
const sockets = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false });

function send(socket, payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  if (socket.bufferedAmount > 64 * 1024) { socket.close(1008, 'slow-client'); return; }
  socket.send(JSON.stringify(payload));
}

function broadcastRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  for (const player of room.players) send(sessions.get(player.uid), { type: 'room', room });
}

function reject(socket, reason) {
  send(socket, { type: 'error', reason });
}

server.on('upgrade', (request, socket, head) => {
  const origin = request.headers.origin;
  const address = request.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const attempts = (upgradeAttempts.get(address) || []).filter((time) => now - time < 60_000);
  attempts.push(now);
  upgradeAttempts.set(address, attempts);
  if (request.url !== '/realtime' || !allowedOrigins.has(origin) || attempts.length > 30) {
    console.info('Throb realtime upgrade rejected');
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  console.info('Throb realtime upgrade accepted');
  sockets.handleUpgrade(request, socket, head, (client) => sockets.emit('connection', client));
});

sockets.on('connection', (socket) => {
  console.info('Throb realtime socket connected');
  let identity = null;
  let messages = 0;
  let windowStart = Date.now();
  const authTimer = setTimeout(() => socket.close(1008, 'authentication-timeout'), 10_000);
  socket.on('message', async (raw) => {
    const now = Date.now();
    if (now - windowStart > 1000) { windowStart = now; messages = 0; }
    if (++messages > 20) { socket.close(1008, 'rate-limit'); return; }
    let request;
    try { request = JSON.parse(String(raw)); }
    catch { reject(socket, 'invalid-message'); return; }
    console.info(`Throb realtime message: ${String(request?.type || '').slice(0, 32)}`);
    if (!identity) {
      if (request?.type !== 'authenticate' || typeof request.token !== 'string') {
        socket.close(1008, 'authentication-required'); return;
      }
      try {
        const decoded = await auth.verifyIdToken(request.token);
        identity = authorizedIdentity(decoded, allowedStudents);
        if (!identity) throw new Error('not-in-pilot');
        clearTimeout(authTimer);
        const previous = sessions.get(identity.uid);
        sessions.set(identity.uid, socket);
        if (previous && previous !== socket) previous.close(1000, 'new-session');
        send(socket, { type: 'authenticated', studentNumber: identity.studentNumber });
        const room = rooms.findByUid(identity.uid);
        if (room) send(socket, { type: 'room', room: rooms.publicRoom(room) });
      } catch {
        socket.close(1008, 'not-authorized');
      }
      return;
    }
    if (sessions.get(identity.uid) !== socket) { socket.close(1008, 'superseded'); return; }
    try {
      if (request?.type === 'create-room') {
        const prior = rooms.findByUid(identity.uid)?.code;
        const room = rooms.create(identity);
        if (prior) broadcastRoom(prior);
        broadcastRoom(room.code);
      } else if (request?.type === 'join-room') {
        const code = String(request.code || '');
        if (!/^\d{6}$/.test(code)) throw new Error('invalid-code');
        const prior = rooms.findByUid(identity.uid)?.code;
        const room = rooms.join(code, identity);
        if (prior) broadcastRoom(prior);
        broadcastRoom(room.code);
      } else if (request?.type === 'ready') {
        const room = rooms.ready(identity.uid, request.ready);
        broadcastRoom(room.code);
      } else if (request?.type === 'leave-room') {
        const code = rooms.findByUid(identity.uid)?.code;
        rooms.leave(identity.uid);
        send(socket, { type: 'left-room' });
        if (code) broadcastRoom(code);
      } else {
        throw new Error('unsupported-command');
      }
    } catch (error) { reject(socket, error.message); }
  });
  socket.on('close', () => {
    console.info('Throb realtime socket closed');
    clearTimeout(authTimer);
    if (!identity || sessions.get(identity.uid) !== socket) return;
    sessions.delete(identity.uid);
    const code = rooms.findByUid(identity.uid)?.code;
    rooms.leave(identity.uid);
    if (code) broadcastRoom(code);
  });
  socket.on('error', () => {});
});

setInterval(() => {
  const expired = rooms.sweep();
  for (const code of expired) {
    for (const socket of sessions.values()) send(socket, { type: 'room-expired', code });
  }
  const cutoff = Date.now() - 60_000;
  for (const [address, attempts] of upgradeAttempts) {
    const recent = attempts.filter((time) => time >= cutoff);
    if (recent.length) upgradeAttempts.set(address, recent);
    else upgradeAttempts.delete(address);
  }
}, 60_000).unref();

server.listen(Number(process.env.PORT) || 10000, '0.0.0.0', () => {
  console.info(`Throb pilot realtime listening on ${server.address().port}`);
});
