import {renderTable} from './table-view.js';
import {janggi,hnefatafl} from './variant-engines.js';
import {alphabet,coordinates,ranks} from './coordinates.js';

const games = {
  janggi:{name:'Дзянги',engine:janggi,sides:['Синие','Красные'],
    pieces:{k:'將',a:'士',e:'象',n:'馬',r:'車',c:'包',p:'卒'},
    names:{k:'Генерал',a:'Страж',e:'Слон',n:'Конь',r:'Колесница',c:'Пушка',p:'Пешка'},
    hint:'Диагонали отмечают дорожки во дворцах.',
    controls:(_state,_selected,legal) => legal.some(move => move.from === 90)
      ? '<button class="button secondary" data-action="pass">Пропустить ход</button>' : '',
    rules:[
      ['Дворец','Синие начинают. Генерал и стражи двигаются на один шаг по линиям своего дворца. Колесница ходит по прямой и по проведённым диагоналям дворца.'],
      ['Фигуры','Конь идёт на шаг по прямой и затем по диагонали. Слон идёт на шаг по прямой и на два по диагонали. Занятая промежуточная точка блокирует ход. Пешка идёт вперёд или вбок, а во дворце может пройти вперёд по его диагонали.'],
      ['Пушка и конец игры','Пушка перепрыгивает через ровно одну фигуру, включая тихий ход. Пушка не перепрыгивает через другую пушку и не берёт её. Мат завершает партию. В этой версии два паса подряд или троекратное повторение дают ничью. Отдельное турнирное правило бикчан не применяется.'],
    ]},
  hnefatafl:{name:'Хнефатафл',engine:hnefatafl,sides:['Защитники','Нападающие'],
    pieces:{k:'♔',a:'●',d:'○'},names:{k:'Король',a:'Нападающий',d:'Защитник'},
    hint:'Защитники выводят короля в угол, нападающие его окружают.',
    rules:[
      ['Цель','На доске 11 × 11 нападающие ходят первыми. Защитники выигрывают, когда король достигает любого угла. Нападающие выигрывают, когда окружают короля по четырём сторонам. Пустой трон может заменить одну сторону окружения.'],
      ['Ход и взятие','Все фигуры идут по прямой на любое число свободных клеток. Трон и углы могут занимать только король. Обычная фигура снимается, если своим ходом зажать её между двумя фигурами своего цвета или между фигурой и пустым троном либо углом.'],
      ['Вариант','Здесь действует упрощённый вариант с выходом в угол. Взятие «стеной щитов» и победа через форт не применяются. Сторона без ходов проигрывает, троекратное повторение даёт ничью.'],
    ]},
};

export function variantView(id) {
  const game = games[id];
  const {width,height} = game.engine;
  const notation = point => point === width*height ? 'Пас' : alphabet[point%width] + (height-Math.floor(point/width));
  function board(_game,state,legal,selected) {
    const pieces = state.board.map((piece,index) => {
      const target = legal.some(move => move.from === selected && move.to === index);
      const source = legal.some(move => move.from === index);
      const marked = id === 'hnefatafl' && [0,10,60,110,120].includes(index);
      const edges = id === 'janggi' ? ['xiangqi-point',index < width && 'top',index >= width*(height-1) && 'bottom',
        index%width === 0 && 'left',index%width === width-1 && 'right'].filter(Boolean).join(' ') : '';
      return `<button class="variant-cell ${edges} ${target ? 'target' : ''} ${marked ? 'special' : ''} ${selected === index ? 'selected' : ''}"
        data-point="${index}" aria-label="${notation(index)}, ${piece ? game.names[piece.type] + ', ' + game.sides[piece.side-1] : 'свободно'}"
        ${target || source ? '' : 'disabled'}>${piece ? `<span class="variant-piece side-${piece.side}">${game.pieces[piece.type]}</span>` : ''}</button>`;
    }).join('');
    const palace = id === 'janggi' ? '<div class="xiangqi-palace north"></div><div class="xiangqi-palace south"></div>' : '';
    return coordinates(`<div class="variant-board ${id}" style="--columns:${width};--rows:${height}">${pieces}${palace}</div>`,
      alphabet.slice(0,width),ranks(height),'xiangqi');
  }
  return {render:root => renderTable(root,{...game,id,board,notation,status:() => 'Выберите фигуру.'})};
}
