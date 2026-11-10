function positionData(position) {
  const {history,board,...data} = position;
  return {...data,board:board.join('')};
}

export function encodeGo(state) {
  return {...positionData(state),history:state.history.map(positionData)};
}

function decodePosition(position, size) {
  if (!position || position.size !== size || ![1,2].includes(position.turn)) return null;
  const raw = position.board;
  const board = typeof raw === 'string' && /^[012]+$/.test(raw) ? Array.from(raw,Number) : raw;
  if (!Array.isArray(board) || board.length !== size ** 2 || !board.every(v => [0,1,2].includes(v)) ||
    !Array.isArray(position.captures) || position.captures.length !== 3 ||
    !position.captures.every(v => Number.isSafeInteger(v) && v >= 0) ||
    ![0,1,2].includes(position.passes) || typeof position.ended !== 'boolean' ||
    !(position.last === null || Number.isInteger(position.last) && position.last >= 0 && position.last < board.length)) return null;
  const {history,...data} = position;
  return {...data,board};
}

export function decodeGo(saved) {
  if (![9,13,19].includes(saved?.size) || !Array.isArray(saved.history)) return null;
  const position = decodePosition(saved,saved.size);
  const history = saved.history.map(entry => decodePosition(entry,saved.size));
  return position && history.every(Boolean) ? {...position,history} : null;
}
