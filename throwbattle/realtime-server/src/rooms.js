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
      hostId: room.hostId,
      hostUid: room.hostUid,
      status: room.status,
      players: [...room.players.values()].map(({ id, uid, name, ready }) => ({ id, uid, name, ready })),
      maxPlayers: MAX_PLAYERS,
    };
  }

  create(player) {
    const id = player.id || player.uid;
    this.leave(id);
    let code;
    for (let attempt = 0; attempt < 30; attempt++) {
      code = this.randomCode();
      if (/^\d{6}$/.test(code) && !this.rooms.has(code)) break;
      code = null;
    }
    if (!code) throw new Error('room-code-unavailable');
    const room = { code, hostId: id, hostUid: player.uid, status: 'waiting', players: new Map(), createdAt: this.now() };
    room.players.set(id, { ...player, id, ready: false });
    this.rooms.set(code, room);
    return this.publicRoom(room);
  }

  join(code, player) {
    const id = player.id || player.uid;
    const room = this.rooms.get(code);
    if (!room || room.status !== 'waiting') throw new Error('room-unavailable');
    if (room.players.has(id)) throw new Error('already-in-room');
    if (room.players.size >= MAX_PLAYERS) throw new Error('room-full');
    this.leave(id);
    room.players.set(id, { ...player, id, ready: false });
    return this.publicRoom(room);
  }

  ready(id, ready) {
    const room = this.findById(id);
    if (!room || room.status !== 'waiting') throw new Error('room-unavailable');
    room.players.get(id).ready = ready === true;
    return this.publicRoom(room);
  }

  leave(id) {
    const room = this.findById(id);
    if (!room) return null;
    room.players.delete(id);
    if (!room.players.size) this.rooms.delete(room.code);
    else if (room.hostId === id) {
      room.hostId = room.players.keys().next().value;
      room.hostUid = room.players.get(room.hostId).uid;
    }
    return room.players.size ? this.publicRoom(room) : null;
  }

  findById(id) {
    for (const room of this.rooms.values()) if (room.players.has(id)) return room;
    return null;
  }

  findByUid(uid) {
    for (const room of this.rooms.values()) if ([...room.players.values()].some((player) => player.uid === uid)) return room;
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
