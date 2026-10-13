import { randomInt } from 'node:crypto';

const MAX_PLAYERS = 8;
const ROOM_TTL_MS = 30 * 60 * 1000;

export class RoomRegistry {
  constructor({ now = () => Date.now(), randomCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0') } = {}) {
    this.rooms = new Map();
    this.now = now;
    this.randomCode = randomCode;
  }

  publicRoom(room) {
    return {
      code: room.code,
      hostUid: room.hostUid,
      status: room.status,
      players: [...room.players.values()].map(({ uid, name, ready }) => ({ uid, name, ready })),
      maxPlayers: MAX_PLAYERS,
    };
  }

  create(player) {
    this.leave(player.uid);
    let code;
    for (let attempt = 0; attempt < 30; attempt++) {
      code = this.randomCode();
      if (/^\d{6}$/.test(code) && !this.rooms.has(code)) break;
      code = null;
    }
    if (!code) throw new Error('room-code-unavailable');
    const room = { code, hostUid: player.uid, status: 'waiting', players: new Map(), createdAt: this.now() };
    room.players.set(player.uid, { ...player, ready: false });
    this.rooms.set(code, room);
    return this.publicRoom(room);
  }

  join(code, player) {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'waiting') throw new Error('room-unavailable');
    if (room.players.has(player.uid)) throw new Error('already-in-room');
    if (room.players.size >= MAX_PLAYERS) throw new Error('room-full');
    this.leave(player.uid);
    room.players.set(player.uid, { ...player, ready: false });
    return this.publicRoom(room);
  }

  ready(uid, ready) {
    const room = this.findByUid(uid);
    if (!room || room.status !== 'waiting') throw new Error('room-unavailable');
    room.players.get(uid).ready = ready === true;
    return this.publicRoom(room);
  }

  leave(uid) {
    const room = this.findByUid(uid);
    if (!room) return null;
    room.players.delete(uid);
    if (!room.players.size) this.rooms.delete(room.code);
    else if (room.hostUid === uid) room.hostUid = room.players.keys().next().value;
    return room.players.size ? this.publicRoom(room) : null;
  }

  findByUid(uid) {
    for (const room of this.rooms.values()) if (room.players.has(uid)) return room;
    return null;
  }

  get(code) {
    const room = this.rooms.get(code);
    return room ? this.publicRoom(room) : null;
  }

  sweep() {
    const expired = [];
    for (const room of this.rooms.values()) {
      if (this.now() - room.createdAt > ROOM_TTL_MS) {
        expired.push(room.code);
        this.rooms.delete(room.code);
      }
    }
    return expired;
  }
}
