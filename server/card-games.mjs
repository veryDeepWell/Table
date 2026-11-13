import {randomInt} from 'node:crypto';

export function deck(ranks = 13) {
  const cards = Array.from({length:ranks*4},(_,card) => card);
  for (let index = cards.length - 1; index > 0; index--) {
    const next = randomInt(index + 1);
    [cards[index],cards[next]] = [cards[next],cards[index]];
  }
  return cards;
}

const rank = card => card % 13;
const suit = card => Math.floor(card / 13);
const after = (side,seats) => side % seats + 1;

function game(seats,create,legal,apply) {
  return {
    seats,hidden:true,create:() => create(),ended:state => Boolean(state.result),
    view(state,side) {
      const {hands,pile,discard,passed,kitty,...publicState} = state;
      return {...publicState,hand:hands[side-1],counts:hands.map(hand => hand.length),
        stock:pile?.length,actions:!state.result && state.turn === side ? legal(state) : []};
    },
    move(state,side,body) {
      if (state.turn !== side) return null;
      const action = legal(state).find(move => Object.entries(move).every(([key,value]) => body[key] === value));
      return action ? apply(structuredClone(state),action) : null;
    },
  };
}

export const eights = game(4,() => {
  const pile = deck();
  const hands = Array.from({length:4},() => pile.splice(0,5));
  const index = pile.findIndex(card => rank(card) !== 6);
  const top = pile.splice(index,1)[0];
  return {pile,hands,top,discard:[],suit:suit(top),turn:1,passes:0};
},state => {
  const playable = state.hands[state.turn-1].flatMap(card => rank(card) === 6
    ? [0,1,2,3].map(suit => ({kind:'card',card,suit}))
    : suit(card) === state.suit || rank(card) === rank(state.top) ? [{kind:'card',card}] : []);
  return playable.length ? playable : [{kind:state.pile.length || state.discard.length ? 'draw' : 'pass'}];
},(state,move) => {
  const hand = state.hands[state.turn-1];
  if (move.kind === 'card') {
    hand.splice(hand.indexOf(move.card),1);
    state.discard.push(state.top);
    state.top = move.card;
    state.suit = move.suit ?? suit(move.card);
    state.passes = 0;
    if (!hand.length) state.result = {winner:state.turn};
  } else if (move.kind === 'draw') {
    if (!state.pile.length) {
      state.pile = deck().filter(card => state.discard.includes(card));
      state.discard = [];
    }
    hand.push(state.pile.pop());
    state.passes = 0;
    return state;
  } else if (++state.passes === 4) {
    const fewest = Math.min(...state.hands.map(cards => cards.length));
    const winners = state.hands.flatMap((cards,index) => cards.length === fewest ? [index+1] : []);
    state.result = winners.length === 1 ? {winner:winners[0]} : {};
  }
  state.turn = after(state.turn,4);
  return state;
});

function heartsDeal(scores = [0,0,0,0],round = 1) {
  const pile = deck();
  return {hands:Array.from({length:4},() => pile.splice(0,13)),scores,round,turn:1,phase:round%4 ? 'pass' : 'trick',
    passed:[],trick:[],taken:[0,0,0,0],broken:false,tricks:0};
}
function heartsStart(state) {
  state.phase = 'trick';
  state.turn = state.hands.findIndex(hand => hand.includes(0))+1;
  return state;
}
const penalty = card => suit(card) === 2 ? 1 : card === 49 ? 13 : 0;
export const hearts = game(4,heartsDeal,state => {
  if (state.phase === 'round') return [{kind:'next'}];
  const hand = state.hands[state.turn-1];
  if (state.phase === 'pass') return hand.map(card => ({kind:'pass-card',card}));
  if (!state.tricks && !state.trick.length) return [{kind:'card',card:0}];
  const lead = state.trick[0]?.card;
  const matching = lead === undefined ? [] : hand.filter(card => suit(card) === suit(lead));
  let allowed = matching.length ? matching : hand;
  if (!matching.length && !state.tricks && allowed.some(card => !penalty(card))) allowed = allowed.filter(card => !penalty(card));
  if (lead === undefined && !state.broken && allowed.some(card => suit(card) !== 2)) allowed = allowed.filter(card => suit(card) !== 2);
  return allowed.map(card => ({kind:'card',card}));
},(state,move) => {
  if (move.kind === 'next') {
    const next = heartsDeal(state.scores,state.round+1);
    return next.phase === 'trick' ? heartsStart(next) : next;
  }
  const index = state.turn-1;
  const hand = state.hands[index];
  hand.splice(hand.indexOf(move.card),1);
  if (move.kind === 'pass-card') {
    state.passed[index] ||= [];
    state.passed[index].push(move.card);
    if (state.passed[index].length < 3) return state;
    state.turn = after(state.turn,4);
    if (state.turn !== 1) return state;
    const direction = [0,1,3,2][state.round%4];
    state.passed.forEach((cards,seat) => state.hands[(seat+direction)%4].push(...cards));
    state.passed = [];
    return heartsStart(state);
  }
  state.trick.push({side:state.turn,card:move.card});
  state.broken ||= suit(move.card) === 2;
  state.turn = after(state.turn,4);
  if (state.trick.length < 4) return state;
  const winner = state.trick.filter(entry => suit(entry.card) === suit(state.trick[0].card))
    .reduce((best,entry) => rank(entry.card) > rank(best.card) ? entry : best).side;
  state.taken[winner-1] += state.trick.reduce((sum,entry) => sum+penalty(entry.card),0);
  state.lastTrick = state.trick;
  state.trick = [];
  state.turn = winner;
  if (++state.tricks < 13) return state;
  const moon = state.taken.indexOf(26);
  state.scores = state.scores.map((score,index) => score + (moon < 0 ? state.taken[index] : moon === index ? 0 : 26));
  state.phase = 'round';
  if (Math.max(...state.scores) >= 100) {
    const low = Math.min(...state.scores);
    const winners = state.scores.flatMap((score,index) => score === low ? [index+1] : []);
    state.result = winners.length === 1 ? {winner:winners[0]} : {};
  }
  return state;
});

