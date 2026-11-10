import {randomInt} from 'node:crypto';
import {tileTypes, counts, closed, shapes, waits, yaku, doraTile} from './mahjong-hands.mjs';

export const claimMs = 10000;
const next = seat => (seat + 1) % 4;
const sorted = tiles => [...tiles].sort((a,b) => a - b);

export function deal(mode, random = randomInt) {
  const wall = Array.from({length:136}, (_,i) => Math.floor(i / 4));
  for (let i = wall.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [wall[i],wall[j]] = [wall[j],wall[i]];
  }
  const dead = mode === 'riichi' ? wall.splice(-14) : [];
  const players = Array.from({length:4}, () => ({
    hand:wall.splice(0,13), melds:[], river:[], riichi:false, furiten:false,
  }));
  const game = {mode,wall,dead,players,phase:'discard',turn:0,version:1,kanCount:0};
  draw(game,0);
  return game;
}

function draw(game, seat, replacement = false) {
  if (!game.wall.length) {
    game.phase = 'end';
    game.result = {reason:'Стена закончилась. Ничья.'};
    return;
  }
  game.turn = seat;
  game.phase = 'discard';
  const p = game.players[seat];
  game.drawn = replacement && game.mode === 'riichi' ? game.dead[game.kanCount - 1] : game.wall.pop();
  if (replacement && game.mode === 'riichi') game.wall.shift();
  p.hand.push(game.drawn);
  if (!p.riichi) p.furiten = false;
  game.replacement = replacement;
}

const canKan = game => game.wall.length > 0 && (game.mode !== 'riichi' || game.kanCount < 4);

function win(game, seat, tile, selfDraw) {
  const p = game.players[seat];
  const hand = selfDraw ? p.hand : [...p.hand,tile];
  if (game.mode === 'chinese') return shapes(hand,p.melds).length ? [] : null;
  if (!selfDraw && (p.furiten || waits(p.hand,p.melds).some(t => p.river.some(d => d.tile === t)))) return null;
  const names = yaku(hand,p.melds,{
    seat,selfDraw,tile,riichi:p.riichi,
    replacement:selfDraw && game.replacement,
    last:!game.wall.length && !game.replacement && (selfDraw || game.claim?.afterDraw),
  });
  return names.length ? names : null;
}

export function actions(game, seat) {
  if (!game || game.phase === 'end') return [];
  const p = game.players[seat];
  if (game.phase === 'claim') {
    const claim = game.claim;
    if (seat === claim.from || claim.replies[seat]) return [];
    const tile = claim.tile;
    const own = counts(p.hand);
    const options = [];
    if (win(game,seat,tile,false)) options.push({id:'ron',kind:'ron'});
    if (!p.riichi && game.wall.length) {
      if (own[tile] >= 2) options.push({id:'pon',kind:'pon',tiles:[tile,tile]});
      if (own[tile] >= 3 && canKan(game)) options.push({id:'kan',kind:'kan',tiles:[tile,tile,tile]});
      if (tile < 27 && seat === next(claim.from)) {
        for (let start = tile - 2; start <= tile; start++) {
          if (start < 0 || start % 9 > 6 || Math.floor(start / 9) !== Math.floor(tile / 9)) continue;
          const tiles = [start,start + 1,start + 2].filter(t => t !== tile);
          if (tiles.every(t => own[t])) options.push({id:`chi-${start}`,kind:'chi',tiles});
        }
      }
    }
    return options.length ? [...options,{id:'pass',kind:'pass'}] : [];
  }
  if (game.turn !== seat) return [];
  const options = [];
  if (game.drawn !== null && win(game,seat,game.drawn,true)) options.push({id:'tsumo',kind:'tsumo'});
  const discards = p.riichi ? [game.drawn] : sorted(new Set(p.hand));
  for (const tile of discards) {
    if (tile === null) continue;
    options.push({id:`discard-${tile}`,kind:'discard',tile});
    if (game.mode === 'riichi' && !p.riichi && game.wall.length >= 4 && closed(p.melds) &&
      waits(without(p.hand,[tile]),p.melds).length) options.push({id:`riichi-${tile}`,kind:'riichi',tile});
  }
  if (!p.riichi && game.drawn !== null && canKan(game)) {
    counts(p.hand).forEach((n,tile) => {
      if (n === 4) options.push({id:`closed-${tile}`,kind:'closed',tile});
    });
  }
  return options;
}

