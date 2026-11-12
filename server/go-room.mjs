import {randomBytes} from 'node:crypto';
import {createGame} from '../src/games/go/engine.js';
import {encodeGo} from '../src/games/go/save.js';
import {matchGames} from './match-games.mjs';
import {expiredSeats} from './presence.mjs';
import {addMessage,playerName} from './chat.mjs';

const token = () => randomBytes(24).toString('base64url');
const reply = (status, body) => ({status,body});

export function createGoRoom(hostSecret, size, clock = Date.now) {
  const code = token();
  let guestKey;
  let version = 0;
  let game = createGame(size);
  let lastSeen = [];
  let forfeits = [];
  const names = ['Чёрные','Белые'];
  const messages = [];
  const events = [];
  const adapter = matchGames.go;
  const ended = () => Boolean(forfeits.length) || adapter.ended(game);
  function forfeit(seats) {
    if (!seats.length || ended()) return;
    forfeits = seats.map(seat => seat + 1);
    events.push({event:'forfeit',sides:forfeits,time:clock()});
    version++;
  }
  const view = side => ({
    ...adapter.view(game,side), scoring:game.ended && !ended(),
    side, ready:Boolean(guestKey), version, ended:ended(), forfeits, names, messages,
  });
  return function request({method,path,token:key,body}) {
    const now = clock();
    const fail = (status,error) => reply(status,{error});
    if (path === '/go/host' && method === 'GET' && key === hostSecret) {
      return reply(200,{code});
    }
    if (path === '/go/' + code + '/join' && method === 'POST') {
      if (guestKey) return fail(409,'Место белых уже занято.');
      guestKey = token();
      names[1] = playerName(body?.name) || names[1];
      lastSeen = [now,now];
      return reply(200,{key:guestKey,...view(2)});
    }
    const side = key === hostSecret ? 1 : guestKey && key === guestKey ? 2 : 0;
    if (!side) return fail(401,'Нужен ключ игрока. Откройте ссылку приглашения.');
    if (guestKey) {
      forfeit(expiredSeats(lastSeen,now));
      lastSeen[side - 1] = now;
    }
    if (path === '/go' && method === 'GET') return reply(200,view(side));
    if (path === '/go/history' && method === 'GET') {
      return reply(200,{...encodeGo(game),game:'go',side,names,events,forfeits});
    }
    if (path === '/go/name' && method === 'POST') {
      const name = playerName(body?.name);
      if (!name) return fail(400,'Введите имя до 24 символов.');
      names[side - 1] = name;
      return reply(200,view(side));
    }
    if (path === '/go/chat' && method === 'POST') {
      const error = addMessage(messages,side,names[side - 1],body?.text,now);
      return error ? fail(400,error) : reply(200,view(side));
    }
    if (path === '/go/leave' && method === 'POST') {
      if (guestKey) forfeit([side - 1]);
      return reply(200,view(side));
    }
    if (path !== '/go/move' || method !== 'POST') return fail(404,'Действие не найдено.');
    if (!guestKey) return fail(409,'Дождитесь второго игрока.');
    if (ended() || !game.ended && side !== game.turn || body?.version !== version) {
      return fail(409,'Ход уже недоступен. Доска обновится.');
    }
    const next = adapter.move(game,side,body);
    if (!next || next.error) return fail(400,next?.error || 'Этот ход недоступен.');
    events.push({event:body.action,side,time:now,...adapter.record(game,body,next)});
    game = next;
    version++;
    return reply(200,view(side));
  };
}
