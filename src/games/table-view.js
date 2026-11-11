import {label} from './grid.js';
import {alphabet, coordinates, ranks} from './coordinates.js';
import {loadSave, saveGame, saveMessage} from './local-save.js';
import {forfeitMessage, inMatch, mountMatch} from '../online/client.js';
import {mountLobby} from '../online/lobby.js';

export function pieceMarkup(game, piece) {
  const type = piece.type.replace('+', '');
  const symbol = game.symbols[piece.type] || game.symbols[type];
  return `<span aria-hidden="true" class="table-piece side-${piece.side} ${piece.type.startsWith('+') ? 'promoted' : ''}">${symbol}</span>`;
}

function gridBoard(game, state, legal, selected) {
  const {size, id, names} = game;
  const board = `<div class="table-grid ${id}-grid" style="--size:${size}" role="group" aria-label="Игровая доска">
    ${state.board.map((p,i) => {
      const shade = (Math.floor(i / size) + i % size) % 2 ? 'dark-cell' : 'light-cell';
      const source = legal.some(move => move.from === i);
      const destination = legal.some(move => move.to === i &&
        (move.from === selected || move.drop === selected));
      const active = source || destination || selected === i;
      const description = p ? `${names[p.type] || names[p.type.replace('+','')]}, ${game.sides[p.side - 1]}` : 'пусто';
      return `<button type="button" class="table-cell ${shade}${destination ? ' target-cell' : ''}${selected === i ? ' selected-cell' : ''}${state.last?.includes(i) ? ' last-cell' : ''}${state.taken?.includes(i) ? ' taken-cell' : ''}" data-point="${i}" aria-label="${label(i,size)}, ${description}" ${active ? '' : 'disabled'}>
        ${p ? pieceMarkup(game,p) : ''}
      </button>`;
    }).join('')}
  </div>`;
  return coordinates(board,alphabet.slice(0,size).toLowerCase(),ranks(size),'square');
}

function renderRules(rules, source) {
  return `<section id="rules" class="rules-section">
    <div class="section-heading"><div><span class="eyebrow">КАК ИГРАТЬ</span><h2>Правила и примеры</h2></div></div>
    <div class="rules-list">${rules.map(([title,text,example],i) => `<article class="rule classic-rule">
      <span class="rule-number">${String(i + 1).padStart(2,'0')}</span>
      <div><h3>${title}</h3><p>${text}</p>${example ? `<div class="rule-example"><b>Пример</b><p>${example}</p></div>` : ''}</div>
    </article>`).join('')}</div>
    ${source ? `<p class="sources"><a href="${source.url}" target="_blank" rel="noreferrer">${source.name} ↗</a></p>` : ''}
  </section>`;
}

