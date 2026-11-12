import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoRoom} from '../server/go-room.mjs';
import {disconnectMs} from '../server/presence.mjs';

test('online Go: leaving or missing heartbeats ends the game without scoring', () => {
  for (const explicit of [true,false]) {
    let now = 0;
    const host = 'test-host';
    const request = createGoRoom(host,9,() => now);
    const get = (path,token) => request({method:'GET',path,token});
    const {code} = get('/go/host',host).body;
    const {key} = request({method:'POST',path:`/go/${code}/join`}).body;
    now = disconnectMs - 1;
    assert.equal(get('/go',host).body.ended,false);
    if (explicit) request({method:'POST',path:'/go/leave',token:key});
    else now++;
    const result = get('/go',host).body;
    assert.equal(result.ended,true);
    assert.deepEqual(result.forfeits,[2]);
    assert.equal(result.points,null);
  }
});

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
  const scoring = post('/go/move',hostKey,{version:2,action:'pass'}).body;
  assert.equal(scoring.scoring,true);
  assert.equal(scoring.ended,false);
  assert.equal(post('/go/move',hostKey,{version:3,action:'automatic'}).body.ended,false);
  const ended = post('/go/move',guest.key,{version:4,action:'automatic'}).body;
  assert.equal(ended.ended,true);
  assert.equal(ended.points[2],7.5);
  assert.equal(get('/go',guest.key).body.ended,true);
});
