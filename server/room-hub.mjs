import {randomBytes,randomInt,scrypt as derive,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {playerName} from './chat.mjs';
import {createMatch} from './match.mjs';
import {matchGames} from './match-games.mjs';
import {createRooms} from './rooms.mjs';

const scrypt = promisify(derive);
const minute = 60_000;
const reply = (status,body) => ({status,body});
const fail = (status,error) => reply(status,{error});

export function createRoomHub({clock = Date.now} = {}) {
  const rooms = new Map();
  const names = new Map();
  const attempts = new Map();
  const legacyRooms = createRooms({clock});
  let hashing = 0;

  function remove(room) {
    rooms.delete(room.id);
    names.delete(room.name);
  }

  return async function request(input) {
    const {method,path,token,body,address} = input;
    if (path !== '/lobby' && !path.startsWith('/lobby/')) return legacyRooms(input);
    const now = clock();
    if (method === 'GET' && path === '/lobby/status') return reply(200,{service:'table-rooms'});
    for (const room of rooms.values()) {
      if (now - room.lastSeen >= 30 * minute) remove(room);
    }
    if (method === 'POST' && (path === '/lobby' || path === '/lobby/join')) {
      const name = typeof body?.room === 'string' ? body.room.trim().toLowerCase() : '';
      const password = body?.password;
      const player = playerName(body?.name);
      if (!/^[a-z0-9_-]{3,32}$/.test(name)) return fail(400,'Имя комнаты: от 3 до 32 латинских букв, цифр, дефисов или подчёркиваний.');
      if (typeof password !== 'string' || password.length < 4 || password.length > 64) return fail(400,'Пароль должен содержать от 4 до 64 символов.');
      if (!player) return fail(400,'Введите имя игрока.');
      const {game,option,side} = body;
      const adapter = typeof game === 'string' && Object.hasOwn(matchGames,game) ? matchGames[game] : null;
      if (!adapter) return fail(400,'Выберите игру.');
      const creating = path === '/lobby';
      const room = names.get(name);
      if (!creating && room?.game !== game) return fail(404,'Комната для этой игры не найдена.');
      if (creating) {
        if (room) return fail(409,'Это имя комнаты уже занято.');
        if (rooms.size >= 100) return fail(503,'На сервере пока нет места для новой комнаты.');
        if (side !== 'random' && (!Number.isInteger(side) || side < 1 || side > adapter.seats)) return fail(400,'Выберите сторону или случайную рассадку.');
        const options = game === 'go' ? [9,13,19] : game === 'mahjong' ? ['chinese','riichi'] : ['standard'];
        if (!options.includes(option)) return fail(400,'Выберите вариант игры.');
      }
      for (const [key,entry] of attempts) if (now >= entry.reset) attempts.delete(key);
      if (hashing >= 4 || (!attempts.has(address) && attempts.size >= 1024)) return fail(429,'Сервер занят. Попробуйте чуть позже.');
      const attempt = attempts.get(address) || {count:0,reset:now + minute};
      if (attempt.count >= 12) return fail(429,'Слишком много попыток. Попробуйте через минуту.');
      attempt.count++;
      attempts.set(address,attempt);
      const salt = room?.salt || randomBytes(16);
      hashing++;
      let hash;
      try { hash = await scrypt(password,salt,32); }
      finally { hashing--; }

      if (creating) {
        if (names.has(name)) return fail(409,'Это имя комнаты уже занято.');
        if (rooms.size >= 100) return fail(503,'На сервере пока нет места для новой комнаты.');
        const id = randomBytes(16).toString('hex');
        const key = randomBytes(24).toString('base64url');
        const randomSeats = side === 'random';
        const hostSide = randomSeats ? randomInt(1,adapter.seats + 1) : side;
        const match = createMatch(game,key,option,clock,{hostSide,hostName:player,randomSeats,managed:true});
        const created = {id,name,game,salt,hash,match,lastSeen:clock()};
        rooms.set(id,created);
        names.set(name,created);
        return reply(201,{id,key});
      }
      if (names.get(name) !== room) return fail(404,'Комната закрыта.');
      if (!timingSafeEqual(hash,room.hash)) return fail(403,'Неверный пароль комнаты.');
      const joined = room.match({method,path:'/match/join',body:{name:player}});
      if (joined.status !== 200) return joined;
      room.lastSeen = clock();
      return reply(200,{id:room.id,key:joined.body.key});
    }
    const target = /^\/lobby\/([a-f0-9]{32})(\/match(?:\/(?:history|move|name|chat|leave))?)$/.exec(path);
    if (!target) return fail(404,'Действие не найдено.');
    const room = rooms.get(target[1]);
    if (!room) return fail(404,'Комната закрыта или сервер был перезапущен.');
    const result = room.match({method,path:target[2],token,body});
    if (result.status !== 200) return result;
    room.lastSeen = now;
    if (result.body.closed) remove(room);
    return reply(200,{...result.body,roomName:room.name});
  };
}
