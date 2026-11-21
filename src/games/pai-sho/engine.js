export const flowers = ['R3','R4','R5','W3','W4','W5'];
export const accents = ['rock','wheel','knot','boat'];
export const types = [...flowers,'lotus','orchid',...accents];
export const xy = point => [point % 19 - 9,Math.floor(point / 19) - 9];
export const pointAt = (x,y) => (y + 9) * 19 + x + 9;
export const validPoint = point => Number.isInteger(point) && point >= 0 && point < 361 &&
  xy(point).reduce((sum,value) => sum + value * value,0) < 81;
export const gates = [pointAt(0,-8),pointAt(8,0),pointAt(0,8),pointAt(-8,0)];
const basic = type => flowers.includes(type);
const flower = tile => tile && !accents.includes(tile.type);
const blooming = (tile,point) => flower(tile) && !gates.includes(point);
const offsets = [[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0]];
const neighbors = (point,diagonal = false) => {
  const [x,y] = xy(point);
  return (diagonal ? offsets : [[0,-1],[1,0],[0,1],[-1,0]])
    .map(([dx,dy]) => pointAt(x+dx,y+dy)).filter(validPoint);
};
export function garden(point) {
  const [x,y] = xy(point);
  if (!x || !y || Math.abs(x) + Math.abs(y) >= 7) return null;
  return x*y > 0 ? 'W' : 'R';
}
const allowed = (tile,point) => validPoint(point) && !gates.includes(point) &&
  (!basic(tile.type) || !garden(point) || tile.type[0] === garden(point));
