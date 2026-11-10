import {other} from '../grid.js';

export const width = 7;
export const height = 6;
export const create = () => ({board:Array(width * height).fill(0),turn:1,last:null});

export function moves(state) {
  if (state.result) return [];
  const options = [];
  for (let col = 0; col < width; col++) {
    for (let row = height - 1; row >= 0; row--) {
      const index = row * width + col;
      if (!state.board[index]) {
        options.push({to:col,index});
        break;
      }
    }
  }
  return options;
}

function winningLine(board, index, side) {
  const row = Math.floor(index / width);
  const col = index % width;
  for (const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
    const line = [index];
    for (const direction of [-1,1]) {
      let r = row + dr * direction;
      let c = col + dc * direction;
      while (r >= 0 && r < height && c >= 0 && c < width && board[r * width + c] === side) {
        line.push(r * width + c);
        r += dr * direction;
        c += dc * direction;
      }
    }
    if (line.length >= 4) return line;
  }
  return [];
}

export function play(state, move) {
  const {turn} = state;
  const board = [...state.board];
  board[move.index] = turn;
  const line = winningLine(board,move.index,turn);
  const result = line.length ? {winner:turn,reason:'Четыре фишки одного цвета в ряд.'}
    : board.every(Boolean) ? {reason:'Поле заполнено. Победного ряда нет.'} : undefined;
  return {board,turn:other(turn),last:move.index,line,result};
}
