import {mkdir,copyFile,cp,rm,writeFile} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});await copyFile('index.html','dist/index.html');await cp('src','dist/src',{recursive:true});await copyFile('index.html','dist/404.html');console.log('Static site built in dist/');
const configured = process.env.MAHJONG_API_URL?.trim();
let apiOrigin = null;
if (configured) {
  const url = new URL(configured);
  if (url.protocol !== 'https:' || url.href !== url.origin + '/') throw Error('MAHJONG_API_URL must be an HTTPS origin');
  apiOrigin = url.origin;
}
await writeFile('dist/src/games/mahjong/config.js',`export const apiOrigin = ${JSON.stringify(apiOrigin)};\n`);
