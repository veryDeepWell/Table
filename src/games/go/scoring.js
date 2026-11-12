import {tally} from './engine.js';
import {goBoard} from './board.js';

export function mountScoring(area,send) {
  const field = area.querySelector('[data-go-field]');
  const panel = document.createElement('section');
  panel.className = 'go-scoring';
  area.querySelector('.capture-note').after(panel);
  let current;
  let preview = false;
  function paint() {
    const {state,playable,forfeited,side,captured} = current;
    const scoring = state.ended && !forfeited;
    const choosing = scoring && !state.mode && !state.confirmed;
    const editing = scoring && state.mode === 'manual' && !state.confirmed;
    const result = scoring && !choosing ? tally(state) : null;
    const vote = state.votes?.[side - 1];
    const opponent = state.votes?.[2 - side];
    const modeLabel = mode => mode === 'automatic' ? 'Автоматический' : 'Ручной';
    const winner = result?.points[1] > result?.points[2] ? 'Чёрные победили' : 'Белые победили';
    field.innerHTML = goBoard(state,playable,{result,editing,ghosts:preview ? captured : []});
    for (const [color,index] of [['black',1],['white',2]]) {
      area.querySelector('#' + color + '-captures').textContent = result?.prisoners[index] ?? state.captures[index];
    }
    panel.innerHTML = `${captured.length ? `<button type="button" class="text-button" data-preview aria-pressed="${preview}">${preview ? 'Скрыть' : 'Показать'} последний захват</button>` : ''}
      ${choosing ? `<p><b>Выберите режим подсчёта</b></p>
        <p>Автоматический снимет только явно окружённые группы. В ручном режиме группы отмечают игроки.</p>
        <button type="button" class="button secondary" data-score="automatic" aria-pressed="${vote === 'automatic'}">Автоматический</button>
        <button type="button" class="button secondary" data-score="manual" aria-pressed="${vote === 'manual'}">Ручной</button>
        ${vote ? `<p role="status">${opponent ? 'У соперника другой выбор: ' + modeLabel(opponent) + '.' : 'Ждём выбора соперника.'}</p>` : opponent ? `<p>Выбор соперника: ${modeLabel(opponent)}.</p>` : ''}
        <button type="button" class="text-button" data-score="resume">Продолжить игру</button>` : ''}
      ${result ? `<p><b>${state.confirmed ? winner : 'Предварительный счёт'} · ${result.points[1]} : ${result.points[2]}</b></p>
        <p>Чёрные: ${result.stones[1]} камней + ${result.territory[1]} территории<br>
        Белые: ${result.stones[2]} камней + ${result.territory[2]} территории + 7,5 коми<br>
        Нейтральных точек: ${result.territory[0]}</p>
        ${editing ? `<p>Нажмите на группу, чтобы отметить её пленной или вернуть на доску.</p>
          <button type="button" class="button dark" data-score="confirm" ${state.accepted?.includes(side) ? 'disabled' : ''}>${state.accepted?.includes(side) ? 'Ждём подтверждения соперника' : 'Подтвердить счёт'}</button>
          <button type="button" class="button secondary" data-score="resume">Продолжить игру</button>` : ''}` : ''}`;
  }
  panel.onclick = event => {
    const button = event.target.closest('button');
    if (!button) return;
    if ('preview' in button.dataset) {
      preview = !preview;
      paint();
    } else if (button.dataset.score) send(button.dataset.score);
  };
  field.onclick = event => {
    const button = event.target.closest('[data-i]:enabled');
    if (!button) return;
    send(current.state.ended ? 'mark' : 'play',Number(button.dataset.i));
  };
  return (state,playable,{forfeited = false,side = 1,captured = []} = {}) => {
    if (current?.state.last !== state.last) preview = false;
    current = {state,playable,forfeited,side,captured};
    paint();
  };
}
