import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoRoom} from '../server/go-room.mjs';

test('online Go: private seats, shared state, stale moves and scoring', () => {
  const hostKey = 'test-host';
  const request = createGoRoom(hostKey,13);
  const get = (path, token) => request({method:'GET',path,token});
  const post = (path, token, body) => request({method:'POST',path,token,body});
  const {code} = get('/go/host',hostKey).body;
  assert.equal(get('/go/host',code).status,401);
  assert.equal(post('/go/move',hostKey,{version:0,action:'play',point:0}).status,409);
  const join = '/go/' + code + '/join';
  const guest = post(join,null,{}).body;
  assert.equal(guest.side,2);
  assert.equal(guest.size,13);
  assert.equal(post(join,null,{}).status,409);
  assert.equal(get('/go',code).status,401);
  assert.equal(post('/go/move',guest.key,{version:0,action:'play',point:0}).status,409);
  assert.equal(post('/go/move',hostKey,{version:0,action:'play',point:0}).body.version,1);
  assert.equal(get('/go',guest.key).body.board[0],1);
  assert.equal(post('/go/move',guest.key,{version:0,action:'pass'}).status,409);
  assert.equal(post('/go/move',guest.key,{version:1,action:'play',point:0}).status,400);
  assert.equal(post('/go/move',guest.key,{version:1,action:'pass'}).status,200);
  const ended = post('/go/move',hostKey,{version:2,action:'pass'}).body;
  assert.equal(ended.ended,true);
  assert.equal(ended.points[2],7.5);
  assert.equal(get('/go',guest.key).body.ended,true);
});
