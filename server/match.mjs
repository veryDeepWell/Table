import {randomBytes} from 'node:crypto';
import {expiredSeats} from './presence.mjs';
import {addMessage, playerName} from './chat.mjs';
import {matchGames} from './match-games.mjs';

const token = () => randomBytes(24).toString('base64url');
const reply = (status,body) => ({status,body});
const fail = (status,error) => reply(status,{error});

export function createMatch(game, hostKey, option, clock = Date.now) {
  const adapter = matchGames[game];
  const code = token();
  const seats = [{key:hostKey,name:''}];
  const messages = [];
  let state = adapter.create(option);
  let lastSeen = [];
  let forfeits = [];
  let version = 0;
  const ready = () => seats.length === adapter.seats;
  const ended = () => Boolean(forfeits.length) || adapter.ended(state);
  const view = side => ({
    game, option, side, version, ready:ready(), ended:ended(), forfeits,
    names:seats.map(seat => seat.name), messages,
    state:game === 'mahjong' && !ready() ? null : adapter.view(state,side),
  });
  function forfeit(indices) {
    if (!indices.length || ended()) return;
    forfeits = indices.map(index => index + 1);
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
      if (ready()) lastSeen = seats.map(() => now);
      return reply(200,{key:guestKey,...view(seats.length)});
    }
    const index = seats.findIndex(seat => seat.key === key);
    if (index < 0) return fail(401,'Нужен ключ игрока. Откройте приглашение.');
    const side = index + 1;
    if (ready() && !ended()) {
      if (path === '/match/leave' && method === 'POST') forfeit([index]);
      else forfeit(expiredSeats(lastSeen,now));
      lastSeen[index] = now;
      if (!ended()) adapter.tick?.(state,now);
    }
    if (path === '/match' && method === 'GET') return reply(200,view(side));
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
    const next = adapter.move(state,side,body,now);
    if (!next || next.error) return fail(400,next?.error || 'Этот ход недоступен.');
    state = next;
    // Mahjong resolves simultaneous claims using its own table version.
    if (game !== 'mahjong') version++;
    return reply(200,view(side));
  };
}
