import {goBoard, goPosition} from './board.js';
import {readKey, remotePrefix, roomCode, roomPrefix, roomSlot, validKey, writeKey} from './room-code.js';

const colors = {1:'чёрные',2:'белые'};
async function api(origin,path,key,body) {
  const response = await fetch(origin + '/api/go' + path,{
    method:body === undefined ? 'GET' : 'POST',
    headers:{...(key && {Authorization:'Bearer ' + key}), ...(body !== undefined && {'Content-Type':'application/json'})},
    body:body === undefined ? undefined : JSON.stringify(body),
    cache:'no-store',
    signal:AbortSignal.timeout(5000),
  });
  if (!response.headers.get('Content-Type')?.includes('application/json')) {
    throw Error('Игровой сервер недоступен по этому адресу.');
  }
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error),{status:response.status});
  return data;
}

export function renderRoom(root) {
  const remote = location.hash.startsWith(remotePrefix);
  let inviteCode = '';
  if (remote) {
    try { inviteCode = decodeURIComponent(location.hash.slice(remotePrefix.length)); } catch {}
  }
  const target = remote ? roomCode(inviteCode) : null;
  const [localCode,hostKey] = location.hash.slice(roomPrefix.length).split('/');
  const code = remote ? target?.code : localCode;
  const origin = remote ? target?.origin : location.origin;
  const request = (path,key,body) => api(origin,path,key,body);
  const slot = roomSlot(origin,code);
  const legacySlot = 'table:go:room:' + code;
  let key = readKey(slot) || (!remote && readKey(legacySlot));
  function remember(value) {
    key = value;
    writeKey(slot,key);
  }
  if (!remote && validKey(code) && validKey(hostKey)) {
    remember(hostKey);
    history.replaceState(null,'',roomPrefix + code);
  }
  root.innerHTML = `<section class="game-intro"><a class="back" href="#/games/go/online">← Комнаты го</a>
    <div class="eyebrow">ГО / ПРОБНАЯ КОМНАТА</div><h1>Го онлайн<em>У каждого свой экран.</em></h1>
  </section>
  <section class="play-section" id="play">
    <div class="board-column"><div data-room-board></div><p class="board-caption" data-last></p></div>
    <aside class="game-panel"><h2 data-room-turn>Комната го</h2><p id="status" role="status"></p>
      <div class="game-actions"><button class="button dark" data-join hidden>Играть за белых</button>
      <button class="button dark" data-pass hidden>Пас</button></div>
      <label data-invite hidden>${remote ? 'Код комнаты для белых' : 'Ссылка для белых'}<input class="go-room-invite" readonly></label>
      <p data-captures class="save-note"></p>
    </aside>
  </section>`;
  const area = root.querySelector('#play');
  const board = area.querySelector('[data-room-board]');
  const turn = area.querySelector('[data-room-turn]');
  const status = area.querySelector('#status');
  const join = area.querySelector('[data-join]');
  const pass = area.querySelector('[data-pass]');
  const invite = area.querySelector('[data-invite]');
  const link = invite.querySelector('input');
  if (!validKey(code)) {
    status.textContent = 'Проверьте код комнаты или ссылку приглашения.';
    return;
  }
  link.value = remote ? inviteCode : new URL(roomPrefix + code,location.href).href;
  link.onclick = () => link.select();
  let state;
  let busy = false;
  let disconnected = false;
  const canMove = () => state?.ready && !state.ended && state.turn === state.side && !disconnected;

  function paint() {
    if (!state) return;
    board.innerHTML = goBoard(state,canMove());
    area.querySelector('[data-last]').textContent = state.last == null ? '' : 'Последний ход: ' + goPosition(state.last,state.size);
    area.querySelector('[data-captures]').textContent =
      `Вы играете за ${state.side === 1 ? 'чёрных' : 'белых'}. Захваты: ${state.captures[1]} : ${state.captures[2]}.`;
    pass.hidden = !canMove();
    invite.hidden = state.side !== 1 || state.ready;
    turn.textContent = state.ended ? 'Партия завершена'
      : !state.ready ? 'Ждём белых'
      : state.turn === state.side ? 'Ваш ход' : 'Ход соперника';
    status.textContent = disconnected ? 'Нет связи с сервером. Пробуем подключиться снова.'
      : state.ended ? `Победили ${colors[state.points[1] > state.points[2] ? 1 : 2]}. Счёт: ${state.points[1]} : ${state.points[2]}.`
      : state.passes ? 'Ещё один пас завершит партию.'
      : !state.ready ? (remote ? 'Отправьте код комнаты второму игроку.' : 'Отправьте приглашение второму игроку.') : '';
  }

  function show(next) {
    if (!area.isConnected) return;
    if (!disconnected && state?.version === next.version && state.ready === next.ready) return;
    state = next;
    disconnected = false;
    paint();
  }
  async function send(action, point) {
    if (!canMove() || busy) return;
    busy = true;
    try { show(await request('/move',key,{action,point,version:state.version})); }
    catch (error) { status.textContent = error.message; }
    finally { busy = false; }
  }
  board.onclick = event => {
    const point = event.target.closest('[data-i]');
    if (point) send('play',Number(point.dataset.i));
  };
  pass.onclick = () => send('pass');
  join.onclick = async () => {
    if (busy) return;
    busy = true;
    join.disabled = true;
    try {
      const {key:guestKey,...view} = await request('/' + code + '/join',null,{});
      remember(guestKey);
      join.hidden = true;
      show(view);
    } catch (error) { status.textContent = error.message; }
    finally { busy = false; join.disabled = false; }
  };
  if (!key) {
    status.textContent = 'Присоединитесь к партии по приглашению.';
    join.hidden = false;
  }
  async function poll() {
    if (!area.isConnected) return;
    if (key && !busy) {
      try {
        const next = await request('',key);
        if (!busy && (!state || next.version >= state.version) && (!state?.ready || next.ready)) show(next);
      }
      catch (error) {
        if (busy || !area.isConnected) return schedule();
        if (error.status === 401) {
          remember(null);
          if (!remote) writeKey(legacySlot,null);
          join.hidden = false;
          status.textContent = error.message;
        } else if (state) {
          if (!disconnected) { disconnected = true; paint(); }
        } else status.textContent = 'Нет связи с сервером. Пробуем подключиться снова.';
      }
    }
    schedule();
  }
  function schedule() {
    if (area.isConnected) setTimeout(poll,650);
  }
  poll();
}
