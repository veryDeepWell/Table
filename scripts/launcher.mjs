import {readFile,readdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';

async function bundle(extraFiles = []) {
  const files = ['index.html','package.json','scripts/serve.mjs','scripts/launcher.mjs',...extraFiles];
  for (const directory of ['src','server']) {
    const paths = await readdir(directory,{recursive:true,withFileTypes:true});
    files.push(...paths.filter(entry => entry.isFile()).map(entry => {
      return (entry.parentPath + '/' + entry.name).replaceAll('\\','/');
    }));
  }
  const payload = Object.fromEntries(await Promise.all(files.map(async file =>
    [file,(await readFile(file)).toString('base64')])));
  return gzipSync(JSON.stringify(payload)).toString('base64');
}

export async function launcherSource() {
  return `BUNDLE = "${await bundle()}"\n${await readFile('play_go.py','utf8')}`;
}

export async function hostLauncherSource(registryOrigin) {
  return `import base64
import gzip
import json
import os
from pathlib import Path
import runpy
import sys
from tempfile import TemporaryDirectory
import traceback

BUNDLE = "${await bundle(['host_rooms.py','play_go.py'])}"

def launch():
    with TemporaryDirectory(prefix="za-stolom-") as folder:
        root = Path(folder)
        files = json.loads(gzip.decompress(base64.b64decode(BUNDLE)))
        for name, contents in files.items():
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(base64.b64decode(contents))
        sys.path.insert(0, folder)
        runpy.run_path(str(root / "host_rooms.py"),
                       init_globals={"DEFAULT_REGISTRY": ${registryOrigin ? JSON.stringify(registryOrigin) : 'None'}},
                       run_name="__main__")


if __name__ == "__main__":
    exit_code = 0
    try:
        launch()
    except SystemExit as error:
        exit_code = error.code
    except KeyboardInterrupt:
        pass
    except Exception:
        traceback.print_exc()
        exit_code = 1
    if exit_code and os.name == "nt" and sys.stdin.isatty():
        try:
            input("Нажмите Enter, чтобы закрыть окно…")
        except (EOFError, KeyboardInterrupt):
            pass
    sys.exit(exit_code)
`;
}
