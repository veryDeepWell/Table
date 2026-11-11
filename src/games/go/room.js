import {goBoard, goPosition} from './board.js';
import {readKey, remotePrefix, roomCode, roomPrefix, roomSlot, validKey, writeKey} from './room-code.js';
import {forfeitMessage, mountMatch} from '../../online/client.js';
import {mountChat} from '../../online/chat.js';
import {playerName} from '../../online/profile.js';

const colors = {1:'чёрные',2:'белые'};

export function renderNetworkGo(root) {
  const play = root.querySelector('#play');
  const board = play.querySelector('[data-go-field]');
  const status = play.querySelector('#status');
  const turn = play.querySelector('#turn');
  const pass = play.querySelector('#pass');
  for (const selector of ['.board-heading label','#undo','#restart','[data-save-note]','.go-backup']) {
    play.querySelector(selector).hidden = true;
  }
  play.querySelector('aside .eyebrow').textContent = 'СЕТЕВАЯ ПАРТИЯ';
  play.querySelector('.board-heading h2').textContent = 'Сетевая партия';
  turn.textContent = 'Ожидаем игроков';
  pass.hidden = true;
  const connection = mountMatch(root,'go',match => {
    const {state} = match;
    const canMove = match.ready && !match.ended && match.side === state.turn;
    board.innerHTML = goBoard(state,canMove);
    pass.hidden = !canMove;
    turn.textContent = match.ended ? 'Партия завершена' : !match.ready ? 'Ждём белых'
      : canMove ? 'Ваш ход' : 'Ходит ' + match.names[state.turn - 1];
    status.textContent = forfeitMessage(match) || (state.points
      ? `Победили ${colors[state.points[1] > state.points[2] ? 1 : 2]}. Счёт ${state.points[1]} : ${state.points[2]}.`
      : state.passes ? 'Ещё один пас завершит партию.' : '');
    play.querySelector('[data-last-position]').textContent = state.last == null ? ''
      : 'Последний ход: ' + goPosition(state.last,state.size);
    play.querySelector('#black-captures').textContent = state.captures[1];
    play.querySelector('#white-captures').textContent = state.captures[2];
    play.querySelector('.capture-note').textContent = `Вы играете за ${match.side === 1 ? 'чёрных' : 'белых'}.`;
  });
  pass.onclick = () => connection?.send({action:'pass'});
  board.onclick = event => {
    const point = event.target.closest('[data-i]:enabled');
    if (point) connection?.send({action:'play',point:Number(point.dataset.i)});
  };
}
async function api(origin,path,key,body) {
  const response = await fetch(origin + '/api/go' + path,{
    method:body === undefined ? 'GET' : 'POST',
    headers:{...(key && {Authorization:'Bearer ' + key}), ...(body !== undefined && {'Content-Type':'application/json'})},
    body:body === undefined ? undefined : JSON.stringify(body),
    cache:'no-store',
    keepalive:path === '/leave',
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
  const area = root.querySelector('#play');
  const board = area.querySelector('[data-go-field]');
  const turn = area.querySelector('#turn');
  const status = area.querySelector('#status');
  area.querySelector('#size').disabled = true;
  area.querySelector('.board-heading label').hidden = true;
  for (const selector of ['#undo','#restart','[data-save-note]','.go-backup']) {
    area.querySelector(selector).hidden = true;
  }
  area.querySelector('aside .eyebrow').textContent = 'СЕТЕВАЯ ПАРТИЯ';
  area.querySelector('.board-heading h2').textContent = 'Сетевая партия';
  turn.textContent = 'Комната го';
  const actions = area.querySelector('.game-actions');
  actions.insertAdjacentHTML('beforeend',`
    <button class="button dark" data-join hidden>Играть за белых</button>
    <button class="button secondary" data-leave hidden>Покинуть партию</button>
    <button class="button secondary" data-invite hidden>Скопировать приглашение</button>
    <input class="go-room-invite" aria-label="Ссылка приглашения" data-invite-url readonly hidden>`);
  const join = area.querySelector('[data-join]');
  const pass = area.querySelector('#pass');
  pass.hidden = true;
  const leave = area.querySelector('[data-leave]');
  const invite = area.querySelector('[data-invite]');
  const link = area.querySelector('[data-invite-url]');
  if (!validKey(code)) {
    status.textContent = 'Проверьте код комнаты или ссылку приглашения.';
    return;
  }
  link.value = new URL(remote ? remotePrefix + encodeURIComponent(inviteCode) : roomPrefix + code,location.href).href;
  link.onclick = () => link.select();
  invite.onclick = async () => {
    try {
      await navigator.clipboard.writeText(link.value);
      invite.textContent = 'Приглашение скопировано';
    } catch {
      link.hidden = false;
      link.select();
    }
  };
  let state;
  let busy = false;
  let disconnected = false;
  const chatArea = document.createElement('div');
  area.after(chatArea);
  const chat = mountChat(chatArea,async text => {
    show(await request('/chat',key,{text}));
  });
  const canMove = () => state?.ready && !state.ended && state.turn === state.side && !disconnected;

  function paint() {
    if (!state) return;
    board.innerHTML = goBoard(state,canMove());
    area.querySelector('[data-last-position]').textContent = state.last == null ? '' : 'Последний ход: ' + goPosition(state.last,state.size);
    area.querySelector('#black-captures').textContent = state.captures[1];
    area.querySelector('#white-captures').textContent = state.captures[2];
    area.querySelector('.capture-note').textContent = `Вы играете за ${state.side === 1 ? 'чёрных' : 'белых'}.`;
    pass.hidden = !canMove();
    invite.hidden = state.side !== 1 || state.ready;
    link.hidden = invite.hidden || link.hidden;
    leave.hidden = !state.ready || state.ended;
    leave.disabled = disconnected;
    turn.textContent = state.ended ? 'Партия завершена'
      : !state.ready ? 'Ждём белых'
      : state.turn === state.side ? 'Ваш ход' : 'Ход соперника';
    const forfeits = state.forfeits || [];
    const forfeitMessage = forfeits.length === 2 ? 'Оба игрока проиграли за выход из партии.'
      : forfeits.includes(state.side) ? 'Вы проиграли за выход из партии.'
      : 'Вы победили. Соперник покинул партию.';
    status.textContent = disconnected ? 'Нет связи с сервером. Пробуем подключиться снова.'
      : forfeits.length ? forfeitMessage
      : state.ended ? `Победили ${colors[state.points[1] > state.points[2] ? 1 : 2]}. Счёт: ${state.points[1]} : ${state.points[2]}.`
      : state.passes ? 'Ещё один пас завершит партию.'
      : !state.ready ? 'Отправьте приглашение второму игроку.' : '';
  }

  function show(next) {
    if (!area.isConnected) return;
    chat(next.messages || []);
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
  leave.onclick = async () => {
    if (busy || !confirm('Покинуть партию и засчитать поражение?')) return;
    busy = true;
    try { show(await request('/leave',key,{})); }
    catch (error) { status.textContent = error.message; }
    finally { busy = false; }
  };
  join.onclick = async () => {
    if (busy) return;
    busy = true;
    join.disabled = true;
    try {
      const {key:guestKey,...view} = await request('/' + code + '/join',null,{name:playerName()});
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
        let next = await request('',key);
        if (next.side === 1 && playerName() && next.names && next.names[0] !== playerName()) {
          next = await request('/name',key,{name:playerName()});
        }
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
  window.addEventListener('hashchange',() => {
    if (key && state?.ready && !state.ended) request('/leave',key,{}).catch(() => {});
  },{once:true});
  poll();
}
