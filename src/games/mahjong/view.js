import {apiOrigin} from './config.js';
import {inMatch,mountMatch} from '../../online/client.js';
import {mountLobby} from '../../online/lobby.js';
import {mountChat} from '../../online/chat.js';
import {playerName} from '../../online/profile.js';

const route = '#/games/mahjong';
const online = apiOrigin !== null;
const modes = {chinese:'Китайский',riichi:'Японский риичи'};
const winds = ['Восток','Юг','Запад','Север'];
const honors = ['東','南','西','北','中','發','白'];
const honorNames = [...winds,'Красный дракон','Зелёный дракон','Белый дракон'];
const actions = {ron:'Победа со сброса',tsumo:'Победа с добора',chi:'Чи · последовательность',
  pon:'Пон · тройка',kan:'Кан · четвёрка',closed:'Закрытый кан',riichi:'Объявить риичи',pass:'Пропустить'};
const escape = value => String(value).replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);

function face(tile) {
  if (tile >= 27) return {top:honors[tile - 27], bottom:'', name:honorNames[tile - 27], suit:tile === 32 ? 1 : 0};
  const suit = Math.floor(tile / 9);
  const number = tile % 9 + 1;
  return {top:number, bottom:['萬','竹','筒'][suit], name:number + ' · ' + ['символы','бамбуки','круги'][suit], suit};
}

function tileMarkup(tile, action, drawn = false) {
  const {top,bottom,name,suit} = face(tile);
  const content = `<b aria-hidden="true">${top}</b>${bottom ? `<small aria-hidden="true">${bottom}</small>` : ''}`;
  const cls = `mj-tile suit-${suit}${drawn ? ' drawn' : ''}`;
  return action
    ? `<button class="${cls}" data-move="${action}" aria-label="Сбросить: ${name}">${content}</button>`
    : `<span class="${cls}" role="img" aria-label="${name}">${content}</span>`;
}

function rules() {
  return `<section id="rules" class="rules-section">
    <div class="section-heading"><div><span class="eyebrow">ЧЕТЫРЕ ИГРОКА · СКРЫТЫЕ РУКИ</span><h2>Правила и примеры</h2></div></div>
    <div class="rules-list">
      <article class="rule classic-rule"><span class="rule-number">01</span><div><h3>Набор и ход</h3><p>В наборе 136 костей: символы, бамбуки и круги от 1 до 9, четыре ветра и три дракона. Каждая кость встречается четыре раза. У каждого по 13 костей, Восток начинает с 14. На ходу вы добираете кость и сбрасываете одну. Ваша рука видна только вам.</p></div></article>
      <article class="rule classic-rule"><span class="rule-number">02</span><div><h3>Четыре набора и пара</h3><p>Соберите четыре набора и пару. Набор — три подряд в одной масти (чи), три одинаковых (пон) или четыре одинаковых (кан). Ветры и драконы не образуют последовательностей. Особые выигрышные руки — семь разных пар или тринадцать сирот: все единицы, девятки и знаки, плюс дубль любой из них.</p><div class="rule-example"><b>Чи из символов</b><div class="mj-tiles">${[0,1,2].map(tile => tileMarkup(tile)).join('')}</div></div></div></article>
      <article class="rule classic-rule"><span class="rule-number">03</span><div><h3>Чужой сброс</h3><p>После сброса есть 10 секунд на заявку. Победа выше по приоритету, чем пон или кан, а они выше чи. При равном приоритете выигрывает ближайший по очереди игрок. Чи берут только у предыдущего игрока. При открытом наборе покажите свои кости набора и сделайте сброс. После кана сначала доберите замену.</p><div class="rule-example"><b>Пример</b><p>У вас две четвёрки бамбуков. Когда любой соперник сбрасывает третью, можно объявить пон.</p></div></div></article>
      <article class="rule classic-rule"><span class="rule-number">04</span><div><h3>Китайский режим</h3><p>Для выигрыша достаточно законченной руки: доберите последнюю кость или заберите чужой сброс. Это учебная раздача без цветов и подсчёта фанов. У турнирного китайского маджонга есть минимальный порог очков и дополнительные комбинации.</p></div></article>
      <article class="rule classic-rule"><span class="rule-number">05</span><div><h3>Что меняет риичи</h3><p>Для победы нужно хотя бы одно яку, например закрытая победа со своего добора, тройка драконов или рука без единиц, девяток и знаков. С закрытой рукой, которой не хватает одной кости, можно объявить риичи при сбросе. Это даёт яку, но после объявления вы сбрасываете только добранные кости. Дора даёт бонус, но сама по себе не даёт яку.</p><div class="rule-example"><b>Пример доры</b><p>Индикатор — девятка кругов. Дора — единица кругов. Две такие кости дают два бонуса.</p></div></div></article>
      <article class="rule classic-rule"><span class="rule-number">06</span><div><h3>Фуритэн и окончание</h3><p>В риичи, если один из ваших текущих аутов уже есть в собственных сбросах, выиграть можно только с добора. Пропуск доступной победы со сброса запрещает такую победу до следующего добора, а после риичи — до конца раздачи. Стол играет отдельные учебные раздачи с ограниченным списком яку, без расчёта хан и фу, ставок риичи, повышения открытого пона в кан и канов после риичи. Когда стена заканчивается, объявляется ничья.</p></div></article>
    </div>
    <p class="sources">Полные регламенты: <a href="https://mahjong-europe.org/portal/index.php?Itemid=167&amp;id=31&amp;option=com_content&amp;view=article">китайский маджонг ↗</a> · <a href="https://www.worldriichi.org/wrc-rules">World Riichi Championship ↗</a></p>
  </section>`;
}

