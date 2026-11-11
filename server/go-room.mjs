import {randomBytes} from 'node:crypto';
import {createGame, pass, play, score} from '../src/games/go/engine.js';
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
  function forfeit(seats) {
    if (!seats.length || game.ended) return;
    forfeits = seats.map(seat => seat + 1);
    game = {...game,ended:true};
    version++;
  }
  const view = side => ({
    side, ready:Boolean(guestKey), version, size, turn:game.turn,
    board:game.board, last:game.last, captures:game.captures,
    passes:game.passes, ended:game.ended, forfeits, names, messages,
    points:game.ended && !forfeits.length ? score(game) : null,
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
    if (game.ended || side !== game.turn || body?.version !== version) {
      return fail(409,'Ход уже недоступен. Доска обновится.');
    }
    if (body.action !== 'pass' && body.action !== 'play') return fail(400,'Неизвестный ход.');
    const next = body.action === 'pass' ? pass(game) : play(game,body.point);
    if (next.error) return fail(400,next.error);
    game = next;
    version++;
    return reply(200,view(side));
  };
}
