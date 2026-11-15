const local = ['127.0.0.1','localhost'].includes(location.hostname);
export const serverOrigin = local ? location.origin : 'https://table-games.lol';
export const serverRoomPath = id => '/api/lobby/' + id + '/match';
export const lobbyRoute = (game,name) => `#/games/${game}/online${name ? '/' + encodeURIComponent(name) : ''}`;

export function mountServerStatus(element) {
  async function refresh() {
    let available = false;
    try {
      const response = await fetch(serverOrigin + '/api/lobby/status',{
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