async function request(path, key, body) {
  const response = await fetch(`${apiOrigin}/api/rooms${path}`, {
    method:body === undefined ? 'GET' : 'POST',
    headers:{...(key && {Authorization:`Bearer ${key}`}), ...(body !== undefined && {'Content-Type':'application/json'})},
    body:body === undefined ? undefined : JSON.stringify(body),
    cache:'no-store', signal:AbortSignal.timeout(8000),
    keepalive:path.endsWith('/leave'),
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error),{status:response.status});
  return data;
}

function playerMarkup(name, player, index, room) {
  return `<section class="mj-seat${room.table?.turn === index && room.table.phase === 'discard' ? ' active-seat' : ''}">
    <div class="mj-seat-heading"><b>${escape(name)}${index === room.seat ? ' · вы' : ''}</b><span>${winds[index]}${player?.riichi ? ' · риичи' : ''}</span></div>
    ${player ? `<small>${player.count} в руке</small>
      <div class="mj-river" aria-label="Сбросы">${player.river.filter(d => !d.called).map(d =>
        `<span${d.riichi ? ' class="mj-riichi-discard"' : ''}>${tileMarkup(d.tile)}</span>`).join('')}</div>
      ${player.melds.length ? `<div class="mj-melds" aria-label="Объявленные наборы">${player.melds.map(meld =>
        `<div class="mj-tiles">${meld.tiles.map(tile => tileMarkup(tile)).join('')}</div>`).join('')}</div>` : ''}` : ''}
  </section>`;
}

