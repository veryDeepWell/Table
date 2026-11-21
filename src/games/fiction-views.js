import {renderTable} from './table-view.js';
import {alphabet,coordinates,ranks} from './coordinates.js';
import * as pai from './pai-sho/engine.js';
import * as gungi from './gungi/engine.js';
import * as tak from './tak/engine.js';

const paiNames={R3:'Роза R3',R4:'Хризантема R4',R5:'Рододендрон R5',W3:'Жасмин W3',W4:'Лилия W4',W5:'Белый нефрит W5',
  lotus:'Лотос',orchid:'Орхидея',rock:'Камень',wheel:'Колесо',knot:'Горец',boat:'Лодка'};
const paiIcons={R3:'R3',R4:'R4',R5:'R5',W3:'W3',W4:'W4',W5:'W5',lotus:'✿',orchid:'❀',rock:'■',wheel:'☸',knot:'♧',boat:'◒'};
const notation = (point,size) => alphabet[point%size]+(size-Math.floor(point/size));
function direct(legal,move,text) {
  return `<button class="button secondary" data-move-index="${legal.indexOf(move)}">${text}</button>`;
}
function palette(entries,legal,selected,names) {
  return `<div class="reserve-palette" aria-label="Резерв">${entries.filter(([,count])=>count>0).map(([type,count])=>
    `<button class="button secondary" data-drop="${type}" aria-pressed="${selected===type}" ${legal.some(move=>move.from===type) ? '' : 'disabled'}>${names[type]} ×${count}</button>`).join('')}</div>`;
}
const games = {
  'pai-sho':{
    name:'Пай-шо',engine:pai,sides:['Светлые','Тёмные'],
    source:{name:'Skud Pai Sho · руководство сообщества, март 2022',url:'https://skudpaisho.com/other/rules/SkudPaiShoRules_20220314_compressed.pdf'},
    hint:'Выберите цветок в резерве или на доске, затем подсвеченную точку.',
    status:state=>state.phase==='accents' ? `Выберите четыре акцента. Выбрано ${state.selectedAccents[state.turn-1]} из 4, максимум два каждого вида.`
      : state.phase==='opening' ? 'Тёмные выбирают первый цветок для обеих сторон.'
      : state.phase==='bonus' ? 'Новая гармония. Можно использовать один бонус.' : 'Создайте кольцо гармоний вокруг центра.',
    choice:move=>move.boatTo!==undefined ? 'Лодка → '+notation(move.boatTo,19) : 'Подтвердить',
    board(_game,state,legal,selected) {
      let reserve;
      if (['accents','opening'].includes(state.phase)) {
        reserve=`<div class="reserve-palette">${legal.map(move=>direct(legal,move,paiNames[move.type])).join('')}</div>`;
      } else {
        reserve=palette(Object.entries(state.reserve[state.turn-1]),legal,selected,paiNames);
        const skip=legal.find(move=>move.kind==='skip');
        if (skip) reserve+=direct(legal,skip,'Завершить ход без бонуса');
      }
      const board=`<div class="pai-board" role="group" aria-label="Доска Skud Pai Sho">${state.board.map((tile,point)=>{
        if (!pai.validPoint(point)) return '<span></span>';
        const target=legal.some(move=>move.to===point && move.from===selected);
        const active=target || legal.some(move=>move.from===point);
        const color=pai.garden(point), gate=pai.gates.includes(point);
        return `<button class="pai-point ${gate ? 'pai-gate' : color ? 'garden-'+color : ''} ${selected===point ? 'selected' : ''} ${target ? 'target' : ''}"
          data-point="${point}" aria-label="${notation(point,19)}, ${tile ? paiNames[tile.type] : gate ? 'Ворота' : 'пусто'}" ${active ? '' : 'disabled'}>
          ${tile ? `<span class="pai-tile side-${tile.side} flower-${tile.type[0]}">${paiIcons[tile.type]}</span>` : point===180 ? '<span class="pai-center">·</span>' : ''}</button>`;
      }).join('')}${['north','east','south','west'].map(direction=>'<span class="pai-gate-region '+direction+'" aria-hidden="true"></span>').join('')}${[1,2].flatMap(side=>pai.harmonies(state.board,side).map(([a,b])=>{
        const x=a%19,y=Math.floor(a/19),bx=b%19,by=Math.floor(b/19);
        return `<span class="harmony-line harmony-${side}" style="left:${(x+.5)/19*100}%;top:${(y+.5)/19*100}%;width:${(bx-x)/19*100}%;height:${(by-y)/19*100}%"></span>`;
      })).join('')}</div>`;
      return coordinates(board,alphabet.slice(0,19),ranks(19),'square')+reserve;
    },
    rules:[
      ['Подготовка','Светлые, затем тёмные выбирают четыре акцента из восьми. Тёмные выбирают обычный цветок для стартовых ворот обеих сторон и ходят первыми. Резервы открыты.','Для знакомства можно взять по камню, колесу, горцу и лодке.'],
      ['Посадка и движение','Посадка вводит обычный цветок в свободные ворота. Вместо неё можно переместить свой цветок по свободным ортогональным дорожкам, поворачивая по пути. Число в имени задаёт дальность. На ворота возвращаться нельзя. Внутри сада противоположного цвета останавливаться нельзя.'],
      ['Гармонии','Цветы в воротах ещё растут. За воротами они цветут. Соседи по кругу R3–R4–R5–W3–W4–W5 образуют гармонию на свободной горизонтали или вертикали. R и W одинакового номера конфликтуют. Такой конфликт запрещён для цветов обеих сторон.','R3 и R4 образуют гармонию. R3 может взять вражеский W3, закончив движение на нём.'],
      ['Бонус','Новая гармония после перемещения даёт один необязательный бонус. Можно выставить акцент или посадить особый цветок. Обычный цветок можно посадить бонусом, если своих растущих цветов нет. Бонус не порождает следующий бонус.'],
      ['Акценты','Камень отменяет гармонии на всей своей строке и колонке. Горец подавляет гармонии восьми соседних цветов. Колесо сдвигает восемь соседних точек по часовой стрелке. Лодка вытесняет цветок в свободную соседнюю точку, а при игре на акцент снимает обе фишки. Запрещено нарушать ограничения садов, ворот и конфликтов.'],
      ['Особые цветы','Лотос ходит до двух шагов и соединяется с обычными цветами обеих сторон. Гармония принадлежит стороне обычного цветка. Орхидея ходит до шести шагов и удерживает соседние вражеские цветы. При цветущем собственном лотосе орхидея может брать любые чужие цветы, но сама становится уязвимой.'],
      ['Победа','Замкните гармониями кольцо вокруг центра, не касаясь его. Если выставлен последний обычный цветок, сравниваются гармонии, пересекающие оси между соседними квадрантами. Равенство даёт ничью.'],
    ],
  },
  gungi:{
    name:'Гунги',engine:gungi,sides:['Белые','Чёрные'],
    source:{name:'Universal Music Japan · правила и официальные уточнения',url:'https://www.universal-music.co.jp/other/hunter-gungi__qa/'},
    hint:'Верхняя фигура управляет башней. Число у фигуры показывает её высоту.',
    status:state=>state.phase==='setup' ? 'Выставляйте фигуры в трёх домашних рядах. Маршал обязателен.'
      : gungi.threatened(state,state.turn) ? 'Шах маршалу.' : 'Выберите фигуру или резерв.',
    choice:move=>(move.kind==='capture' ? 'Взять' : move.kind==='stack' ? 'Поставить сверху' : 'Выставить')+
      (move.convert ? ' · заменить слои '+[1,2].filter(level=>move.convert & (1<<(level-1))).join(', ') : ''),
    board(_game,state,legal,selected) {
      const board=stackBoard('gungi',state,legal,selected,9,piece=>gungi.pieces[piece.type][0],piece=>gungi.pieces[piece.type][1]);
      const reserve=palette(Object.entries(state.reserve[state.turn-1]),legal,selected,Object.fromEntries(Object.entries(gungi.pieces).map(([type,value])=>[type,value[0]+' '+value[1]])));
      const ready=legal.find(move=>move.kind==='ready');
      return board+reserve+(ready ? direct(legal,ready,'Расстановка завершена') : '');
    },
    rules:[
      ['Версия','Расширенные правила лицензированного издания Universal Music Japan 2022 года с официальными уточнениями. Поле 9 × 9, по 25 фигур четырнадцати типов. Белые ходят первыми.'],
      ['Расстановка','Игроки по очереди выставляют фигуры в своих трёх рядах. Можно строить башни до трёх фигур. Маршал обязателен, сверху на него ставить нельзя. После «Расстановка завершена» оставшиеся фигуры остаются в резерве. Когда закончат оба, белые делают первый ход.'],
      ['Движение','Ходит только верхняя фигура башни. Её дальность растёт на один шаг на втором уровне и на два на третьем. Генерал сохраняет бесконечную дальность по прямой, генерал-лейтенант — по диагонали. После выбора фигуры доска показывает допустимые назначения.','Пехотинец первого уровня идёт на один шаг вперёд или назад. На третьем уровне он может пройти до трёх.'],
      ['Взятие и башни','Можно взять вражескую верхнюю фигуру или встать на неё. Цель должна быть той же высоты или ниже. При взятии снимаются чужие слои, свои сохраняются. На маршала ставить нельзя, но он сам может встать на другую фигуру.','Башня высотой один не может взять башню высотой два.'],
      ['Прыжки','Пушка, лучник и мушкетёр прыгают на указанные дальние точки через башни своей высоты или ниже. Более высокая башня блокирует прыжок. Остальные фигуры не перепрыгивают через занятые клетки.'],
      ['Резерв и капитан','Фигуру резерва можно добавить на пустую клетку или собственную башню позади линии своего самого передового открытого бойца, включая эту линию. Нельзя превысить три уровня. Капитан при постановке сверху позволяет добровольно заменить чужие фигуры под ним своими одноимёнными фигурами из резерва.'],
      ['Завершение','Цель — мат маршалу. Четырёхкратное повторение позиции с той же очередью хода завершает игру ничьёй.'],
      ['Движения фигур','Генерал-майор ходит по прямой и вперёд по диагонали. Самурай — вперёд, назад и вперёд по диагонали. Копейщик — до двух вперёд, один назад или вперёд по диагонали. Конь — на два вперёд/назад или один вбок. Разведчик — на два по диагонали. Крепость — вперёд, вбок или назад по диагонали. Капитан — вперёд по диагонали или назад. Пушка прыгает на три вперёд и ходит на один вбок/назад. Лучник прыгает на два вперёд, в том числе по диагонали, или ходит назад на один. Мушкетёр прыгает на два вперёд или ходит назад по диагонали.'],
    ],
  },
  tak:{
    name:'Так',engine:tak,sides:['Белые','Чёрные'],singlePlayerLabels:false,
    source:{name:'US Tak Association · правила',url:'https://ustak.org/play-beautiful-game-tak/'},
    hint:'Стопка показана снизу вверх. Для перемещения выберите начало и конечную клетку.',
    status:state=>state.ply<2 ? 'Поставьте плоский камень соперника на пустую клетку.' : 'Постройте дорогу между любыми противоположными краями.',
    choice:move=>move.kind==='spread' ? `Поднять ${move.carry}, оставить по пути ${move.drops.join(' → ')}` : move.type,
    board(_game,state,legal,selected) {
      return stackBoard('tak',state,legal,selected,5,piece=>({flat:'●',wall:'▰',cap:'◆'})[piece.type],piece=>({flat:'Камень',wall:'Стена',cap:'Вершина'})[piece.type])+
        palette([['flat',state.reserve[(state.ply<2 ? 3-state.turn : state.turn)-1].flat],['wall',state.ply<2 ? 0 : state.reserve[state.turn-1].flat],['cap',state.ply<2 ? 0 : state.reserve[state.turn-1].cap]],legal,selected,{flat:'Плоский',wall:'Стена',cap:'Вершина'});
    },
    rules:[
      ['Начало','Версия на доске 5 × 5. У каждой стороны 21 обычный камень и одна вершина. Первые два хода игроки ставят по одному плоскому камню соперника. Затем играют своими.'],
      ['Постановка','На пустую клетку можно поставить плоский камень, стену или вершину. Стена использует обычный камень. Дороги состоят из видимых сверху плоских камней и вершин. Стены в дорогу не входят.'],
      ['Перенос','Стопкой управляет владелец верхнего камня. Можно поднять до пяти верхних камней и идти строго по прямой, оставляя на каждой клетке хотя бы один нижний камень из руки. Порядок сохраняется.','Подняв три камня, можно оставить один на соседней клетке и два на следующей. Выберите конечную клетку, затем распределение.'],
      ['Препятствия','На плоские камни можно ставить переносимые стопки. Через стены и вершины проходить нельзя. Вершина, оставшаяся в руке одна на последнем шаге, может лечь на стену и сделать её плоской.'],
      ['Победа','Соедините свои противоположные края ортогональной дорогой. Если одним ходом появились две дороги, выигрывает сделавший ход. При заполнении доски или исчерпании всего резерва одной стороны сравниваются верхние плоские камни. Вершины в этом подсчёте не участвуют. Равенство даёт ничью.'],
    ],
  },
};

