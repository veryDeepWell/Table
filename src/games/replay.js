import {mountGameLayout} from './game-layout.js';

export function mountReplay(play,live,renderPosition) {
  const sidebar = document.createElement('aside');
  sidebar.className = 'move-history';
  sidebar.innerHTML = '<h2>История ходов</h2><button class="text-button" hidden>К текущей позиции</button><ol></ol><p>Ходов пока нет.</p>';
  mountGameLayout(play,live,sidebar);
  const preview = document.createElement('div');
  preview.className = 'replay-position';
  preview.inert = true;
  preview.hidden = true;
  live.after(preview);
  const list = sidebar.querySelector('ol');
  const back = sidebar.querySelector('button');
  let entries = [];
  let selected = -1;
  function select(index) {
    selected = index;
    live.hidden = index >= 0;
    preview.hidden = back.hidden = index < 0;
    preview.innerHTML = index < 0 ? '' : renderPosition(entries[index].state);
    for (const button of list.querySelectorAll('button')) {
      button.setAttribute('aria-pressed',String(Number(button.dataset.position) === index));
    }
  }
  back.onclick = () => select(-1);
  list.onclick = event => {
    const button = event.target.closest('[data-position]');
    if (button) select(Number(button.dataset.position));
  };
  return next => {
    entries = next;
    list.replaceChildren(...entries.map(({label},index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.className = 'text-button';
      button.dataset.position = index;
      button.textContent = label;
      item.append(button);
      return item;
    }));
    sidebar.querySelector('p').hidden = entries.length > 0;
    select(selected < entries.length ? selected : -1);
  };
}

export function boardReplay(engine,archive,describeMove = () => 'Ход') {
  if (!archive) return [];
  const {previous = [],events = []} = archive;
  let state = archive.side ? engine.create() : previous.at(-1) || archive.initial;
  const positions = previous.map((position,index) => ({state:position,label:index ? `${index}. Ход` : 'Начальная позиция'}));
  if (!positions.length && state) positions.push({state,label:'Начальная позиция'});
  for (const [index,entry] of events.entries()) {
    const {event,move,dice} = entry;
    if (event === 'play') state = engine.play(state,move);
    else if (event === 'roll') state = engine.roll(state,...dice);
    else if (event === 'finish') state = engine.finish(state);
    else if (event === 'claim') state = {...state,result:{reason:engine.claim(state)}};
    else continue;
    const label = event === 'roll' ? 'Бросок ' + dice.join(' и ') : event === 'play' ? describeMove(move) : 'Завершение';
    positions.push({state,label:`${index + Math.max(previous.length,1)}. ${label}`});
  }
  return positions;
}
