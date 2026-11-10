import {other, orthogonals, targets} from '../grid.js';

export const size = 15;
const length = size * size;
export const create = () => ({
  board:Array(length).fill(0), territory:Array(length).fill(0), turn:1,
  captures:[0,0],last:null,
});

export function moves({board,territory,result}) {
  if (result) return [];
  return board.flatMap((side,to) => side || territory[to] ? [] : [{to}]);
}

function capture(board, territory, side) {
  const outside = new Set();
  const wall = index => board[index] === side && !territory[index];
  function fill(start, seen) {
    const region = [start];
    seen.add(start);
    for (const index of region) {
      for (const neighbor of targets(board,index,size,orthogonals)) {
        if (wall(neighbor) || seen.has(neighbor)) continue;
        region.push(neighbor);
        seen.add(neighbor);
      }
    }
    return region;
  }
  for (let i = 0; i < length; i++) {
    if (i < size || i >= length - size || i % size === 0 || i % size === size - 1) {
      if (!wall(i) && !outside.has(i)) fill(i,outside);
    }
  }
  let captured = 0;
  const seen = new Set(outside);
  for (let i = 0; i < length; i++) {
    if (seen.has(i) || wall(i)) continue;
    const region = fill(i,seen);
    const enemies = region.filter(index => board[index] === other(side) && !territory[index]).length;
    if (!enemies) continue;
    captured += enemies;
    for (const index of region) if (!territory[index]) territory[index] = side;
  }
  return captured;
}

export function finish(state) {
  const [red,blue] = state.captures;
  const reason = `Захвачено точек: красные — ${red}, синие — ${blue}.`;
  const result = red === blue ? {reason} : {winner:red > blue ? 1 : 2,reason};
  return {...state,result};
}

export function play(state, {to}) {
  const {turn} = state;
  const board = [...state.board];
  const territory = [...state.territory];
  const captures = [...state.captures];
  board[to] = turn;
  captures[turn - 1] += capture(board,territory,turn);
  captures[other(turn) - 1] += capture(board,territory,other(turn));
  const next = {board,territory,captures,turn:other(turn),last:to};
  return moves(next).length ? next : finish(next);
}
