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
export function score(state){const points=[0,0,7.5],seen=new Set();state.board.forEach((v,i)=>{if(v){points[v]++;return}if(seen.has(i))return;const region=[i],border=new Set();seen.add(i);for(const p of region)for(const q of neighbors(p,state.size)){if(state.board[q])border.add(state.board[q]);else if(!seen.has(q)){seen.add(q);region.push(q)}}if(border.size===1)points[[...border][0]]+=region.length});return points}
