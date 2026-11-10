import test from 'node:test';
import assert from 'node:assert/strict';
import * as chess from '../src/games/chess/engine.js';
import * as checkers from '../src/games/checkers/engine.js';
import * as shogi from '../src/games/shogi/engine.js';
import * as gammon from '../src/games/backgammon/engine.js';
import {piece} from '../src/games/grid.js';

function move(engine, state, from, to) {
  const choice = engine.moves(state).find(m => m.from === from && m.to === to);
  assert.ok(choice, `Missing legal move ${from} → ${to}`);
  return engine.play(state,choice);
}

test('chess: opening move tree, en passant and checkmate', () => {
  const start = chess.create();
  const opening = chess.moves(start);
  assert.equal(opening.length,20);
  assert.equal(opening.reduce((sum,m) => sum + chess.moves(chess.play(start,m)).length,0),400);
  let state = start;
  for (const [from,to] of [[52,36],[8,16],[36,28],[11,27],[28,19]]) state = move(chess,state,from,to);
  assert.equal(state.board[27],null);
  assert.deepEqual(state.board[19],piece('p',1));
  state = start;
  for (const [from,to] of [[53,45],[12,28],[54,38],[3,39]]) state = move(chess,state,from,to);
  assert.deepEqual(state.result,{winner:2,reason:'Мат'});
});

test('chess: castling cannot cross an attacked square and promotion offers four pieces', () => {
  const start = chess.create();
  const board = Array(64).fill(null);
  board[60] = piece('k',1);
  board[63] = piece('r',1);
  board[0] = piece('k',2);
  board[10] = piece('p',1);
  assert.ok(chess.moves({...start,board}).some(m => m.rook === 63));
  board[5] = piece('r',2);
  assert.equal(chess.moves({...start,board}).some(m => m.rook === 63),false);
  assert.deepEqual(chess.moves({...start,board}).filter(m => m.from === 10).map(m => m.promotion),['q','r','b','n']);
});

test('Russian checkers: obligatory chain crowns on the first jump and keeps captured pieces as obstacles', () => {
  const board = Array(64).fill(null);
  board[17] = piece('m',1); // b6
  board[10] = piece('m',2); // c7
  board[21] = piece('m',2); // f6
  const state = {...checkers.create(),board};
  assert.deepEqual(checkers.moves(state),[{from:17,to:3,over:10}]);
  const chain = move(checkers,state,17,3);
  assert.deepEqual(chain.board[3],piece('d',1));
  assert.deepEqual(chain.taken,[10]);
  assert.deepEqual(checkers.moves(chain).map(m => m.to),[30,39]);
  const result = move(checkers,chain,3,30);
  assert.equal(result.board[10],null);
  assert.equal(result.board[21],null);
  assert.equal(result.result.winner,1);
});

test('backgammon: maximum dice use, priority of higher die, bar entry and bearing off', () => {
  const start = gammon.create();
  assert.equal(start.board.reduce((sum,n) => sum + Math.max(0,n),0),15);
  assert.equal(gammon.roll(start,2,4).turn,2);
  const board = Array(24).fill(0);
  board[2] = 1;
  board[1] = -1;
  board[0] = -2;
  board[23] = 1;
  board[22] = board[21] = -2;
  const blocked = {...start,opening:false,board,dice:[1,2],off:[13,0]};
  assert.deepEqual(gammon.moves(blocked),[{from:2,to:1,die:1}]);
  const hit = gammon.play(blocked,gammon.moves(blocked)[0]);
  assert.equal(hit.bar[1],1);
  const entries = gammon.moves(gammon.roll(hit,1,3));
  assert.ok(entries.length && entries.every(m => m.from === gammon.BAR));
  const home = Array(24).fill(0);
  home[4] = 1;
  const ending = {...blocked,board:home,dice:[5,6],off:[14,0]};
  assert.deepEqual(gammon.moves(ending),[{from:4,to:gammon.OFF,die:6}]);
  assert.equal(gammon.play(ending,gammon.moves(ending)[0]).result.winner,1);
  home[4] = 2;
  assert.deepEqual(gammon.moves({...ending,off:[13,0]}).map(m => m.die),[5,6]);
});

test('shogi: drops respect occupied files, dead ranks and the pawn-drop mate ban', () => {
  const start = shogi.create();
  assert.equal(shogi.moves(start).length,30);
  const board = Array(81).fill(null);
  board[4] = piece('k',2);
  board[76] = piece('k',1);
  board[57] = piece('p',1);
  const state = {...start,board,hands:[{p:1,n:1},{}]};
  const drops = shogi.moves(state);
  assert.ok(drops.some(m => m.drop === 'p' && m.to === 13));
  assert.ok(drops.every(m => m.drop !== 'p' || m.to >= 9 && m.to % 9 !== 3));
  assert.ok(drops.every(m => m.drop !== 'n' || m.to >= 18));
  board[22] = piece('r',1);
  board[3] = piece('l',2);
  board[5] = piece('l',2);
  board[12] = piece('p',2);
  board[14] = piece('p',2);
  assert.equal(shogi.moves(state).some(m => m.drop === 'p' && m.to === 13),false);
});
