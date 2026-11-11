export const roomPrefix = '#/games/go/room/';
export const remotePrefix = roomPrefix + 'remote/';
export const validKey = value => /^[A-Za-z0-9_-]{32,64}$/.test(value || '');
export {readKey,writeKey} from '../../online/seat-storage.js';

export function roomCode(value) {
  const match = /^go-room-v1\.([\w-]{32})\.([a-f0-9]{64})\.(https:\/\/[a-z0-9-]+\.trycloudflare\.com|http:\/\/127\.0\.0\.1:\d{1,5})$/.exec(value.trim());
  if (!match) return null;
  const [,code,proof,origin] = match;
  try { if (new URL(origin).origin !== origin) return null; }
  catch { return null; }
  return {code,proof,origin};
}

export const roomSlot = (origin,code) => 'table:go:room:' + origin + ':' + code;
