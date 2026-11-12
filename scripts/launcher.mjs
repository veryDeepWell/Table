import {readFile,readdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';

export async function launcherSource() {
  const files = ['index.html','package.json','scripts/serve.mjs','scripts/launcher.mjs'];
  for (const directory of ['src','server']) {
    const paths = await readdir(directory,{recursive:true,withFileTypes:true});
    files.push(...paths.filter(entry => entry.isFile()).map(entry => {
      return (entry.parentPath + '/' + entry.name).replaceAll('\\','/');
    }));
  }
  const payload = Object.fromEntries(await Promise.all(files.map(async file =>
    [file,(await readFile(file)).toString('base64')])));
  const compressed = gzipSync(JSON.stringify(payload)).toString('base64');
  return `BUNDLE = "${compressed}"\n${await readFile('play_go.py','utf8')}`;
}
