import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch} from '../server/match.mjs';
import {networkGames} from '../src/online/games.js';
import {parseInvite,verifyInvite} from '../src/online/codes.js';
import {createHmac} from 'node:crypto';

const host = 'host-test-key';
const request = (match,path,key,body) => match({
  method:body === undefined ? 'GET' : 'POST',path:'/match' + path,token:key,body,
});
const invitation = match => request(match,'/host',host).body.code;
const join = (match,name) => request(match,'/' + invitation(match) + '/join',null,{name}).body;

for (const game of networkGames.filter(id => id !== 'mahjong')) {
  test(`${game}: shared room validates turns and synchronizes a move`,() => {
    const match = createMatch(game,host,game === 'go' ? 9 : 'standard');
    const move = {action:game === 'backgammon' ? 'roll' : 'play',index:0,point:0,version:0};
    assert.equal(request(match,'/move',host,move).status,409);
    const guest = join(match,'Гость');
    assert.equal(guest.ready,true);
    assert.equal(request(match,'/move',guest.key,move).status,400);
    const played = request(match,'/move',host,move);
    assert.equal(played.status,200);
    assert.equal(played.body.version,1);
    assert.notDeepEqual(played.body.state,guest.state);
    assert.deepEqual(request(match,'',guest.key).body.state,played.body.state);
    assert.equal(request(match,'/move',host,move).status,409);
  });
}

test('shared rooms: authenticated chat and loss after disconnect',() => {
  let now = 1000;
  const match = createMatch('go',host,9,() => now);
  const guest = join(match,'Гость');
  assert.equal(request(match,'/name',host,{name:'Ведущий'}).status,200);
  assert.equal(request(match,'/chat',null,{text:'Привет'}).status,401);
  assert.equal(request(match,'/chat',guest.key,{text:'  Привет  '}).status,200);
  assert.equal(request(match,'/chat',guest.key,{text:'Слишком быстро'}).status,400);
  assert.deepEqual(request(match,'',host).body.messages,[{id:1,player:2,name:'Гость',text:'Привет',time:1000}]);
  now += 19_000;
  assert.equal(request(match,'',host).body.ended,false);
  now += 1000;
  const result = request(match,'',host).body;
  assert.equal(result.ended,true);
  assert.deepEqual(result.forfeits,[2]);
  assert.equal(result.state.points,null);
});

for (const mode of ['chinese','riichi']) {
  test(`${mode}: four private hands, shared discard and forfeit`,() => {
    const match = createMatch('mahjong',host,mode);
    const east = join(match,'Юг');
    assert.equal(east.state,null);
    const west = join(match,'Запад');
    const north = join(match,'Север');
    assert.equal(north.ready,true);
    const dealer = request(match,'',host).body;
    assert.equal(dealer.state.hand.length,14);
    for (const key of [east.key,west.key,north.key]) {
      const {state} = request(match,'',key).body;
      assert.equal(state.hand.length,13);
      assert.ok(!state.players.some(player => 'hand' in player));
      assert.deepEqual(state.actions,[]);
    }
    const discard = dealer.state.actions.find(move => move.kind === 'discard');
    const move = {action:'play',id:discard.id,tableVersion:dealer.state.version,version:dealer.version};
    assert.equal(request(match,'/move',east.key,move).status,400);
    assert.equal(request(match,'/move',host,move).status,200);
    assert.equal(request(match,'',west.key).body.state.players[0].river[0].tile,discard.tile);
    assert.deepEqual(request(match,'/leave',north.key,{}).body.forfeits,[4]);
    assert.equal(request(match,'/move',host,move).status,409);
  });
}

test('invitation signature binds the code, game and server',async () => {
  const origin = 'http://127.0.0.1:5500';
  const code = 'a'.repeat(32);
  const proof = createHmac('sha256',host).update('chess/' + origin + '/' + code).digest('hex');
  const invite = 'table-room-v1.chess.' + code + '.' + proof + '.' + origin;
  assert.equal(parseInvite(invite,'dots'),null);
  assert.equal(await verifyInvite(parseInvite(invite,'chess'),host),true);
  assert.equal(await verifyInvite(parseInvite(invite.replace('5500','5501'),'chess'),host),false);
});
