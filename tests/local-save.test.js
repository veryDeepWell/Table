import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSave, saveGame} from '../src/games/local-save.js';
import {decodeGo, encodeGo} from '../src/games/go/save.js';
import {createGame, play, pass, undo} from '../src/games/go/engine.js';

const storage = (data = new Map(), fail = false) => ({
  getItem: key => data.get(key) ?? null,
  setItem(key,value) {
    if (fail) throw new Error('Storage quota exceeded');
    data.set(key,value);
  },
});

test('loads legacy Go saves and keeps a long game and undo history within a small save', () => {
  let state = createGame(19);
  for (let i = 0; i < 270; i++) {
    const next = play(state,i);
    if (!next.error) state = next;
  }
  assert.ok(state.history.length > 200);
  state = pass(state);
  const original = JSON.stringify(state);
  const compact = JSON.stringify(encodeGo(state));
  assert.ok(compact.length < original.length * 0.65);
  assert.deepEqual(decodeGo(JSON.parse(original)),state);
  const restored = decodeGo(JSON.parse(compact));
  assert.deepEqual(restored,state);
  assert.deepEqual(undo(restored),undo(state));
});

test('uses the latest session copy after a local write fails, even after reloading', async () => {
  const key = 'table:test:go';
  const local = new Map();
  globalThis.localStorage = storage(local);
  globalThis.sessionStorage = storage();
  const start = createGame();
  assert.equal(saveGame(key,start,encodeGo),'localStorage');
  globalThis.localStorage = storage(local,true);
  const next = play(start,0);
  assert.equal(saveGame(key,next,encodeGo),'sessionStorage');
  const reload = await import('../src/games/local-save.js?reload');
  assert.deepEqual(reload.loadSave(key,decodeGo).value,next);
  globalThis.sessionStorage = storage(new Map(),true);
  const later = play(next,1);
  assert.equal(saveGame(key,later,encodeGo),'memory');
  assert.deepEqual(loadSave(key,decodeGo).value,later);
});
