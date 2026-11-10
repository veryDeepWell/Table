export const diagonals = [[-1,-1],[-1,1],[1,-1],[1,1]];
export const orthogonals = [[-1,0],[1,0],[0,-1],[0,1]];
export const adjacent = [...diagonals, ...orthogonals];
export const knight = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
export const other = side => 3 - side;
export const forward = side => side === 1 ? -1 : 1;
export const piece = (type, side) => ({type, side});
export const label = (index, size) => 'abcdefghi'[index % size] + (size - Math.floor(index / size));

export function offset(index, row, col, size) {
  const r = Math.floor(index / size) + row;
  const c = index % size + col;
  return r >= 0 && r < size && c >= 0 && c < size ? r * size + c : -1;
}

export function targets(board, from, size, directions, sliding = false) {
  const result = [];
  for (const [row, col] of directions) {
    let to = offset(from, row, col, size);
    while (to >= 0) {
      result.push(to);
      if (!sliding || board[to]) break;
      to = offset(to, row, col, size);
    }
  }
  return result;
}

export function checked(board, side, attacks) {
  const king = board.findIndex(p => p?.side === side && p.type === 'k');
  return board.some((p, from) => p?.side === other(side) && attacks(board, from).includes(king));
}

export const boardKey = board => board.map(p => p ? p.side + p.type : '-').join(',');
