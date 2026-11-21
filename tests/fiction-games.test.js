import test from 'node:test';
import assert from 'node:assert/strict';
import * as pai from '../src/games/pai-sho/engine.js';
import * as gungi from '../src/games/gungi/engine.js';
import * as tak from '../src/games/tak/engine.js';
import {tiles,comparePair,pairRank,splitTiles} from '../src/games/tile-ranking.js';
import {baccarat,baccaratDeal,bankerDraws,drawSabaccCard,paiGow,sabacc,sabaccRank} from '../server/casino-games.mjs';

test('Skud Pai Sho setup, harmony bonus, clash traps and rock suppression',()=>{
  let state=pai.create();
  for(let i=0;i<8;i++) state=pai.play(state,pai.moves(state).find(move=>move.type===pai.accents[i%4]));
  assert.equal(state.phase,'opening');
  state=pai.play(state,pai.moves(state)[0]);
  assert.equal(state.turn,2);
  assert.equal(state.board[pai.gates[0]].type,'R3');
  state.board.fill(null);state.phase='play';state.turn=1;
  const put=(x,y,type,side=1,id=0)=>state.board[pai.pointAt(x,y)]={type,side,id};
  put(-3,0,'R3',1,1);put(0,1,'R4',1,2);
  const move=pai.moves(state).find(move=>move.from===pai.pointAt(-3,0) && move.to===pai.pointAt(-1,1));
  assert.ok(move);
  const next=pai.play(state,move);
  assert.equal(next.phase,'bonus');
  assert.equal(next.turn,1);
  assert.equal(state.board[pai.pointAt(-3,0)].type,'R3');
  put(-2,-2,'R3');put(2,-2,'W3',2);put(0,-2,'R4');
  assert.ok(!pai.moves(state).some(move=>move.from===pai.pointAt(0,-2) && move.to===pai.pointAt(0,-3)));
  const board=Array(361).fill(null);
  board[pai.pointAt(-3,-1)]={type:'R3',side:1};
  board[pai.pointAt(3,-1)]={type:'R4',side:1};
  assert.equal(pai.harmonies(board,1).length,1);
  board[pai.pointAt(-5,-1)]={type:'rock',side:2};
  assert.equal(pai.harmonies(board,1).length,0);
});

test('Skud Pai Sho ring must surround the center and cannot touch it',()=>{
  assert.equal(pai.garden(pai.pointAt(3,4)),null);
  assert.equal(pai.garden(pai.pointAt(3,3)),'W');
  const ring=points=>points.map((point,index)=>[point,points[(index+1)%points.length]]);
  const edges=points=>ring(points.map(([x,y])=>pai.pointAt(x,y)));
  assert.equal(pai.hasRing(edges([[-2,-2],[2,-2],[2,2],[-2,2]])),true);
  assert.equal(pai.hasRing(edges([[1,1],[3,1],[3,3],[1,3]])),false);
  assert.equal(pai.hasRing(edges([[0,0],[3,0],[3,3],[0,3]])),false);
});

test('Gungi requires marshal, moves only the upper layer and offers optional captain conversion',()=>{
  let state=gungi.create();
  assert.ok(!gungi.moves(state).some(move=>move.kind==='ready'));
  state=gungi.play(state,gungi.moves(state).find(move=>move.type==='k' && move.to===76));
  state=gungi.play(state,gungi.moves(state).find(move=>move.type==='k' && move.to===4));
  state=gungi.play(state,gungi.moves(state).find(move=>move.kind==='ready'));
  state=gungi.play(state,gungi.moves(state).find(move=>move.kind==='ready'));
  assert.equal(state.phase,'play');
  state.board[58]=[{side:1,type:'p'},{side:1,type:'t'}];
  state.board[48]=[{side:2,type:'p'}];
  const choices=gungi.moves(state).filter(move=>move.from===58 && move.to===48);
  assert.ok(choices.some(move=>move.convert));
  const next=gungi.play(state,choices.find(move=>move.kind==='stack' && !move.convert));
  assert.deepEqual(next.board[58],[{side:1,type:'p'}]);
  assert.equal(next.board[48][0].side,2);
  assert.equal(gungi.play(state,choices.find(move=>move.convert)).board[48][0].side,1);
});

