import {randomInt} from 'node:crypto';
import {comparePair,pairRank,splitTiles,tiles} from '../src/games/tile-ranking.js';
import {sabaccRank,sabaccValue} from '../src/games/sabacc-rules.js';
export {sabaccRank,sabaccValue} from '../src/games/sabacc-rules.js';

const shuffle = values => {
  const deck=[...values];
  for(let i=deck.length-1;i>0;i--) {
    const j=randomInt(i+1);
    [deck[i],deck[j]]=[deck[j],deck[i]];
  }
  return deck;
};
const game = (seats,create,actions,apply,view) => ({
  seats,hidden:true,create,ended:state=>Boolean(state.result),
  view:(state,side)=>({...view(state,side),turn:state.turn,result:state.result,actions:actions(state,side)}),
  move(state,side,body) {
    if (body.action!=='play' || !actions(state,side).some(action=>action.kind===body.kind && action.value===body.value)) return null;
    return apply(structuredClone(state),side,body);
  },
});
function paiDeal(score=[1000,1000],round=1) {
  const deck=shuffle(tiles.map((_,i)=>i));
  return {hands:[deck.splice(0,4),deck.splice(0,4)],splits:[null,null],turn:1,banker:(round-1)%2+1,
    phase:'split',score,round,result:null};
}
export const paiGow=game(2,()=>paiDeal(),(state,side)=>{
  if (state.result || state.turn!==side) return [];
  return state.phase==='round' ? [{kind:'next'}] : [0,1,2].map(value=>({kind:'split',value}));
},(state,side,body)=>{
  if(body.kind==='next') return paiDeal(state.score,state.round+1);
  state.splits[side-1]=splitTiles(state.hands[side-1],body.value);
  if(!state.splits.every(Boolean)) { state.turn=3-side;return state; }
  const banker=state.splits[state.banker-1],player=state.splits[2-state.banker];
  const high=comparePair(player.high,banker.high)>0;
  const bothZero=pairRank(player.low)[0]===0 && pairRank(player.low)[1]===0 &&
    pairRank(banker.low)[0]===0 && pairRank(banker.low)[1]===0;
  const low=!bothZero && comparePair(player.low,banker.low)>0;
  const winner=high && low ? 3-state.banker : !high && !low ? state.banker : null;
  state.roundWinner=winner;
  if(winner) {
    state.score[winner-1]+=19;
    state.score[2-winner]-=20;
  }
  state.phase='round';state.turn=1;
  if(state.score.some(balance=>balance<20)) {
    state.result={winner:state.score[0]===state.score[1] ? null : state.score[0]>state.score[1] ? 1 : 2,
      reason:'Недостаточно фишек для следующей ставки'};
  }
  return state;
},(state,side)=>({
  phase:state.phase,hand:state.hands[side-1],counts:state.hands.map(hand=>hand.length),
  ownSplit:state.splits[side-1],showdown:state.phase==='round' ? state.splits : null,
  banker:state.banker,score:state.score,round:state.round,roundWinner:state.roundWinner,
}));

const cardValue = card => Math.min(card%13+1,10)%10;
export const baccaratTotal = hand => hand.reduce((sum,card)=>sum+cardValue(card),0)%10;
export function bankerDraws(total,third) {
  if(third===null) return total<=5;
  return total<=2 || total===3 && third!==8 || total===4 && third>=2 && third<=7 ||
    total===5 && third>=4 && third<=7 || total===6 && third>=6 && third<=7;
}
export function baccaratDeal(deck) {
  const player=[deck.pop()],banker=[deck.pop()];
  player.push(deck.pop());banker.push(deck.pop());
  if(baccaratTotal(player)<8 && baccaratTotal(banker)<8) {
    const third=baccaratTotal(player)<=5 ? deck.pop() : null;
    if(third!==null) player.push(third);
    if(bankerDraws(baccaratTotal(banker),third===null ? null : cardValue(third))) banker.push(deck.pop());
  }
  const a=baccaratTotal(player),b=baccaratTotal(banker);
  return {player,banker,outcome:a===b ? 2 : a>b ? 0 : 1};
}
function baccaratRound(balance=[1000,1000,1000,1000],round=1) {
  return {balance,round,bets:[null,null,null,null],phase:'bet',turn:1,result:null};
}
export const baccarat=game(4,()=>baccaratRound(),(state,side)=>{
  if(state.result || state.turn!==side) return [];
  return state.phase==='round' ? [{kind:'next'}] : [0,1,2].map(value=>({kind:'bet',value}));
},(state,side,body)=>{
  if(body.kind==='next') return baccaratRound(state.balance,state.round+1);
  state.bets[side-1]=body.value;
  if(side<4) { state.turn++;return state; }
  const deck=shuffle(Array.from({length:8*52},(_,i)=>i%52));
  state.deal=baccaratDeal(deck);
  state.balance=state.balance.map((balance,index)=>{
    const bet=state.bets[index],outcome=state.deal.outcome;
    if(outcome===2 && bet!==2) return balance;
    return balance+(bet===outcome ? bet===2 ? 160 : bet===1 ? 19 : 20 : -20);
  });
  state.phase='round';state.turn=1;
  if(state.balance.some(balance=>balance<20)) {
    const best=Math.max(...state.balance);
    const winners=state.balance.flatMap((balance,index)=>balance===best ? [index+1] : []);
    state.result={winner:winners.length===1 ? winners[0] : null,reason:'Недостаточно фишек для следующей ставки'};
  }
  return state;
},state=>({phase:state.phase,balance:state.balance,round:state.round,bets:state.bets,deal:state.deal}));