function roomMarkup(room) {
  const table = room.table;
  let title = `За столом ${room.names.length} из 4`;
  if (table?.phase === 'discard') title = table.turn === room.seat ? 'Ваш ход' : `Ходит ${room.names[table.turn]}`;
  if (table?.phase === 'claim') title = 'Последний сброс';
  if (table?.phase === 'end') {
    const {forfeits,winner,reason} = table.result;
    title = forfeits ? `Поражение за выход: ${forfeits.map(seat => room.names[seat]).join(', ')}`
      : winner === undefined ? reason : `${room.names[winner]} выиграл(а)`;
  }
  const moves = table?.actions || [];
  const discards = new Set(moves.filter(m => m.kind === 'discard').map(m => m.tile));
  const special = moves.filter(m => m.kind !== 'discard');
  const note = table?.result?.kind ? `${actions[table.result.kind]}${table.result.yaku.length ? ' · ' + table.result.yaku.join(', ') : ''}
    ${room.mode === 'riichi' ? ' · Дора: ' + table.result.dora : ''}` : '';
  return `<div class="mj-room-head"><div><span class="eyebrow">${modes[room.mode]}${room.code ? ' · ' + room.code : ''}</span><h2>${escape(title)}</h2></div>
    ${room.shared ? '' : '<button class="button secondary" data-copy>Скопировать приглашение</button>'}</div>
    ${!table ? '<p class="mj-instructions">Поделитесь ссылкой. Каждый игрок открывает её на своём устройстве.</p>' : ''}
    ${note ? `<p class="mj-instructions">${escape(note)}</p>` : ''}
    ${table ? `<div class="mj-wall"><span>В стене: ${table.wallCount}</span>
      ${table.indicators.length ? `<span>Индикаторы доры</span><div class="mj-tiles">${table.indicators.map(tile => tileMarkup(tile)).join('')}</div>` : ''}
      ${table.claim ? `<span>Сброс игрока ${escape(room.names[table.claim.from])}</span>${tileMarkup(table.claim.tile)}<span data-countdown></span>` : ''}</div>` : ''}
    <div class="mj-seats">${Array.from({length:4},(_,index) =>
      playerMarkup(room.names[index] || 'Свободно',table?.players[index],index,room)).join('')}</div>
    ${table ? `<div class="mj-hand"><b>Ваша рука</b>${discards.size ? '<small>Нажмите на кость, чтобы сбросить её</small>' : ''}
      <div class="mj-tiles">${table.hand.map((tile,index) => tileMarkup(tile,
        discards.has(tile) ? 'discard-' + tile : null,tile === table.drawn && table.hand.lastIndexOf(tile) === index)).join('')}</div></div>` : ''}
    ${special.length ? `<div class="mj-actions">${special.map(move => `<button class="button ${move.kind === 'pass' ? 'secondary' : 'dark'}" data-move="${move.id}">${actions[move.kind]}${move.tile !== undefined ? ' · ' + face(move.tile).name : ''}${move.tiles ? ' · ' + move.tiles.map(t => face(t).name).join(' + ') : ''}</button>`).join('')}</div>` : ''}
    ${!room.shared && table && table.phase !== 'end' ? '<button class="button secondary" data-leave>Покинуть партию</button>' : ''}
    ${room.host && room.names.length === 4 && (!table || table.phase === 'end' && !table.result.forfeits) ? '<button class="button dark" data-start>Начать раздачу</button>' : ''}`;
}