test('Gungi scout starts two diagonal spaces away and jumps cannot cross taller towers',()=>{
  const state=gungi.create();state.phase='play';
  state.board[40]=[{side:1,type:'i'}];
  assert.ok(!gungi.targets(state,40).includes(30));
  assert.ok(gungi.targets(state,40).includes(20));
  state.board[40]=[{side:1,type:'c'}];
  state.board[31]=[{side:2,type:'p'}];
  assert.ok(gungi.targets(state,40).includes(13));
  state.board[31].push({side:2,type:'p'});
  assert.ok(!gungi.targets(state,40).includes(13));
});

test('Tak opening swaps colors, preserves carry order and flattens a wall with a lone capstone',()=>{
  let state=tak.create();
  state=tak.play(state,tak.moves(state).find(move=>move.to===0));
  assert.equal(state.board[0][0].side,2);
  state=tak.play(state,tak.moves(state).find(move=>move.to===1));
  assert.equal(state.board[1][0].side,1);
  state.board[10]=[{side:2,type:'flat'},{side:1,type:'flat'},{side:1,type:'cap'}];
  state.board[12]=[{side:2,type:'wall'}];
  const move=tak.moves(state).find(move=>move.from===10 && move.to===12 && move.carry===2 && move.drops.join()==='1,1');
  assert.ok(move);
  const next=tak.play(state,move);
  assert.deepEqual(next.board[10],[{side:2,type:'flat'}]);
  assert.equal(next.board[12][0].type,'flat');
  assert.equal(tak.top(next.board[12]).type,'cap');
  const board=Array.from({length:25},()=>[]);
  for(let i=0;i<5;i++) board[i]=[{type:'flat',side:1}];
  assert.equal(tak.road(board,1),true);
  board[2][0].type='wall';
  assert.equal(tak.road(board,1),false);
});

test('Pai Gow ranks supreme pair, wong, gee jun and validates all three partitions',()=>{
  assert.equal(tiles.length,32);
  assert.ok(comparePair([30,31],[0,1])>0);
  assert.ok(comparePair([0,22],[0,24])>0);
  assert.deepEqual(pairRank([30,0]),[0,8,16]);
  for(let index=0;index<3;index++){
    const {high,low}=splitTiles([0,4,20,30],index);
    assert.ok(comparePair(high,low)>=0);
    assert.equal(new Set([...high,...low]).size,4);
  }
});

test('Baccarat banker third-card matrix and natural hands',()=>{
  assert.equal(bankerDraws(3,8),false);
  assert.equal(bankerDraws(3,9),true);
  assert.equal(bankerDraws(6,7),true);
  assert.equal(bankerDraws(6,5),false);
  assert.equal(bankerDraws(5,null),true);
  const deal=baccaratDeal([12,12,12,12,7,8,0,0]);
  assert.equal(deal.player.length,2);
  assert.equal(deal.banker.length,2);
});

test('Casino rounds finish without exposing the stock or other private hands',()=>{
  for(const adapter of [paiGow,baccarat,sabacc]){
    let state=adapter.create(),finished=false;
    for(let step=0;step<150 && !state.result;step++){
      const side=state.turn,view=adapter.view(state,side);
      assert.ok(!('hands' in view) && !('stock' in view));
      assert.equal(adapter.move(state,side,{action:'play',kind:'invalid'}),null);
      const move=view.actions.find(move=>move.kind==='stand') || view.actions[0];
      assert.ok(move);
      state=adapter.move(state,side,{action:'play',...move});
      assert.ok(state);
      if(state.phase==='round'){finished=true;break;}
    }
    assert.ok(finished || state.result);
    if(adapter===sabacc) assert.equal(adapter.view(state,1).showdown.length,4);
  }
  assert.ok(sabaccRank([9,39,60])[0]>sabaccRank([0,30])[0]);
  assert.ok(sabaccRank([0])[2]>sabaccRank([30])[2]);
});

test('Sabacc recycles only discarded cards and preserves the face-up card',()=>{
  const state={stock:[],discard:[1,2,3,4]};
  const drawn=[drawSabaccCard(state),drawSabaccCard(state),drawSabaccCard(state)];
  assert.deepEqual(drawn.sort(),[1,2,3]);
  assert.deepEqual(state.discard,[4]);
});
