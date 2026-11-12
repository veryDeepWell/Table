import {gomoku,reversi,kalah} from './new-board-engines.js';
import {renderTable} from './table-view.js';
import {alphabet,coordinates,ranks} from './coordinates.js';

function stoneBoard(game,state,legal) {
  const size = game.size;
  const enabled = new Set(legal.map(move => move.to));
  const points = state.board.map((stone,index) => {
    const coordinate = alphabet[index % size] + (size - Math.floor(index / size));
    const name = stone === 1 ? 'чёрная фишка' : stone === 2 ? 'белая фишка' : enabled.has(index) ? 'доступный ход' : 'пусто';
    return `<button type="button" class="stone-cell side-${stone}${state.last?.includes(index) ? ' latest' : ''}${state.result?.line?.includes(index) ? ' winning' : ''}"
      data-point="${index}" aria-label="${coordinate}, ${name}" ${enabled.has(index) ? '' : 'disabled'}><span></span></button>`;
  }).join('');
  return coordinates(`<div class="stone-grid ${game.id}-board" style="--size:${size}">${points}</div>`,
    alphabet.slice(0,size),ranks(size),'square');
}

function kalahBoard(game,state,legal) {
  const available = new Set(legal.map(move => move.to));
  const row = indices => indices.map(index => {
    const number = index < 6 ? index + 1 : index - 6;
    return `<button type="button" data-point="${index}" class="${state.last?.includes(index) ? 'latest' : ''}"
      aria-label="${index < 6 ? 'Первый' : 'Второй'} игрок, лунка ${number}, камней ${state.board[index]}"
      ${available.has(index) ? '' : 'disabled'}><small>${number}</small><b>${state.board[index]}</b></button>`;
  }).join('');
  return `<div class="kalah-board"><div class="kalah-store"><small>Второй</small><b>${state.board[13]}</b></div>
    <div class="kalah-pits">${row([12,11,10,9,8,7])}${row([0,1,2,3,4,5])}</div>
    <div class="kalah-store"><small>Первый</small><b>${state.board[6]}</b></div></div>`;
}

const sides = ['Чёрные','Белые'];
const games = {
  reversi:{name:'Реверси',engine:reversi,size:8,sides,board:stoneBoard,
    hint:'Подсвечены клетки, на которых можно перевернуть фишки.',
    status:state => state.skipped ? 'У соперника нет хода. Сыграйте ещё раз.' : 'Зажмите фишки соперника между своими.',
    source:{name:'Правила Всемирной федерации отелло',url:'https://worldothello.org/about/about-othello/othello-rules/official-rules/english'},
    rules:[
      ['Как поставить фишку','Чёрные начинают. Поставьте фишку так, чтобы между ней и другой вашей фишкой был непрерывный ряд фишек соперника. Ряд можно замкнуть по горизонтали, вертикали или диагонали. Переверните все зажатые фишки.','В начальной позиции ход чёрных на D6 переворачивает D5.'],
      ['Когда нет хода','Если подходящей клетки нет, ход автоматически переходит к сопернику. Если ходов нет у обоих, партия заканчивается. Побеждает цвет, у которого больше фишек.'],
    ]},
  gomoku:{name:'Гомоку',engine:gomoku,size:15,sides,board:stoneBoard,
    hint:'Пять или больше камней подряд в любом направлении.',
    status:() => 'Поставьте камень на свободную точку.',
    rules:[
      ['Ход','Чёрные начинают. Игроки по очереди ставят по одному камню на любую свободную точку поля 15 × 15. Поставленные камни остаются на месте.'],
      ['Пять в ряд','Побеждает первый, кто соберёт пять или больше камней подряд по горизонтали, вертикали или диагонали. Здесь играем по свободным правилам. При заполнении поля без победителя объявляется ничья.','Если у соперника четыре камня подряд и оба конца открыты, одним ходом оба конца уже не закрыть.'],
    ]},
  kalah:{name:'Калах',engine:kalah,sides:['Первый игрок','Второй игрок'],singlePlayerLabels:true,board:kalahBoard,
    hint:'Нижний ряд принадлежит первому игроку, верхний — второму.',
    status:state => state.extra ? 'Последний камешек попал в амбар. Ходите ещё раз.' : 'Выберите лунку со своей стороны.',
    rules:[
      ['Посев','На каждой стороне шесть лунок по четыре камешка и свой амбар. Возьмите все камешки из своей лунки и раскладывайте по одному против часовой стрелки. Кладите в свой амбар и пропускайте чужой.','Из третьей нижней лунки четыре камешка попадут в лунки 4, 5, 6 и свой амбар. Это даёт ещё один ход.'],
      ['Захват','Если последний камешек попал в пустую лунку на вашей стороне, заберите его и все камешки из лунки напротив в свой амбар. Захват происходит, когда напротив есть хотя бы один камешек.'],
      ['Конец партии','Когда у одного игрока опустеют все шесть лунок, второй переносит остаток в свой амбар. Побеждает тот, у кого больше камешков в амбаре.'],
    ]},
};

export const boardView = id => ({render:root => renderTable(root,{id,placement:true,...games[id]})});
