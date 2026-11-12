import {randomBytes} from 'node:crypto';
import {expiredSeats} from './presence.mjs';
import {addMessage, playerName} from './chat.mjs';
import {matchGames} from './match-games.mjs';
import {createMahjongHistory} from './mahjong-history.mjs';
import {encodeGo} from '../src/games/go/save.js';

const token = () => randomBytes(24).toString('base64url');
const reply = (status,body) => ({status,body});
const fail = (status,error) => reply(status,{error});

export function createMatch(game, hostKey, option, clock = Date.now) {
  const adapter = matchGames[game];
  const code = token();
  const seats = [{key:hostKey,name:''}];
  const messages = [];
  let state = adapter.create(option);
  const hidden = adapter.hidden ? createMahjongHistory((position,seat) => adapter.view(position,seat+1),adapter.seats) : null;
  const initial = hidden ? null : adapter.view(state,1);
  const events = [];
  let lastSeen = [];
  let forfeits = [];
  let version = 0;
  const ready = () => seats.length === adapter.seats;
  const ended = () => Boolean(forfeits.length) || adapter.ended(state);
  const view = side => ({
    game, option, side, version, ready:ready(), ended:ended(), forfeits,
    names:seats.map(seat => seat.name), messages,
    state:adapter.hidden && !ready() ? null : adapter.view(state,side),
  });
  function forfeit(indices,now) {
    if (!indices.length || ended()) return;
    forfeits = indices.map(index => index + 1);
    events.push({event:'forfeit',sides:forfeits,time:now});
    version++;
  }

  return function request({method,path,token:key,body}) {
    const now = clock();
    if (path === '/match/host' && method === 'GET' && key === hostKey) return reply(200,{code});
    if (path === '/match/' + code + '/join' && method === 'POST') {
      if (ready()) return fail(409,'В комнате нет свободных мест.');
      const name = playerName(body?.name);
      if (!name) return fail(400,'Введите имя игрока.');
      const guestKey = token();
      seats.push({key:guestKey,name});
      if (ready()) {
        lastSeen = seats.map(() => now);
        hidden?.record(state,'start',now);
      }
      return reply(200,{key:guestKey,...view(seats.length)});
    }
    const index = seats.findIndex(seat => seat.key === key);
    if (index < 0) return fail(401,'Нужен ключ игрока. Откройте приглашение.');
    const side = index + 1;
    if (ready() && !ended()) {
      if (path === '/match/leave' && method === 'POST') forfeit([index],now);
      else forfeit(expiredSeats(lastSeen,now),now);
      lastSeen[index] = now;
      if (adapter.tick && !ended()) {
        const before = state.version;
        adapter.tick(state,now);
        if (state.version !== before) hidden.record(state,'resolve',now);
      }
    }
    if (path === '/match' && method === 'GET') return reply(200,view(side));
    if (path === '/match/history' && method === 'GET') {
      const archive = {game,option,side,names:seats.map(seat => seat.name),forfeits,events};
      if (hidden) return reply(200,{...archive,positions:hidden.read(index)});
      if (game === 'go') return reply(200,{...encodeGo(state),...archive});
      return reply(200,{...archive,initial,final:adapter.view(state,side)});
    }
    if (method !== 'POST') return fail(404,'Действие не найдено.');
    if (path === '/match/leave') return reply(200,view(side));
    if (path === '/match/name') {
      const name = playerName(body?.name);
      if (!name) return fail(400,'Введите имя до 24 символов.');
      seats[index].name = name;
      return reply(200,view(side));
    }
    if (path === '/match/chat') {
      const error = addMessage(messages,side,seats[index].name,body?.text,now);
      return error ? fail(400,error) : reply(200,view(side));
    }
    if (path !== '/match/move') return fail(404,'Действие не найдено.');
    if (!ready() || ended() || body?.version !== version) return fail(409,'Ход уже недоступен.');
    if (body.action === 'finish' && game === 'dots') {
      return fail(400,'Используйте выход из партии, чтобы сдаться.');
    }
    const before = state.version;
    const next = adapter.move(state,side,body,now);
    if (!next || next.error) return fail(400,next?.error || 'Этот ход недоступен.');
    if (hidden) hidden.record(next,'play',now,index,
      game === 'mahjong' ? before === next.version : adapter.privateMove?.(body),body.id || body.kind);
    else events.push({event:body.action,side,time:now,...adapter.record(state,body,next)});
    state = next;
    // Mahjong resolves simultaneous claims using its own table version.
    if (game !== 'mahjong') version++;
    return reply(200,view(side));
  };
}
