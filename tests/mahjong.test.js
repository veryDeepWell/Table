import test from 'node:test';
import assert from 'node:assert/strict';
import {createRooms} from '../server/rooms.mjs';
import {actions, apply, claimMs, deal, tick} from '../server/mahjong.mjs';
import {shapes, yaku} from '../server/mahjong-hands.mjs';

for (const mode of ['chinese','riichi']) {
  test(`${mode}: each key sees only its own hand and cannot play another seat's turn`, () => {
    let now = 0;
    const game = deal(mode, () => 0);
    const request = createRooms({clock:() => now,newGame:() => game});
    const post = (path,body,token) => request({method:'POST',path,body,token});
    const host = post('/rooms',{mode,name:'East'}).body;
    const path = '/rooms/' + host.code;
    const players = [host,...['South','West','North'].map(name => post(path + '/join',{name}).body)];
    assert.equal(post(path + '/start',{},players[1].key).status,403);
    const started = post(path + '/start',{},host.key).body;
    assert.equal(started.table.wallCount,mode === 'chinese' ? 83 : 69);
    assert.equal(request({method:'GET',path,token:host.code}).status,401);
    for (const [i,player] of players.entries()) {
      const response = request({method:'GET',path,token:player.key}).body;
      assert.equal(response.seat,i);
      assert.deepEqual(response.table.hand,[...game.players[i].hand].sort((a,b) => a-b));
      assert.ok(response.table.players.every(p => !('hand' in p) && !('furiten' in p)));
      for (const secret of ['wall','dead','key','replies']) {
        assert.doesNotMatch(JSON.stringify(response),new RegExp('"' + secret + '":'));
      }
    }
    const move = started.table.actions.find(option => option.kind === 'discard');
    const command = {id:move.id,version:started.table.version};
    assert.equal(post(path + '/move',command,players[1].key).status,409);
    assert.equal(post(path + '/move',command,host.key).body.table.claim.tile,move.tile);
    assert.equal(post(path + '/move',command,host.key).status,409);
    now += claimMs;
    const next = request({method:'GET',path,token:players[1].key}).body.table;
    assert.equal(next.turn,1);
    assert.equal(next.hand.length,14);
    assert.equal(next.players[0].river[0].tile,move.tile);
  });
}

test('winning shape alone does not give a yaku; a valid ron outranks a chi', () => {
  const hand = [0,1,2,9,10,11,12,13,14,24,25,26,27,27];
  assert.ok(shapes(hand,[]).length);
  assert.deepEqual(yaku(hand,[],{seat:1,selfDraw:false,tile:27}),[]);
  assert.ok(yaku(hand,[],{seat:1,selfDraw:false,riichi:true,tile:27}).includes('Риичи'));
  const game = deal('chinese');
  game.players[0].hand = [1];
  game.players[1].hand = [0,2,3,4,5];
  game.players[2].hand = [0,2,9,10,11,12,13,14,24,25,26,27,27];
  assert.ok(apply(game,0,'discard-1',game.version,0));
  assert.ok(apply(game,1,'chi-0',game.version,1));
  assert.ok(apply(game,2,'ron',game.version,2));
  assert.equal(game.phase,'claim');
  tick(game,claimMs);
  assert.equal(game.result.winner,2);
});

test('riichi furiten checks every winning wait against the player’s river', () => {
  const game = deal('riichi');
  game.players[0].hand = [2];
  game.players[1].hand = [0,1,9,10,11,12,13,14,24,25,26,27,27];
  game.players[1].riichi = true;
  assert.ok(apply(game,0,'discard-2',game.version,0));
  assert.ok(actions(game,1).some(option => option.kind === 'ron'));
  game.players[1].river.push({tile:2,called:true});
  assert.ok(actions(game,1).every(option => option.kind !== 'ron'));
});
