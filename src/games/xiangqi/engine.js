import {orthogonals,diagonals,knight} from '../grid.js';

export const width = 9;
export const height = 10;
const row = point => Math.floor(point / width);
const col = point => point % width;
const palace = (y,x,side) => x >= 3 && x <= 5 && (side === 1 ? y >= 7 : y <= 2);
const home = (y,side) => side === 1 ? y >= 5 : y <= 4;
const inside = (y,x) => y >= 0 && y < height && x >= 0 && x < width;
const key = (board,turn) => turn + ':' + board.map(p => p ? p.side + p.type : '-').join('');

export function create() {
  const board = Array(width * height).fill(null);
  for (const side of [1,2]) {
    const rank = distance => side === 1 ? height - 1 - distance : distance;
    const place = (x,distance,type) => { board[rank(distance) * width + x] = {side,type}; };
    [...'rneakaenr'].forEach((type,x) => place(x,0,type));
    for (const x of [1,7]) place(x,2,'c');
    for (const x of [0,2,4,6,8]) place(x,3,'p');
  }
  return {board,turn:1,positions:[{key:key(board,1)}]};
}

function targets(board,from) {
  const {type,side} = board[from];
  const y = row(from), x = col(from);
  if (type === 'r' || type === 'c') {
    const result = [];
    for (const [dy,dx] of orthogonals) {
      let screen = false;
      for (let ny = y + dy, nx = x + dx; inside(ny,nx); ny += dy, nx += dx) {
        const to = ny * width + nx, occupant = board[to];
        if (type === 'c' && !screen && occupant) { screen = true; continue; }
        if (screen) {
          if (!occupant) continue;
          if (occupant.side !== side) result.push(to);
          break;
        }
        if (occupant?.side !== side) result.push(to);
        if (occupant) break;
      }
    }
    return result;
  }
  const forward = side === 1 ? -1 : 1;
  const steps = type === 'k' ? orthogonals : type === 'a' ? diagonals
    : type === 'e' ? diagonals.map(([dy,dx]) => [dy*2,dx*2])
    : type === 'n' ? knight : home(y,side) ? [[forward,0]] : [[forward,0],[0,-1],[0,1]];
  return steps.flatMap(([dy,dx]) => {
    const ny = y+dy, nx = x+dx, to = ny * width + nx;
    if (!inside(ny,nx) || board[to]?.side === side) return [];
    if ((type === 'k' || type === 'a') && !palace(ny,nx,side)) return [];
    if (type === 'e' && (!home(ny,side) || board[(y+dy/2)*width+x+dx/2])) return [];
    if (type === 'n' && board[(y+Math.trunc(dy/2))*width+x+Math.trunc(dx/2)]) return [];
    return [to];
  });
}

export function inCheck(board,side) {
  const general = board.findIndex(p => p?.side === side && p.type === 'k');
  if (general < 0) return true;
  const enemy = board.findIndex(p => p?.side === 3-side && p.type === 'k');
  if (enemy >= 0 && col(general) === col(enemy)) {
    let blocker = false;
    for (let point = Math.min(general,enemy)+width; point < Math.max(general,enemy); point += width) {
      if (board[point]) { blocker = true; break; }
    }
    if (!blocker) return true;
  }
  return board.some((p,from) => p?.side === 3-side && targets(board,from).includes(general));
}

function moveBoard(board,from,to) {
  const next = [...board];
  next[to] = next[from];
  next[from] = null;
  return next;
}

export function moves({board,turn,result}) {
  if (result) return [];
  return board.flatMap((p,from) => p?.side === turn ? targets(board,from).flatMap(to =>
    board[to]?.type !== 'k' && !inCheck(moveBoard(board,from,to),turn) ? [{from,to}] : []) : []);
}

export function play(state,{from,to}) {
  const board = moveBoard(state.board,from,to);
  const turn = 3-state.turn;
  const check = inCheck(board,turn);
  const position = {key:key(board,turn),side:state.turn,check};
  const positions = [...(state.positions || [{key:key(state.board,state.turn)}]),position];
  const next = {board,turn,positions,last:[from,to]};
  if (!moves(next).length) return {...next,result:{winner:state.turn,reason:check ? 'Мат' : 'Пат'}};
  const repeats = positions.flatMap((entry,index) => entry.key === position.key ? [index] : []);
  if (repeats.length < 3) return next;
  const cycle = positions.slice(repeats.at(-3)+1);
  const checks = [1,2].filter(side => cycle.filter(entry => entry.side === side).every(entry => entry.check));
  return {...next,result:checks.length === 1 ? {winner:3-checks[0],reason:'Вечный шах'} : {reason:'Троекратное повторение'}};
}
