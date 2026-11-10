export const tileTypes = 34;
export const counts = tiles => {
  const result = Array(tileTypes).fill(0);
  for (const tile of tiles) result[tile]++;
  return result;
};
const suited = tile => tile < 27;
const rank = tile => tile % 9;
const simple = tile => suited(tile) && rank(tile) > 0 && rank(tile) < 8;
const orphans = [0,8,9,17,18,26,27,28,29,30,31,32,33];

function* groups(remaining, number) {
  if (!number) {
    yield [];
    return;
  }
  const tile = remaining.findIndex(Boolean);
  if (tile < 0) return;
  if (remaining[tile] >= 3) {
    remaining[tile] -= 3;
    for (const rest of groups(remaining, number - 1)) yield [{kind:'pon',tile}, ...rest];
    remaining[tile] += 3;
  }
  if (suited(tile) && rank(tile) <= 6 && remaining[tile + 1] && remaining[tile + 2]) {
    remaining[tile]--;
    remaining[tile + 1]--;
    remaining[tile + 2]--;
    for (const rest of groups(remaining, number - 1)) yield [{kind:'chi',tile}, ...rest];
    remaining[tile]++;
    remaining[tile + 1]++;
    remaining[tile + 2]++;
  }
}

export function shapes(hand, melds) {
  const needed = 4 - melds.length;
  if (needed < 0 || hand.length !== needed * 3 + 2) return [];
  const remaining = counts(hand);
  const results = [];
  if (!melds.length && remaining.filter(n => n === 2).length === 7) results.push({special:'Семь пар'});
  if (!melds.length && orphans.every(tile => remaining[tile])) results.push({special:'Тринадцать сирот'});
  for (let pair = 0; pair < tileTypes; pair++) {
    if (remaining[pair] < 2) continue;
    remaining[pair] -= 2;
    for (const sets of groups(remaining,needed)) results.push({pair,sets:[...sets,...melds]});
    remaining[pair] += 2;
  }
  return results;
}

export const closed = melds => melds.every(meld => meld.concealed);
export function waits(hand, melds) {
  const used = counts([...hand,...melds.flatMap(meld => meld.tiles)]);
  return used.flatMap((n,tile) => n < 4 && shapes([...hand,tile],melds).length ? [tile] : []);
}

export function yaku(hand, melds, context) {
  const {seat, selfDraw, riichi, tile, replacement = false, last = false} = context;
  const all = [...hand,...melds.flatMap(meld => meld.tiles)];
  const isClosed = closed(melds);
  const suits = new Set(all.filter(suited).map(t => Math.floor(t / 9)));
  const value = t => t === 27 || t === 27 + seat || t >= 31;
  let best = [];
  for (const shape of shapes(hand,melds)) {
    const names = [];
    if (shape.special) names.push(shape.special);
    if (riichi) names.push('Риичи');
    if (isClosed && selfDraw) names.push('Закрытое цумо');
    if (replacement) names.push('Ринсян');
    if (last) names.push(selfDraw ? 'Хайтэй' : 'Хотэй');
    if (all.every(simple)) names.push('Танъяо');
    if (suits.size === 1) names.push(all.every(suited) ? 'Тинъицу' : 'Хонъицу');
    if (all.every(t => !simple(t))) names.push('Хонрото');
    if (all.every(t => !suited(t))) names.push('Цуисо');
    if (all.every(t => suited(t) && [0,8].includes(rank(t)))) names.push('Тинрото');
    if (shape.sets) {
      const sequences = shape.sets.filter(set => set.kind === 'chi').map(set => set.tile);
      const triplets = shape.sets.filter(set => set.kind !== 'chi').map(set => set.tile);
      if (triplets.some(value)) names.push('Якухай');
      if (!sequences.length) names.push('Тойтой');
      if (triplets.filter(t => t >= 31).length === 3) names.push('Дайсангэн');
      if (triplets.filter(t => t >= 27 && t <= 30).length >= 3 &&
        (triplets.filter(t => t >= 27 && t <= 30).length === 4 || shape.pair >= 27 && shape.pair <= 30)) names.push('Сууси');
      if (sequences.some(t => rank(t) === 0 && sequences.includes(t + 3) && sequences.includes(t + 6))) names.push('Иццу');
      if (sequences.some(t => t < 9 && sequences.includes(t + 9) && sequences.includes(t + 18))) names.push('Сансёку додзюн');
      if (triplets.some(t => t < 9 && triplets.includes(t + 9) && triplets.includes(t + 18))) names.push('Сансёку доко');
      if (isClosed && sequences.some((t,i) => sequences.indexOf(t) !== i)) names.push('Ипэйко');
      if (isClosed && sequences.length === 4 && !value(shape.pair) && sequences.some(t =>
        tile === t && rank(t) < 6 || tile === t + 2 && rank(t) > 0)) names.push('Пинфу');
      if (sequences.length && !simple(shape.pair) && triplets.every(t => !simple(t)) &&
        sequences.every(t => rank(t) === 0 || rank(t) === 6)) names.push(all.every(suited) ? 'Дзюнтян' : 'Тянта');
    }
    if (names.length > best.length) best = names;
  }
  return best;
}

export function doraTile(indicator) {
  if (indicator < 27) return indicator - rank(indicator) + (rank(indicator) + 1) % 9;
  if (indicator < 31) return 27 + (indicator - 26) % 4;
  return 31 + (indicator - 30) % 3;
}