export function renderTable(root, game) {
  const network = inMatch(game.id);
  let match;
  let connection;
  const key = `table:${game.id}:v1`;
  let state = game.engine.create();
  let history = [];
  let selected = null;
  let pending = [];
  const saved = loadSave(key, value =>
    value?.state?.board?.length === state.board.length && Array.isArray(value.history) ? value : null);
  if (saved) ({state,history} = saved.value);
  let saveLocation = saved?.location;

  root.innerHTML = `<section class="game-intro classic-intro">
    <a href="#/" class="back">← Все игры</a>
    <div class="eyebrow">СТРАТЕГИЯ / ${game.variant}</div>
    <h1>${game.name}<em>${game.subtitle}</em></h1>
    <p>${game.description}</p><div class="intro-meta"><span>♙ 2 игрока</span><span>◉ ${network ? 'Сетевая партия' : 'На одном устройстве'}</span></div>
  </section>
  <div class="game-tabs"><a href="#play">Играть <span>↗</span></a><a href="#rules">Правила и примеры <span>↓</span></a></div>
  <section id="play" class="play-section classic-play">
    <div class="board-column">
      <div class="board-heading"><h2>Игровая доска</h2></div>
      <div data-game-board></div>
      <div class="board-caption">${game.hint}</div>
    </div>
    <aside class="game-panel classic-panel">
      <span class="eyebrow">${network ? 'СЕТЕВАЯ ПАРТИЯ' : 'ЛОКАЛЬНАЯ ПАРТИЯ'}</span>
      <h2 data-turn></h2>
      <p id="status" role="status" aria-live="polite"></p>
      <div data-choices></div>
      <div class="game-actions">
        <button data-action="undo" class="button secondary" ${network ? 'hidden' : ''}>↶ Отменить действие</button>
        <button data-action="restart" class="text-button" ${network ? 'hidden' : ''}>Начать заново</button>
      </div>
      <p class="save-note" data-save-note role="status" ${network ? 'hidden' : ''}></p>
      <a href="#rules" class="text-link">К правилам ↓</a>
    </aside>
  </section>${renderRules(game.rules,game.source)}`;

  const board = root.querySelector('[data-game-board]');
  const choices = root.querySelector('[data-choices]');
  const saveNote = root.querySelector('[data-save-note]');
  const playSection = root.querySelector('#play');
  if (!network) mountLobby(playSection,game.id);
  const canMove = () => !network || Boolean(match?.ready && !match.ended && match.side === state.turn);
  let legal = [];

  function refresh() {
    if (state.chain != null) selected = state.chain;
    legal = canMove() ? game.engine.moves(state) : [];
    saveNote.textContent = saveMessage(saveLocation);
    saveNote.classList.toggle('save-warning',saveLocation === 'memory' || saveLocation === 'sessionStorage');
    const result = state.result;
    const side = game.sides[state.turn - 1];
    const forfeited = match && forfeitMessage(match);
    root.querySelector('h2[data-turn]').textContent = forfeited ? 'Партия завершена'
      : network && !match?.ready ? 'Ожидаем игроков'
      : result
      ? (result.winner ? `${game.sides[result.winner - 1]} победили` : 'Ничья')
      : state.opening ? (network ? (canMove() ? 'Ваш первый бросок' : 'Первый бросок соперника') : 'Первый бросок')
      : network ? (canMove() ? 'Ваш ход' : 'Ходит ' + match.names[state.turn - 1]) : `Ходят ${side.toLowerCase()}`;
    root.querySelector('#status').textContent = forfeited || result?.reason || (canMove() ? game.status(state) : '');
    board.innerHTML = (game.board || gridBoard)(game,state,legal,selected);
    const options = pending.length
      ? `<div class="move-options" aria-label="Варианты хода">${pending.map((move,i) =>
        `<button class="button secondary" data-choice="${i}">${game.choice(move)}</button>`).join('')}
        <button class="text-button" data-action="cancel">Назад</button></div>`
      : game.controls?.(state,selected,legal) || '';
    const claim = canMove() && (network ? state.canClaim : game.engine.claim?.(state));
    choices.innerHTML = options + (claim && !pending.length
      ? '<button class="button secondary" data-action="claim">Заявить ничью</button>' : '');
    root.querySelector('[data-action="undo"]').disabled = !history.length;
    if (network) {
      choices.querySelector('[data-action="finish"]')?.remove();
      const roll = choices.querySelector('[data-action="roll"]');
      if (roll) roll.disabled = !canMove();
    }
  }

  function commit(next) {
    if (next === state) return;
    history = [...history.slice(-19),state];
    state = next;
    saveLocation = saveGame(key,{state,history});
    selected = null;
    pending = [];
    refresh();
  }

  function play(move) {
    if (network) connection.send({action:'play',index:legal.indexOf(move)});
    else commit(game.engine.play(state,move));
  }

  playSection.onclick = event => {
    const button = event.target.closest('button');
    if (!button || button.disabled || !canMove()) return;
    if (button.dataset.action === 'undo') {
      if (!history.length) return;
      state = history.pop();
      saveLocation = saveGame(key,{state,history:[...history]});
      selected = null;
      pending = [];
    } else if (button.dataset.action === 'restart') {
      if (history.length && !confirm('Начать новую партию?')) return;
      state = game.engine.create();
      history = [];
      saveLocation = saveGame(key,{state,history});
      selected = null;
      pending = [];
    } else if (button.dataset.action === 'cancel') {
      pending = [];
    } else if (button.dataset.action === 'claim') {
      if (network) { connection.send({action:'claim'}); return; }
      const reason = game.engine.claim(state);
      if (reason) commit({...state,result:{reason}});
      return;
    } else if (button.dataset.action === 'roll') {
      if (network) { connection.send({action:'roll'}); return; }
      commit(game.roll(state));
      return;
    } else if (button.dataset.action === 'finish') {
      if (!state.result && game.engine.finish && confirm('Оба игрока согласны закончить партию?')) {
        commit(game.engine.finish(state));
      }
      return;
    } else if (button.dataset.choice !== undefined) {
      play(pending[Number(button.dataset.choice)]);
      return;
    } else if (button.dataset.drop) {
      selected = button.dataset.drop;
      pending = [];
    } else if (button.dataset.point !== undefined) {
      const point = Number(button.dataset.point);
      const candidates = legal.filter(move => move.to === point &&
        (game.placement || move.from === selected || move.drop === selected));
      if (candidates.length === 1) {
        play(candidates[0]);
        return;
      }
      pending = candidates;
      if (!pending.length) selected = legal.some(move => move.from === point) ? point : null;
    } else return;
    refresh();
  };
  if (network) {
    state = game.engine.create();
    connection = mountMatch(root,game.id,next => {
      match = next;
      state = next.state;
      selected = null;
      pending = [];
      refresh();
    });
  }
  refresh();
}