export function render(root) {
  const invited = location.hash.split('/')[3]?.toUpperCase();
  const code = /^[A-F0-9]{10}$/.test(invited || '') ? invited : '';
  let room;
  let key;
  let busy = false;
  let pending = Promise.resolve();
  let rendered = '';
  root.innerHTML = `<section class="game-intro"><a href="#/" class="back">← Все игры</a>
    <div class="eyebrow">МАДЖОНГ · ОНЛАЙН</div><h1>Маджонг<em>У каждого своя рука.</em></h1>
    <p>Четыре игрока за одним столом. Каждый со своего устройства.</p>
    <div class="intro-meta"><a href="#rules">Правила и примеры ↓</a></div></section>
    <section class="mj-area" id="play"><p class="mj-status" role="status"></p><div data-room></div></section>${rules()}`;
  const area = root.querySelector('.mj-area');
  const panel = area.querySelector('[data-room]');
  if (inMatch('mahjong')) {
    const connection = mountMatch(root,'mahjong',match => {
      const table = match.forfeits.length
        ? {...match.state,phase:'end',result:{forfeits:match.forfeits.map(side => side - 1)},actions:[],claim:null}
        : match.state;
      room = {shared:true,table,seat:match.side - 1,names:match.names,mode:match.option};
      panel.innerHTML = roomMarkup(room);
      updateCountdown();
    });
    panel.onclick = event => {
      const id = event.target.closest('[data-move]')?.dataset.move;
      if (id) connection?.send({action:'play',id,tableVersion:room.table.version});
    };
    const timer = setInterval(() => {
      if (area.isConnected) updateCountdown();
      else clearInterval(timer);
    },250);
    return;
  }
  mountLobby(area,'mahjong');
  if (!online) return;
  const chatArea = document.createElement('div');
  area.after(chatArea);
  const chat = mountChat(chatArea,async text => {
    await run(async () => show(await request('/' + room.code + '/chat',key,{text})),false,true);
  });
  const status = area.querySelector('[role="status"]');
  const say = message => { status.textContent = message; };
  const storage = 'table:mahjong:' + apiOrigin + ':';
  function lobby() {
    panel.innerHTML = online ? `<div class="mj-lobby">
      <form data-operation="create"><h2>Создать стол</h2>
      <label>Вариант<select name="mode"><option value="chinese">Китайский · проще начать</option><option value="riichi">Японский риичи · яку и фуритэн</option></select></label>
      <button class="button dark">Создать стол</button></form>
      <form data-operation="join"><h2>Войти по коду</h2><label>Код стола<input name="code" value="${code}" maxlength="10" pattern="[a-fA-F0-9]{10}" required></label>
      <button class="button dark">Занять место</button></form>
    </div>` : '<p class="mj-instructions">Онлайн-стол пока недоступен. Правила обоих вариантов можно прочитать ниже.</p>';
  }
  function show(value) {
    room = value;
    const markup = roomMarkup(room);
    if (markup !== rendered) {
      panel.innerHTML = markup;
      rendered = markup;
    }
    chat(value.messages || []);
    updateCountdown();
  }
  function updateCountdown() {
    const countdown = panel.querySelector('[data-countdown]');
    if (countdown) countdown.textContent = `· ${Math.max(0,Math.ceil((room.table.claim.until - Date.now()) / 1000))} с`;
  }
  function accept(response) {
    if (!area.isConnected) return;
    const {key:secret,...view} = response;
    key = secret;
    try { sessionStorage.setItem(storage + view.code,key); } catch {}
    history.replaceState(null,'',route + '/' + view.code);
    show(view);
  }
  function run(task, background = false, reportError = false) {
    if (busy || !area.isConnected) {
      if (reportError) return Promise.reject(new Error('Дождитесь ответа стола.'));
      return pending;
    }
    if (!background) busy = true;
    const result = pending.then(async () => {
      if (!area.isConnected) return;
      try {
        await task();
      } catch (error) {
        if (reportError) throw error;
        say(error.status ? error.message : 'Не удалось связаться со столом. Проверьте подключение.');
      }
    }).finally(() => {
      if (!background) busy = false;
    });
    pending = result.catch(() => {});
    return result;
  }
  area.onsubmit = event => {
    event.preventDefault();
    run(async () => {
      const data = {...Object.fromEntries(new FormData(event.target)),name:playerName()};
      const join = event.target.dataset.operation === 'join';
      accept(await request(join ? '/' + data.code.trim().toUpperCase() + '/join' : '',null,data));
      say('');
    });
  };
  area.onclick = event => {
    const button = event.target.closest('button');
    if (!room || !button) return;
    if ('leave' in button.dataset) {
      if (confirm('Покинуть партию и засчитать поражение?')) {
        run(async () => show(await request('/' + room.code + '/leave',key,{})));
      }
      return;
    }
    if ('copy' in button.dataset) {
      const link = new URL(route + '/' + room.code,location.href).href;
      navigator.clipboard?.writeText(link).then(() => say('Приглашение скопировано.'),() => say(link));
      if (!navigator.clipboard) say(link);
      return;
    }
    const start = 'start' in button.dataset;
    if (start || button.dataset.move) {
      const data = start ? {} : {id:button.dataset.move,version:room.table.version};
      const path = '/' + room.code + (start ? '/start' : '/move');
      run(async () => {
        if (!key) return;
        show(await request(path,key,data));
        say('');
      });
    }
  };
  lobby();
  window.addEventListener('hashchange',() => {
    if (key && room?.table && room.table.phase !== 'end') {
      request('/' + room.code + '/leave',key,{}).catch(() => {});
    }
  },{once:true});
  try { if (code) key = sessionStorage.getItem(storage + code); } catch {}
  async function poll() {
    if (!area.isConnected) return;
    if (key) await run(async () => {
      try {
        show(await request('/' + (room?.code || code),key));
        if (status.textContent.startsWith('Не удалось связаться')) say('');
      } catch (error) {
        if ([401,404].includes(error.status)) {
          key = null;
          room = null;
          rendered = '';
          lobby();
        }
        throw error;
      }
    },true);
    if (area.isConnected) setTimeout(poll,950);
  }
  poll();
}
