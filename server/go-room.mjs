import {randomBytes} from 'node:crypto';
import {createGame, pass, play, score} from '../src/games/go/engine.js';

const token = () => randomBytes(24).toString('base64url');
const reply = (status, body) => ({status,body});

export function createGoRoom(hostSecret, size) {
  const code = token();
  let guestKey;
  let version = 0;
  let game = createGame(size);
  const view = side => ({
    side, ready:Boolean(guestKey), version, size, turn:game.turn,
    board:game.board, last:game.last, captures:game.captures,
    passes:game.passes, ended:game.ended, points:game.ended ? score(game) : null,
  });
  return function request({method,path,token:key,body}) {
    const fail = (status,error) => reply(status,{error});
    if (path === '/go/host' && method === 'GET' && key === hostSecret) {
      return reply(200,{code});
    }
    if (path === '/go/' + code + '/join' && method === 'POST') {
      if (guestKey) return fail(409,'Место белых уже занято.');
      guestKey = token();
      return reply(200,{key:guestKey,...view(2)});
    }
    const side = key === hostSecret ? 1 : guestKey && key === guestKey ? 2 : 0;
    if (!side) return fail(401,'Нужен ключ игрока. Откройте ссылку приглашения.');
    if (path === '/go' && method === 'GET') return reply(200,view(side));
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