const compareRank = (a,b) => {
  for(let i=0;i<a.length;i++) if(a[i]!==b[i]) return Math.sign(a[i]-b[i]);
  return 0;
};
function sabaccCreate() {
  const stock=shuffle(Array.from({length:62},(_,i)=>i));
  return {stock,hands:Array.from({length:4},()=>stock.splice(0,2)),discard:[stock.pop()],turn:2,dealer:1,
    phase:'play',lap:1,acted:0,dice:null,result:null};
}
export function drawSabaccCard(state) {
  if(!state.stock.length) {
    const visible=state.discard.pop();
    state.stock=shuffle(state.discard);
    state.discard=visible===undefined ? [] : [visible];
  }
  return state.stock.pop();
}
function finishSabaccTurn(state) {
  state.acted++;
  if(!state.discard.length) state.discard.push(drawSabaccCard(state));
  if(state.acted===4) {
    state.dice=[randomInt(1,7),randomInt(1,7)];
    if(state.dice[0]===state.dice[1]) {
      const lengths=state.hands.map(hand=>hand.length);
      state.discard.push(...state.hands.flat());
      for(let offset=1;offset<=4;offset++) {
        const side=(state.dealer-1+offset)%4;
        state.hands[side]=Array.from({length:lengths[side]},()=>drawSabaccCard(state));
      }
    }
    state.acted=0;
    if(state.lap===3) {
      let best=[],winners=[];
      state.hands.forEach((hand,index)=>{
        const rank=sabaccRank(hand),order=best.length ? compareRank(rank,best) : 1;
        if(order>0){best=rank;winners=[index+1];}
        else if(order===0) winners.push(index+1);
      });
      const tiebreak=[];
      while(winners.length>1) {
        let value=-Infinity,remaining=[];
        for(const side of winners) {
          const card=drawSabaccCard(state),rank=-Math.abs(sabaccValue(card))*2+(sabaccValue(card)>=0 ? 1 : 0);
          state.discard.push(card);
          tiebreak.push({side,card});
          if(rank>value){value=rank;remaining=[side];}
          else if(rank===value)remaining.push(side);
        }
        winners=remaining;
      }
      state.tiebreak=tiebreak;
      state.result={winner:winners[0],reason:'Лучшая рука раздачи'};
      return state;
    }
    state.lap++;
  }
  state.phase='play';state.turn=state.turn%4+1;
  return state;
}
export const sabacc=game(4,sabaccCreate,(state,side)=>{
  if(state.result || state.turn!==side) return [];
  if(state.phase==='discard') return [{kind:'keep'},...state.hands[side-1].map(card=>({kind:'discard',value:card}))];
  return [{kind:'stand'},{kind:'stock'},{kind:'pile'}];
},(state,side,body)=>{
  if(body.kind==='stand') return finishSabaccTurn(state);
  if(body.kind==='stock' || body.kind==='pile') {
    state.hands[side-1].push(body.kind==='stock' ? drawSabaccCard(state) : state.discard.pop());
    state.phase='discard';
    return state;
  }
  if(body.kind==='discard') {
    const hand=state.hands[side-1];
    state.discard.push(hand.splice(hand.indexOf(body.value),1)[0]);
  }
  return finishSabaccTurn(state);
},(state,side)=>({
  phase:state.phase,hand:state.hands[side-1],counts:state.hands.map(hand=>hand.length),
  top:state.discard.at(-1),lap:state.lap,dice:state.dice,stockCount:state.stock.length,
  showdown:state.result ? state.hands : null,tiebreak:state.tiebreak,
}));
