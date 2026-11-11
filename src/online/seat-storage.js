const keys = new Map();

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
