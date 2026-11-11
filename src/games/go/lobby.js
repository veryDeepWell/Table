import {matchesSetup, readKey, remotePrefix, roomCode, roomSlot, writeKey} from './room-code.js';

const draftSlot = 'table:go:launch-draft';

export function renderLobby(root) {
  root.innerHTML = `<section class="game-intro">
    <a class="back" href="#/games/go">← Го</a><h1>Го онлайн</h1>
    <p>Один игрок запускает сервер у себя, второй присоединяется по коду комнаты.</p>
  </section>
  <section class="go-online-lobby" aria-label="Комнаты го">
    <div class="go-online-card">
      <h2>Создать комнату</h2>
      <label>Размер доски <select data-size><option value="9">9 × 9</option><option value="13">13 × 13</option><option value="19">19 × 19</option></select></label>
      <button class="button dark" data-create>Получить код запуска</button>
      <div data-setup hidden>
        <p>В папке проекта запусти <code>python play_go.py --setup</code> и вставь код запуска в терминал.</p>
        <label>Код запуска<textarea data-launch readonly rows="3" spellcheck="false"></textarea></label>
        <button class="button secondary" data-copy>Копировать код запуска</button>
        <p>Этот код только для ведущего. Когда скрипт выдаст код комнаты, вставь его справа и нажми «Войти как ведущий».</p>
      </div>
    </div>
    <form class="go-online-card">
      <h2>Войти в комнату</h2>
      <label>Код комнаты<textarea name="room" required rows="3" maxlength="256" spellcheck="false"></textarea></label>
      <button class="button dark" value="guest">Войти как гость</button>
      <button class="button secondary" value="host">Войти как ведущий</button>
      <p role="status" data-join-status></p>
    </form>
  </section>`;
  const setup = root.querySelector('[data-setup]');
  const launch = root.querySelector('[data-launch]');
  const size = root.querySelector('[data-size]');
  const status = root.querySelector('[data-join-status]');

  function showDraft(draft) {
    launch.value = `go-setup-v1.${draft}.${location.origin}`;
    setup.hidden = false;
  }
  const draft = readKey(draftSlot);
  if (draft) {
    size.value = draft.split('.')[0];
    showDraft(draft);
  }
  root.querySelector('[data-create]').onclick = () => {
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)),byte => byte.toString(16).padStart(2,'0')).join('');
    const draft = size.value + '.' + secret;
    writeKey(draftSlot,draft);
    showDraft(draft);
  };
  root.querySelector('[data-copy]').onclick = async event => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText(launch.value);
      button.textContent = 'Код скопирован';
    } catch { launch.select(); }
  };
  root.querySelector('form').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const value = new FormData(form).get('room').trim();
    const room = roomCode(value);
    if (!room) { status.textContent = 'Вставь полный код комнаты из терминала.'; return; }
    if (event.submitter?.value === 'host') {
      const secret = readKey(draftSlot)?.split('.')[1];
      if (!secret || !await matchesSetup(room,secret).catch(() => false)) {
        status.textContent = 'Этот код комнаты не совпадает с кодом запуска в этой вкладке.';
        return;
      }
      if (!form.isConnected) return;
      writeKey(roomSlot(room.origin,room.code),secret);
    }
    location.hash = remotePrefix + encodeURIComponent(value);
  };
}
