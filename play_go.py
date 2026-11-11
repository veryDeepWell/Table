"""Start one invite-only Go room using the project's Node.js server."""

import argparse
import getpass
import hmac
import json
import os
from pathlib import Path
from queue import Empty, Queue
import re
import secrets
import shutil
import subprocess
import sys
from threading import Thread
import time
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
import webbrowser


ROOT = Path(__file__).resolve().parent
QUICK_URL = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com\b")
LOCAL_URL = re.compile(r"http://127\.0\.0\.1:\d+\b")


def start(args, processes, *, env=None):
    process = subprocess.Popen(
        args, cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, encoding="utf-8", errors="replace",
    )
    processes.append(process)
    messages = Queue()

    def read_output():
        with process.stdout as stream:
            for line in stream:
                messages.put(line)
        messages.put(None)

    Thread(target=read_output, daemon=True).start()
    return messages


def wait_for_url(messages, pattern, seconds):
    until = time.monotonic() + seconds
    while time.monotonic() < until:
        try:
            line = messages.get(timeout=max(0, until - time.monotonic()))
        except Empty:
            break
        if line is None:
            raise RuntimeError("Процесс завершился до получения адреса.")
        match = pattern.search(line)
        if match:
            return match.group()
    raise RuntimeError("Не удалось получить адрес за отведённое время.")


def stop(process):
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=4)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()

def read_setup():
    value = (getpass.getpass("Вставьте код запуска с сайта: ") if sys.stdin.isatty() else sys.stdin.readline()).strip()
    match = re.fullmatch(r"go-setup-v1\.(9|13|19)\.([0-9a-f]{64})\.(.+)", value)
    if not match:
        raise ValueError("Некорректный код запуска. Скопируйте его целиком с сайта.")
    size, secret, origin = match.groups()
    parsed = urlsplit(origin)
    if (origin != f"{parsed.scheme}://{parsed.netloc}" or not parsed.hostname
            or parsed.username is not None or parsed.port == 0
            or (parsed.scheme != "https"
                and not (parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1")))):
        raise ValueError("Код запуска должен содержать HTTPS-адрес сайта.")
    return size, secret, origin


def main():
    parser = argparse.ArgumentParser(description="Создать комнату го на двоих.")
    parser.add_argument("--size", type=int, choices=[9, 13, 19], default=9)
    parser.add_argument("--local", action="store_true", help="Проверка на одном компьютере, без туннеля.")
    parser.add_argument("--no-browser", action="store_true", help="Показать приватную ссылку ведущего в терминале.")
    parser.add_argument("--setup", action="store_true", help="Принять код запуска и выдать код комнаты для сайта.")
    args = parser.parse_args()
    node = shutil.which("node")
    if not node:
        parser.error("Нужен Node.js. Установите его с https://nodejs.org/.")
    tunnel = shutil.which("cloudflared")
    if not args.local and not tunnel:
        parser.error("Для игры через интернет нужен cloudflared в PATH. "
                     "Скачайте его с https://developers.cloudflare.com/tunnel/downloads/. "
                     "Для проверки на этом компьютере запустите с --local.")

    processes = []
    try:
        size, host_key, site = read_setup() if args.setup else (str(args.size), secrets.token_urlsafe(32), "")
        env = {**os.environ, "HOST":"127.0.0.1", "PORT":"0",
               "TABLE_GO_HOST_KEY":host_key, "TABLE_GO_SIZE":size, "TABLE_ORIGIN":site}
        local = wait_for_url(start([node, "scripts/serve.mjs"], processes, env=env), LOCAL_URL, 10)
        request = Request(local + "/api/go/host", headers={"Authorization":"Bearer " + host_key})
        with urlopen(request, timeout=5) as response:
            code = json.load(response)["code"]
        origin = local
        if not args.local:
            print("Открываю временный HTTPS-туннель…", flush=True)
            origin = wait_for_url(
                start([tunnel, "tunnel", "--url", local], processes), QUICK_URL, 40,
            )
        if args.setup:
            proof = hmac.digest(host_key.encode(), (origin + "/" + code).encode(), "sha256").hex()
            print("Код комнаты для вас и друга:", flush=True)
            print(f"go-room-v1.{code}.{proof}.{origin}", flush=True)
        else:
            invite = origin + "/#/games/go/room/" + code
            host = invite + "/" + host_key
            print("Приглашение для второго игрока:", invite, flush=True)
            if args.no_browser or not webbrowser.open(host):
                print("Приватная ссылка ведущего (не пересылайте):", host, flush=True)
        print("Ctrl+C завершает работу комнаты.", flush=True)
        while all(process.poll() is None for process in processes):
            time.sleep(.5)
        raise RuntimeError("Сервер или туннель остановился.")
    except KeyboardInterrupt:
        return 0
    except (EOFError, OSError, RuntimeError, ValueError) as error:
        print("Не удалось запустить комнату:", error, file=sys.stderr)
        return 1
    finally:
        for process in reversed(processes):
            stop(process)


if __name__ == "__main__":
    sys.exit(main())
