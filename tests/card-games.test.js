import test from 'node:test';
import assert from 'node:assert/strict';
import {oldMaid,durak,eights,hearts,thousand} from '../server/card-games.mjs';
import {holdem,handRank} from '../server/holdem.mjs';

test('Old Maid broadcasts opaque card order and rejects stale picks', () => {
  const game = oldMaid();
  const state = {hands:[[2],[3,15,10],[],[]],order:[[0],[52,53,54],[],[]],turn:1};
  const shuffled = game.move(state,2,{kind:'reorder',from:1,to:0});
  const view = game.view(shuffled,1);
  assert.deepEqual(view.order[1],[53,52,54]);
  assert.deepEqual(view.hand,[2]);
  assert.ok(!('hands' in view));
  assert.equal(game.move(shuffled,1,{kind:'draw',from:0,slotId:52}),null);
  const drawn = game.move(shuffled,1,{kind:'draw',from:0,slotId:53});
  assert.deepEqual(drawn.hands[0],[]);
  assert.deepEqual(drawn.order[0],[]);
  assert.deepEqual(drawn.order[1],[52,54]);
});

test('card games expose legal actions and can finish a deal without leaking the stock', () => {
  for (const game of [durak,eights,hearts,thousand,holdem]) {
    let state = game.create();
    let limit = 600;
    while (!state.result && state.phase !== 'round' && limit-- > 0) {
      const view = game.view(state,state.turn);
      assert.ok(!('hands' in view) && !('pile' in view) && !('kitty' in view) && !('passed' in view));
      const move = view.actions.find(action => action.kind === 'card')
        || view.actions.find(action => ['call','check'].includes(action.kind)) || view.actions[0];
      assert.ok(move);
      state = game.move(state,state.turn,move);
      assert.ok(state);
    }
    assert.ok(state.result || state.phase === 'round');
  }
});

test('Holdem recognizes the ace-low straight and conserves chips in an all-in showdown', () => {
  assert.deepEqual(handRank([12,0,14,28,42,7,19]),[4,5]);
  let state = holdem.create();
  while (!state.result && state.phase !== 'round') {
    const moves = holdem.view(state,state.turn).actions;
    state = holdem.move(state,state.turn,moves.find(move => move.kind === 'all-in') || moves[0]);
  }
  assert.equal(state.community.length,5);
  assert.equal(state.stacks.reduce((sum,chips) => sum+chips,0),2000);
});
