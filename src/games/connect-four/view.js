import * as engine from './engine.js';
import {renderTable} from '../table-view.js';
import {alphabet, coordinates, ranks} from '../coordinates.js';

const sides = ['Красные','Жёлтые'];
const {width,height} = engine;

function board(game, state, legal) {
  const available = new Map(legal.map(move => [move.to,move.index]));
  const field = `<div class="four-board" data-turn="${state.turn}" role="group" aria-label="Поле 7 на 6">
    ${Array.from({length:width}, (_,col) => {
      const column = Array.from({length:height}, (_,row) => state.board[row * width + col]);
      const description = column.filter(Boolean).reverse().map(side => sides[side - 1].toLowerCase()).join(', ');
      return `<button type="button" class="four-column" data-point="${col}"
        aria-label="Столбец ${alphabet[col]}, ${description ? 'снизу вверх: ' + description : 'пусто'}" ${available.has(col) ? '' : 'disabled'}>
        ${column.map((side,row) => {
          const index = row * width + col;
          return `<span aria-hidden="true" class="four-slot side-${side}${state.last === index ? ' last' : ''}${state.line?.includes(index) ? ' won' : ''}${available.get(col) === index ? ' landing' : ''}"></span>`;
        }).join('')}
      </button>`;
    }).join('')}
  </div>`;
  return coordinates(field,alphabet.slice(0,width),ranks(height),'four');
}

const game = {
  id:'connect-four',name:'4 в ряд',variant:'ПОЛЕ 7 × 6',
  subtitle:'Четвёртая решает.',
  description:'Роняйте фишки в столбцы и первыми выстройте четыре в ряд.',
  hint:'Выберите столбец. Фишка упадёт на нижнее свободное место.',
  sides,engine,board,placement:true,
  status:() => 'Выберите столбец для следующей фишки.',
  source:{name:'Правила классической Connect 4 от Hasbro',url:'https://instructions.hasbro.com/en-gb/instruction/the-classic-game-of-connect-4'},
  rules:[
    ['Поле и ход','У поля семь столбцов и шесть рядов. Красные начинают. Игроки по очереди бросают по одной фишке своего цвета в любой неполный столбец. Фишка падает до дна или до верхней фишки в столбце.',
      'Если в столбце C уже лежат две фишки, новая займёт поле C3.'],
    ['Четыре подряд','Выигрывает тот, кто первым соберёт непрерывную линию из четырёх или более своих фишек по горизонтали, вертикали или диагонали.',
      'Красные фишки на 1-й, 2-й, 3-й и 4-й высоте в соседних столбцах образуют диагональ. Под каждой должны быть фишки, которые удерживают её на этой высоте.'],
    ['Как остановить соперника','Если соперник собрал три фишки и может следующим ходом поставить четвёртую, займём эту клетку своим цветом. Проверьте, куда упадёт ваша фишка.',
      'Красные фишки заняли A1, B1 и C1. Жёлтые могут бросить фишку в пустой столбец D и закрыть линию.'],
    ['Ничья','Если все 42 места заняты и ни у кого нет выигрышного ряда, партия заканчивается вничью.'],
  ],
};

export const render = root => renderTable(root,game);
