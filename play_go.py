"""Start an invite-only room using the project's Node.js server."""

import argparse
import base64
import gzip
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
from tempfile import TemporaryDirectory
from urllib.parse import quote, urlsplit
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import webbrowser


ROOT = Path(__file__).resolve().parent
QUICK_URL = re.compile(r"\|\s+(https://[a-z0-9-]+\.trycloudflare\.com)\s+\|")
LOCAL_URL = re.compile(r"http://127\.0\.0\.1:\d+\b")


def start(args, processes, *, env=None):
    group = {"creationflags":subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == "nt" else {"start_new_session":True}
    process = subprocess.Popen(
        args, cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, encoding="utf-8", errors="replace",
        **group,
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
    last_error = ""
    while time.monotonic() < until:
        try:
            line = messages.get(timeout=max(0, until - time.monotonic()))
        except Empty:
            break
        if line is None:
            detail = f" {last_error}" if last_error else ""
            raise RuntimeError(f"Процесс завершился до получения адреса.{detail}")
        match = pattern.search(line)
        if match:
            return match.group(1) if match.lastindex else match.group()
        if " ERR " in line:
            last_error = line.split(" ERR ", 1)[1].strip()
    detail = f" {last_error}" if last_error else ""
    raise RuntimeError(f"Не удалось получить адрес за отведённое время.{detail}")


def stop(process):
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=4)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()


def wait_for_tunnel(origin, api, site, process, seconds=35):
    deadline = time.monotonic() + seconds
    problem = "сервер ещё не отвечает"
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError("cloudflared остановился до подключения комнаты.")
        try:
            headers = {"Origin":site, "Access-Control-Request-Method":"GET",
                       "Access-Control-Request-Headers":"authorization"} if site else {}
            if headers:
                with urlopen(Request(origin + api, headers=headers, method="OPTIONS"), timeout=4) as response:
                    if response.status != 204 or response.headers.get("Access-Control-Allow-Origin") != site:
                        raise ValueError("туннель не разрешил подключение с сайта")
            try:
                with urlopen(Request(origin + api, headers={"Origin":site} if site else {}), timeout=4):
                    raise ValueError("туннель вернул неожиданный ответ")
            except HTTPError as error:
                with error:
                    if error.code != 401:
                        raise
                    if site and error.headers.get("Access-Control-Allow-Origin") != site:
                        raise ValueError("игровой сервер не разрешил подключение с сайта")
                    if not json.load(error).get("error"):
                        raise ValueError("туннель не дошёл до игрового сервера")
                    return
        except (OSError, ValueError) as error:
            problem = str(error)
        time.sleep(1)
    raise RuntimeError(f"Туннель получил адрес, но игровой сервер недоступен через него ({problem}).")


def read_setup(value):
    match = re.fullmatch(r"table-setup-v1\.([a-z-]+)\.(9|13|19|chinese|riichi|standard)\.([0-9a-f]{64})\.(.+)", value)
    if not match:
        legacy = re.fullmatch(r"go-setup-v1\.(9|13|19)\.([0-9a-f]{64})\.(.+)", value)
        if not legacy:
            raise ValueError("Некорректный код запуска. Скопируйте его целиком с сайта.")
        match = ("", *legacy.groups())
    else:
        match = match.groups()
    game, option, secret, origin = match
    parsed = urlsplit(origin)
    if (origin != f"{parsed.scheme}://{parsed.netloc}" or not parsed.hostname
            or parsed.username is not None or parsed.port == 0
            or (parsed.scheme != "https"
                and not (parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1")))):
        raise ValueError("Код запуска должен содержать HTTPS-адрес сайта.")
    return game, option, secret, origin


def wait_in_window(processes):
    try:
        import tkinter as tk
    except ImportError:
        return False
    try:
        window = tk.Tk()
    except tk.TclError:
        return False
    window.title("За столом · Сервер комнаты")
    icon = tk.PhotoImage(width=32, height=32)
    icon.put("#344b38", to=(0, 0, 32, 32))
    for rectangle in [(5, 9, 27, 14), (8, 14, 12, 24), (20, 14, 24, 24)]:
        icon.put("#f6f5ef", to=rectangle)
    window.iconphoto(True, icon)
    status = tk.Label(window, text="Сервер комнаты запущен")
    status.pack(padx=28, pady=(20, 6))
    tk.Label(window, text="Скопируйте приглашение на сайте.").pack(padx=28)
    stop_button = tk.Button(window, text="Остановить сервер", command=window.destroy)
    stop_button.pack(pady=18)

    def check_processes():
        if any(process.poll() is not None for process in processes):
            status.config(text="Сервер или туннель остановился")
            stop_button.config(text="Закрыть")
        else:
            window.after(750, check_processes)

    window.after(750, check_processes)
    window.mainloop()
    return True


def main():
    parser = argparse.ArgumentParser(description="Запустить сетевую комнату сайта «За столом».")
    parser.add_argument("--size", type=int, choices=[9, 13, 19], default=9)
    parser.add_argument("--local", action="store_true", help="Проверка на одном компьютере, без туннеля.")
    parser.add_argument("--no-browser", action="store_true", help="Показать приватную ссылку ведущего в терминале.")
    parser.add_argument("--setup", action="store_true", help="Принять код запуска и выдать код комнаты для сайта.")
    args = parser.parse_args()
    node = shutil.which("node")
    if not node:
        parser.error("Нужен Node.js. Установите его с https://nodejs.org/.")
    tunnel = shutil.which("cloudflared")
    launch = globals().get("LAUNCH")
    local_only = args.local or bool(launch and launch.get("local"))
    if not local_only and not tunnel:
        parser.error("Для игры через интернет нужен cloudflared в PATH. "
                     "Скачайте его с https://developers.cloudflare.com/tunnel/downloads/. "
                     "Для проверки на этом компьютере запустите с --local.")

    processes = []
    local = None
    try:
        setup = launch["setup"] if launch else input("Вставьте код запуска с сайта и нажмите Enter: ").strip() if args.setup else None
        game, option, host_key, site = read_setup(setup) if setup is not None else ("", str(args.size), secrets.token_urlsafe(32), "")
        api = "/api/match" if game else "/api/go"
        env = {**os.environ, "HOST":"127.0.0.1", "PORT":"0",
               "TABLE_GO_HOST_KEY":host_key, "TABLE_GO_SIZE":option if game in ("","go") else "9",
               "TABLE_MATCH_GAME":game, "TABLE_MATCH_OPTION":option, "TABLE_ORIGIN":site}
        local = wait_for_url(start([node, "scripts/serve.mjs"], processes, env=env), LOCAL_URL, 10)
        request = Request(local + api + "/host", headers={"Authorization":"Bearer " + host_key})
        with urlopen(request, timeout=5) as response:
            code = json.load(response)["code"]
        origin = local
        if not local_only:
            print("Открываю временный HTTPS-туннель…", flush=True)
            origin = wait_for_url(
                start([tunnel, "tunnel", "--url", local], processes), QUICK_URL, 40,
            )
            print("Проверяю доступность игровой комнаты через туннель…", flush=True)
            wait_for_tunnel(origin, api, site, processes[-1])
        if setup is not None:
            signed = (game + "/" if game else "") + origin + "/" + code
            proof = hmac.digest(host_key.encode(), signed.encode(), "sha256").hex()
            prefix = f"table-room-v1.{game}" if game else "go-room-v1"
            room = f"{prefix}.{code}.{proof}.{origin}"
            if launch:
                address = urlsplit(launch["page"])
                if f"{address.scheme}://{address.netloc}" != site:
                    raise ValueError("Адрес страницы не совпадает с адресом сайта.")
                host_url = f"{launch['page']}#/games/{game}/room/match/{quote(room,safe='')}/{host_key}"
                if args.no_browser or not webbrowser.open(host_url):
                    print("Откройте ссылку ведущего:", host_url, flush=True)
            else:
                print("Код комнаты для вас и друга:", room, flush=True)
        else:
            invite = origin + "/#/games/go/room/" + code
            host = invite + "/" + host_key
            print("Приглашение для второго игрока:", invite, flush=True)
            if args.no_browser or not webbrowser.open(host):
                print("Приватная ссылка ведущего (не пересылайте):", host, flush=True)
        print("Ctrl+C завершает работу комнаты.", flush=True)
        if launch and not args.no_browser and wait_in_window(processes):
            raise KeyboardInterrupt
        while all(process.poll() is None for process in processes):
            time.sleep(.5)
        raise RuntimeError("Сервер или туннель остановился.")
    except KeyboardInterrupt:
        if local:
            try:
                leave = Request(local + api + "/leave", data=b"{}",
                                headers={"Authorization":"Bearer " + host_key, "Content-Type":"application/json"})
                with urlopen(leave, timeout=2) as response:
                    forfeits = json.load(response).get("forfeits", [])
                if 1 in forfeits:
                    time.sleep(2)  # Give the other player time to receive the result.
            except (KeyboardInterrupt, OSError, ValueError):
                pass
        return 0
    except (EOFError, OSError, RuntimeError, ValueError) as error:
        print("Не удалось запустить комнату:", error, file=sys.stderr)
        return 1
    finally:
        for process in reversed(processes):
            stop(process)


if __name__ == "__main__":
    if "BUNDLE" in globals():
        with TemporaryDirectory(prefix="za-stolom-") as folder:
            ROOT = Path(folder)
            files = json.loads(gzip.decompress(base64.b64decode(BUNDLE)))
            for name, contents in files.items():
                path = ROOT / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(base64.b64decode(contents))
            sys.exit(main())
    sys.exit(main())
