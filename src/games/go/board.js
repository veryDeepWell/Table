import {coordinates, goFiles, ranks} from '../coordinates.js';

export function goPosition(index, size) {
  return goFiles[index % size] + (size - Math.floor(index / size));
}

export function goBoard(state, enabled = !state.ended) {
  const intersections = state.board.map((stone,index) => {
    const color = stone === 1 ? 'black' : stone === 2 ? 'white' : '';
    const description = stone === 1 ? 'чёрный камень' : stone === 2 ? 'белый камень' : 'свободно';
    return `<button type="button" class="intersection ${color} ${state.last === index ? 'last' : ''}" data-i="${index}"
      aria-label="${goPosition(index,state.size)}, ${description}" ${stone || !enabled ? 'disabled' : ''}></button>`;
  }).join('');
  const field = `<div id="board" class="board" role="group" aria-label="Доска го" style="--n:${state.size}" data-turn="${state.turn === 1 ? 'black' : 'white'}">${intersections}</div>`;
  return coordinates(field,goFiles.slice(0,state.size),ranks(state.size),'go');
}
