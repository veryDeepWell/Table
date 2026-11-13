import {inMatch,mountMatch,forfeitMessage} from '../online/client.js';
import {mountLobby} from '../online/lobby.js';
import {mountReplay} from './replay.js';

const label = card => '23456789TJQKA'[card % 13] + '♣♦♥♠'[Math.floor(card / 13)];
const button = (title,attrs) => `<button type="button" class="button secondary" ${attrs}>${title}</button>`;

function maid(state,side,active) {
  const event = state.last;
  return `${event ? `<p>Место ${event.side} · ${event.kind === 'reorder'
    ? `карта ${event.from+1} перемещена на позицию ${event.to+1}`
    : `взята карта ${event.from+1} у места ${event.target}`}</p>` : ''}
    ${state.order.map((slots,index) => `<section class="card-seat"><h2>${index + 1 === side ? 'Ваша рука' : 'Место ' + (index+1)}</h2>
      <div class="card-hand">${slots.map((slot,position) => index + 1 === side
        ? `<div data-slot="${slot}"><span class="playing-card">${label(state.hand[position])}</span>
          ${active ? `<div class="card-order">${position ? button('←',`data-kind="reorder" data-from="${position}" data-to="${position-1}" aria-label="Карту ${position+1} влево"`) : ''}
          ${position+1 < slots.length ? button('→',`data-kind="reorder" data-from="${position}" data-to="${position+1}" aria-label="Карту ${position+1} вправо"`) : ''}</div>` : ''}</div>`
        : `<div data-slot="${slot}">${active && state.turn === side && state.target === index+1
          ? `<button type="button" class="playing-card card-back" data-kind="draw" data-from="${position}" data-slot-id="${slot}" aria-label="Вытянуть карту ${position+1}">${position+1}</button>`
          : `<span class="playing-card card-back">${position+1}</span>`}</div>`).join('') || 'Рука пуста.'}</div></section>`).join('')}`;
}

export function cardView({id,name,seats,rules,markup = maid}) {
  return {render(root) {
    root.innerHTML = `<section id="play" class="mj-area"><h1>${name}</h1><p class="mj-status" role="status"></p><div data-room></div></section>
      <section id="rules" class="rules-section"><h2>Правила</h2><div class="rules-list">
      ${rules.map(([title,body],index) => `<article class="rule classic-rule"><span class="rule-number">${index+1}</span><div><h3>${title}</h3><p>${body}</p></div></article>`).join('')}</div></section>`;
    const play = root.querySelector('#play');
    const field = play.querySelector('[data-room]');
    const status = play.querySelector('[role="status"]');
    if (!inMatch(id)) {
      mountLobby(play,id).open = true;
      status.textContent = 'Мест за столом: ' + seats;
      return;
    }
    let match;
    const replay = mountReplay(play,field,state => markup(state,match.side,false));
    const connection = mountMatch(root,id,next => {
      match = next;
      const state = next.state;
      status.textContent = forfeitMessage(next) || (!next.ready ? `За столом ${next.names.length} из ${seats}`
        : state.result?.loser ? `Проиграл игрок на месте ${state.result.loser}`
        : state.result ? state.result.winner ? `Победил игрок на месте ${state.result.winner}` : 'Партия завершена'
        : state.turn === next.side ? 'Ваш ход' : `Ход игрока на месте ${state.turn}`);
      const previous = new Map([...field.querySelectorAll('[data-slot]')].map(card => [card.dataset.slot,card.getBoundingClientRect()]));
      field.innerHTML = state ? markup(state,next.side,!next.ended) : '';
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      for (const card of field.querySelectorAll('[data-slot]')) {
        const before = previous.get(card.dataset.slot);
        if (!before) continue;
        const after = card.getBoundingClientRect();
        if (before.x !== after.x || before.y !== after.y) {
          card.animate([{transform:`translate(${before.x-after.x}px,${before.y-after.y}px)`},{transform:'none'}],{duration:260});
        }
      }
    },archive => replay(archive.positions.map(({position},index) => ({
      state:position,label:index ? `${index}. ${position.last?.kind === 'reorder' ? 'Перестановка' : 'Ход'}` : 'Начало партии',
    }))));
    field.onclick = event => {
      const control = event.target.closest('button[data-kind]');
      if (!control) return;
      const {kind,...data} = control.dataset;
      connection?.send({action:'play',kind,...Object.fromEntries(Object.entries(data).map(([key,value]) => [key,Number(value)]))});
    };
  }};
}

export const oldMaidView = () => cardView({id:'old-maid',name:'Старая дева',seats:4,rules:[
  ['Пары','Из колоды убирается одна дама. Карты раздаются поровну, насколько возможно. Пары одного достоинства сбрасываются автоматически.'],
  ['Порядок карт','Стрелками можно переставлять свои карты. Остальные видят движение рубашек и их текущий порядок. В свой ход выберите конкретную позицию в руке следующего игрока.'],
  ['Конец','Игроки с пустой рукой пропускаются. Тот, у кого осталась непарная дама, проигрывает.'],
]});

const suits = ['♣','♦','♥','♠'];
const moveNames = {draw:'Добрать',pass:'Пас',take:'Беру',done:'Бито',next:'Следующая раздача',call:'Уравнять',
  check:'Чек',fold:'Сбросить', 'all-in':'Олл-ин',bid:'Торг',raise:'Повысить до',
  'pass-card':'Передать',give:'Отдать',marriage:'Марьяж',card:'Сыграть'};
