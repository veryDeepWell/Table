import {networkGames} from './games.js';
import {roomCode as legacyCode} from '../games/go/room-code.js';
export {readKey, writeKey} from './seat-storage.js';

export const roomRoute = game => `#/games/${game}/room/`;
export const draftSlot = game => 'table:launch:' + game;
export const matchSlot = room => `table:match:${room.game}:${room.origin}:${room.code}`;

export function parseInvite(value,game) {
  const match = /^table-room-v1\.([a-z-]+)\.([\w-]{32})\.([a-f0-9]{64})\.(https:\/\/[a-z0-9-]+\.trycloudflare\.com|http:\/\/127\.0\.0\.1:\d{1,5})$/.exec(value);
  if (match) {
    const [,id,code,proof,origin] = match;
    if (id !== game || !networkGames.includes(id)) return null;
    try { if (new URL(origin).origin !== origin) return null; }
    catch { return null; }
    return {game,code,proof,origin};
  }
  const legacy = game === 'go' && legacyCode(value);
  return legacy ? {...legacy,game,legacy:true} : null;
}

export async function verifyInvite(room,secret) {
  const utf8 = new TextEncoder();
  const key = await crypto.subtle.importKey('raw',utf8.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const signature = Uint8Array.from(room.proof.match(/../g),byte => parseInt(byte,16));
  return crypto.subtle.verify('HMAC',key,signature,utf8.encode(
    (room.legacy ? '' : room.game + '/') + room.origin + '/' + room.code));
}
