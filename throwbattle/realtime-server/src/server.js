import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { WebSocket, WebSocketServer } from 'ws';
import { RoomRegistry } from './rooms.js';
import { PilotBattle } from './pilotBattle.js';
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
const matches = new Map(); // Volatile pilot matches: no official XP, points or ranking writes.
const sessions = new Map(); // Server-issued participant ID -> authenticated connection.
const PILOT_MULTIDEVICE_UID = 'caremate-2510044';
const PILOT_DEVICE_LIMIT = 3;
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
  for (const player of room.players) send(sessions.get(player.id)?.socket, { type: 'room', room });
}

function broadcastMatch(code, payload) {
  const room = rooms.get(code);
  if (!room) return;
  for (const player of room.players) send(sessions.get(player.id)?.socket, payload);
}

function finishMatch(code) {
  const match = matches.get(code);
  if (!match?.result) return;
  broadcastMatch(code, { type: 'battle-result', result: match.result });
  matches.delete(code);
  rooms.finish(code);
  broadcastRoom(code);
}

function forfeitIfPlaying(id) {
  const code = rooms.findById(id)?.code;
  const match = code && matches.get(code);
  if (match) { match.forfeit(id); finishMatch(code); }
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
  send(socket, { type: 'hello', protocol: 1 });
  let identity = null;
  let participantId = null;
  let authenticating = false;
  let messages = 0;
  let windowStart = Date.now();
  const authTimer = setTimeout(() => socket.close(1008, 'authentication-timeout'), 10_000);
  socket.on('message', async (raw) => {
    const now = Date.now();
    if (now - windowStart > 1000) { windowStart = now; messages = 0; }
    if (++messages > 40) { socket.close(1008, 'rate-limit'); return; }
    let request;
    try { request = JSON.parse(String(raw)); }
    catch { reject(socket, 'invalid-message'); return; }
    if (request?.type !== 'battle-input') console.info(`Throb realtime message: ${String(request?.type || '').slice(0, 32)}`);
    if (!identity) {
      if (request?.type !== 'authenticate' || typeof request.token !== 'string') {
        socket.close(1008, 'authentication-required'); return;
      }
      if (authenticating) return;
      authenticating = true;
      try {
        const decoded = await auth.verifyIdToken(request.token);
        const verified = authorizedIdentity(decoded, allowedStudents);
        if (!verified || socket.readyState !== WebSocket.OPEN) throw new Error('not-in-pilot');
        const existing = [...sessions].filter(([, session]) => session.identity.uid === verified.uid);
        if (verified.uid === PILOT_MULTIDEVICE_UID) {
          // Only the test account may join from multiple devices. Do not extend this to other users.
          if (existing.length >= PILOT_DEVICE_LIMIT) throw new Error('device-limit');
        } else {
          for (const [id, session] of existing) {
            forfeitIfPlaying(id);
            sessions.delete(id);
            const oldCode = rooms.findById(id)?.code;
            rooms.leave(id);
            if (oldCode) broadcastRoom(oldCode);
            session.socket.close(1000, 'new-session');
          }
        }
        identity = verified;
        participantId = randomUUID();
        const deviceNumber = verified.uid === PILOT_MULTIDEVICE_UID
          ? [...Array(PILOT_DEVICE_LIMIT).keys()].map((index) => index + 1)
            .find((number) => !existing.some(([, session]) => session.deviceNumber === number))
          : 1;
        sessions.set(participantId, { socket, identity, deviceNumber });
        clearTimeout(authTimer);
        send(socket, { type: 'authenticated', studentNumber: identity.studentNumber, participantId });
      } catch {
        socket.close(1008, 'not-authorized');
      } finally {
        authenticating = false;
      }
      return;
    }
    if (sessions.get(participantId)?.socket !== socket) { socket.close(1008, 'superseded'); return; }
    const player = { ...identity, id: participantId,
      name: identity.uid === PILOT_MULTIDEVICE_UID
        ? `${identity.studentNumber}（端末${sessions.get(participantId).deviceNumber}）` : identity.name };
    try {
      if (request?.type === 'create-room') {
        const current = rooms.findById(participantId);
        if (current?.status === 'playing') throw new Error('battle-in-progress');
        const prior = current?.code;
        const room = rooms.create(player);
        if (prior) broadcastRoom(prior);
        broadcastRoom(room.code);
      } else if (request?.type === 'join-room') {
        const code = String(request.code || '');
        if (!/^\d{6}$/.test(code)) throw new Error('invalid-code');
        const current = rooms.findById(participantId);
        if (current?.status === 'playing') throw new Error('battle-in-progress');
        const prior = current?.code;
        const room = rooms.join(code, player);
        if (prior) broadcastRoom(prior);
        broadcastRoom(room.code);
      } else if (request?.type === 'ready') {
        const room = rooms.ready(participantId, request.ready);
        broadcastRoom(room.code);
      } else if (request?.type === 'start-match') {
        const room = rooms.start(participantId);
        matches.set(room.code, new PilotBattle(room.players));
        broadcastRoom(room.code);
        broadcastMatch(room.code, { type: 'battle-state', state: matches.get(room.code).snapshot() });
      } else if (request?.type === 'battle-input') {
        const room = rooms.findById(participantId);
        const match = room && matches.get(room.code);
        if (!match || room.status !== 'playing') throw new Error('battle-not-active');
        match.setInput(participantId, request.input);
      } else if (request?.type === 'leave-room') {
        forfeitIfPlaying(participantId);
        const code = rooms.findById(participantId)?.code;
        rooms.leave(participantId);
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
    if (!participantId || sessions.get(participantId)?.socket !== socket) return;
    forfeitIfPlaying(participantId);
    sessions.delete(participantId);
    const code = rooms.findById(participantId)?.code;
    rooms.leave(participantId);
    if (code) broadcastRoom(code);
  });
  socket.on('error', () => {});
});

setInterval(() => {
  const expired = rooms.sweep();
  for (const code of expired) {
    for (const session of sessions.values()) send(session.socket, { type: 'room-expired', code });
  }
  const cutoff = Date.now() - 60_000;
  for (const [address, attempts] of upgradeAttempts) {
    const recent = attempts.filter((time) => time >= cutoff);
    if (recent.length) upgradeAttempts.set(address, recent);
    else upgradeAttempts.delete(address);
  }
}, 60_000).unref();

let lastBattleTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const delta = Math.min(.1, Math.max(0, (now - lastBattleTick) / 1000));
  lastBattleTick = now;
  for (const [code, match] of matches) {
    match.tick(delta);
    if (match.result) finishMatch(code);
    else broadcastMatch(code, { type: 'battle-state', state: match.snapshot() });
  }
}, 50).unref();

server.listen(Number(process.env.PORT) || 10000, '0.0.0.0', () => {
  console.info(`Throb pilot realtime listening on ${server.address().port}`);
});