function without(hand, tiles) {
  const copy = [...hand];
  for (const tile of tiles) copy.splice(copy.indexOf(tile),1);
  return copy;
}

const indicators = game => game.mode === 'riichi'
  ? Array.from({length:game.kanCount + 1},(_,i) => game.dead[4 + i * 2]) : [];

function finish(game, seat, tile, selfDraw) {
  const p = game.players[seat];
  const hand = selfDraw ? p.hand : [...p.hand,tile];
  const all = [...hand,...p.melds.flatMap(m => m.tiles)];
  const doras = indicators(game).map(doraTile);
  game.result = {
    winner:seat, kind:selfDraw ? 'tsumo' : 'ron', tile,
    yaku:win(game,seat,tile,selfDraw), dora:doras.reduce((sum,dora) => sum + all.filter(t => t === dora).length,0),
  };
  game.phase = 'end';
  game.claim = null;
}

export function tick(game, now) {
  if (game?.phase !== 'claim' || now < game.claim.until) return;
  const claim = game.claim;
  const rank = {ron:3,kan:2,pon:2,chi:1};
  const replies = claim.replies.flatMap((reply,seat) => reply && rank[reply.kind] ? [{...reply,seat}] : []);
  replies.sort((a,b) => rank[b.kind] - rank[a.kind] ||
    (a.seat - claim.from + 4) % 4 - (b.seat - claim.from + 4) % 4);
  const selected = replies[0];
  if (selected?.kind === 'ron') finish(game,selected.seat,claim.tile,false);
  else {
    if (game.mode === 'riichi') game.players.forEach((p,seat) => {
      if (seat !== claim.from && (claim.replies[seat]?.kind !== 'ron') &&
        (claim.replies[seat]?.couldRon || (!claim.replies[seat] && win(game,seat,claim.tile,false)))) p.furiten = true;
    });
    game.claim = null;
    if (!selected) draw(game,next(claim.from));
    else {
      const p = game.players[selected.seat];
      const tiles = sorted([...selected.tiles,claim.tile]);
      p.hand = without(p.hand,selected.tiles);
      p.melds.push({kind:selected.kind,tile:tiles[0],tiles,from:claim.from});
      game.players[claim.from].river.at(-1).called = true;
      game.turn = selected.seat;
      game.phase = 'discard';
      game.drawn = null;
      game.replacement = false;
      if (selected.kind === 'kan') {
        game.kanCount++;
        draw(game,selected.seat,true);
      }
    }
  }
  game.version++;
}

export function apply(game, seat, id, version, now) {
  tick(game,now);
  if (!game || version !== game.version) return false;
  const options = actions(game,seat);
  const move = options.find(option => option.id === id);
  if (!move) return false;
  const p = game.players[seat];
  if (game.phase === 'claim') {
    game.claim.replies[seat] = {...move,couldRon:options.some(option => option.kind === 'ron')};
    return true;
  }
  if (move.kind === 'tsumo') finish(game,seat,game.drawn,true);
  else if (move.kind === 'closed') {
    const tiles = Array(4).fill(move.tile);
    p.hand = without(p.hand,tiles);
    p.melds.push({kind:'kan',tile:move.tile,tiles,concealed:true});
    game.kanCount++;
    draw(game,seat,true);
  } else {
    p.hand = without(p.hand,[move.tile]);
    if (move.kind === 'riichi') p.riichi = true;
    p.river.push({tile:move.tile,riichi:move.kind === 'riichi'});
    game.claim = {from:seat,tile:move.tile,until:now + claimMs,replies:Array(4).fill(null),afterDraw:game.drawn !== null};
    game.drawn = null;
    game.phase = 'claim';
  }
  game.version++;
  return true;
}

export function tableView(game, seat) {
  if (!game) return null;
  const own = game.players[seat];
  return {
    phase:game.phase, version:game.version, turn:game.turn,
    wallCount:game.wall.length, indicators:indicators(game), result:game.result,
    claim:game.phase === 'claim' ? {tile:game.claim.tile,from:game.claim.from,until:game.claim.until} : null,
    players:game.players.map(p => ({count:p.hand.length,river:p.river,melds:p.melds,riichi:p.riichi})),
    hand:sorted(own.hand), drawn:game.turn === seat ? game.drawn : null,
    actions:actions(game,seat),
  };
}
