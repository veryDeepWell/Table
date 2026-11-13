import {randomInt} from 'node:crypto';
import * as go from '../src/games/go/engine.js';
import * as chess from '../src/games/chess/engine.js';
import * as checkers from '../src/games/checkers/engine.js';
import * as backgammon from '../src/games/backgammon/engine.js';
import * as shogi from '../src/games/shogi/engine.js';
import * as dots from '../src/games/dots/engine.js';
import * as connectFour from '../src/games/connect-four/engine.js';
import * as mahjong from './mahjong.mjs';
import {gomoku,reversi,kalah} from '../src/games/new-board-engines.js';
import {battleship,domino} from './private-games.mjs';
import * as xiangqi from '../src/games/xiangqi/engine.js';
import {oldMaid,eights,hearts,durak,thousand} from './card-games.mjs';
import {holdem} from './holdem.mjs';
import {janggi,hnefatafl} from '../src/games/variant-engines.js';

function boardGame(engine) {
  return {
    seats:2, create:engine.create,
    ended:state => Boolean(state.result),
    view:state => {
      const {keys,positions,...board} = state;
      return {...board,canClaim:Boolean(engine.claim?.(state))};
    },
    record(state,body,next) {
      if (body.action === 'play') return {move:engine.moves(state)[body.index]};
      if (body.action === 'roll') return {dice:next.rolled};
      return {};
    },
    move(state,side,body) {
      if (state.turn !== side) return null;
      if (body.action === 'roll' && engine.roll && !state.dice.length) {
        const a = randomInt(1,7);
        let b = randomInt(1,7);
        while (state.opening && a === b) b = randomInt(1,7);
        return engine.roll(state,a,b);
      }
      if (body.action === 'claim' && engine.claim) {
        const reason = engine.claim(state);
        return reason ? {...state,result:{reason}} : null;
      }
      if (body.action !== 'play' || !Number.isInteger(body.index)) return null;
      const move = engine.moves(state)[body.index];
      return move ? engine.play(state,move) : null;
    },
  };
}

export const matchGames = {
  go:{
    seats:2,create:go.createGame,ended:state => Boolean(state.confirmed),
    view(state) {
      const {history,...board} = state;
      return {...board,captured:go.lastCapture(state),points:state.confirmed ? go.score(state) : null};
    },
    move(state,side,body) {
      if (state.ended) return go.scoringAction(state,side,body);
      if (state.turn !== side) return null;
      if (body.action === 'pass') return go.pass(state);
      if (body.action === 'play') return go.play(state,body.point);
      return null;
    },
    record(state,body) { return Number.isInteger(body.point) ? {point:body.point} : {}; },
  },
  chess:boardGame(chess), checkers:boardGame(checkers), backgammon:boardGame(backgammon),
  shogi:boardGame(shogi), dots:boardGame(dots), 'connect-four':boardGame(connectFour),
  gomoku:boardGame(gomoku), reversi:boardGame(reversi), kalah:boardGame(kalah),
  xiangqi:boardGame(xiangqi),
  'old-maid':oldMaid(),
  eights,hearts,durak,thousand,holdem,
  janggi:boardGame(janggi),hnefatafl:boardGame(hnefatafl),
  battleship:{...battleship,hidden:true}, domino:{...domino,hidden:true},
  mahjong:{
    seats:4,hidden:true,create:mahjong.deal,ended:state => state.phase === 'end',
    view:(state,side) => mahjong.tableView(state,side - 1),
    tick:mahjong.tick,
    move:(state,side,body,now) => body.action === 'play' &&
      mahjong.apply(state,side - 1,body.id,body.tableVersion,now) ? state : null,
  },
};
