export const pieces = {
  k:['帥','Маршал',1],g:['大','Генерал',1],l:['中','Генерал-лейтенант',1],
  m:['小','Генерал-майор',2],s:['侍','Самурай',2],v:['槍','Копейщик',3],
  n:['馬','Конь',2],i:['忍','Разведчик',2],f:['砦','Крепость',2],
  p:['兵','Пехотинец',4],c:['砲','Пушка',1],a:['弓','Лучник',2],
  u:['筒','Мушкетёр',1],t:['謀','Капитан',1],
};
export const top = stack => stack.at(-1);
const directions = {
  k:[[0,1],[1,1],[-1,1],[1,0],[-1,0],[0,-1],[1,-1],[-1,-1]],
  g:[[1,1],[-1,1],[1,-1],[-1,-1]],
  l:[[0,1],[0,-1],[1,0],[-1,0]],
  m:[[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,1]],
  s:[[0,1],[0,-1],[1,1],[-1,1]],v:[[0,2],[0,-1],[1,1],[-1,1]],
  n:[[0,2],[0,-2],[1,0],[-1,0]],i:[[2,2],[-2,2],[2,-2],[-2,-2]],
  f:[[0,1],[1,0],[-1,0],[1,-1],[-1,-1]],p:[[0,1],[0,-1]],
  c:[[1,0],[-1,0],[0,-1],[0,3]],a:[[0,-1],[0,2],[2,2],[-2,2]],
  u:[[1,-1],[-1,-1],[0,2]],t:[[1,1],[-1,1],[0,-1]],
};
const inside = (x,y) => x>=0 && x<9 && y>=0 && y<9;
const signature = state => JSON.stringify([state.turn,state.board,state.reserve]);
export function create() {
  return {board:Array.from({length:81},()=>[]),reserve:[1,2].map(()=>Object.fromEntries(Object.entries(pieces).map(([type,data])=>[type,data[2]]))),
    phase:'setup',turn:1,done:[false,false],result:null,repetitions:[]};
}
export function targets(state,from) {
  const stack = state.board[from], piece = top(stack);
  if (!piece) return [];
  const height = stack.length, forward = piece.side === 1 ? -1 : 1;
  const rays = piece.type === 'g' ? [[1,0],[-1,0],[0,1],[0,-1]]
    : piece.type === 'l' ? [[1,1],[-1,1],[1,-1],[-1,-1]] : [];
  const result = new Set();
  const path = (dx,dy,min,max,jumping) => {
    const unitX = Math.sign(dx), unitY = Math.sign(dy)*forward;
    for (let step=1;step<=max;step++) {
      const x=from%9+unitX*step, y=Math.floor(from/9)+unitY*step;
      if (!inside(x,y)) break;
      const to=y*9+x, target=state.board[to];
      if (step>=min) result.add(to);
      if (target.length && (!jumping || target.length>height)) break;
    }
  };
  for (const [dx,dy] of rays) path(dx,dy,1,8,false);
  for (const [dx,dy] of directions[piece.type]) {
    const distance=Math.max(Math.abs(dx),Math.abs(dy));
    const jumping=['c','a','u'].includes(piece.type) && dy>0;
    const minimum = jumping || piece.type==='i' || piece.type==='n' && dy ? distance : 1;
    path(dx,dy,minimum,distance+height-1,jumping);
  }
  return [...result];
}
function captainOptions(state,tower,dropping) {
  const hand={...state.reserve[state.turn-1]};
  if(dropping) hand.t--;
  let options=[0];
  for(let mask=1;mask<(1<<tower.length);mask++) {
    const needed={};
    const valid=tower.every((piece,index)=>{
      if(!(mask & (1<<index))) return true;
      needed[piece.type]=(needed[piece.type] || 0)+1;
      return piece.side!==state.turn && needed[piece.type]<=hand[piece.type];
    });
    if(valid) options.push(mask);
  }
  return options;
}
function rawMoves(state) {
  const moves=[], side=state.turn;
  const own=state.board.flatMap((stack,p)=>top(stack)?.side===side ? [Math.floor(p/9)] : []);
  const front=own.length ? side===1 ? Math.min(...own) : Math.max(...own) : side===1 ? 6 : 2;
  state.board.forEach((stack,to)=>{
    const piece=top(stack), row=Math.floor(to/9);
    const territory=state.phase==='setup' ? side===1 ? row>=6 : row<=2 : side===1 ? row>=front : row<=front;
    if (territory && stack.length<3 && (!piece || piece.side===side && piece.type!=='k')) {
      for (const [type,count] of Object.entries(state.reserve[side-1])) if (count) {
        if (type==='k' && state.phase!=='setup') continue;
        const base={kind:'drop',type,from:type,to};
        moves.push(base);
        if(type==='t') {
          for(const convert of captainOptions(state,stack,true)) if(convert) moves.push({...base,convert});
        }
      }
    }
  });
  if (state.phase==='setup') {
    if (state.reserve[side-1].k===0) moves.push({kind:'ready',from:'ready',to:40});
    return moves;
  }
  state.board.forEach((stack,from)=>{
    const piece=top(stack);
    if (piece?.side!==side) return;
    for (const to of targets(state,from)) {
      const target=state.board[to], enemy=top(target);
      if (!enemy) moves.push({kind:'move',from,to});
      else if (target.length<=stack.length) {
        if (enemy.side!==side) moves.push({kind:'capture',from,to});
        if (enemy.type!=='k' && target.length<3) {
          const move={kind:'stack',from,to};
          moves.push(move);
          if(piece.type==='t') {
            for(const convert of captainOptions(state,target,false)) if(convert) moves.push({...move,convert});
          }
        }
      }
    }
  });
  return moves;
}
function apply(state,move) {
  const next=structuredClone(state), side=state.turn;
  if (move.kind==='ready') next.done[side-1]=true;
  else {
    const piece=move.kind==='drop' ? {side,type:move.type} : next.board[move.from].pop();
    if (move.kind==='drop') next.reserve[side-1][move.type]--;
    if (move.kind==='capture') {
      if (next.board[move.to].some(p=>p.type==='k')) next.result={winner:side,reason:'Маршал взят'};
      // Remove enemy layers while retaining friendly layers in a mixed tower.
      next.board[move.to]=next.board[move.to].filter(p=>p.side===side);
    }
    next.board[move.to].push(piece);
    if (move.convert) {
      const tower=next.board[move.to];
      for (let i=tower.length-2;i>=0;i--) {
        const enemy=tower[i];
        if (!(move.convert & (1<<i))) continue;
        tower[i]={type:enemy.type,side};
        next.reserve[side-1][enemy.type]--;
      }
    }
  }
  if (state.phase==='setup') {
    if (next.done.every(Boolean)) { next.phase='play';next.turn=1; }
    else next.turn=next.done[2-side] ? side : 3-side;
  } else next.turn=3-side;
  return next;
}
export function threatened(state,side) {
  const king=state.board.findIndex(stack=>top(stack)?.type==='k' && top(stack).side===side);
  if (king<0) return true;
  return state.board.some((stack,from)=>top(stack)?.side===3-side && stack.length>=state.board[king].length && targets(state,from).includes(king));
}
export function moves(state) {
  if (state.result) return [];
  const raw=rawMoves(state);
  if (state.phase==='setup') return raw;
  return raw.filter(move=>!threatened(apply(state,move),state.turn));
}
export function play(state,move) {
  if (!moves(state).some(candidate=>JSON.stringify(candidate)===JSON.stringify(move))) return state;
  const next=apply(state,move);
  if (next.phase==='play' && !next.result) {
    const key=signature(next);
    next.repetitions.push(key);
    if (next.repetitions.filter(position=>position===key).length>=4) next.result={reason:'Четырёхкратное повторение'};
    else if (!moves(next).length && threatened(next,next.turn)) next.result={winner:state.turn,reason:'Мат маршалу'};
  }
  return next;
}