const clash = (a,b) => basic(a.type) && basic(b.type) && a.type !== b.type && a.type[1] === b.type[1];
const visiblePairs = board => {
  const pairs = [];
  board.forEach((tile,from) => {
    if (!blooming(tile,from)) return;
    const [x,y] = xy(from);
    for (const [dx,dy] of [[1,0],[0,1]]) {
      for (let step = 1; step < 19; step++) {
        const to = pointAt(x+dx*step,y+dy*step);
        if (!validPoint(to) || gates.includes(to)) break;
        if (!board[to]) continue;
        if (blooming(board[to],to)) pairs.push([from,to]);
        break;
      }
    }
  });
  return pairs;
};
const hasClash = board => visiblePairs(board).some(([a,b]) => clash(board[a],board[b]));
export function harmonies(board,side) {
  const drained = point => neighbors(point,true).some(p => board[p]?.type === 'knot');
  return visiblePairs(board).filter(([a,b]) => {
    const first = board[a], second = board[b];
    if (drained(a) || drained(b)) return false;
    const [ax,ay] = xy(a), [bx,by] = xy(b);
    if (board.some((tile,p) => tile?.type === 'rock' && (ax === bx ? xy(p)[0] === ax : xy(p)[1] === ay))) return false;
    if (first.type === 'lotus') return basic(second.type) && second.side === side;
    if (second.type === 'lotus') return basic(first.type) && first.side === side;
    const distance = Math.abs(flowers.indexOf(first.type) - flowers.indexOf(second.type));
    return basic(first.type) && basic(second.type) && first.side === side && second.side === side && (distance === 1 || distance === 5);
  });
}
export function hasRing(edges) {
  const graph = new Map();
  for (const [a,b] of edges) {
    const [ax,ay] = xy(a), [bx,by] = xy(b);
    if (ax === 0 && bx === 0 && ay*by <= 0 || ay === 0 && by === 0 && ax*bx <= 0) continue;
    if (!graph.has(a)) graph.set(a,[]);
    if (!graph.has(b)) graph.set(b,[]);
    graph.get(a).push(b);
    graph.get(b).push(a);
  }
  const seen = new Map();
  const visit = (node,angle) => {
    if (seen.has(node)) return Math.abs(angle - seen.get(node)) > Math.PI;
    seen.set(node,angle);
    const [x,y] = xy(node);
    for (const next of graph.get(node)) {
      const [nx,ny] = xy(next);
      if (visit(next,angle + Math.atan2(x*ny-y*nx,x*nx+y*ny))) return true;
    }
    return false;
  };
  return [...graph.keys()].some(node => !seen.has(node) && visit(node,0));
}
export function create() {
  return {board:Array(361).fill(null),reserve:[1,2].map(() => Object.fromEntries(types.map(type => [type,basic(type) ? 3 : accents.includes(type) ? 0 : 1]))),
    turn:1,phase:'accents',selectedAccents:[0,0],ply:0,result:null,nextId:0};
}
function wild(board,side) {
  return board.some((tile,p) => tile?.side === side && tile.type === 'lotus' && blooming(tile,p));
}
function canCapture(board,tile,target) {
  if (!flower(target) || target.side === tile.side) return false;
  return clash(tile,target) || tile.type === 'orchid' && wild(board,tile.side) ||
    target.type === 'orchid' && wild(board,target.side);
}
function destinations(state,from) {
  const tile = state.board[from];
  if (neighbors(from,true).some(p => state.board[p]?.type === 'orchid' && state.board[p].side !== tile.side)) return [];
  const max = basic(tile.type) ? Number(tile.type[1]) : tile.type === 'lotus' ? 2 : 6;
  const distance = new Map([[from,0]]), queue = [from], result = [];
  for (const point of queue) {
    const depth = distance.get(point);
    if (depth === max) continue;
    for (const to of neighbors(point)) {
      if (distance.has(to)) continue;
      distance.set(to,depth+1);
      const target = state.board[to];
      if (allowed(tile,to) && (!target || canCapture(state.board,tile,target))) result.push(to);
      if (!target) queue.push(to);
    }
  }
  return result;
}
function apply(state,move) {
  const next = structuredClone(state);
  const {board,reserve,turn} = next, stock = reserve[turn-1];
  if (move.kind === 'accent-choice') {
    stock[move.type]++;
    next.selectedAccents[turn-1]++;
    if (next.selectedAccents[turn-1] === 4) {
      next.turn = 2;
      if (turn === 2) next.phase = 'opening';
    }
    return next;
  }
  if (move.kind === 'opening') {
    for (const [side,to] of [[1,gates[0]],[2,gates[2]]]) {
      board[to] = {side,type:move.type,id:next.nextId++};
      reserve[side-1][move.type]--;
    }
    next.phase = 'play';
    return next;
  }
  if (move.kind === 'move') {
    board[move.to] = board[move.from];
    board[move.from] = null;
  } else if (move.kind === 'plant' || move.kind === 'accent') {
    stock[move.type]--;
    const tile = {type:move.type,side:turn,id:next.nextId++};
    if (move.type === 'wheel') {
      const [cx,cy] = xy(move.to);
      const points = offsets.map(([x,y]) => pointAt(cx+x,cy+y));
      const old = points.map(p => validPoint(p) ? board[p] : null);
      for (const p of points) if (validPoint(p)) board[p] = null;
      for (let i=0;i<8;i++) if (old[i]) board[points[(i+1)%8]] = old[i];
    }
    if (move.type === 'boat') {
      if (flower(board[move.to])) {
        board[move.boatTo] = board[move.to];
        board[move.to] = tile;
      } else board[move.to] = null;
    } else board[move.to] = tile;
  }
  const rings = [1,2].filter(side => hasRing(harmonies(board,side)));
  if (rings.length) next.result = {winner:rings.length === 1 ? rings[0] : null,reason:'Кольцо гармоний'};
  if (!next.result && reserve.some(hand => flowers.every(type => hand[type] === 0))) {
    const crossing = side => harmonies(board,side).filter(([a,b]) => {
      const [ax,ay] = xy(a), [bx,by] = xy(b);
      return ax*bx < 0 || ay*by < 0;
    }).length;
    const a = crossing(1), b = crossing(2);
    next.result = {winner:a === b ? null : a>b ? 1 : 2,reason:'Гармонии через оси: '+a+' : '+b};
  }
  if (move.kind === 'move' && !next.result) {
    const before = new Set(harmonies(state.board,turn).map(([a,b]) => [state.board[a].id,state.board[b].id].sort((x,y)=>x-y).join(',')));
    const newHarmony = harmonies(board,turn).some(([a,b]) => !before.has([board[a].id,board[b].id].sort((x,y)=>x-y).join(',')));
    if (newHarmony) { next.phase = 'bonus'; return next; }
  }
  next.phase = 'play';
  next.turn = 3-turn;
  next.ply++;
  return next;
}
function wheelAllowed(state,to) {
  const [x,y] = xy(to);
  return offsets.every(([dx,dy],index) => {
    const from = pointAt(x+dx,y+dy);
    if (!validPoint(from) || !state.board[from]) return true;
    const [nx,ny] = offsets[(index+1)%8], target = pointAt(x+nx,y+ny);
    return state.board[from].type !== 'rock' && !gates.includes(from) && allowed(state.board[from],target);
  });
}
export function moves(state) {
  if (state.result) return [];
  const hand = state.reserve[state.turn-1];
  if (state.phase === 'accents') return accents.filter(type => hand[type]<2).map(type=>({kind:'accent-choice',type,from:type,to:180}));
  if (state.phase === 'opening') return flowers.map(type=>({kind:'opening',type,from:type,to:gates[2]}));
  const result = [], bonus = state.phase === 'bonus';
  const growing = state.board.some((tile,p) => tile?.side === state.turn && gates.includes(p));
  const plantTypes = bonus ? [...(!growing ? flowers : []),'lotus','orchid'] : flowers;
  for (const type of plantTypes) if (hand[type]) {
    for (const to of gates) if (!state.board[to]) result.push({kind:'plant',type,from:type,to});
  }
  if (bonus) {
    result.push({kind:'skip',from:'skip',to:180});
    for (let to=0;to<361;to++) {
      if (!validPoint(to) || gates.includes(to)) continue;
      for (const type of accents) {
        if (!hand[type]) continue;
        if (type === 'boat') {
          if (!state.board[to]) continue;
          if (!flower(state.board[to])) result.push({kind:'accent',type,from:type,to});
          else for (const boatTo of neighbors(to,true)) {
            if (!state.board[boatTo] && allowed(state.board[to],boatTo)) result.push({kind:'accent',type,from:type,to,boatTo});
          }
        } else if (!state.board[to] && (type !== 'wheel' || wheelAllowed(state,to))) result.push({kind:'accent',type,from:type,to});
      }
    }
  } else {
    state.board.forEach((tile,from) => {
      if (tile?.side === state.turn && flower(tile)) for (const to of destinations(state,from)) result.push({kind:'move',from,to});
    });
  }
  return result.filter(move => !hasClash(apply(state,move).board));
}
export function play(state,move) {
  if (!moves(state).some(candidate => JSON.stringify(candidate) === JSON.stringify(move))) return state;
  return apply(state,move);
}