export const durak = game(2,() => {
  const pile = deck().filter(card => rank(card) >= 4);
  const hands = [pile.splice(0,6),pile.splice(0,6)];
  const trump = pile[0];
  const lowest = hand => Math.min(13,...hand.filter(card => suit(card) === suit(trump)).map(rank));
  const attacker = lowest(hands[0]) <= lowest(hands[1]) ? 1 : 2;
  return {pile,hands,trump,attacker,turn:attacker,phase:'attack',table:[],limit:6};
},state => {
  const hand = state.hands[state.turn-1];
  if (state.phase === 'defend') {
    const attack = state.table.at(-1).attack;
    return [{kind:'take'},...hand.filter(card => suit(card) === suit(attack)
      ? rank(card) > rank(attack) : suit(card) === suit(state.trump)).map(card => ({kind:'card',card}))];
  }
  const ranks = new Set(state.table.flatMap(pair => [rank(pair.attack),rank(pair.defense)]));
  const attacks = state.table.length < state.limit ? hand.filter(card => !state.table.length || ranks.has(rank(card))) : [];
  return [...attacks.map(card => ({kind:'card',card})),...(state.table.length ? [{kind:'done'}] : [])];
},(state,move) => {
  if (move.kind === 'card') {
    const hand = state.hands[state.turn-1];
    hand.splice(hand.indexOf(move.card),1);
    if (state.phase === 'attack') {
      state.table.push({attack:move.card});
      state.turn = 3-state.attacker;
      state.phase = 'defend';
    } else {
      state.table.at(-1).defense = move.card;
      state.turn = state.attacker;
      state.phase = 'attack';
    }
    return state;
  }
  const defender = 3-state.attacker;
  if (move.kind === 'take') state.hands[defender-1].push(...state.table.flatMap(pair =>
    pair.defense === undefined ? [pair.attack] : [pair.attack,pair.defense]));
  for (const side of [state.attacker,defender]) {
    while (state.pile.length && state.hands[side-1].length < 6) state.hands[side-1].push(state.pile.pop());
  }
  if (!state.pile.length && state.hands.some(hand => !hand.length)) {
    const loser = state.hands.findIndex(hand => hand.length)+1;
    state.result = loser ? {loser} : {};
  }
  if (move.kind === 'done') state.attacker = defender;
  state.turn = state.attacker;
  state.phase = 'attack';
  state.table = [];
  state.limit = Math.min(6,state.hands[2-state.attacker].length);
  return state;
});

const trickPoints = [0,0,0,0,0,0,0,0,10,2,3,4,11];
const trickRank = card => rank(card) === 8 ? 12 : rank(card) === 12 ? 13 : rank(card);
function thousandDeal(scores = [0,0,0],round = 1) {
  const pile = deck().filter(card => rank(card) >= 7);
  const hands = Array.from({length:3},() => pile.splice(0,7));
  const opener = (round-1)%3+1;
  return {hands,kitty:pile,scores,round,turn:after(opener,3),bid:100,bidder:opener,out:[],
    phase:'auction',trick:[],taken:[0,0,0],wins:[0,0,0]};
}

