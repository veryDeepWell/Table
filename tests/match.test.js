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

test('battleship keeps placement private and passes the turn only on a miss', () => {
  const match = createMatch('battleship',host,'standard');
  const guest = join(match,'Гость');
  const play = (key,version,kind,point) =>
    request(match,'/move',key,{action:'play',kind,version,point});
  assert.equal(play(host,0,'place',9).status,400);
  assert.equal(play(host,0,'random').status,200);
  const placed = play(guest.key,1,'random').body;
  const fleet = placed.state.ships.flat();
  assert.equal(fleet.length,20);
  assert.equal(request(match,'/history',host).body.positions.length,2);
  assert.equal(play(host,2,'ready').status,200);
  assert.equal(play(guest.key,3,'ready').status,200);
  assert.equal(play(guest.key,4,'shoot',0).status,400);
  assert.equal(play(host,4,'shoot',fleet[0]).body.state.turn,1);
  const miss = Array.from({length:100},(_,index) => index).find(index => !fleet.includes(index));
  assert.equal(play(host,5,'shoot',miss).body.state.turn,2);
  assert.ok(request(match,'/history',host).body.positions.every(entry => !('fleets' in entry.position)));
});

test('four domino seats each get seven distinct tiles and only the opening seat can play', () => {
  const match = createMatch('domino',host,'standard');
  const keys = [host,...['Два','Три','Четыре'].map(name => join(match,name).key)];
  const states = keys.map(key => request(match,'',key).body.state);
  assert.ok(states.every(state => state.hand.length === 7 && !('hands' in state)));
  assert.equal(new Set(states.flatMap(state => state.hand.map(tile => tile.join('-')))).size,28);
  const opener = states[0].turn - 1;
  const move = states[opener].actions[0];
  const body = {action:'play',kind:'tile',version:0,...move};
  assert.equal(request(match,'/move',keys[(opener+1)%4],body).status,400);
  assert.deepEqual(request(match,'/move',keys[opener],body).body.state.chain,[[1,1]]);
  const archive = request(match,'/history',keys[(opener+1)%4]).body;
  assert.ok(archive.positions.every(entry => !('hands' in entry.position) && entry.position.hand.length === 7));
});

for (const game of networkGames.filter(id => !['mahjong','battleship','domino'].includes(id))) {
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
    const archive = request(match,'/history',guest.key).body;
    assert.equal(archive.events.length,1);
    assert.equal(archive.events[0].event,move.action);
    assert.equal(request(match,'/history',null).status,401);
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
    const archive = request(match,'/history',west.key).body;
    assert.equal(archive.positions[0].position.hand.length,13);
    assert.ok(archive.positions.every(entry => entry.position.players.every(player => !('hand' in player))));
    assert.equal(archive.positions[1].action,undefined);
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

test('Go scoring removes a marked group virtually and requires fresh confirmation',() => {
  const match = createMatch('go',host,9);
  const guest = join(match,'Гость');
  const move = (key,version,action,point) => request(match,'/move',key,{version,action,point}).body;
  move(host,0,'play',0);
  move(guest.key,1,'play',80);
  move(host,2,'pass');
  move(guest.key,3,'pass');
  assert.equal(move(host,4,'automatic').state.mode,undefined);
  assert.equal(move(guest.key,5,'manual').state.mode,undefined);
  assert.equal(move(host,6,'manual').state.mode,'manual');
  move(host,7,'confirm');
  const changed = move(guest.key,8,'mark',80);
  assert.deepEqual(changed.state.accepted,[]);
  assert.deepEqual(changed.state.dead,[80]);
  assert.equal(changed.state.board[80],2);
  assert.equal(move(guest.key,9,'confirm').ended,false);
  const finished = move(host,10,'confirm');
  assert.equal(finished.ended,true);
  assert.deepEqual(finished.state.points,[0,81,7.5]);
  assert.deepEqual(request(match,'/history',host).body.events.map(entry => entry.event),
    ['play','play','pass','pass','automatic','manual','manual','confirm','mark','confirm','confirm']);
});
