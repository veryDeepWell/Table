export const roomPrefix = '#/games/go/room/';
export const remotePrefix = roomPrefix + 'remote/';
export const validKey = value => /^[A-Za-z0-9_-]{32,64}$/.test(value || '');
const keys = new Map();

export function roomCode(value) {
  const match = /^go-room-v1\.([\w-]{32})\.([a-f0-9]{64})\.(https:\/\/[a-z0-9-]+\.trycloudflare\.com|http:\/\/127\.0\.0\.1:\d{1,5})$/.exec(value.trim());
  if (!match) return null;
  const [,code,proof,origin] = match;
  try { if (new URL(origin).origin !== origin) return null; }
  catch { return null; }
  return {code,proof,origin};
}

export function readKey(slot) {
  try { return keys.get(slot) || sessionStorage.getItem(slot); }
  catch { return keys.get(slot); }
}

export function writeKey(slot,key) {
  if (key) keys.set(slot,key);
  else keys.delete(slot);
  try {
    if (key) sessionStorage.setItem(slot,key);
    else sessionStorage.removeItem(slot);
  } catch {}
}

export const roomSlot = (origin,code) => 'table:go:room:' + origin + ':' + code;

export async function matchesSetup(room,secret) {
  const utf8 = new TextEncoder();
  const key = await crypto.subtle.importKey('raw',utf8.encode(secret),
    {name:'HMAC',hash:'SHA-256'},false,['verify']);
  const signature = Uint8Array.from(room.proof.match(/../g),byte => parseInt(byte,16));
  return crypto.subtle.verify('HMAC',key,signature,utf8.encode(room.origin + '/' + room.code));
}
