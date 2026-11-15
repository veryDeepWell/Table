"""Host all Table game rooms through a temporary Cloudflare tunnel."""

import argparse
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import sys
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from play_go import LOCAL_URL, QUICK_URL, start, stop, wait_for_url


SITE = "https://verydeepwell.github.io"
USER_AGENT = "ZaStolom-RoomHost/1.0"
WORKER_URL = re.compile(r"https://[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev")
CONFIG = Path(os.environ.get("LOCALAPPDATA") or Path.home() / ".config") / "ZaStolom" / "room-host.json"


def configuration(reset):
    default = globals().get("DEFAULT_REGISTRY")
    if not reset and CONFIG.exists():
        saved = json.loads(CONFIG.read_text(encoding="utf-8"))
        if isinstance(saved, dict) and (not default or saved.get("registry") == default):
            registry, key = saved.get("registry"), saved.get("key")
            if isinstance(registry, str) and WORKER_URL.fullmatch(registry) and isinstance(key, str) and key:
                return registry, key
    registry = default or input("Адрес Cloudflare Worker: ").strip().rstrip("/")
    if not WORKER_URL.fullmatch(registry):
        raise ValueError("Нужен адрес вида https://имя.аккаунт.workers.dev.")
    key = input("Вставьте ключ запуска и нажмите Enter: ").strip()
    if not key:
        raise ValueError("Ключ запуска пуст.")
    return registry, key


def registry_request(registry, key, method, session, origin=None):
    data = {"session": session}
    if origin:
        data["origin"] = origin
    request = Request(registry + "/host", method=method, data=json.dumps(data).encode(),
                      headers={"Authorization": "Bearer " + key, "Content-Type": "application/json",
                               "User-Agent": USER_AGENT})
    with urlopen(request, timeout=5) as response:
        if not json.load(response).get("ok"):
            raise ValueError("Реестр вернул неожиданный ответ.")


def verify_tunnel(origin, process):
    limit = time.monotonic() + 35
    while time.monotonic() < limit and process.poll() is None:
        try:
            request = Request(origin + "/api/lobby/status", headers={"Origin": SITE, "User-Agent": USER_AGENT})
            with urlopen(request, timeout=4) as response:
                if (response.headers.get("Access-Control-Allow-Origin") == SITE
                        and json.load(response).get("service") == "table-rooms"):
                    return
        except (OSError, ValueError, AttributeError):
            pass
        time.sleep(1)
    raise RuntimeError("Игровой сервер не ответил через туннель.")


def main():
    parser = argparse.ArgumentParser(description="Запустить общий сервер комнат «За столом».")
    parser.add_argument("--setup", action="store_true", help="Ввести настройки запуска заново.")
    args = parser.parse_args()
    node, tunnel = shutil.which("node"), shutil.which("cloudflared")
    if not node or not tunnel:
        parser.error("Установите Node.js 22+ и cloudflared, затем откройте терминал заново.")
    processes = []
    session = secrets.token_hex(16)
    attempted_registration = False
    try:
        registry, key = configuration(args.setup)
        env = {**os.environ, "HOST": "127.0.0.1", "PORT": "0", "TABLE_ORIGIN": SITE,
               "TABLE_API_ONLY": "1", "TABLE_GO_HOST_KEY": "", "TABLE_MATCH_GAME": ""}
        print("Запускаю сервер и туннель…", flush=True)
        local = wait_for_url(start([node, "scripts/serve.mjs"], processes, env=env), LOCAL_URL, 10)
        origin = wait_for_url(start([tunnel, "tunnel", "--url", local], processes), QUICK_URL, 40)
        verify_tunnel(origin, processes[-1])
        attempted_registration = True
        registry_request(registry, key, "PUT", session, origin)
        CONFIG.parent.mkdir(parents=True, exist_ok=True)
        next_config = json.dumps({"registry": registry, "key": key})
        if not CONFIG.exists() or CONFIG.read_text(encoding="utf-8") != next_config:
            descriptor = os.open(CONFIG, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(descriptor, "w", encoding="utf-8") as file:
                file.write(next_config)
        print("Сервер онлайн. Игроки могут создавать комнаты на GitHub Pages. Ctrl+C — остановить.", flush=True)
        last_success = time.monotonic()
        next_update = last_success + 12
        while all(process.poll() is None for process in processes):
            now = time.monotonic()
            if now >= next_update:
                try:
                    registry_request(registry, key, "PUT", session, origin)
                    last_success = now
                    next_update = now + 12
                except OSError as error:
                    if isinstance(error, HTTPError) and error.code in (400, 401, 403, 409):
                        raise
                    if time.monotonic() - last_success >= 35:
                        raise RuntimeError("Связь с реестром серверов потеряна.") from error
                    next_update = time.monotonic() + 2
            time.sleep(.5)
        raise RuntimeError("Сервер или туннель остановился.")
    except KeyboardInterrupt:
        return 0
    except HTTPError as error:
        messages = {401: "Ключ запуска не подходит. Запустите файл с --setup.",
                    403: "Cloudflare отклонил запрос к реестру (HTTP 403).",
                    409: "Другой сервер комнат уже работает."}
        print(messages.get(error.code, f"Реестр ответил HTTP {error.code}."), file=sys.stderr)
        return 1
    except (EOFError, OSError, RuntimeError, ValueError) as error:
        print("Не удалось запустить сервер:", error, file=sys.stderr)
        return 1
    finally:
        for process in reversed(processes):
            stop(process)
        if attempted_registration:
            try:
                registry_request(registry, key, "DELETE", session)
            except (OSError, ValueError, KeyboardInterrupt):
                pass


if __name__ == "__main__":
    sys.exit(main())