const phaseNames = {attack:'Атака',defend:'Защита',pass:'Передача трёх карт',trick:'Взятка',round:'Раздача завершена',
  auction:'Торги',give:'Передача карт',preflop:'Префлоп',flop:'Флоп',turn:'Тёрн',river:'Ривер'};

function table(state,side,active) {
  const controls = active ? state.actions : [];
  const cards = values => values.map(card => `<span class="playing-card">${label(card)}</span>`).join('');
  const command = move => {
    const {kind,card,suit,value} = move;
    const attrs = Object.entries({kind,card,suit,value}).filter(([,value]) => value !== undefined)
      .map(([name,value]) => `data-${name}="${value}"`).join(' ');
    return button([moveNames[kind],value,suits[suit]].filter(value => value !== undefined).join(' '),attrs);
  };
  return `<section class="card-seat"><h2>${phaseNames[state.phase] || 'Стол'}</h2>
    <p>${state.counts.map((count,index) => `Место ${index+1} · ${count} карт`).join(' / ')}</p>
    ${state.stock === undefined ? '' : `<p>Колода · ${state.stock}</p>`}
    ${state.scores ? `<p>Счёт · ${state.scores.join(' / ')}</p>` : ''}
    ${state.taken ? `<p>Очки раздачи · ${state.taken.join(' / ')}</p>` : ''}
    ${state.bid ? `<p>Заявка · ${state.bid}, место ${state.bidder}</p>` : ''}
    ${state.stacks ? `<p>Фишки · ${state.stacks.join(' / ')} · Банк ${state.phase === 'round' ? 0 : state.total.reduce((a,b)=>a+b,0)}</p><p>Ставки круга · ${state.street.join(' / ')}</p>` : ''}
    <div class="card-hand">${state.top === undefined ? '' : cards([state.top]) + ' ' + suits[state.suit]}
      ${state.trump === undefined ? '' : 'Козырь ' + (state.table ? label(state.trump) : suits[state.trump])}
      ${state.table?.map(pair => `<div class="card-hand">${cards(pair.defense === undefined ? [pair.attack] : [pair.attack,pair.defense])}</div>`).join('') || ''}
      ${(state.trick?.length ? state.trick : state.lastTrick || []).map(entry => `<div>Место ${entry.side}${cards([entry.card])}</div>`).join('')}
      ${cards(state.community || [])}
    </div>
    ${state.showdown?.map(entry => `<div class="card-hand">Место ${entry.side}${cards(entry.cards)}</div>`).join('') || ''}
    </section><section class="card-seat"><h2>Ваша рука</h2><div class="card-hand">${state.hand.map(card =>
      `<div>${cards([card])}<div class="card-order">${controls.filter(move => move.card === card).map(command).join('')}</div></div>`).join('') || 'Рука пуста.'}</div>
    <div class="private-actions">${controls.filter(move => move.card === undefined).map(command).join('')}</div></section>`;
}

export const cardCatalog = {
  durak:['Подкидной дурак',2,[['Атака и защита','Колода из 36 карт, по шесть на руки. Козырь виден под колодой. Отбейте карту старшей той же масти или козырем. Козырь бьётся старшим козырем.'],['Подкидывание и добор','Подкидывать можно по достоинствам на столе, максимум шесть карт и не больше размера руки защитника в начале атаки. Если защитник берёт, стол сразу переходит ему. Атакующий добирает первым. После исчерпания колоды проигрывает оставшийся с картами.']]],
  eights:['Восьмёрки',4,[['Сброс','По пять карт. Кладите карту той же масти или достоинства. Восьмёрка подходит всегда и позволяет выбрать следующую масть.'],['Добор','Если хода нет, добирайте до подходящей карты. Сброс перемешивается, когда колода кончается. Выигрывает первый, кто избавится от карт.']]],
  hearts:['Червы',4,[['Передача и взятки','В первых трёх раздачах цикла передайте три карты влево, вправо и напротив соответственно. Четвёртая проходит без обмена. Первую взятку открывает двойка треф. Если можете, ходите в масть. Червами можно открывать после первого сброса червы или когда остались только червы.'],['Очки','Черва стоит одно штрафное очко, дама пик — 13. Взявшему все 26 штрафных очков записывается ноль, а остальным по 26. При достижении 100 очков побеждает игрок с наименьшим счётом.']]],
  thousand:['Тысяча',3,[['Торги','В колоде 24 карты от девятки до туза. Начальная заявка — 100, шаг — 5, предел ставок в этой версии — 120. Победитель торгов забирает прикуп и передаёт по карте двум соперникам.'],['Взятки','Порядок от старшей к младшей: туз, десятка, король, дама, валет, девятка. Ходите в масть, при её отсутствии — козырем. После выигранной взятки можно объявить марьяж, начав с короля или дамы одной масти. Она становится козырем.'],['Счёт','За выполнение заявки начисляется её величина, за недобор она вычитается. Остальным очки округляются до пяти. Побеждает первый с 1000 очков. Бочка в этой версии не используется.']]],
  holdem:['Техасский холдем',4,[['Фишки и ставки','Каждому по 500 игровых фишек. Блайнды 5 и 10. Доступны чек, колл, сброс, минимальное повышение и олл-ин. Две закрытые карты получает каждый игрок, общие карты открываются тремя этапами.'],['Вскрытие','Выигрывает лучшая пятикарточная комбинация из семи карт. При равенстве банк делится. При олл-ине с разными стеками побочные банки разыгрываются между игроками, которые внесли соответствующую сумму.']]],
};
export function standardCardView(id) {
  const [name,seats,rules] = cardCatalog[id];
  return cardView({id,name,seats,rules,markup:table});
}
