import {adjacent, diagonals, orthogonals, knight, other, forward, piece, offset, targets, checked, boardKey} from '../grid.js';

const size = 8;
const home = {1: 60, 2: 4};
const promotions = ['q','r','b','n'];
const attack = (board, from) => {
  const {type, side} = board[from];
  if (type === 'p') return targets(board, from, size, [[forward(side),-1],[forward(side),1]]);
  const directions = {k: adjacent, q: adjacent, b: diagonals, r: orthogonals, n: knight};
  return targets(board, from, size, directions[type], ['q','b','r'].includes(type));
};

export const inCheck = (board, side) => checked(board, side, attack);

export function create() {
  const board = Array(64).fill(null);
  [...'rnbqkbnr'].forEach((type, col) => {
    board[col] = piece(type, 2);
    board[col + 8] = piece('p', 2);
    board[col + 48] = piece('p', 1);
    board[col + 56] = piece(type, 1);
  });
  const state = {board, turn:1, castle:[0,7,56,63], ep:null, quiet:0, keys:[]};
  return {...state, keys:[positionKey(state)]};
}

function applyBoard(board, move) {
  const next = [...board];
  const moving = next[move.from];
  next[move.from] = null;
  next[move.to] = move.promotion ? piece(move.promotion, moving.side) : moving;
  if (move.capture !== undefined) next[move.capture] = null;
  if (move.rook !== undefined) {
    next[(move.from + move.to) / 2] = next[move.rook];
    next[move.rook] = null;
  }
  return next;
}

function pawnMoves(state, from) {
  const {board, turn, ep} = state;
  const dir = forward(turn);
  const row = Math.floor(from / 8);
  const step = offset(from, dir, 0, size);
  const moves = [];
  if (step >= 0 && !board[step]) {
    moves.push({from,to:step});
    const twice = offset(from, dir * 2, 0, size);
    if (row === (turn === 1 ? 6 : 1) && !board[twice]) moves.push({from,to:twice});
  }
  for (const to of attack(board, from)) {
    if (board[to]?.side === other(turn) && board[to].type !== 'k') moves.push({from,to});
    if (to === ep) moves.push({from,to,capture:to - dir * 8});
  }
  return moves.flatMap(move => move.to < 8 || move.to >= 56
    ? promotions.map(promotion => ({...move, promotion})) : [move]);
}

function castles(state, from) {
  const {board, turn, castle} = state;
  if (from !== home[turn] || inCheck(board, turn)) return [];
  return [-1,1].flatMap(dir => {
    const rook = from + (dir === -1 ? -4 : 3);
    if (!castle.includes(rook) || board[rook]?.type !== 'r' || board[rook].side !== turn) return [];
    for (let square = from + dir; square !== rook; square += dir) if (board[square]) return [];
    if (inCheck(applyBoard(board, {from,to:from + dir}), turn)) return [];
    return [{from,to:from + dir * 2,rook}];
  });
}

export function moves(state) {
  if (state.result) return [];
  const {board, turn} = state;
  return board.flatMap((p, from) => {
    if (p?.side !== turn) return [];
    if (p.type === 'p') return pawnMoves(state, from);
    const ordinary = attack(board, from)
      .filter(to => board[to]?.side !== turn && board[to]?.type !== 'k')
      .map(to => ({from,to}));
    return p.type === 'k' ? [...ordinary, ...castles(state, from)] : ordinary;
  }).filter(move => !inCheck(applyBoard(board, move), turn));
}

function positionKey(state) {
  const ep = state.ep !== null && moves(state).some(move => move.capture !== undefined) ? state.ep : '-';
  return [boardKey(state.board),state.turn,state.castle.join(','),ep].join('/');
}

function dead(board) {
  const nonKings = board.flatMap((p, square) => p && p.type !== 'k' ? [{...p,square}] : []);
  if (!nonKings.length) return true;
  if (nonKings.length === 1) return ['b','n'].includes(nonKings[0].type);
  const parity = square => (Math.floor(square / 8) + square % 8) % 2;
  return nonKings.every(p => p.type === 'b' && parity(p.square) === parity(nonKings[0].square));
}

export function play(state, move) {
  const {from,to} = move;
  const {type,side} = state.board[from];
  const board = applyBoard(state.board, move);
  const next = {
    ...state, board, turn:other(side), last:[from,to],
    castle:state.castle.filter(square => square !== from && square !== to &&
      !(type === 'k' && Math.floor(square / 8) === Math.floor(home[side] / 8))),
    ep:type === 'p' && Math.abs(from - to) === 16 ? (from + to) / 2 : null,
    quiet:type === 'p' || state.board[to] ? 0 : state.quiet + 1,
  };
  const key = positionKey(next);
  next.keys = [...state.keys,key];
  if (!moves(next).length) next.result = inCheck(board, next.turn)
    ? {winner:side, reason:'Мат'} : {reason:'Пат'};
  else if (dead(board)) next.result = {reason:'Недостаточно материала для мата'};
  else if (next.quiet >= 150) next.result = {reason:'75 ходов без взятий и ходов пешками'};
  else if (next.keys.filter(k => k === key).length >= 5) next.result = {reason:'Пятикратное повторение'};
  return next;
}

export function claim(state) {
  if (state.result) return null;
  if (state.quiet >= 100) return '50 ходов без взятий и ходов пешками';
  if (state.keys.filter(key => key === state.keys.at(-1)).length >= 3) return 'Троекратное повторение';
  return null;
}
