import {randomInt} from 'node:crypto';

const fleet = [4,3,3,2,2,2,1,1,1,1];
const cells = Array.from({length:100},(_,index) => index);
const near = (a,b) => Math.abs(a % 10 - b % 10) <= 1 && Math.abs(Math.floor(a / 10) - Math.floor(b / 10)) <= 1;

function shipAt(ships,start,vertical) {
  const length = fleet[ships.length];
  if (!Number.isInteger(start) || !cells.includes(start) || !length) return null;
  if (vertical ? Math.floor(start / 10) + length > 10 : start % 10 + length > 10) return null;
  const ship = Array.from({length},(_,index) => start + index * (vertical ? 10 : 1));
  return ship.some(cell => ships.some(existing => existing.some(other => near(cell,other)))) ? null : ship;
}

function randomFleet() {
  for (;;) {
    const ships = [];
    for (const length of fleet) {
      const options = cells.flatMap(cell => [shipAt(ships,cell,false),...(length > 1 ? [shipAt(ships,cell,true)] : [])]).filter(Boolean);
      if (!options.length) break;
      ships.push(options[randomInt(options.length)]);
    }
    if (ships.length === fleet.length) return ships;
  }
}

export const battleship = {
  seats:2,
  create:() => ({fleets:[[],[]],shots:[{},{}],locked:[false,false],turn:1}),
  ended:state => Boolean(state.result),
  view(state,side) {
    const index = side - 1;
    return {ships:state.fleets[index],incoming:state.shots[1-index],shots:state.shots[index],
      locked:state.locked,turn:state.turn,result:state.result,nextShip:fleet[state.fleets[index].length]};
  },
  move(state,side,body) {
    const index = side - 1;
    if (!state.locked[index]) {
      const ships = state.fleets[index];
      if (body.kind === 'ready' && ships.length === fleet.length) {
        return {...state,locked:state.locked.map((locked,seat) => locked || seat === index)};
      }
      const ship = body.kind === 'place' && shipAt(ships,body.point,body.vertical === true);
      const updated = body.kind === 'random' ? randomFleet() : body.kind === 'clear' ? [] : ship ? [...ships,ship] : null;
      return updated && {...state,fleets:state.fleets.map((value,seat) => seat === index ? updated : value)};
    }
    if (!state.locked.every(Boolean) || state.turn !== side || body.kind !== 'shoot' ||
      !Number.isInteger(body.point) || !cells.includes(body.point) || state.shots[index][body.point]) return null;
    const ship = state.fleets[1-index].find(entry => entry.includes(body.point));
    const shots = {...state.shots[index],[body.point]:ship ? 'hit' : 'miss'};
    if (ship?.every(cell => shots[cell])) for (const cell of ship) shots[cell] = 'sunk';
    const result = Object.values(shots).filter(value => value === 'sunk').length === 20 ? {winner:side} : undefined;
    return {...state,shots:state.shots.map((value,seat) => seat === index ? shots : value),
      turn:ship ? side : 3-side,result};
  },
  privateMove:body => body.kind !== 'shoot' && body.kind !== 'ready',
};

function deal(scores = [0,0],round = 1,previousWinner) {
  const tiles = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) tiles.push([a,b]);
  for (let index = tiles.length - 1; index > 0; index--) {
    const next = randomInt(index + 1);
    [tiles[index],tiles[next]] = [tiles[next],tiles[index]];
  }
  const hands = Array.from({length:4},(_,index) => tiles.slice(index * 7,index * 7 + 7));
  const doubles = [1,2,3,4,5,6,0];
  const opening = round === 1 ? doubles.find(value => hands.some(hand => hand.some(([a,b]) => a === value && b === value))) : null;
  const turn = previousWinner || 1 + hands.findIndex(hand => hand.some(([a,b]) => a === opening && b === opening));
  return {hands,chain:[],turn,opening,scores,round,passes:0};
}

function placements(state,index) {
  return state.hands[index].flatMap(([a,b],tile) => {
    if (!state.chain.length) return state.opening === null || a === state.opening && b === a ? [{tile,end:'right'}] : [];
    const left = state.chain[0][0];
    const right = state.chain.at(-1)[1];
    return [...(a === left || b === left ? [{tile,end:'left'}] : []),
      ...(a === right || b === right ? [{tile,end:'right'}] : [])];
  });
}

function closeRound(state,winner) {
  const points = [0,0];
  state.hands.forEach((hand,index) => { points[index % 2] += hand.reduce((sum,[a,b]) => sum + a + b,0); });
  const winningTeam = winner ? (winner - 1) % 2 : points[0] === points[1] ? null : points[0] < points[1] ? 0 : 1;
  const scores = [...state.scores];
  if (winningTeam !== null) scores[1-winningTeam] += points[1-winningTeam];
  return {...state,scores,roundResult:{winningTeam,points,blocked:!winner},
    result:Math.max(...scores) >= 101 ? {winner:winningTeam + 1} : undefined};
}

export const domino = {
  seats:4,
  create:() => deal(),
  ended:state => Boolean(state.result),
  view(state,side) {
    const {hands,...publicState} = state;
    return {...publicState,hand:hands[side-1],counts:hands.map(hand => hand.length),
      actions:!state.roundResult && state.turn === side ? placements(state,side-1) : []};
  },
  move(state,side,body) {
    if (state.roundResult) {
      if (side !== 1 || body.kind !== 'next') return null;
      const team = state.roundResult.winningTeam;
      const starter = team === null || (state.turn - 1) % 2 === team ? state.turn : state.turn % 4 + 1;
      return deal(state.scores,state.round+1,starter);
    }
    if (state.turn !== side) return null;
    const actions = placements(state,side-1);
    if (body.kind === 'pass' && !actions.length) {
      const next = {...state,passes:state.passes+1,turn:side%4+1};
      return next.passes === 4 ? closeRound(next) : next;
    }
    if (body.kind !== 'tile' || !actions.some(move => move.tile === body.tile && move.end === body.end)) return null;
    const hands = state.hands.map(hand => [...hand]);
    const [a,b] = hands[side-1].splice(body.tile,1)[0];
    const chain = [...state.chain];
    if (body.end === 'left') chain.unshift(b === chain[0][0] ? [a,b] : [b,a]);
    else chain.push(!chain.length || a === chain.at(-1)[1] ? [a,b] : [b,a]);
    const next = {...state,hands,chain,passes:0,turn:hands[side-1].length ? side%4+1 : side};
    return hands[side-1].length ? next : closeRound(next,side);
  },
};