export const thousand = game(3,thousandDeal,state => {
  const hand = state.hands[state.turn-1];
  if (state.phase === 'round') return [{kind:'next'}];
  if (state.phase === 'auction') return [{kind:'pass'},...(state.bid < 120 ? [{kind:'bid',value:state.bid+5}] : [])];
  if (state.phase === 'give') return hand.map(card => ({kind:'give',card}));
  const lead = state.trick[0]?.card;
  if (lead !== undefined) {
    const following = hand.filter(card => suit(card) === suit(lead));
    const trumps = hand.filter(card => suit(card) === state.trump);
    return (following.length ? following : trumps.length ? trumps : hand).map(card => ({kind:'card',card}));
  }
  return hand.flatMap(card => [{kind:'card',card},...((rank(card) === 10 || rank(card) === 11) &&
    state.wins[state.turn-1] && hand.includes(suit(card)*13 + (rank(card) === 10 ? 11 : 10)) ? [{kind:'marriage',card}] : [])]);
},(state,move) => {
  if (move.kind === 'next') return thousandDeal(state.scores,state.round+1);
  if (state.phase === 'auction') {
    if (move.kind === 'pass') state.out.push(state.turn);
    else { state.bid = move.value; state.bidder = state.turn; }
    const challengers = [1,2,3].filter(side => side !== state.bidder && !state.out.includes(side));
    if (!challengers.length) {
      state.turn = state.bidder;
      state.hands[state.turn-1].push(...state.kitty);
      state.kitty = [];
      state.phase = 'give';
      state.gifts = 0;
    } else state.turn = challengers.sort((a,b) => (a-state.turn+2)%3-(b-state.turn+2)%3)[0];
    return state;
  }
  const hand = state.hands[state.turn-1];
  hand.splice(hand.indexOf(move.card),1);
  if (move.kind === 'give') {
    const recipient = (state.bidder+state.gifts)%3;
    state.hands[recipient].push(move.card);
    if (++state.gifts === 2) state.phase = 'trick';
    return state;
  }
  if (move.kind === 'marriage') {
    state.trump = suit(move.card);
    state.taken[state.turn-1] += [60,80,100,40][state.trump];
  }
  state.trick.push({side:state.turn,card:move.card});
  state.turn = after(state.turn,3);
  if (state.trick.length < 3) return state;
  const lead = suit(state.trick[0].card);
  const strength = card => (suit(card) === state.trump ? 30 : suit(card) === lead ? 15 : 0) + trickRank(card);
  const winner = state.trick.reduce((best,entry) => strength(entry.card) > strength(best.card) ? entry : best).side;
  state.taken[winner-1] += state.trick.reduce((sum,entry) => sum+trickPoints[rank(entry.card)],0);
  state.wins[winner-1]++;
  state.lastTrick = state.trick;
  state.trick = [];
  state.turn = winner;
  if (state.hands.some(cards => cards.length)) return state;
  state.scores = state.scores.map((score,index) => score + (index+1 === state.bidder
    ? state.taken[index] >= state.bid ? state.bid : -state.bid : Math.round(state.taken[index]/5)*5));
  state.phase = 'round';
  const highest = Math.max(...state.scores);
  if (highest >= 1000 && state.scores.filter(score => score === highest).length === 1) {
    state.result = {winner:state.scores.indexOf(highest)+1};
  }
  return state;
});
function withoutPairs(hand) {
  const remaining = [];
  for (const card of hand) {
    const pair = remaining.findIndex(other => rank(other) === rank(card));
    if (pair < 0) remaining.push(card);
    else remaining.splice(pair,1);
  }
  return remaining;
}

function nextSeat(hands,side) {
  for (let step = 1; step < hands.length; step++) {
    const seat = (side - 1 + step) % hands.length;
    if (hands[seat].length) return seat + 1;
  }
  return null;
}

export function oldMaid(seats = 4) {
  return {
    seats, hidden:true,
    create() {
      const hands = Array.from({length:seats},() => []);
      deck().filter(card => card !== 10).forEach((card,index) => hands[index % seats].push(card));
      const unpaired = hands.map(withoutPairs);
      const active = unpaired.filter(hand => hand.length).length;
      const turn = unpaired.findIndex(hand => hand.length) + 1;
      const order = unpaired.map((hand,seat) => hand.map((_,index) => seat * 52 + index));
      return {hands:unpaired,order,turn,result:active === 1 ? {loser:turn} : undefined};
    },
    ended:state => Boolean(state.result),
    view(state,side) {
      const {hands,...visible} = state;
      return {...visible,hand:hands[side-1],counts:hands.map(hand => hand.length),target:nextSeat(hands,state.turn)};
    },
    move(state,side,{kind,from,to,slotId}) {
      const hands = state.hands.map(hand => [...hand]);
      const order = state.order.map(hand => [...hand]);
      const hand = hands[side-1];
      const valid = (index,cards) => Number.isInteger(index) && index >= 0 && index < cards.length;
      if (kind === 'reorder') {
        if (!valid(from,hand) || !valid(to,hand) || from === to) return null;
        hand.splice(to,0,hand.splice(from,1)[0]);
        const slots = order[side-1];
        slots.splice(to,0,slots.splice(from,1)[0]);
        return {...state,hands,order,last:{kind,side,from,to}};
      }
      if (kind !== 'draw' || state.turn !== side) return null;
      const target = nextSeat(hands,side);
      const source = hands[target-1];
      if (!source || !valid(from,source) || order[target-1][from] !== slotId) return null;
      const [card] = source.splice(from,1);
      const [slot] = order[target-1].splice(from,1);
      order[side-1].push(slot);
      hand.push(card);
      hands[side-1] = withoutPairs(hand);
      order[side-1] = order[side-1].filter((_,index) => hands[side-1].includes(hand[index]));
      const turn = nextSeat(hands,side);
      const active = hands.flatMap((cards,index) => cards.length ? [index+1] : []);
      return {...state,hands,order,turn:turn || side,last:{kind,side,target,from},
        result:active.length === 1 ? {loser:active[0]} : undefined};
    },
  };
}
