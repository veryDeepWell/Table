import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {roomApi} from '../server/http.mjs';
import {createGoRoom} from '../server/go-room.mjs';
import {createMatch} from '../server/match.mjs';
import {networkGames} from '../src/online/games.js';
import {launcherSource} from './launcher.mjs';

const root = process.cwd();
const goSecret = process.env.TABLE_GO_HOST_KEY;
const goSize = Number(process.env.TABLE_GO_SIZE || 9);
if (goSecret && (!/^[A-Za-z0-9_-]{32,}$/.test(goSecret) || ![9,13,19].includes(goSize))) {
  throw new Error('Invalid Go probe configuration');
}
const matchGame = process.env.TABLE_MATCH_GAME;
const matchOption = process.env.TABLE_MATCH_OPTION;
if (matchGame && (!goSecret || !networkGames.includes(matchGame) ||
    (matchGame === 'mahjong' && !['chinese','riichi'].includes(matchOption)))) {
  throw new Error('Invalid match configuration');
}
const api = matchGame
  ? roomApi({rooms:createMatch(matchGame,goSecret,matchGame === 'go' ? goSize : matchOption)})
  : goSecret ? roomApi({rooms:createGoRoom(goSecret,goSize)}) : roomApi();
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 5173);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'};
const server = http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if (pathname.startsWith('/api/')) return await api(req,res,pathname.slice(4));
    if (['/room-launcher.txt','/room-launcher.py'].includes(pathname) && !goSecret) {
      const source = await launcherSource();
      res.setHeader('Content-Type','text/plain; charset=utf-8');
      return res.end(source);
    }
    const file = pathname === '/' ? path.join(root,'index.html') : path.resolve(root,'.' + pathname);
    if (file !== path.join(root,'index.html') && !file.startsWith(path.join(root,'src') + path.sep)) throw Error();
    const body = await readFile(file);
    res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch {
    if (!res.headersSent) res.writeHead(404);
    res.end('Not found');
  }
});
server.listen(port,host,() => console.log('Local: http://' + host + ':' + server.address().port));
