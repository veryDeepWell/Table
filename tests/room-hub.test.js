import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomHub} from '../server/room-hub.mjs';

const send = (hub,path,body,token) => hub({method:body === undefined ? 'GET' : 'POST',path,body,token});
const matchPath = room => `/lobby/${room.id}/match`;

test('room hub isolates games and admits independent seats only with the room password', async () => {
  const hub = createRoomHub();
  const go = {game:'go',room:'Qwerty',password:'1234',name:'Ведущий',option:9,side:2};
  assert.deepEqual((await send(hub,'/lobby/status')).body,{service:'table-rooms'});
  const created = await send(hub,'/lobby',go);
  assert.equal(created.status,201);
  const host = created.body;
  const waiting = (await send(hub,matchPath(host),undefined,host.key)).body;
  assert.equal(waiting.host,true);
  assert.equal(waiting.side,2);
  assert.equal(waiting.occupied,1);
  assert.equal(waiting.ready,false);
  assert.equal((await send(hub,'/lobby',{...go,room:'qwerty'})).status,409);
  const other = await send(hub,'/lobby',{...go,game:'chess',room:'chess',option:'standard'});
  assert.equal(other.status,201);
  assert.equal((await send(hub,matchPath(other.body),undefined,host.key)).status,401);
  assert.equal((await send(hub,'/lobby/join',{...go,password:'wrong'})).status,403);
  const guest = (await send(hub,'/lobby/join',{...go,room:'qwerty',name:'Гость'})).body;
  assert.equal(guest.id,host.id);
  const joined = (await send(hub,matchPath(guest),undefined,guest.key)).body;
  assert.equal(joined.side,1);
  assert.equal(joined.host,false);
  assert.equal(joined.ready,true);
  const move = {action:'play',version:joined.version,point:0};
  assert.equal((await send(hub,matchPath(host) + '/move',move,host.key)).status,400);
  assert.equal((await send(hub,matchPath(guest) + '/move',move,guest.key)).status,200);
  assert.equal((await send(hub,matchPath(host) + '/leave',{},host.key)).body.forfeits[0],2);
});

test('random Mahjong seating assigns each player a different private seat', async () => {
  const hub = createRoomHub();
  const table = {game:'mahjong',room:'riichi',password:'mahjong',name:'Ведущий',option:'riichi',side:'random'};
  const host = (await send(hub,'/lobby',table)).body;
  const waiting = (await send(hub,matchPath(host),undefined,host.key)).body;
  assert.equal(waiting.state,null);
  const guests = [];
  for (const name of ['Юля','Дима','Лена']) {
    const joined = await send(hub,'/lobby/join',{...table,name});
    assert.equal(joined.status,200);
    guests.push(joined.body);
  }
  const views = await Promise.all([host,...guests].map(async room =>
    (await send(hub,matchPath(room),undefined,room.key)).body));
  assert.deepEqual(views.map(view => view.side).sort(),[1,2,3,4]);
  assert.equal(views.filter(view => view.host).length,1);
  for (const view of views) {
    assert.equal(view.ready,true);
    assert.equal(view.state.hand.length,view.side === 1 ? 14 : 13);
    assert.ok(view.state.players.every(player => !('hand' in player)));
  }
});

test('closing a waiting room releases its name and old links retain their old identity', async () => {
  const hub = createRoomHub();
  const params = {game:'checkers',room:'waiting',password:'1234',name:'Ведущий',option:'standard',side:2};
  const first = (await send(hub,'/lobby',params)).body;
  assert.equal((await send(hub,matchPath(first) + '/leave',{},first.key)).body.closed,true);
  const second = (await send(hub,'/lobby',params)).body;
  assert.notEqual(second.id,first.id);
  assert.equal((await send(hub,matchPath(first),undefined,first.key)).status,404);
});
