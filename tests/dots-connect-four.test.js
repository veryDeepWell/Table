import test from 'node:test';
import assert from 'node:assert/strict';
import * as dots from '../src/games/dots/engine.js';
import * as four from '../src/games/connect-four/engine.js';

const middle = 7 * dots.size + 7;
const ring = [middle - dots.size, middle + 1, middle + dots.size, middle - 1];

test('dots: a diagonal loop captures, scores and closes the enclosed point', () => {
  const state = dots.create();
  state.board[middle] = 2;
  for (const point of ring.slice(0,3)) state.board[point] = 1;
  const result = dots.play(state,{to:ring[3]});
  assert.deepEqual(result.captures,[1,0]);
  assert.equal(result.territory[middle],1);
  assert.equal(result.board[middle],2);
  assert.equal(state.territory[middle],0);
  assert.equal(dots.finish(result).result.winner,1);
});

test('dots: an empty loop stays open until the other side plays inside', () => {
  const state = dots.create();
  for (const point of ring.slice(0,3)) state.board[point] = 1;
  const enclosed = dots.play(state,{to:ring[3]});
  assert.ok(dots.moves(enclosed).some(move => move.to === middle));
  assert.deepEqual(dots.play(enclosed,{to:middle}).captures,[1,0]);
});

test('dots: the border does not complete a contour', () => {
  const state = dots.create();
  state.board[7] = 2;
  for (const point of [6,8,21,22]) state.board[point] = 1;
  assert.deepEqual(dots.play(state,{to:23}).captures,[0,0]);
});

function drops(columns) {
  return columns.reduce((state,to) => {
    const move = four.moves(state).find(option => option.to === to);
    assert.ok(move);
    return four.play(state,move);
  },four.create());
}

test('connect four: gravity and a full column', () => {
  const state = drops([0,0,0,0,0,0]);
  assert.deepEqual(Array.from({length:6},(_,row) => state.board[row * 7]),[2,1,2,1,2,1]);
  assert.ok(!four.moves(state).some(move => move.to === 0));
});

test('connect four: a diagonal and its mirror end the game', () => {
  const columns = [0,1,1,2,3,2,2,3,4,3,3];
  for (const moves of [columns,columns.map(col => 6 - col)]) {
    const state = drops(moves);
    assert.equal(state.result.winner,1);
    assert.equal(state.line.length,4);
    assert.deepEqual(four.moves(state),[]);
  }
});
