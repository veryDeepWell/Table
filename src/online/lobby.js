import {draftSlot,matchSlot,parseInvite,readKey,roomRoute,verifyInvite,writeKey} from './codes.js';
import {remotePrefix,roomSlot} from '../games/go/room-code.js';

export function mountLobby(playSection,game) {
  const details = document.createElement('details');
  details.className = 'match-lobby-settings';
  details.innerHTML = `<summary>Играть по сети</summary><div class="match-lobby-lobby">
    <section class="match-lobby-card"><h2>Создать комнату</h2>
      ${game === 'go' ? '<label>Размер доски <select data-option><option>9</option><option>13</option><option>19</option></select></label>'
        : game === 'mahjong' ? '<label>Вариант <select data-option><option value="chinese">Китайский</option><option value="riichi">Риичи</option></select></label>' : ''}
      <button class="button dark" data-create>Скачать файл запуска</button>
      <p role="status" data-launch-status></p>
    </section>
    <form class="match-lobby-card"><h2>Войти в комнату</h2>
      <label>Код комнаты<textarea name="room" required rows="3" maxlength="300" spellcheck="false"></textarea></label>
      <button class="button dark" value="guest">Войти как гость</button>
      <button class="button secondary" value="host">Войти как ведущий</button>
      <p role="status" data-join-status></p>
    </form>
  </div>`;
  playSection.before(details);
  details.open = location.hash === `#/games/${game}/online` || game === 'mahjong';
  const launchStatus = details.querySelector('[data-launch-status]');
  const option = details.querySelector('[data-option]');
  const status = details.querySelector('[data-join-status]');
  const draftKey = draftSlot(game);
  const draft = readKey(draftKey);
  if (draft && option) option.value = draft.split('.')[0];
  const create = details.querySelector('[data-create]');
  create.onclick = async () => {
    create.disabled = true;
    try {
      const response = await fetch(new URL('../../room-launcher.py',import.meta.url));
      if (!response.ok) throw new Error();
      const source = await response.text();
      if (!source.startsWith('BUNDLE = ')) throw new Error();
      const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)),byte => byte.toString(16).padStart(2,'0')).join('');
      const settings = (option?.value || 'standard') + '.' + secret;
      const local = ['127.0.0.1','localhost'].includes(location.hostname);
      const setup = `table-setup-v1.${game}.${settings}.${location.origin}`;
      const url = URL.createObjectURL(new Blob([
        `LAUNCH = {"setup": ${JSON.stringify(setup)}, "page": ${JSON.stringify(location.href.split('#')[0])}, "local": ${local ? 'True' : 'False'}}\n`,
        source,
      ],{type:'application/octet-stream'}));
      const link = document.createElement('a');
      link.href = url;
      link.download = `za-stolom-${game}.py`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url),1000);
      writeKey(draftKey,settings);
      launchStatus.textContent = 'Запусти скачанный файл. Когда откроется комната, скопируй приглашение.';
    } catch {
      launchStatus.textContent = 'Не удалось скачать файл запуска. Обнови страницу и попробуй ещё раз.';
    } finally { create.disabled = false; }
  };
  details.querySelector('form').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const value = new FormData(form).get('room').trim();
    const room = parseInvite(value,game);
    if (!room) { status.textContent = 'Вставь полный код комнаты для этой игры.'; return; }
    if (event.submitter?.value === 'host') {
      const secret = readKey(room.legacy ? 'table:go:launch-draft' : draftKey)?.split('.')[1];
      if (!secret || !await verifyInvite(room,secret).catch(() => false)) {
        status.textContent = 'Код комнаты не совпадает с кодом запуска в этой вкладке.';
        return;
      }
      if (!form.isConnected) return;
      writeKey(room.legacy ? roomSlot(room.origin,room.code) : matchSlot(room),secret);
    }
    location.hash = (room.legacy ? remotePrefix : roomRoute(game) + 'match/') + encodeURIComponent(value);
  };
  return details;
}
