const live = new Map();
let guarding = false;

function warnBeforeUnload(event) {
  event.preventDefault();
  event.returnValue = true;
}

function syncUnloadWarning() {
  const needsWarning = [...live.values()].some(save => save.location === 'memory');
  if (needsWarning === guarding || !globalThis.addEventListener) return;
  if (needsWarning) globalThis.addEventListener('beforeunload',warnBeforeUnload);
  else globalThis.removeEventListener('beforeunload',warnBeforeUnload);
  guarding = needsWarning;
}

function read(storage, key) {
  const raw = globalThis[storage].getItem(key);
  if (raw === null) return null;
  const parsed = JSON.parse(raw);
  return parsed?.saveFormat === 1 ? parsed : {time:0, data:parsed};
}

// A session copy survives reloads if the browser rejects a local write.
export function loadSave(key, decode) {
  let best = live.get(key);
  for (const storage of ['localStorage','sessionStorage']) {
    try {
      const saved = read(storage,key);
      if (!saved || (best && saved.time <= best.time)) continue;
      const value = decode(saved.data);
      if (value) best = {value,time:saved.time,location:storage};
    } catch {}
  }
  if (best) live.set(key,best);
  return best;
}

export function saveGame(key, value, encode = value => value) {
  const time = Math.max(Date.now(),(live.get(key)?.time || 0) + 1);
  let location = 'memory';
  try {
    const raw = JSON.stringify({saveFormat:1,time,data:encode(value)});
    for (const storage of ['localStorage','sessionStorage']) {
      try {
        globalThis[storage].setItem(key,raw);
        location = storage;
        break;
      } catch {}
    }
  } catch {}
  live.set(key,{value,time,location});
  syncUnloadWarning();
  return location;
}

export const saveMessage = location => ({
  localStorage:'Партия сохранена в браузере.',
  sessionStorage:'Постоянное сохранение недоступно. Партия сохранена до закрытия этой вкладки.',
  memory:'Браузер не сохранил партию. Она останется при переходе в каталог, пока эта вкладка открыта и страница не перезагружена.',
})[location] || 'Партия сохраняется после первого хода.';
