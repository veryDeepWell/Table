import {adjacent,offset} from './grid.js';

function line(board,point,side,size,[dy,dx]) {
  const cells = [point];
  for (const sign of [-1,1]) {
    for (let step = 1; ; step++) {
      const cell = offset(point,dy * step * sign,dx * step * sign,size);
      if (cell < 0 || board[cell] !== side) break;
      cells.push(cell);
    }
  }
  return cells;
}

export const gomoku = {
  size:15,
  create:() => ({board:Array(225).fill(0),turn:1}),
  moves:({board,result}) => result ? [] : board.flatMap((stone,to) => stone ? [] : [{to}]),
  play(state,{to}) {
    const board = [...state.board];
    board[to] = state.turn;
    const win = [[0,1],[1,0],[1,1],[1,-1]].map(direction =>
      line(board,to,state.turn,15,direction)).find(cells => cells.length >= 5);
    const result = win ? {winner:state.turn,line:win} : board.every(Boolean) ? {reason:'Поле заполнено'} : undefined;
    return {board,turn:3-state.turn,last:[to],result};
  },
};

export const reversi = {
  size:8,
  create() {
    const board = Array(64).fill(0);
    board[27] = board[36] = 2;
    board[28] = board[35] = 1;
    return {board,turn:1};
  },
  moves({board,turn,result}) {
    if (result) return [];
    return board.flatMap((stone,to) => {
      if (stone) return [];
      const flips = adjacent.flatMap(([dy,dx]) => {
        const run = [];
        let step = 1;
        let cell = offset(to,dy,dx,8);
        while (cell >= 0 && board[cell] === 3 - turn) {
          run.push(cell);
          step++;
          cell = offset(to,dy * step,dx * step,8);
        }
        return board[cell] === turn ? run : [];
      });
      return flips.length ? [{to,flips}] : [];
    });
  },
  play(state,{to,flips}) {
    const board = [...state.board];
    for (const cell of [to,...flips]) board[cell] = state.turn;
    const next = {board,turn:3-state.turn,last:[to],flips};
    if (reversi.moves(next).length) return next;
    next.turn = state.turn;
    if (reversi.moves(next).length) return {...next,skipped:3-state.turn};
    const black = board.filter(stone => stone === 1).length;
    const white = board.filter(stone => stone === 2).length;
    return {...next,result:{winner:black === white ? null : black > white ? 1 : 2,reason:`Чёрные ${black} · Белые ${white}`}};
  },
};

const pits = [[0,1,2,3,4,5],[7,8,9,10,11,12]];
export const kalah = {
  create:() => ({board:[4,4,4,4,4,4,0,4,4,4,4,4,4,0],turn:1}),
  moves:state => state.result ? [] : pits[state.turn - 1].flatMap(to => state.board[to] ? [{to}] : []),
  play(state,{to}) {
    const board = [...state.board];
    const store = state.turn === 1 ? 6 : 13;
    const otherStore = 19 - store;
    let remaining = board[to], cursor = to;
    board[to] = 0;
    while (remaining > 0) {
      cursor = (cursor + 1) % 14;
      if (cursor === otherStore) continue;
      board[cursor]++;
      remaining--;
    }
    const opposite = 12 - cursor;
    if (pits[state.turn - 1].includes(cursor) && board[cursor] === 1 && board[opposite]) {
      board[store] += board[opposite] + 1;
      board[cursor] = board[opposite] = 0;
    }
    let result;
    if (pits.some(row => row.every(index => !board[index]))) {
      pits.forEach((row,side) => row.forEach(index => { board[side ? 13 : 6] += board[index]; board[index] = 0; }));
      result = {winner:board[6] === board[13] ? null : board[6] > board[13] ? 1 : 2,reason:`${board[6]} : ${board[13]}`};
    }
    return {board,turn:cursor === store ? state.turn : 3-state.turn,last:[cursor],extra:cursor === store,result};
  },
};
