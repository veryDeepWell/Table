import {cardView} from './card-view.js';
import {pairName,splitTiles,tileLabel,tiles} from './tile-ranking.js';
import {sabaccValue} from './sabacc-rules.js';

const command=(move,text)=>`<button type="button" class="button secondary" data-kind="${move.kind}" ${move.value===undefined ? '' : 'data-value="'+move.value+'"'}>${text}</button>`;
const card=(text,negative=false)=>`<span class="playing-card ${negative ? 'card-red' : ''}">${text}</span>`;
const regular=hand=>`<div class="card-hand">${hand.map(id=>card('A23456789TJQK'[id%13]+'♣♦♥♠'[Math.floor(id/13)],[1,2].includes(Math.floor(id/13)))).join('')}</div>`;
const signed=hand=>`<div class="card-hand">${hand.map(id=>card((sabaccValue(id)>0 ? '+' : '')+sabaccValue(id),sabaccValue(id)<0)).join('')}</div>`;
const tile=id=>`<span class="chinese-tile" title="${tileLabel(id)}"><b>${tiles[id].face[0]}<br>${tiles[id].face[1]}</b><small>${tiles[id].name}</small></span>`;
const pair=ids=>`<div class="tile-pair">${ids.map(tile).join('')}<span>${pairName(ids)}</span></div>`;
const sources={
  'pai-gow':['Регламент Casino Canberra 2023','https://legislation.act.gov.au/DownloadFile/ni/2023-578/current/PDF/2023-578.PDF'],
  baccarat:['Правила баккары · GRA','https://www.gra.gov.sg/docs/default-source/game-rules/mbs/baccarat-games/mbs-baccarat-game-rules-ver-7.pdf'],
  sabacc:['Hasbro · Han Solo Card Game','https://instructions.hasbro.com/en-us/instruction/star-wars-han-solo-card-game'],
};
const games={
  'pai-gow':{
    name:'Пай-гоу',seats:2,
    markup(state,_side,active) {
      const actions=active ? state.actions : [];
      return `<p>Раздача ${state.round} · Банкир — место ${state.banker}</p>
        <p>Счёт ${state.score.join(' : ')} фишек</p><h2>Ваши кости</h2>
        <div class="card-hand">${state.hand.map(tile).join('')}</div>
        ${state.phase==='round' ? `<p>${state.roundWinner ? 'Победило место '+state.roundWinner : 'Возврат ставки'}</p>
          ${state.showdown.map((split,index)=>`<section class="card-seat"><h2>Место ${index+1}</h2>${pair(split.high)}${pair(split.low)}</section>`).join('')}` : state.ownSplit ? '<p>Расстановка принята. Ожидаем соперника.</p>' : ''}
        <div class="pai-splits">${actions.map(move=>{
          if(move.kind==='next') return command(move,'Следующая раздача');
          const split=splitTiles(state.hand,move.value);
          return `<section>${pair(split.high)}${pair(split.low)}${command(move,'Выбрать это разделение')}</section>`;
        }).join('')}</div>`;
    },
    rules:[
      ['Стол','Дуэль на 32 китайских костях. Каждый начинает с 1000 игровых фишек. За раздачу ставится 20. Роль банкира чередуется. Сервер выдаёт по четыре закрытые кости.'],
      ['Расстановка','Разделите четыре кости на старшую и младшую пары. Интерфейс показывает все три разделения и автоматически ставит более сильную пару старшей. До вскрытия чужая рука скрыта.'],
      ['Старшинство','Выше всего Gee Jun, затем пары Teen, Day, Yun, Gor, Mooy, Chong, Bon, Foo, Ping, Tit, Look, Chop Gow, Chop Bot, Chop Chit и Chop Ng. Ниже идут Wong: Teen/Day с девяткой, Gong с восьмёркой и High Nine с семёркой. Остальные пары сравниваются по последней цифре суммы.','Teen + 9 сильнее обычных девяти очков.'],
      ['Особые кости','Две Gee Jun вместе образуют высшую пару. По отдельности они дают 3 или 6, выбирается лучший остаток. При равенстве обычных очков сравнивается сильнейшая отдельная кость пары.'],
      ['Расчёт','Сравниваются старшие и младшие пары. Равенство выигрывает банкир. Две младшие пары по нулю также выигрывает банкир. Победа обеих пар даёт выигрыш, разделение — возврат. Победитель получает 19 фишек, проигравший теряет 20. Разница — комиссия 5%.'],
    ],
  },
  baccarat:{
    name:'Баккара',seats:4,
    markup(state,_side,active) {
      const labels=['Игрок','Банк','Ничья'];
      return `<p>Раздача ${state.round} · Ставка 20 фишек</p>
        <div class="casino-balances">${state.balance.map((value,index)=>`<p>Место ${index+1} · ${value} фишек${state.bets[index]===null ? '' : ' · '+labels[state.bets[index]]}</p>`).join('')}</div>
        ${state.deal ? `<h2>${labels[state.deal.outcome]}</h2><h3>Игрок</h3>${regular(state.deal.player)}<h3>Банк</h3>${regular(state.deal.banker)}` : '<p>Выберите исход раздачи.</p>'}
        <div class="private-actions">${(active ? state.actions : []).map(move=>command(move,move.kind==='next' ? 'Следующая раздача' : labels[move.value])).join('')}</div>`;
    },
    rules:[
      ['Ставка','Punto Banco на восьми колодах. Четыре места, начальный запас 1000 игровых фишек. На раздачу каждый ставит 20 на Игрока, Банк или Ничью. После последней ставки сервер открывает карты.'],
      ['Очки','Туз стоит одно очко, от двойки до девятки — свой номинал, десятки и фигуры — ноль. Из суммы берётся последняя цифра. Побеждает рука ближе к девяти.','7 + 8 дают 5 очков.'],
      ['Добор','Начальные 8 или 9 у любой руки прекращают добор. Иначе Игрок добирает при 0–5. Если Игрок остановился, Банк добирает при 0–5. После третьей карты Игрока Банк добирает при 0–2 всегда, при 3 кроме восьмёрки, при 4 против 2–7, при 5 против 4–7, при 6 против 6–7.'],
      ['Выплаты','Выигрыш Игрока даёт +20, Банка +19 после комиссии, Ничьи +160. При ничьей ставки на Игрока и Банк возвращаются. При проигрыше теряются 20 фишек. Новую раздачу открывает первое место.'],
    ],
  },
  sabacc:{
    name:'Сабакк',seats:4,
    markup(state,side,active) {
      const sum=state.hand.reduce((value,id)=>value+sabaccValue(id),0);
      const labels={stand:'Оставить руку',stock:'Взять из колоды',pile:'Взять из сброса',keep:'Оставить все карты'};
      return `<p>Круг ${state.lap} из 3 · В колоде ${state.stockCount}</p>
        <p>${state.dice ? 'Кости '+state.dice.join(' · ')+(state.dice[0]===state.dice[1] ? ' — руки заменены' : '') : 'Дилер — место 1, первым ходит место 2'}</p>
        <h2>Сброс</h2>${state.top===undefined ? '<p>Пусто</p>' : signed([state.top])}
        <h2>Ваша рука · ${sum>0 ? '+' : ''}${sum}</h2>${signed(state.hand)}
        <p>${state.counts.map((count,index)=>'Место '+(index+1)+': '+count+' карт').join(' · ')}</p>
        <div class="private-actions">${(active ? state.actions : []).map(move=>command(move,move.kind==='discard' ? 'Сбросить '+sabaccValue(move.value) : labels[move.kind])).join('')}</div>
        ${state.showdown ? state.showdown.map((hand,index)=>`<section class="card-seat"><h2>Место ${index+1}${index+1===side ? ' · вы' : ''}</h2>${signed(hand)}</section>`).join('') : ''}
        ${state.tiebreak?.length ? '<h2>Дополнительные карты при равенстве</h2>'+state.tiebreak.map(({side,card})=>'<p>Место '+side+': '+sabaccValue(card)+'</p>').join('') : ''}`;
    },
    rules:[
      ['Версия','Одна раздача Han Solo Card Game от Hasbro для четверых. Используется полный порядок ходов и сравнение рук из инструкции. Кампания на 24 жетонах наград пока не включена. Дилер — место 1, первым ходит место 2.'],
      ['Карты','62 карты: по три экземпляра значений от +1 до +10 и от −1 до −10, а также два нуля. Каждый получает две закрытые карты. Цель — сумма как можно ближе к нулю.'],
      ['Ход','Можно оставить руку или взять верхнюю карту колоды либо сброса. После добора можно сбросить одну карту. Каждый делает три хода. Если сброс опустел, его пополняет карта колоды.'],
      ['Кости','После каждого полного круга бросаются две кости. Дубль заменяет все руки новыми картами с сохранением их размеров. Кости бросаются и после третьего круга, до вскрытия.'],
      ['Сравнение','Лучшая комбинация — ровно +10, −10 и 0. Затем идёт нулевая сумма, где больше карт лучше. При одинаковом количестве выигрывают большие номиналы. Остальные руки сравниваются по расстоянию от нуля, положительная сумма старше такой же отрицательной, затем больше карт лучше.','+1 выигрывает у −1. Ноль с пятью картами сильнее нуля с четырьмя.'],
      ['Равенство','Равные руки получают дополнительные карты. Ближайшая к нулю выигрывает, положительная старше равной отрицательной. При новом равенстве добор повторяется.'],
      ['Если колода закончилась','В этой реализации сброс перемешивается в новую колоду, верхняя открытая карта сохраняется. Инструкция Hasbro отдельно не уточняет этот редкий случай.'],
    ],
  },
};
export function casinoView(id) {
  const [name,url]=sources[id];
  const game=games[id],view=cardView({id,...game});
  return {render(root) {
    view.render(root);
    const source=document.createElement('p');
    source.className='sources';
    const link=document.createElement('a');
    link.href=url;link.textContent=name+' ↗';link.target='_blank';link.rel='noreferrer';
    source.append(link);root.querySelector('#rules').append(source);
  }};
}
