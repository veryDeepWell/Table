import {randomBytes} from 'node:crypto';
import {deal, tick, apply, tableView} from './mahjong.mjs';
import {expiredSeats} from './presence.mjs';
import {addMessage,playerName} from './chat.mjs';
import {createMahjongHistory} from './mahjong-history.mjs';

const ttl = 12 * 60 * 60 * 1000;
const roomCode = /^[A-F0-9]{10}$/;
const error = (status,message) => ({status,body:{error:message}});
const ok = body => ({status:200,body});

export function createRooms({clock = Date.now, newGame = deal} = {}) {
  const rooms = new Map();
  const view = (room,seat) => ({
    code:room.code, mode:room.mode, seat, host:seat === 0,
    names:room.seats.map(p => p.name), table:tableView(room.game,seat), messages:room.messages,
  });

  return function request({method, path, token, body = {}}) {
    const now = clock();
    for (const [code,room] of rooms) if (now - room.updated > ttl) rooms.delete(code);
    const name = playerName(body?.name);
    if (method === 'POST' && path === '/rooms') {
      if (!['chinese','riichi'].includes(body?.mode) || !name || name.length > 24) {
        return error(400,'Выберите вариант и введите имя до 24 символов.');
      }
      if (rooms.size >= 250) return error(503,'Все столы заняты. Попробуйте позже.');
      let code;
      do { code = randomBytes(5).toString('hex').toUpperCase(); } while (rooms.has(code));
      const key = randomBytes(32).toString('base64url');
      const room = {code, mode:body.mode, seats:[{name,key}], messages:[], history:createMahjongHistory(), updated:now};
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
    const active = room.game && room.game.phase !== 'end';
    if (active) {
      const forfeits = action === 'leave' && method === 'POST'
        ? [seat] : expiredSeats(room.lastSeen,now);
      room.lastSeen[seat] = now;
      if (forfeits.length) {
        room.game.phase = 'end';
        room.game.claim = null;
        room.game.result = {forfeits,reason:'Поражение за выход из партии.'};
        room.game.version++;
        room.history.record(room.game,'forfeit',now);
      }
    }
    const versionBeforeTick = room.game?.version;
    tick(room.game,now);
    if (room.game?.version !== versionBeforeTick) room.history.record(room.game,'resolve',now);
    if (method === 'GET' && !action) return ok(view(room,seat));
    if (method === 'GET' && action === 'history') return ok({
      game:'mahjong',option:room.mode,side:seat + 1,names:room.seats.map(player => player.name),
      positions:room.history.read(seat),
    });
    if (method === 'POST' && action === 'leave') return ok(view(room,seat));
    if (method === 'POST' && action === 'start') {
      if (seat !== 0) return error(403,'Раздачу начинает создатель стола.');
      if (room.seats.length !== 4 || room.game && room.game.phase !== 'end') {
        return error(409,'Начать раздачу можно, когда за столом четверо и предыдущая раздача завершена.');
      }
      const version = (room.game?.version || 0) + 1;
      if (room.game?.result?.forfeits) return error(409,'Для новой раздачи создайте другой стол.');
      room.game = newGame(room.mode);
      room.lastSeen = room.seats.map(() => now);
      room.game.version = version;
      room.history.record(room.game,'start',now);
    } else if (method === 'POST' && action === 'chat') {
      const problem = addMessage(room.messages,seat,room.seats[seat].name,body?.text,now);
      if (problem) return error(400,problem);
    } else if (method === 'POST' && action === 'move') {
      const before = room.game?.version;
      if (!apply(room.game,seat,body?.id,body?.version,now)) return error(409,'Ход уже недоступен. Стол обновится.');
      room.history.record(room.game,'play',now,seat,before === room.game.version,body.id);
    } else return error(404,'Действие не найдено.');
    room.updated = now;
    return ok(view(room,seat));
  };
}
