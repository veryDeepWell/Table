import {draftSlot,matchSlot,parseInvite,readKey,roomRoute,verifyInvite,writeKey} from './codes.js';
import {remotePrefix,roomSlot} from '../games/go/room-code.js';

export function mountLobby(playSection,game) {
  const details = document.createElement('details');
  details.className = 'match-lobby-settings';
  details.innerHTML = `<summary>Играть по сети</summary><div class="match-lobby-lobby">
    <section class="match-lobby-card"><h2>Создать комнату</h2>
      ${game === 'go' ? '<label>Размер доски <select data-option><option>9</option><option>13</option><option>19</option></select></label>'
        : game === 'mahjong' ? '<label>Вариант <select data-option><option value="chinese">Китайский</option><option value="riichi">Риичи</option></select></label>' : ''}
      <button class="button dark" data-create>Получить код запуска</button>
      <div data-setup hidden><p>В папке проекта запусти <code>python play_go.py --setup</code> и вставь код.</p>
        <label>Код запуска<textarea data-launch readonly rows="3" spellcheck="false"></textarea></label>
        <button class="button secondary" data-copy>Копировать код запуска</button>
        <p>Вставь код комнаты из терминала в соседнее поле и войди как ведущий. Код запуска оставь у себя.</p>
      </div>
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
  const setup = details.querySelector('[data-setup]');
  const launch = details.querySelector('[data-launch]');
  const option = details.querySelector('[data-option]');
  const status = details.querySelector('[data-join-status]');
  const copy = details.querySelector('[data-copy]');
  const draftKey = draftSlot(game);
  function showDraft(draft) {
    launch.value = `table-setup-v1.${game}.${draft}.${location.origin}`;
    setup.hidden = false;
    copy.textContent = 'Копировать код запуска';
  }
  const draft = readKey(draftKey);
  if (draft) {
    if (option) option.value = draft.split('.')[0];
    showDraft(draft);
  }
  details.querySelector('[data-create]').onclick = () => {
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)),byte => byte.toString(16).padStart(2,'0')).join('');
    const draft = (option?.value || 'standard') + '.' + secret;
    writeKey(draftKey,draft);
    showDraft(draft);
  };
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(launch.value);
      copy.textContent = 'Код скопирован';
    } catch { launch.select(); }
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
