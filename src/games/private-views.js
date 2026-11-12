import {inMatch,mountMatch,forfeitMessage} from '../online/client.js';
import {mountLobby} from '../online/lobby.js';
import {mountReplay} from './replay.js';
import {alphabet,coordinates,ranks} from './coordinates.js';

const rules = {
  battleship:[
    ['Расстановка','На поле 10 × 10 поставьте один четырёхпалубный, два трёхпалубных, три двухпалубных и четыре однопалубных корабля. Корабли ставятся по прямой и не касаются даже углами. Можно расставить флот случайно.'],
    ['Стрельба','Выбирайте клетку поля противника. После попадания стреляйте снова. Промах передаёт ход. Корабль тонет, когда подбиты все его клетки. Побеждает тот, кто потопит весь флот соперника.'],
  ],
  domino:[
    ['Команды и начало','Четверо играют командами: места 1 и 3 против 2 и 4. Каждый получает семь костей. Первую раздачу открывает игрок с дублем 1–1.'],
    ['Как ходить','Приложите кость к любому концу цепочки так, чтобы соприкасающиеся числа совпали. Если подходит к обоим концам, выберите сторону. Если хода нет, пропустите ход.'],
    ['Очки и «рыба»','Раздачу выигрывает команда игрока, первым выложившего все кости. Если все четверо пропустили ход подряд, побеждает команда с меньшей суммой точек на руках. При равенстве очки не начисляются. Проигравшей команде записывают сумму точек на её руках. Матч заканчивается, когда команда набирает 101 штрафное очко.'],
  ],
};

const titles = {battleship:'Морской бой',domino:'Домино · Козёл'};
const action = (kind,label,extra = '') => `<button type="button" class="button secondary" data-kind="${kind}" ${extra}>${label}</button>`;
const tile = ([a,b]) => `<span class="domino-tile"><b>${a}</b><b>${b}</b></span>`;

function fleetBoard(ships,shots,mode,title) {
  const occupied = new Set(ships.flat());
  const cells = Array.from({length:100},(_,index) => {
    const coordinate = alphabet[index % 10] + (10 - Math.floor(index / 10));
    const value = shots[index] || (occupied.has(index) ? 'ship' : 'water');
    const description = {ship:'корабль',water:'вода',hit:'попадание',miss:'промах',sunk:'потоплен'}[value];
    return `<button type="button" class="fleet-cell ${value}" data-kind="${mode}" data-point="${index}"
      aria-label="${coordinate}, ${description}" ${!mode || mode === 'shoot' && shots[index] ? 'disabled' : ''}>${value === 'miss' ? '·' : value === 'hit' || value === 'sunk' ? '×' : ''}</button>`;
  }).join('');
  return `<section><h2>${title}</h2>${coordinates(`<div class="fleet-grid">${cells}</div>`,alphabet.slice(0,10),ranks(10),'square')}</section>`;
}

function battleMarkup(state,side,active,vertical) {
  const placing = active && !state.locked[side-1];
  const shooting = active && state.locked.every(Boolean) && state.turn === side;
  const controls = placing ? `<p>${state.nextShip ? `Выберите начало корабля длиной ${state.nextShip}.` : 'Флот расставлен.'}</p>
    <div class="private-actions">${action('rotate',vertical ? 'Вертикально' : 'Горизонтально')}
    ${action('random','Случайная расстановка')}${action('clear','Очистить поле')}
    ${action('ready','Флот готов',state.nextShip ? 'disabled' : '')}</div>` : '';
  return `${controls}<div class="fleet-boards">
    ${fleetBoard(state.ships,state.incoming,placing && state.nextShip ? 'place' : '', 'Ваш флот')}
    ${fleetBoard([],state.shots,shooting ? 'shoot' : '', 'Поле соперника')}</div>`;
}

