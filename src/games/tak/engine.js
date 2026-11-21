export const top = stack => stack.at(-1);
export function create() {
  return {board:Array.from({length:25},()=>[]),reserve:[{flat:21,cap:1},{flat:21,cap:1}],turn:1,ply:0,result:null};
}
export function road(board,side) {
  const usable = p => top(board[p])?.side===side && top(board[p]).type!=='wall';
  for (const vertical of [true,false]) {
    const queue=Array.from({length:5},(_,i)=>vertical ? i : i*5).filter(usable), seen=new Set(queue);
    for (const p of queue) {
      if (vertical ? Math.floor(p/5)===4 : p%5===4) return true;
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const x=p%5+dx,y=Math.floor(p/5)+dy,to=y*5+x;
        if (x<0 || x>=5 || y<0 || y>=5 || seen.has(to) || !usable(to)) continue;
        seen.add(to);queue.push(to);
      }
    }
  }
  return false;
}
export function moves(state) {
  if (state.result) return [];
  const result=[], side=state.turn, opening=state.ply<2;
  for (let to=0;to<25;to++) if (!state.board[to].length) {
    const hand=state.reserve[(opening ? 3-side : side)-1];
    if (hand.flat) {
      result.push({kind:'place',type:'flat',from:'flat',to});
      if (!opening) result.push({kind:'place',type:'wall',from:'wall',to});
    }
    if (!opening && hand.cap) result.push({kind:'place',type:'cap',from:'cap',to});
  }
  if (opening) return result;
  state.board.forEach((stack,from)=>{
    if (top(stack)?.side!==side) return;
    for (const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const spread=(point,left,drops,carry)=>{
        const x=point%5+dx,y=Math.floor(point/5)+dy;
        if (x<0 || x>=5 || y<0 || y>=5) return;
        const to=y*5+x, target=top(state.board[to]);
        if (target?.type==='cap') return;
        if (target?.type==='wall') {
          if (left===1 && top(stack).type==='cap') result.push({kind:'spread',from,to,dx,dy,carry,drops:[...drops,1]});
          return;
        }
        for (let count=1;count<=left;count++) {
          const next=[...drops,count];
          if (count===left) result.push({kind:'spread',from,to,dx,dy,carry,drops:next});
          else spread(to,left-count,next,carry);
        }
      };
      for(let carry=1;carry<=Math.min(5,stack.length);carry++) spread(from,carry,[],carry);
    }
  });
  return result;
}
export function play(state,move) {
  if (!moves(state).some(candidate=>JSON.stringify(candidate)===JSON.stringify(move))) return state;
  const next=structuredClone(state);
  if (move.kind==='place') {
    const side=state.ply<2 ? 3-state.turn : state.turn;
    next.board[move.to].push({side,type:move.type});
    next.reserve[side-1][move.type==='cap' ? 'cap' : 'flat']--;
  } else {
    const carry=next.board[move.from].splice(-move.carry);
    let point=move.from;
    for (const count of move.drops) {
      point+=move.dy*5+move.dx;
      const target=top(next.board[point]);
      if (target?.type==='wall') target.type='flat';
      next.board[point].push(...carry.splice(0,count));
    }
  }
  next.ply++;next.turn=3-state.turn;
  if (road(next.board,state.turn)) next.result={winner:state.turn,reason:'Дорога'};
  else if (road(next.board,next.turn)) next.result={winner:next.turn,reason:'Дорога'};
  else if (next.board.every(stack=>stack.length) || next.reserve.some(hand=>!hand.flat && !hand.cap)) {
    const count=side=>next.board.filter(stack=>top(stack)?.side===side && top(stack).type==='flat').length;
    const a=count(1),b=count(2);
    next.result={winner:a===b ? null : a>b ? 1 : 2,reason:'Плоские камни: '+a+' : '+b};
  }
  return next;
}
