export const createGame = (size=9) => ({size,board:Array(size*size).fill(0),turn:1,history:[],passes:0,ended:false,captures:[0,0,0],last:null});
export function neighbors(i,n){return [i%n>0?i-1:-1,i%n<n-1?i+1:-1,i>=n?i-n:-1,i<n*(n-1)?i+n:-1].filter(x=>x>=0)}
export function group(board,i,n){const stones=new Set([i]),liberties=new Set(),queue=[i];for(const p of queue)for(const q of neighbors(p,n)){if(!board[q])liberties.add(q);else if(board[q]===board[i]&&!stones.has(q)){stones.add(q);queue.push(q)}}return {stones,liberties}}
const snapshot = ({history,...position}) => position;
export function undo(state){return state.history.length?{...state.history.at(-1),history:state.history.slice(0,-1)}:state}
export function play(state,i){
 if(state.ended)return {error:'Партия завершена. Начните новую игру.'};
 if(!Number.isInteger(i)||i<0||i>=state.board.length||state.board[i])return {error:'Выберите свободное пересечение.'};
 const board=[...state.board];board[i]=state.turn;let captured=0;
 for(const q of neighbors(i,state.size)){if(board[q]&&board[q]!==state.turn){const g=group(board,q,state.size);if(!g.liberties.size)for(const p of g.stones){board[p]=0;captured++}}}
 if(!group(board,i,state.size).liberties.size)return {error:'Самоубийство запрещено: у группы должны быть дыхания.'};
 const key=board.join('');if(state.history.some(s=>s.board.join('')===key))return {error:'Ко: нельзя повторять предыдущую позицию. Сыграйте в другом месте.'};
 const captures=[...state.captures];captures[state.turn]+=captured;
 return {...state,board,turn:3-state.turn,history:[...state.history,snapshot(state)],passes:0,captures,last:i};
}
export function pass(state){if(state.ended)return state;return {...state,turn:3-state.turn,history:[...state.history,snapshot(state)],passes:state.passes+1,ended:state.passes+1>=2,last:null}}
export function tally(state) {
  const board = [...state.board];
  const prisoners = [...state.captures];
  for (const point of state.dead || []) {
    if (!board[point]) continue;
    prisoners[3 - board[point]]++;
    board[point] = 0;
  }
  const stones = [0,0,0];
  const territory = [0,0,0];
  const owners = Array(board.length).fill(0);
  const seen = new Set();
  board.forEach((stone,point) => {
    if (stone) { stones[stone]++; return; }
    if (seen.has(point)) return;
    const region = [point];
    const border = new Set();
    seen.add(point);
    for (const cell of region) {
      for (const neighbor of neighbors(cell,state.size)) {
        if (board[neighbor]) border.add(board[neighbor]);
        else if (!seen.has(neighbor)) {
          seen.add(neighbor);
          region.push(neighbor);
        }
      }
    }
    const owner = border.size === 1 ? [...border][0] : 0;
    territory[owner] += region.length;
    for (const cell of region) owners[cell] = owner;
  });
  return {stones,territory,owners,prisoners,points:[0,stones[1] + territory[1],stones[2] + territory[2] + 7.5]};
}

export const score = state => tally(state).points;

// Only remove a group from a small pocket bordered by an opponent with two eyes elsewhere.
export function automaticPrisoners({board,size}) {
  const visited = new Set();
  const dead = [];
  board.forEach((stone,point) => {
    if (!stone || visited.has(point)) return;
    const {stones,liberties} = group(board,point,size);
    for (const cell of stones) visited.add(cell);
    if (stones.size + liberties.size > 3) return;
    const pocket = new Set([...stones,...liberties]);
    const border = new Set();
    for (const cell of pocket) {
      for (const next of neighbors(cell,size)) {
        if (!pocket.has(next)) border.add(next);
      }
    }
    if (!border.size || [...border].some(cell => board[cell] !== 3 - stone)) return;
    const surround = group(board,[...border][0],size).stones;
    if ([...border].some(cell => !surround.has(cell))) return;
    const eyes = board.reduce((total,value,cell) => total + Number(
      !value && !pocket.has(cell) && neighbors(cell,size).every(next => surround.has(next))),0);
    const ownEyes = [...liberties].filter(cell => neighbors(cell,size).every(next => stones.has(next)));
    if (eyes >= 2 && ownEyes.length < 2) dead.push(...stones);
  });
  return dead;
}

export function scoringAction(state,side,{action,point},required = 2) {
  if (!state.ended || state.confirmed) return null;
  if (action === 'resume') return {...state,ended:false,passes:0,dead:[],accepted:[],mode:null,votes:[]};
  if (!state.mode) {
    if (action !== 'automatic' && action !== 'manual') return null;
    const votes = [...(state.votes || [])];
    if (votes[side - 1] === action) return null;
    votes[side - 1] = action;
    const agreed = votes[0] === action && (required === 1 || votes[1] === action);
    if (!agreed) return {...state,votes};
    if (action === 'manual') return {...state,votes,mode:action};
    return {...state,votes,mode:action,dead:automaticPrisoners(state),confirmed:true};
  }
  if (action === 'mark' && Number.isInteger(point) && state.board[point]) {
    const dead = new Set(state.dead);
    const restore = dead.has(point);
    for (const cell of group(state.board,point,state.size).stones) {
      if (restore) dead.delete(cell);
      else dead.add(cell);
    }
    return {...state,dead:[...dead],accepted:[]};
  }
  if (action !== 'confirm' || state.accepted?.includes(side)) return null;
  const accepted = [...(state.accepted || []),side];
  return {...state,accepted,confirmed:accepted.length >= required};
}

export function lastCapture(state) {
  let after = state;
  for (let index = state.history.length - 1; index >= 0; index--) {
    const before = state.history[index];
    if (before.captures[1] !== after.captures[1] || before.captures[2] !== after.captures[2]) {
      return before.board.flatMap((stone,point) =>
        stone && !after.board[point] && !state.board[point] ? [{stone,point}] : []);
    }
    after = before;
  }
  return [];
}
