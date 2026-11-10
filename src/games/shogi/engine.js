import {adjacent, diagonals, orthogonals, other, forward, piece, targets, checked, boardKey} from '../grid.js';

export const handTypes = ['r','b','g','s','n','l','p'];
const promotable = ['r','b','s','n','l','p'];
const zone = (i, side) => side === 1 ? i < 27 : i >= 54;
const stranded = (type, i, side) => {
  const distance = side === 1 ? Math.floor(i / 9) : 8 - Math.floor(i / 9);
  return (['p','l'].includes(type) && distance === 0) || (type === 'n' && distance < 2);
};

function attack(board, from) {
  const {type,side} = board[from];
  const dir = forward(side);
  const gold = [[dir,-1],[dir,0],[dir,1],[0,-1],[0,1],[-dir,0]];
  const steps = {
    p:[[dir,0]], n:[[2*dir,-1],[2*dir,1]], s:[[dir,-1],[dir,0],[dir,1],[-dir,-1],[-dir,1]],
    g:gold, k:adjacent, '+b':orthogonals, '+r':diagonals,
  };
  const rays = {l:[[dir,0]], b:diagonals, r:orthogonals, '+b':diagonals, '+r':orthogonals};
  const goldLike = ['+p','+l','+n','+s'].includes(type);
  return [...targets(board, from, 9, goldLike ? gold : steps[type] || []),
    ...targets(board, from, 9, rays[type] || [], true)];
}

export const inCheck = (board, side) => checked(board, side, attack);
const key = ({board,turn,hands}) => boardKey(board) + '/' + turn + '/' + hands.map(hand =>
  handTypes.map(type => hand[type] || 0).join(',')).join('/');

export function create() {
  const board = Array(81).fill(null);
  [...'lnsgkgsnl'].forEach((type, col) => {
    board[col] = piece(type,2);
    board[18 + col] = piece('p',2);
    board[54 + col] = piece('p',1);
    board[72 + col] = piece(type,1);
  });
  board[10] = piece('r',2);
  board[16] = piece('b',2);
  board[64] = piece('b',1);
  board[70] = piece('r',1);
  const state = {board,turn:1,hands:[{},{}],positions:[]};
  return {...state, positions:[{key:key(state),turn:1,check:false}]};
}

function apply(state, move) {
  const {from,to,drop,promotion} = move;
  const {turn} = state;
  const board = [...state.board];
  const hands = state.hands.map(hand => ({...hand}));
  const hand = hands[turn - 1];
  if (drop) {
    hand[drop]--;
    board[to] = piece(drop,turn);
  } else {
    const captured = board[to]?.type.replace('+','');
    if (captured) hand[captured] = (hand[captured] || 0) + 1;
    board[to] = promotion ? piece(promotion,turn) : board[from];
    board[from] = null;
  }
  return {...state, board, hands, turn:other(turn), last:drop ? [to] : [from,to]};
}

export function moves(state, boardOnly = false) {
  if (state.result) return [];
  const {board,turn,hands} = state;
  const normal = board.flatMap((p,from) => {
    if (p?.side !== turn) return [];
    return attack(board, from).flatMap(to => {
      if (board[to]?.side === turn || board[to]?.type === 'k') return [];
      if (stranded(p.type,to,turn)) return [{from,to,promotion:'+' + p.type}];
      if (promotable.includes(p.type) && (zone(from,turn) || zone(to,turn))) {
        return [{from,to},{from,to,promotion:'+' + p.type}];
      }
      return [{from,to}];
    });
  });
  const drops = boardOnly ? [] : handTypes.flatMap(drop => {
    if (!hands[turn - 1][drop]) return [];
    const pawnFiles = new Set(board.flatMap((p,i) => p?.side === turn && p.type === 'p' ? [i % 9] : []));
    return board.flatMap((p,to) => p || stranded(drop,to,turn) ||
      (drop === 'p' && pawnFiles.has(to % 9)) ? [] : [{drop,to}]);
  });
  return [...normal,...drops].filter(move => {
    const next = apply(state, move);
    if (inCheck(next.board, turn)) return false;
    // A check from an adjacent dropped pawn can only be answered by a board move.
    return move.drop !== 'p' || !inCheck(next.board,next.turn) || moves(next,true).length > 0;
  });
}

export function play(state, move) {
  const next = apply(state, move);
  const current = key(next);
  const check = inCheck(next.board, next.turn);
  next.positions = [...state.positions,{key:current,turn:next.turn,check}];
  if (!moves(next).length) {
    next.result = {winner:state.turn,reason:check ? 'Мат' : 'У соперника нет ходов'};
    return next;
  }
  const repetitions = next.positions.flatMap((pos,i) => pos.key === current ? [i] : []);
  if (repetitions.length >= 4) {
    const cycle = next.positions.slice(repetitions.at(-4) + 1);
    const checkingSide = [1,2].find(side => cycle.filter(pos => pos.turn === other(side)).every(pos => pos.check));
    next.result = checkingSide
      ? {winner:other(checkingSide),reason:'Повторение с непрерывным шахом'}
      : {reason:'Четырёхкратное повторение'};
  }
  return next;
}
