import * as engine from './engine.js';
import {renderTable} from '../table-view.js';
import {alphabet,coordinates,ranks} from '../coordinates.js';

const {width,height} = engine;
const names = {k:'Генерал',a:'Советник',e:'Слон',n:'Конь',r:'Ладья',c:'Пушка',p:'Пешка'};
const symbols = [{k:'帥',a:'仕',e:'相',n:'馬',r:'車',c:'炮',p:'兵'},
  {k:'將',a:'士',e:'象',n:'馬',r:'車',c:'砲',p:'卒'}];
const sides = ['Красные','Чёрные'];
const notation = point => alphabet[point % width] + (height - Math.floor(point / width));

function board(game,state,legal,selected) {
  const sources = new Set(legal.map(move => move.from));
  const destinations = new Set(legal.filter(move => move.from === selected).map(move => move.to));
  const cells = state.board.map((piece,index) => {
    const y = Math.floor(index / width), x = index % width;
    const edges = [y === 0 && 'top',y === 9 && 'bottom',x === 0 && 'left',x === 8 && 'right',
      y === 4 && x > 0 && x < 8 && 'bottom',y === 5 && x > 0 && x < 8 && 'top'].filter(Boolean).join(' ');
    const classes = [edges,index === selected && 'selected',destinations.has(index) && 'target',
      state.last?.includes(index) && 'last'].filter(Boolean).join(' ');
    const description = piece ? names[piece.type] + ', ' + sides[piece.side-1].toLowerCase() : 'пусто';
    return `<button class="xiangqi-point ${classes}" data-point="${index}" aria-label="${notation(index)}, ${description}"
      ${sources.has(index) || destinations.has(index) ? '' : 'disabled'}>${piece
        ? `<span class="xiangqi-piece side-${piece.side}">${symbols[piece.side-1][piece.type]}</span>` : ''}</button>`;
  }).join('');
  return coordinates(`<div class="xiangqi-board" role="group" aria-label="Доска сянци">${cells}
    <div class="xiangqi-palace north" aria-hidden="true"></div><div class="xiangqi-palace south" aria-hidden="true"></div>
    </div>`,alphabet.slice(0,width),ranks(height),'xiangqi');
}

export const render = root => renderTable(root,{
  id:'xiangqi',name:'Сянци',sides,engine,board,notation,
  hint:'Красные начинают. Фигуры стоят на пересечениях линий.',
  status:state => engine.inCheck(state.board,state.turn) ? 'Шах. Защитите генерала.' : 'Выберите фигуру.',
  source:{name:'Правила Всемирной федерации сянци',url:'https://www.wxf-xiangqi.org/images/wxf-rules/2018_World_XiangQi_Rules_English2018.pdf'},
  rules:[
    ['Доска и цель','На доске 9 × 10 пересечений. Река проходит между двумя половинами, а дворцы генералов отмечены диагоналями. Красные начинают. Мат или отсутствие разрешённых ходов означает поражение.'],
    ['Генерал и советники','Генерал ходит на один шаг по прямой, советник — на один шаг по диагонали. Оба остаются в своём дворце. Генералы не могут смотреть друг на друга по одной вертикали без фигуры между ними.'],
    ['Ладья и пушка','Ладья движется по прямой до первой фигуры. Пушка так же ходит на пустые точки, а для взятия перепрыгивает ровно через одну фигуру любого цвета.','Если между пушкой и целью две фигуры или ни одной, взятие невозможно.'],
    ['Конь и слон','Конь идёт на шаг по прямой и затем на шаг по диагонали наружу. Фигура на первом шаге блокирует ход. Слон идёт ровно на две точки по диагонали, если середина свободна. Слон остаётся на своей стороне реки.'],
    ['Пешка','До реки пешка ходит на один шаг вперёд. После переправы может также идти на шаг вбок. Назад пешка не ходит и на последнем ряду сохраняет свои свойства.'],
    ['Повторение','В этой версии третье появление позиции с той же стороной на ходу даёт ничью. Если только одна сторона давала шах на каждом своём ходу в повторяющемся цикле, она проигрывает. Турнирные правила преследования фигур здесь не применяются.'],
  ],
});
