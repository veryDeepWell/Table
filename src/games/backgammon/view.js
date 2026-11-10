import * as engine from './engine.js';
import {renderTable} from '../table-view.js';

const diceFaces = ['','⚀','⚁','⚂','⚃','⚄','⚅'];
const rollDie = () => Math.floor(Math.random() * 6) + 1;
const sides = ['Белые','Чёрные'];

function board(game, state, legal, selected) {
  const {BAR,OFF} = engine;
  const destination = to => legal.some(move => move.from === selected && move.to === to);
  const source = from => legal.some(move => move.from === from);
  const point = (index, edge) => {
    const count = state.board[index];
    return `<button class="gammon-point ${edge} ${index % 2 ? 'point-dark' : 'point-light'}${destination(index) ? ' target-point' : ''}"
      data-point="${index}" aria-pressed="${selected === index}" aria-label="Пункт ${index + 1}${count ? `, ${sides[count > 0 ? 0 : 1]}, шашек: ${Math.abs(count)}` : ', пусто'}"
      ${source(index) || destination(index) ? '' : 'disabled'}>
      <span class="point-index">${index + 1}</span>
      <span class="gammon-stack" aria-hidden="true">${Array.from({length:Math.min(Math.abs(count),5)}, (_,i) =>
        `<i class="gammon-piece side-${count > 0 ? 1 : 2}">${i === 4 && Math.abs(count) > 5 ? Math.abs(count) : ''}</i>`).join('')}</span>
    </button>`;
  };
  const range = (start, direction) => Array.from({length:6},(_,i) => start + i * direction);
  return `<div class="gammon-board" role="group" aria-label="Доска коротких нард">
    <div class="gammon-row">${range(12,1).map(i => point(i,'top')).join('')}<span class="gammon-divider"></span>${range(18,1).map(i => point(i,'top')).join('')}</div>
    <div class="gammon-row">${range(11,-1).map(i => point(i,'bottom')).join('')}<span class="gammon-divider"></span>${range(5,-1).map(i => point(i,'bottom')).join('')}</div>
  </div>
  <div class="gammon-trays">
    <button class="button secondary" data-point="${BAR}" aria-pressed="${selected === BAR}" ${source(BAR) ? '' : 'disabled'}>Бар · ${state.bar.join(' : ')}</button>
    <button class="button secondary ${destination(OFF) ? 'target-point' : ''}" data-point="${OFF}" ${destination(OFF) ? '' : 'disabled'}>Снять · ${state.off.join(' : ')}</button>
  </div>`;
}

const game = {
  id:'backgammon', name:'Нарды', variant:'КОРОТКИЕ НАРДЫ',
  subtitle:'Бросок и расчёт.',
  description:'Проведите пятнадцать шашек в свой дом и снимите их раньше соперника.',
  hint:'Белые идут от 24 к 1, чёрные — от 1 к 24. Счётчики: белые : чёрные.',
  sides, engine, board,
  status(state) {
    if (state.opening) return 'Каждая сторона бросает по одной кости. Большая начинает.';
    if (state.dice.length) return 'Выберите шашку и один из доступных пунктов.';
    if (state.skipped) return `${sides[state.skipped - 1]} выбросили ${state.rolled.join(' и ')}, но ходов нет. Бросайте кости.`;
    return 'Бросьте кости, чтобы начать ход.';
  },
  roll(state) {
    const a = rollDie();
    let b = rollDie();
    while (state.opening && a === b) b = rollDie();
    return engine.roll(state,a,b);
  },
  choice:move => `Использовать ${move.die}`,
  controls(state) {
    if (state.result) return '';
    const rolled = state.rolled ? `<div class="dice-readout"><span>${state.opening ? 'Бросок' : 'Последний бросок'}</span>
      ${state.rolled.map(die => `<b aria-label="${die}">${diceFaces[die]}</b>`).join('')}</div>` : '';
    return rolled + (state.dice.length
      ? `<p class="dice-left">Осталось сыграть: ${state.dice.join(', ')}</p>`
      : `<button class="button dark" data-action="roll">${state.opening ? 'Первый бросок' : 'Бросить кости'}</button>`);
  },
  source:{name:'Федерация нард США',url:'https://usbgf.org/beginners-guide-to-backgammon/'},
  rules:[
    ['Расстановка и цель','У каждого 15 шашек. В нумерации белых их стартовые стопки стоят на 24-м, 13-м, 8-м и 6-м пунктах: 2, 5, 3 и 5 шашек. У чёрных расстановка зеркальная. Стороны движутся навстречу друг другу. Побеждает тот, кто первым снимет все свои шашки.','Дом белых — пункты 1–6, дом чёрных — 19–24.'],
    ['Бросок и движение','Для первого хода стороны бросают по одной кости. При равенстве бросают снова. Начинает сторона с большим числом, используя обе кости. Дальше игрок бросает две кости на своём ходу. Каждое число — отдельное перемещение. Дубль даёт четыре перемещения. Пункт с двумя или более шашками соперника закрыт.','При броске 3 и 5 можно сходить двумя шашками или одной на 8, если хотя бы один порядок шагов даёт открытый промежуточный пункт.'],
    ['Обе кости, если возможно','Нужно использовать обе кости, если существует такой порядок ходов. Если можно сыграть только одну из двух разных костей, выбирают большую, когда она доступна. При дубле нужно сыграть максимальное возможное число перемещений.','При 2 и 6, когда можно сыграть 2 или 6 по отдельности, но нельзя обе, нужно сыграть 6.'],
    ['Взятие и бар','Одиночная шашка соперника на пункте уязвима. Если туда приходит ваша, чужая уходит на бар. Пока у вас есть шашки на баре, сначала возвращайте их в дом соперника по значениям костей. Если оба входа закрыты, ход пропускается.','Белая шашка на баре входит на пункт 21 при броске 4, если там меньше двух чёрных шашек.'],
    ['Снятие шашек','Когда все оставшиеся шашки в вашем доме, их можно снимать по точному значению кости. Если нужный пункт пуст и выше него шашек нет, можно снять шашку с самого дальнего занятого пункта. Обычный ход внутри дома тоже допустим. Если шашку побили, сначала верните её в дом.','Если у белых самый дальний занятый пункт — 5, на 6 можно снять шашку с 5.'],
    ['Окончание','Обычная победа стоит одно очко. Если соперник не снял ни одной шашки, это марс (два очка). Если при этом у него осталась шашка на баре или в вашем доме, это кокс (три очка). Здесь играют отдельную партию без куба удвоения.','Если белые всё сняли, а у чёрных осталось 15 шашек, одна из которых на баре, это кокс.'],
  ],
};
export const render = root => renderTable(root,game);
