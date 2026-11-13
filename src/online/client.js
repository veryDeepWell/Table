import {matchSlot,parseInvite,readKey,roomRoute,verifyInvite,writeKey} from './codes.js';
import {askName,playerName} from './profile.js';
import {mountChat} from './chat.js';
import {downloadHistory} from '../games/history-export.js';
import {watchOpponentMove} from './move-sound.js';

const prefix = game => roomRoute(game) + 'match/';
export const inMatch = game => location.hash.startsWith(prefix(game));

export async function roomRequest(origin,path,key,body) {
  const response = await fetch(origin + path,{
    method:body === undefined ? 'GET' : 'POST',
    headers:{...(key && {Authorization:'Bearer ' + key}), ...(body !== undefined && {'Content-Type':'application/json'})},
    body:body === undefined ? undefined : JSON.stringify(body),
    cache:'no-store',keepalive:path.endsWith('/leave'),signal:AbortSignal.timeout(5000),
  }).catch(error => {
    if (error.name === 'TimeoutError') throw new Error('Игровой сервер не ответил вовремя.');
    throw new Error('Нет связи с игровым сервером. Проверьте, что окно сервера открыто.');
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw Object.assign(new Error(data?.error || 'Игровой сервер недоступен.'),{status:response.status});
  return data;
}

export function mountMatch(root,game,paint,showHistory) {
  const play = root.querySelector('#play');
  const panel = document.createElement('section');
  panel.className = 'match-controls';
  panel.innerHTML = `<a href="#/games/${game}/online">← Комнаты</a>
    <button class="button dark" data-match-join hidden>Присоединиться</button>
    <button class="button secondary" data-match-copy hidden>Скопировать приглашение</button>
    <button class="button secondary" data-match-leave hidden>Покинуть партию</button>
    <button class="button secondary" data-match-export hidden>Скачать историю партии</button>
    <input aria-label="Ссылка приглашения" readonly hidden><p role="status"></p>`;
  play.before(panel);
  const status = panel.querySelector('[role="status"]');
  const join = panel.querySelector('[data-match-join]');
  const copy = panel.querySelector('[data-match-copy]');
  const leave = panel.querySelector('[data-match-leave]');
  const exportButton = panel.querySelector('[data-match-export]');
  let code;
  const [encoded,hostSecret] = location.hash.slice(prefix(game).length).split('/');
  try { code = decodeURIComponent(encoded); } catch {}
  if (hostSecret) history.replaceState(null,'',prefix(game) + encoded);
  const room = parseInvite(code || '',game);
  if (!room) { status.textContent = 'Проверьте ссылку приглашения.'; return; }
  const slot = matchSlot(room);
  let key = readKey(slot);
  let current;
  let online = true;
  let previous = '';
  let archived = '';
  let loadingHistory = false;
  const sound = watchOpponentMove();
  let task = Promise.resolve();
  const queue = action => {
    const result = task.then(action);
    task = result.catch(() => {});
    return result;
  };
  const api = (path,body) => roomRequest(room.origin,'/api/match' + path,key,body);
  const input = panel.querySelector('input');
  input.value = location.href;
  const chat = mountChat(play,
    text => queue(async () => show(await api('/chat',{text}))));
  let pendingName;
  const profile = event => { if (key) pendingName = event.detail; };
  document.addEventListener('table:profile',profile);

  function show(next) {
    if (!panel.isConnected) return;
    if (next.game !== game) throw new Error('Приглашение относится к другой игре.');
    current = next;
    online = true;
    status.textContent = '';
    join.hidden = true;
    copy.hidden = next.side !== 1 || next.ready;
    if (copy.hidden) input.hidden = true;
    leave.hidden = !next.ready || next.ended;
    exportButton.hidden = !next.ready;
    chat(next.messages);
    const signature = JSON.stringify([next.state,next.side,next.ready,next.ended,next.forfeits,next.names]);
    if (signature !== previous) {
      previous = signature;
      paint(next);
    }
    if (next.ready && archived !== signature && !loadingHistory) {
      loadingHistory = true;
      api('/history').then(archive => {
        if (!panel.isConnected) return;
        archived = signature;
        sound(archive,next.side);
        showHistory?.(archive);
      }).catch(() => {}).finally(() => { loadingHistory = false; });
    }
  }
  const send = action => {
    const version = current?.version;
    return queue(async () => {
      if (!online || !current || current.ended || !current.ready || !panel.isConnected || current.version !== version) return;
      try { show(await api('/move',{...action,version})); }
      catch (error) { status.textContent = error.message; }
    });
  };
  join.hidden = Boolean(key);
  status.textContent = key ? 'Подключаемся…' : 'Займите место за столом.';
  join.onclick = async () => {
    if (!playerName()) { askName(); return; }
    join.disabled = true;
    try {
      const {key:seatKey,...view} = await api('/' + room.code + '/join',{name:playerName()});
      key = seatKey;
      writeKey(slot,key);
      show(view);
    } catch (error) { status.textContent = error.message; }
    finally { join.disabled = false; }
  };
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(input.value); copy.textContent = 'Приглашение скопировано'; }
    catch { input.hidden = false; input.select(); }
  };
  leave.onclick = () => {
    if (!confirm('Покинуть партию и засчитать поражение?')) return;
    queue(async () => show(await api('/leave',{}))).catch(error => { status.textContent = error.message; });
  };
  exportButton.onclick = async () => {
    try { downloadHistory(game,await api('/history')); }
    catch (error) { status.textContent = error.message; }
  };
  window.addEventListener('hashchange',() => {
    document.removeEventListener('table:profile',profile);
    if (key && current?.ready && !current.ended) api('/leave',{}).catch(() => {});
  },{once:true});
  async function poll() {
    if (!panel.isConnected) return;
    if (key && !join.disabled) await queue(async () => {
      try {
        let next = await api('');
        const name = pendingName || (!next.names[next.side - 1] ? playerName() : '');
        if (name) {
          next = await api('/name',{name});
          if (pendingName === name) pendingName = undefined;
        }
        show(next);
      } catch (error) {
        online = false;
        if (error.status === 401) {
          key = null;
          writeKey(slot,null);
          join.hidden = false;
        }
        status.textContent = error.message;
      }
    });
    if (panel.isConnected) setTimeout(poll,700);
  }
  async function connect() {
    if (hostSecret && /^[a-f0-9]{64}$/.test(hostSecret) &&
        await verifyInvite(room,hostSecret).catch(() => false) && panel.isConnected) {
      key = hostSecret;
      writeKey(slot,key);
      join.hidden = true;
      status.textContent = 'Подключаемся…';
    }
    poll();
  }
  connect();
  return {send};
}

export function forfeitMessage(match) {
  if (match.forfeits.length === 2 && match.names.length === 2) return 'Оба игрока проиграли за выход из партии.';
  if (match.forfeits.includes(match.side)) return 'Вы проиграли за выход из партии.';
  if (match.forfeits.length && match.names.length === 2) return 'Вы победили. Соперник покинул партию.';
  if (match.forfeits.length) return 'Поражение за выход: ' + match.forfeits.map(side => match.names[side - 1]).join(', ');
  return '';
}