function stackBoard(id,state,legal,selected,size,symbol,name) {
  const board=`<div class="stack-board ${id}-board" style="--size:${size}" role="group" aria-label="Игровая доска">${state.board.map((stack,point)=>{
    const target=legal.some(move=>move.to===point && move.from===selected);
    const active=target || legal.some(move=>move.from===point);
    return `<button type="button" class="stack-cell ${target ? 'target' : ''} ${selected===point ? 'selected' : ''}" data-point="${point}"
      aria-label="${notation(point,size)}, ${stack.map(piece=>name(piece)+' '+(piece.side===1 ? 'белых' : 'чёрных')).join(', ') || 'пусто'}" ${active ? '' : 'disabled'}>
      ${stack.map(piece=>`<span class="stack-piece side-${piece.side}">${symbol(piece)}</span>`).join('')}
      ${stack.length>1 ? `<small>${stack.length}</small>` : ''}</button>`;
  }).join('')}</div>`;
  return coordinates(board,alphabet.slice(0,size),ranks(size),'square');
}
export function fictionView(id) {
  const game=games[id];
  const point=index=>notation(index,id==='pai-sho' ? 19 : id==='gungi' ? 9 : 5);
  const labels=id==='pai-sho' ? paiNames : id==='gungi'
    ? Object.fromEntries(Object.entries(gungi.pieces).map(([type,value])=>[type,value[1]])) : {flat:'Камень',wall:'Стена',cap:'Вершина'};
  const describeMove=move=>{
    if(move.kind==='ready') return 'Расстановка завершена';
    if(move.kind==='skip') return 'Без бонуса';
    if(move.kind==='accent-choice') return 'Акцент: '+labels[move.type];
    if(move.kind==='opening') return 'Начальный цветок: '+labels[move.type];
    const source=typeof move.from==='number' ? point(move.from) : labels[move.from];
    return source+' → '+point(move.to)+(move.drops ? ' · '+move.drops.join('/') : '');
  };
  return {render:root=>renderTable(root,{...game,id,notation:point,describeMove})};
}
