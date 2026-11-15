import {mkdir,copyFile,cp,rm,writeFile} from 'node:fs/promises';
import {hostLauncherSource,launcherSource} from './launcher.mjs';
import {registryOrigin} from '../src/online/registry-config.js';
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});await copyFile('index.html','dist/index.html');await cp('src','dist/src',{recursive:true});await copyFile('index.html','dist/404.html');console.log('Static site built in dist/');
const configured = process.env.MAHJONG_API_URL?.trim();
let apiOrigin = null;
if (configured) {
  const url = new URL(configured);
  if (url.protocol !== 'https:' || url.href !== url.origin + '/') throw Error('MAHJONG_API_URL must be an HTTPS origin');
  apiOrigin = url.origin;
}
await writeFile('dist/src/games/mahjong/config.js',`export const apiOrigin = ${JSON.stringify(apiOrigin)};\n`);
await writeFile('dist/room-launcher.txt',await launcherSource());
const registry = process.env.TABLE_REGISTRY_URL?.trim().replace(/\/$/,'') || registryOrigin;
if (registry && !/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/.test(registry)) {
  throw Error('TABLE_REGISTRY_URL must be a workers.dev HTTPS origin');
}
await writeFile('dist/src/online/registry-config.js',`export const registryOrigin = ${JSON.stringify(registry)};\n`);
const hostLauncher = await hostLauncherSource(registry);
await writeFile('dist/za-stolom-server.py',hostLauncher);
if (process.argv.includes('--branch-pages')) {
  await writeFile('za-stolom-server.py',registry === registryOrigin ? hostLauncher : await hostLauncherSource(registryOrigin));
}
