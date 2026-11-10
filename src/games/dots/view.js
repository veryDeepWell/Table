import * as engine from './engine.js';
import {renderTable} from '../table-view.js';
import {alphabet, coordinates, ranks} from '../coordinates.js';

const sides = ['Красные','Синие'];
const {size} = engine;
const grid = Array.from({length:size}, (_,i) => {
  const p = i + .5;
  return `M.5 ${p}h${size - 1}M${p} .5v${size - 1}`;
}).join('');

function board(game, state, legal) {
  const available = new Set(legal.map(move => move.to));
  const field = `<div class="dots-board" data-turn="${state.turn}" style="--size:${size}" role="group" aria-label="Поле 15 на 15 пересечений">
    <svg class="dots-grid-lines" viewBox="0 0 ${size} ${size}" aria-hidden="true"><path d="${grid}"/></svg>
    ${state.board.map((side,i) => {
      const owner = state.territory[i];
      const label = side ? sides[side - 1].toLowerCase() : 'свободно';
      return `<button type="button" class="dots-point dot-${side} territory-${owner}${state.last === i ? ' last' : ''}"
        aria-label="${alphabet[i % size]}${size - Math.floor(i / size)}, ${label}${owner ? ', окружено' : ''}"
        data-point="${i}" ${available.has(i) ? '' : 'disabled'}></button>`;
    }).join('')}
  </div>`;
  return coordinates(field,alphabet.slice(0,size),ranks(size),'dots');
}

const game = {
  id:'dots',name:'Точки',variant:'ИГРА НА ОКРУЖЕНИЕ',
  subtitle:'Замкните контур.',
  description:'Окружайте точки соперника, соединяя свои по горизонтали, вертикали и диагонали.',
  hint:'Точки ставятся на пересечения. Заливка показывает захваченные области.',
  sides,engine,board,placement:true,
  status:() => 'Поставьте точку на свободное пересечение.',
  controls:state => `<div class="dots-score" aria-label="Счёт захватов">
    <div><span>Красные</span><b>${state.captures[0]}</b></div>
    <div><span>Синие</span><b>${state.captures[1]}</b></div>
  </div>${state.result ? '' : '<button type="button" class="button secondary" data-action="finish">Закончить по счёту</button>'}`,
  source:{name:'Учебник по игре «Точки» на Zagram',url:'https://zagram.org/tutorial/points-tutorial.pdf'},
  rules:[
    ['Постановка точек','Поле состоит из 15 × 15 пересечений. Красные начинают. За ход ставится одна точка на свободное пересечение. Поставленные точки остаются на месте.',
      'Можно поставить точку по диагонали от предыдущей, чтобы продолжить контур.'],
    ['Захват','Соедините соседние свои точки по горизонтали, вертикали или диагонали в замкнутый контур. Если внутри есть активные точки соперника, область захватывается. Каждая захваченная чужая точка даёт одно очко.',
      'Синяя точка на H8. Красные точки на H9, I8, H7 и G8 замыкают вокруг неё ромб. Красные получают одно очко.'],
    ['Пустой контур и край','В пустом контуре ещё можно ходить. Если соперник поставил туда точку и этим ходом сам ничего в этом контуре не захватил, она окружится автоматически. Край доски не закрывает контур. Точки на краю нельзя окружить.',
      'Если одна вершина ромба отсутствует, у точки внутри остаётся выход и захват не происходит.'],
    ['Как считается результат','В этом варианте захват окончательный. В захваченную область нельзя ставить точки, а точки внутри неё не участвуют в новых контурах. Игра заканчивается, когда нет доступных ходов, или по согласию обоих игроков. Побеждает тот, кто захватил больше чужих точек.',
      'Если красные захватили три точки, а синие две, красные выигрывают со счётом 3:2.'],
  ],
};

export const render = root => renderTable(root,game);
