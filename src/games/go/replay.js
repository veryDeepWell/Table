import {goPosition} from './board.js';

export function goReplay(state) {
  if (!state?.history.length) return [];
  return [...state.history,state].map((position,index) => ({
    state:position,
    label:index === 0 ? 'Начальная позиция' : `${index}. ${position.last == null ? 'Пас' : goPosition(position.last,state.size)}`,
  }));
}
