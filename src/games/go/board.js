import {coordinates, goFiles, ranks} from '../coordinates.js';

export function goPosition(index, size) {
  return goFiles[index % size] + (size - Math.floor(index / size));
}

export function goBoard(state, enabled = !state.ended, {result,editing,ghosts = []} = {}) {
  const dead = new Set(result ? state.dead : []);
  const captured = new Map(ghosts.map(({point,stone}) => [point,stone]));
  const intersections = state.board.map((stone,index) => {
    const color = stone === 1 ? 'black' : stone === 2 ? 'white' : '';
    const owner = result?.owners[index];
    const ghost = captured.get(index);
    const description = stone ? (stone === 1 ? 'чёрный камень' : 'белый камень') : 'свободно';
    const territory = owner ? (owner === 1 ? ', территория чёрных' : ', территория белых') : '';
    return `<button type="button" class="intersection ${color} ${state.last === index ? 'last' : ''}${dead.has(index) ? ' go-dead' : ''}" data-i="${index}"
      aria-label="${goPosition(index,state.size)}, ${description}${dead.has(index) ? ', пленный' : ''}${territory}" ${(editing ? !stone : stone || !enabled) ? 'disabled' : ''}>${owner ? `<span class="go-territory owner-${owner}"></span>` : ''}${ghost ? `<span class="go-ghost ghost-${ghost}"></span>` : ''}</button>`;
  }).join('');
  const field = `<div id="board" class="board" role="group" aria-label="Доска го" style="--n:${state.size}" data-turn="${state.turn === 1 ? 'black' : 'white'}">${intersections}</div>`;
  return coordinates(field,goFiles.slice(0,state.size),ranks(state.size),'go');
}
