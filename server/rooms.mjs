import {randomBytes} from 'node:crypto';
import {deal, tick, apply, tableView} from './mahjong.mjs';

const ttl = 12 * 60 * 60 * 1000;
const roomCode = /^[A-F0-9]{10}$/;
const error = (status,message) => ({status,body:{error:message}});
const ok = body => ({status:200,body});

export function createRooms({clock = Date.now, newGame = deal} = {}) {
  const rooms = new Map();
  const view = (room,seat) => ({
    code:room.code, mode:room.mode, seat, host:seat === 0,
    names:room.seats.map(p => p.name), table:tableView(room.game,seat),
  });

  return function request({method, path, token, body = {}}) {
    const now = clock();
    for (const [code,room] of rooms) if (now - room.updated > ttl) rooms.delete(code);
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (method === 'POST' && path === '/rooms') {
      if (!['chinese','riichi'].includes(body?.mode) || !name || name.length > 24) {
        return error(400,'Выберите вариант и введите имя до 24 символов.');
      }
      if (rooms.size >= 250) return error(503,'Все столы заняты. Попробуйте позже.');
      let code;
      do { code = randomBytes(5).toString('hex').toUpperCase(); } while (rooms.has(code));
      const key = randomBytes(32).toString('base64url');
      const room = {code, mode:body.mode, seats:[{name,key}], updated:now};
      rooms.set(code,room);
      return ok({key,...view(room,0)});
    }
    const [resource,code,action,...rest] = path.slice(1).split('/');
    if (resource !== 'rooms' || !roomCode.test(code) || rest.length) return error(404,'Стол не найден.');
    const room = rooms.get(code);
    if (!room) return error(404,'Стол не найден или закрылся.');
    if (method === 'POST' && action === 'join') {
      if (!name || name.length > 24) return error(400,'Введите имя до 24 символов.');
      if (room.game || room.seats.length === 4) return error(409,'За этим столом нет свободных мест.');
      const key = randomBytes(32).toString('base64url');
      room.seats.push({name,key});
      room.updated = now;
      return ok({key,...view(room,room.seats.length - 1)});
    }
    const seat = room.seats.findIndex(p => p.key === token);
    if (seat < 0) return error(401,'У этого браузера нет ключа места за столом.');
    tick(room.game,now);
    if (method === 'GET' && !action) return ok(view(room,seat));
    if (method === 'POST' && action === 'start') {
      if (seat !== 0) return error(403,'Раздачу начинает создатель стола.');
      if (room.seats.length !== 4 || room.game && room.game.phase !== 'end') {
        return error(409,'Начать раздачу можно, когда за столом четверо и предыдущая раздача завершена.');
      }
      const version = (room.game?.version || 0) + 1;
      room.game = newGame(room.mode);
      room.game.version = version;
    } else if (method === 'POST' && action === 'move') {
      if (!apply(room.game,seat,body?.id,body?.version,now)) return error(409,'Ход уже недоступен. Стол обновится.');
    } else return error(404,'Действие не найдено.');
    room.updated = now;
    return ok(view(room,seat));
  };
}
