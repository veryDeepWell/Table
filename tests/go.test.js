import test from 'node:test';import assert from 'node:assert/strict';import {createGame,play,pass,score,group} from '../src/games/go/engine.js';
test('stone placement, turns, occupied point and immutable history',()=>{const s=createGame();const next=play(s,40);assert.equal(next.turn,2);assert.equal(s.board[40],0);assert.deepEqual(next.history[0].board,s.board);assert.ok(play(next,40).error)});
test('capture removes stones and allows a capturing move without initial liberties',()=>{const s=createGame(3);s.board=[0,1,2,1,2,0,0,1,2];const next=play(s,5);assert.equal(next.captures[1],3);assert.equal(next.board[4],0);assert.equal(next.board[5],1)});
test('suicide forbidden',()=>{const s=createGame(3);s.board=[0,2,0,2,0,2,0,2,0];assert.ok(play(s,4).error)});
test('connected groups share liberties; diagonals do not connect',()=>{const s=createGame(3);s.board[0]=1;s.board[4]=1;assert.equal(group(s.board,0,3).stones.size,1);s.board[1]=1;assert.equal(group(s.board,0,3).stones.size,3)});
test('superko rejects a repeated position',()=>{const s=createGame(3);const repeated=createGame(3);repeated.board[0]=1;s.history=[repeated];assert.ok(play(s,0).error)});
test('two passes end the game and undo restores previous state',()=>{const s=pass(pass(createGame()));assert.ok(s.ended);assert.equal(s.history.at(-1).ended,false);assert.ok(play(s,0).error)});
test('area scoring, neutral space and komi',()=>{assert.deepEqual(score(createGame(3)),[0,0,7.5]);const s=createGame(3);s.board=[1,1,1,1,0,1,1,1,1];assert.deepEqual(score(s),[0,9,7.5])});

