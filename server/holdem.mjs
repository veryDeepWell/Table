import {deck} from './card-games.mjs';

const next = (side,offset = 1) => (side+offset-1)%4+1;
const seats = [1,2,3,4];
const compare = (a,b) => {
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) return a[index]-b[index];
  return 0;
};
function five(cards) {
  const ranks = cards.map(card => card%13+2).sort((a,b) => b-a);
  const unique = [...new Set(ranks)];
  const groups = unique.map(rank => [ranks.filter(value => value === rank).length,rank]).sort((a,b) => b[0]-a[0] || b[1]-a[1]);
  const flush = cards.every(card => Math.floor(card/13) === Math.floor(cards[0]/13));
  const straight = unique.length === 5 ? ranks[0]-ranks[4] === 4 ? ranks[0] : ranks.join() === '14,5,4,3,2' ? 5 : 0 : 0;
  if (flush && straight) return [8,straight];
  if (groups[0][0] === 4) return [7,groups[0][1],groups[1][1]];
  if (groups[0][0] === 3 && groups[1][0] === 2) return [6,groups[0][1],groups[1][1]];
  if (flush) return [5,...ranks];
  if (straight) return [4,straight];
  const category = groups[0][0] === 3 ? 3 : groups[0][0] === 1 ? 0 : groups[1][0] === 2 ? 2 : 1;
  return [category,...groups.map(group => group[1])];
}
export function handRank(cards) {
  let best = [-1];
  for (let a = 0; a < 6; a++) for (let b = a+1; b < 7; b++) {
    const score = five(cards.filter((_,index) => index !== a && index !== b));
    if (compare(score,best) > 0) best = score;
  }
  return best;
}
function put(state,side,amount) {
  const index = side-1;
  const paid = Math.min(amount,state.stacks[index]);
  state.stacks[index] -= paid;
  state.street[index] += paid;
  state.total[index] += paid;
}
const alive = state => seats.filter(side => state.hands[side-1].length && !state.folded.includes(side));
const able = state => alive(state).filter(side => state.stacks[side-1] > 0);
function choose(from,options) {
  for (let step = 1; step <= 4; step++) if (options.includes(next(from,step))) return next(from,step);
}
function finish(state) {
  const players = alive(state);
  const ranks = players.length > 1 ? new Map(players.map(side => [side,handRank([...state.hands[side-1],...state.community])])) : null;
  const awards = [0,0,0,0];
  let previous = 0;
  for (const level of [...new Set(state.total)].sort((a,b) => a-b)) {
    const contributors = seats.filter(side => state.total[side-1] >= level);
    const amount = (level-previous)*contributors.length;
    previous = level;
    if (!amount) continue;
    const eligible = contributors.filter(side => players.includes(side));
    const winners = contributors.length === 1 || !eligible.length ? contributors : !ranks ? eligible
      : eligible.filter(side => !eligible.some(other => compare(ranks.get(other),ranks.get(side)) > 0));
    const clockwise = [...winners].sort((a,b) => (a-state.dealer+3)%4-(b-state.dealer+3)%4);
    clockwise.forEach((side,index) => { awards[side-1] += Math.floor(amount/clockwise.length) + Number(index < amount%clockwise.length); });
  }
  state.stacks = state.stacks.map((chips,index) => chips+awards[index]);
  state.awards = awards;
  state.showdown = ranks ? players.map(side => ({side,cards:state.hands[side-1]})) : [];
  state.phase = 'round';
  state.turn = 1;
  if (state.stacks.filter(Boolean).length === 1) state.result = {winner:state.stacks.findIndex(Boolean)+1};
  return state;
}
function advance(state,from) {
  if (alive(state).length === 1) return finish(state);
  while (true) {
    const canBet = able(state);
    const pending = canBet.filter(side => state.street[side-1] < state.bet || canBet.length > 1 && !state.acted.includes(side));
    const turn = choose(from,pending);
    if (turn) return {...state,turn};
    if (state.community.length === 5) return finish(state);
    state.community.push(...state.pile.splice(0,state.community.length ? 1 : 3));
    state.street = [0,0,0,0];
    state.acted = [];
    state.bet = 0;
    state.raise = 10;
    state.phase = ['flop','turn','river'][state.community.length-3];
    from = state.dealer;
  }
}
function deal(stacks = [500,500,500,500],dealer = 1,round = 1) {
  const pile = deck();
  const state = {stacks:[...stacks],dealer,round,pile,hands:stacks.map(chips => chips ? pile.splice(0,2) : []),
    community:[],street:[0,0,0,0],total:[0,0,0,0],folded:[],acted:[],bet:10,raise:10,phase:'preflop'};
  const players = alive(state);
  const small = players.length === 2 ? dealer : choose(dealer,players);
  const big = choose(small,players);
  put(state,small,5);
  put(state,big,10);
  return advance(state,big);
}
function actions(state,side) {
  if (state.phase === 'round') return [{kind:'next'}];
  const index = side-1;
  const call = state.bet-state.street[index];
  const chips = state.stacks[index];
  const moves = [{kind:call ? 'call' : 'check'}, {kind:'fold'}];
  const mayRaise = able(state).length > 1 && !state.acted.includes(side);
  if (mayRaise && chips >= call+state.raise) moves.push({kind:'raise',value:state.bet+state.raise});
  if (chips <= call || mayRaise) moves.push({kind:'all-in'});
  return moves;
}
export const holdem = {
  seats:4,hidden:true,create:() => deal(),ended:state => Boolean(state.result),
  view(state,side) {
    const {hands,pile,...publicState} = state;
    return {...publicState,hand:hands[side-1],counts:hands.map(hand => hand.length),
      actions:!state.result && state.turn === side ? actions(state,side) : []};
  },
  move(current,side,body) {
    if (current.turn !== side || !actions(current,side).some(move =>
      move.kind === body.kind && move.value === body.value)) return null;
    if (body.kind === 'next') return deal(current.stacks,choose(current.dealer,seats.filter(seat => current.stacks[seat-1])),current.round+1);
    const state = structuredClone(current);
    const index = side-1;
    if (body.kind === 'fold') state.folded.push(side);
    if (body.kind === 'call') put(state,side,state.bet-state.street[index]);
    if (body.kind === 'raise') put(state,side,body.value-state.street[index]);
    if (body.kind === 'all-in') put(state,side,state.stacks[index]);
    if (state.street[index] > state.bet) {
      const increase = state.street[index]-state.bet;
      if (increase >= state.raise) {
        state.raise = increase;
        state.acted = [];
      }
      state.bet = state.street[index];
    }
    state.acted.push(side);
    return advance(state,side);
  },
};
