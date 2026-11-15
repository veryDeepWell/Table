import {registryOrigin} from './registry-config.js';

const local = () => ['127.0.0.1','localhost'].includes(location.hostname);
export const validServerOrigin = origin => typeof origin === 'string' &&
  (/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin) || local() && origin === location.origin);
export const serverOriginSlot = id => 'table:server-origin:' + id;
export const serverRoomPath = id => '/api/lobby/' + id + '/match';
export const lobbyRoute = (game,name) => `#/games/${game}/online${name ? '/' + encodeURIComponent(name) : ''}`;

export async function findRoomServer() {
  if (local()) return location.origin;
  if (!registryOrigin) throw new Error('Адрес реестра серверов ещё не настроен.');
  const origin = await fetch(registryOrigin + '/host',{
    cache:'no-store',signal:AbortSignal.timeout(5000),
  }).then(async response => response.ok ? (await response.json()).origin : null).catch(() => null);
  if (!validServerOrigin(origin)) throw new Error('Сервер комнат недоступен. Запустите сервер и попробуйте ещё раз.');
  return origin;
}

export function mountServerStatus(element) {
  async function refresh() {
    let available = false;
    try {
      const origin = await findRoomServer();
      const response = await fetch(origin + '/api/lobby/status',{
        cache:'no-store',signal:AbortSignal.timeout(5000),
      });
      available = response.ok && (await response.json()).service === 'table-rooms';
    } catch {}
    if (!element.isConnected) return;
    if (element.dataset.online !== String(available)) {
      element.dataset.online = String(available);
      element.textContent = available ? 'Сервер онлайн' : 'Сервер недоступен';
    }
    setTimeout(refresh,15_000);
  }
  refresh();
}