function dominoMarkup(state,side,active) {
  const playing = active && state.turn === side && !state.roundResult;
  return `<p>Раздача ${state.round} · Штрафные очки команд ${state.scores.join(' : ')}</p>
    <p>Костей на руках · ${state.counts.map((count,index) => `Место ${index+1}: ${count}`).join(' · ')}</p>
    <div class="domino-chain" aria-label="Цепочка костей">${state.chain.map(tile).join('') || 'Цепочка пока пуста.'}</div>
    <h2>Ваши кости</h2><div class="domino-hand">${state.hand.map((value,index) => `<div>${tile(value)}
      ${playing ? state.actions.filter(move => move.tile === index).map(move =>
        action('tile',state.chain.length ? move.end === 'left' ? 'Слева' : 'Справа' : 'Начать',`data-tile="${index}" data-end="${move.end}"`)).join('') : ''}</div>`).join('')}</div>
    ${playing && !state.actions.length ? action('pass','Пропустить ход') : ''}
    ${state.roundResult ? `<p>${state.roundResult.blocked ? 'Рыба. ' : ''}${state.roundResult.winningTeam === null
      ? 'Ничья' : 'Раздачу выиграла команда ' + (state.roundResult.winningTeam + 1)}.</p>` : ''}
    ${active && state.roundResult && side === 1 ? action('next','Следующая раздача') : ''}`;
}

function status(match,game) {
  if (!match.ready) return `Ожидаем игроков · ${match.names.length} из ${game === 'domino' ? 4 : 2}`;
  if (match.forfeits.length) return forfeitMessage(match);
  const state = match.state;
  if (state.result) return game === 'domino' ? `Матч выиграла команда ${state.result.winner}`
    : state.result.winner === match.side ? 'Вы потопили флот соперника' : 'Ваш флот потоплен';
  if (game === 'battleship' && !state.locked.every(Boolean)) {
    return state.locked[match.side-1] ? 'Ждём расстановку соперника' : 'Расставьте флот';
  }
  if (state.roundResult) return 'Раздача завершена';
  return state.turn === match.side ? 'Ваш ход' : `Ход игрока на месте ${state.turn}`;
}

export const privateView = game => ({render(root) {
  root.innerHTML = `<section id="play" class="mj-area"><h1>${titles[game]}</h1>
    <p class="mj-status" role="status"></p><div data-room></div></section>
    <section id="rules" class="rules-section"><h2>Правила</h2><div class="rules-list">
    ${rules[game].map(([title,body],index) => `<article class="rule classic-rule"><span class="rule-number">${index+1}</span><div><h3>${title}</h3><p>${body}</p></div></article>`).join('')}</div></section>`;
  const play = root.querySelector('#play');
  const board = play.querySelector('[data-room]');
  const readout = play.querySelector('[role="status"]');
  if (!inMatch(game)) {
    mountLobby(play,game).open = true;
    readout.textContent = game === 'domino' ? 'Для партии нужны четыре игрока.' : 'Создайте комнату для игры вдвоём.';
    return;
  }
  let match;
  let vertical = false;
  const markup = game === 'domino' ? dominoMarkup : battleMarkup;
  const replay = mountReplay(play,board,state => markup(state,match.side,false,vertical));
  const paint = next => {
    match = next;
    readout.textContent = status(match,game);
    board.innerHTML = match.state ? markup(match.state,match.side,!match.ended,vertical) : '';
  };
  const connection = mountMatch(root,game,paint,archive => replay(archive.positions.map(({position},index) => ({
    state:position,label:index ? `${index}. ${game === 'domino' ? 'Действие' : 'Позиция флота'}` : 'Начальная позиция',
  }))));
  board.onclick = event => {
    const button = event.target.closest('[data-kind]');
    if (!button || !button.dataset.kind) return;
    const {kind,point,tile,end} = button.dataset;
    if (kind === 'rotate') {
      vertical = !vertical;
      paint(match);
      return;
    }
    connection?.send({action:'play',kind,point:point === undefined ? undefined : Number(point),
      tile:tile === undefined ? undefined : Number(tile),end,vertical});
  };
}});
