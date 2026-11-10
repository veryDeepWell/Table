import {diagonals, other, forward, offset, targets, piece, boardKey} from '../grid.js';

const key = state => boardKey(state.board) + '/' + state.turn;
export function create() {
  const board = Array.from({length:64}, (_, i) => {
    const row = Math.floor(i / 8);
    if ((row + i % 8) % 2 === 0 || row === 3 || row === 4) return null;
    return piece('m', row < 3 ? 2 : 1);
  });
  const state = {board, turn:1, chain:null, taken:[], keys:[]};
  return {...state, keys:[key(state)]};
}

function captures(state, from) {
  const {board, taken} = state;
  const moving = board[from];
  const king = moving.type === 'd';
  return diagonals.flatMap(([row,col]) => {
    let distance = 1;
    let over = offset(from, row, col, 8);
    while (king && over >= 0 && !board[over]) {
      distance++;
      over = offset(from, row * distance, col * distance, 8);
    }
    if (over < 0 || !board[over] || board[over].side === moving.side || taken.includes(over)) return [];
    const landings = [];
    let to = offset(over, row, col, 8);
    while (to >= 0 && !board[to]) {
      landings.push({from,to,over});
      if (!king) break;
      to = offset(to, row, col, 8);
    }
    return landings;
  });
}

export function moves(state) {
  if (state.result) return [];
  if (state.chain !== null) return captures(state, state.chain);
  const own = state.board.flatMap((p, i) => p?.side === state.turn ? [i] : []);
  const forced = own.flatMap(from => captures(state, from));
  if (forced.length) return forced;
  return own.flatMap(from => {
    const king = state.board[from].type === 'd';
    const directions = king ? diagonals : diagonals.filter(([r]) => r === forward(state.turn));
    return targets(state.board, from, 8, directions, king)
      .filter(to => !state.board[to]).map(to => ({from,to}));
  });
}

export function play(state, {from,to,over}) {
  const {turn} = state;
  const board = [...state.board];
  const crown = turn === 1 ? to < 8 : to >= 56;
  board[to] = crown ? piece('d',turn) : board[from];
  board[from] = null;
  const next = {...state, board, last:[from,to]};
  if (over !== undefined) {
    next.taken = [...state.taken,over];
    next.chain = to;
    if (captures(next, to).length) return next;
    for (const square of next.taken) board[square] = null;
  }
  next.turn = other(turn);
  next.chain = null;
  next.taken = [];
  const current = key(next);
  next.keys = [...state.keys,current];
  if (!moves(next).length) next.result = {winner:turn, reason:'У соперника нет ходов'};
  else if (next.keys.filter(k => k === current).length >= 3) next.result = {reason:'Троекратное повторение'};
  return next;
}
