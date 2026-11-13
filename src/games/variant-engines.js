import {orthogonals,diagonals} from './grid.js';
import * as xiangqi from './xiangqi/engine.js';

const coordinate = (point,width) => [Math.floor(point/width),point%width];
const at = (y,x,width,height) => x < 0 || x >= width || y < 0 || y >= height ? -1 : y*width+x;
const palaceLines = [[3,13,23],[5,13,21],[66,76,86],[68,76,84]];
function janggiTargets(board,from) {
  const {type,side} = board[from];
  const [y,x] = coordinate(from,9);
  const index = (dy,dx) => at(y+dy,x+dx,9,10);
  const palace = to => to >= 0 && to%9 >= 3 && to%9 <= 5 && (side === 1 ? to >= 63 : to < 27);
  const adjacent = orthogonals.map(([dy,dx]) => index(dy,dx));
  const diagonalsHere = palaceLines.filter(line => line.includes(from)).flatMap(line =>
    line.filter((point,offset) => Math.abs(offset-line.indexOf(from)) === 1));
  const forward = side === 1 ? -1 : 1;
  if (type === 'k' || type === 'a') return [...adjacent,...diagonalsHere].filter(palace);
  if (type === 'p') return [index(forward,0),index(0,-1),index(0,1),
    ...diagonalsHere.filter(point => Math.floor(point/9)-y === forward)];
  if (type === 'n' || type === 'e') {
    return orthogonals.flatMap(([dy,dx]) => {
      const first = index(dy,dx);
      if (first < 0 || board[first]) return [];
      return [-1,1].flatMap(sign => {
        const sy = dx * sign, sx = dy * sign;
        const second = index(dy*2+sy,dx*2+sx);
        if (type === 'n') return [second];
        if (second < 0 || board[second]) return [];
        return [index(dy*3+sy*2,dx*3+sx*2)];
      });
    });
  }
  const rays = orthogonals.map(([dy,dx]) => {
    const ray = [];
    for (let step=1,point; (point=index(dy*step,dx*step)) >= 0; step++) ray.push(point);
    return ray;
  });
  for (const line of palaceLines.filter(line => line.includes(from))) {
    const pivot = line.indexOf(from);
    rays.push(line.slice(pivot+1),line.slice(0,pivot).reverse());
  }
  const result = [];
  for (const ray of rays) {
    let screen = type === 'r';
    for (const point of ray) {
      const occupant = board[point];
      if (!screen) {
        if (occupant?.type === 'c') break;
        if (occupant) screen = true;
        continue;
      }
      if (occupant?.side !== side && (type === 'r' || occupant?.type !== 'c')) result.push(point);
      if (occupant) break;
    }
  }
  return result;
}
const checked = (board,side) => {
  const king = board.findIndex(piece => piece?.type === 'k' && piece.side === side);
  return board.some((piece,from) => piece?.side === 3-side && janggiTargets(board,from).includes(king));
};
const moved = (board,{from,to}) => board.map((piece,index) => index === to ? board[from] : index === from ? null : piece);
export const janggi = {
  width:9,height:10,
  create() {
    const {board} = xiangqi.create();
    for (const row of [0,9]) {
      const point = row*9+4;
      const general = point + (row ? -9 : 9);
      board[general] = board[point];
      board[point] = null;
    }
    return {board,turn:1,positions:[]};
  },
  moves({board,turn,result}) {
    if (result) return [];
    const options = board.flatMap((piece,from) => piece?.side === turn ? janggiTargets(board,from)
      .filter(to => to >= 0 && board[to]?.side !== turn && board[to]?.type !== 'k')
      .map(to => ({from,to})).filter(move => !checked(moved(board,move),turn)) : []);
    return checked(board,turn) ? options : [...options,{from:90,to:90}];
  },
  play(state,move) {
    const pass = move.from === 90;
    const board = pass ? state.board : moved(state.board,move);
    const turn = 3-state.turn;
    const key = turn + board.map(piece => piece ? piece.side+piece.type : '-').join('');
    const positions = [...state.positions,key];
    const next = {board,turn,positions,passes:pass ? (state.passes || 0)+1 : 0,last:pass ? [] : [move.from,move.to]};
    if (!janggi.moves(next).length) return {...next,result:{winner:state.turn,reason:'Мат'}};
    if (next.passes === 2 || positions.filter(value => value === key).length >= 3) return {...next,result:{reason:'Ничья'}};
    return next;
  },
};

const width = 11;
const corners = [0,10,110,120];
const throne = 60;
const neighbors = point => orthogonals.map(([dy,dx]) => {
  const [y,x] = coordinate(point,width);
  return at(y+dy,x+dx,width,width);
});
const defender = piece => piece?.side === 1;
export const hnefatafl = {
  width,height:width,
  create() {
    const board = Array(121).fill(null);
    const place = (indices,side,type) => indices.forEach(index => { board[index] = {side,type}; });
    place([38,48,49,50,58,59,61,62,70,71,72,82],1,'d');
    place([3,4,5,6,7,16,33,43,44,54,55,56,64,65,66,76,77,87,104,113,114,115,116,117],2,'a');
    place([throne],1,'k');
    return {board,turn:2,positions:[]};
  },
  moves({board,turn,result}) {
    if (result) return [];
    return board.flatMap((piece,from) => {
      if (piece?.side !== turn) return [];
      const [y,x] = coordinate(from,width);
      return orthogonals.flatMap(([dy,dx]) => {
        const ray = [];
        for (let step=1,point; (point=at(y+dy*step,x+dx*step,width,width)) >= 0 && !board[point]; step++) {
          if (piece.type === 'k' || point !== throne && !corners.includes(point)) ray.push({from,to:point});
        }
        return ray;
      });
    });
  },
  play(state,{from,to}) {
    const board = moved(state.board,{from,to});
    const [y,x] = coordinate(to,width);
    for (const [dy,dx] of orthogonals) {
      const victim = at(y+dy,x+dx,width,width);
      const beyond = at(y+2*dy,x+2*dx,width,width);
      if (board[victim]?.side !== 3-state.turn || board[victim].type === 'k') continue;
      if (board[beyond]?.side === state.turn || !board[beyond] && (corners.includes(beyond) || beyond === throne)) board[victim] = null;
    }
    const king = board.findIndex(piece => piece?.type === 'k');
    let result;
    if (corners.includes(king)) result = {winner:1,reason:'Король добрался до угла'};
    else if (neighbors(king).every(point => point === throne && !board[point] || board[point] && !defender(board[point]))) {
      result = {winner:2,reason:'Король окружён'};
    }
    const turn = 3-state.turn;
    const key = turn + board.map(piece => piece?.type || '-').join('');
    const positions = [...state.positions,key];
    const next = {board,turn,positions,last:[from,to],result};
    if (!result && !hnefatafl.moves(next).length) return {...next,result:{winner:state.turn,reason:'Нет ходов'}};
    if (!result && positions.filter(value => value === key).length >= 3) return {...next,result:{reason:'Троекратное повторение'}};
    return next;
  },
};
