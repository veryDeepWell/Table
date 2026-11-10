import {other} from '../grid.js';

export const BAR = 24;
export const OFF = 25;
const sign = side => side === 1 ? 1 : -1;
const distance = (point, side) => side === 1 ? point + 1 : 24 - point;

export function create() {
  const board = Array(24).fill(0);
  for (const [point,count] of [[23,2],[12,5],[7,3],[5,5]]) {
    board[point] = count;
    board[23 - point] = -count;
  }
  return {board,turn:1,bar:[0,0],off:[0,0],dice:[],opening:true};
}

function options(state, die) {
  const {board,turn,bar} = state;
  const own = sign(turn);
  const available = board.flatMap((count,point) => count * own > 0 ? [point] : []);
  if (bar[turn - 1]) {
    const to = turn === 1 ? 24 - die : die - 1;
    return board[to] * own >= -1 ? [{from:BAR,to,die}] : [];
  }
  const farthest = Math.max(0, ...available.map(point => distance(point,turn)));
  return available.flatMap(from => {
    const to = from - own * die;
    if (to >= 0 && to < 24) return board[to] * own >= -1 ? [{from,to,die}] : [];
    const remaining = distance(from,turn);
    return farthest <= 6 && (die === remaining || remaining === farthest) ? [{from,to:OFF,die}] : [];
  });
}

function step(state, {from,to,die}) {
  const {turn} = state;
  const own = sign(turn);
  const board = [...state.board];
  const bar = [...state.bar];
  const off = [...state.off];
  const dice = [...state.dice];
  dice.splice(dice.indexOf(die),1);
  if (from === BAR) bar[turn - 1]--;
  else board[from] -= own;
  if (to === OFF) off[turn - 1]++;
  else if (board[to] === -own) {
    bar[other(turn) - 1]++;
    board[to] = own;
  } else board[to] += own;
  return {...state,board,bar,off,dice,last:[from,to]};
}

function choices(state) {
  return [...new Set(state.dice)].flatMap(die => options(state,die));
}

function usable(state) {
  let best = 0;
  for (const move of choices(state)) {
    best = Math.max(best,1 + usable(step(state,move)));
    if (best === state.dice.length) break;
  }
  return best;
}

export function moves(state) {
  if (state.result) return [];
  const possible = choices(state).map(move => ({move,length:1 + usable(step(state,move))}));
  const max = Math.max(0,...possible.map(item => item.length));
  const best = possible.filter(item => item.length === max).map(item => item.move);
  if (max !== 1) return best;
  const high = Math.max(...best.map(move => move.die));
  return best.filter(move => move.die === high);
}

const finishTurn = state => ({...state,turn:other(state.turn),dice:[]});
export function roll(state, a, b) {
  if (state.result || state.dice.length || (state.opening && a === b)) return state;
  const turn = state.opening ? (a > b ? 1 : 2) : state.turn;
  const next = {...state,turn,opening:false,dice:a === b ? [a,a,a,a] : [a,b],rolled:[a,b],last:[]};
  if (!moves(next).length) return {...finishTurn(next),skipped:turn};
  return {...next,skipped:null};
}

export function play(state, move) {
  const next = step(state,move);
  const {turn,board,bar,off} = next;
  if (off[turn - 1] === 15) {
    const opponent = other(turn);
    const backgammon = bar[opponent - 1] || board.some((count,i) =>
      count * sign(opponent) > 0 && distance(i,turn) <= 6);
    const reason = off[opponent - 1] ? 'Обычная победа · 1 очко'
      : backgammon ? 'Кокс · 3 очка' : 'Марс · 2 очка';
    return {...next,result:{winner:turn,reason}};
  }
  return moves(next).length ? next : finishTurn(next);
}
