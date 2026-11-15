import {matchSlot,serverMatchRoute,writeKey} from './codes.js';
import {roomRequest} from './client.js';
import {askName,playerName} from './profile.js';
import {lobbyRoute,serverOrigin} from './server.js';
import {seatLabels} from './games.js';

const credentials = `<label>Имя комнаты<input name="room" required minlength="3" maxlength="32"
    pattern="[A-Za-z0-9_&#92;-]{3,32}" placeholder="qwerty" autocomplete="off" autocapitalize="none" spellcheck="false"></label>
  <label>Пароль комнаты<input name="password" type="password" required minlength="4" maxlength="64" autocomplete="off"></label>`;

export function mountLobby(playSection,game) {
  const details = document.createElement('details');
  details.className = 'match-lobby-settings';
  details.innerHTML = `<summary>Играть по сети</summary><div class="match-lobby-lobby">
    <form class="match-lobby-card" data-create><h2>Создать комнату</h2>
      ${credentials}
      ${game === 'go' ? '<label>Размер доски <select name="option"><option>9</option><option>13</option><option>19</option></select></label>'
        : game === 'mahjong' ? '<label>Вариант <select name="option"><option value="chinese">Китайский</option><option value="riichi">Риичи</option></select></label>' : ''}
      <label>Ваша сторона или место<select name="side"><option value="random">Случайная рассадка</option>
        ${seatLabels(game).map((label,index) => `<option value="${index + 1}">${label}</option>`).join('')}</select></label>
      <button class="button dark">Создать комнату</button><p role="status"></p>
    </form>
    <form class="match-lobby-card" data-join><h2>Войти в комнату</h2>
      ${credentials}
      <button class="button dark">Войти в комнату</button><p role="status"></p>
    </form>
  </div>`;
  playSection.before(details);
  const route = lobbyRoute(game);
  details.open = location.hash === route || location.hash.startsWith(route + '/') || game === 'mahjong';
  const invite = location.hash.slice(route.length + 1);
  if (location.hash.startsWith(route + '/') && /^[a-z0-9_-]{3,32}$/.test(invite)) {
    details.querySelector('[data-join] [name="room"]').value = invite;
  }
  for (const form of details.querySelectorAll('form')) {
    const creating = form.hasAttribute('data-create');
    const button = form.querySelector('button');
    const status = form.querySelector('[role="status"]');
    form.onsubmit = async event => {
      event.preventDefault();
      const name = playerName();
      if (!name) { askName(); return; }
      const values = Object.fromEntries(new FormData(form));
      const option = game === 'go' ? Number(values.option) : values.option || 'standard';
      const side = values.side === 'random' ? values.side : Number(values.side);
      const body = {room:values.room,password:values.password,game,name,option,side};
      button.disabled = true;
      status.textContent = 'Подключаемся…';
      try {
        const {id,key} = await roomRequest(serverOrigin,creating ? '/api/lobby' : '/api/lobby/join',null,body);
        if (!form.isConnected) return;
        writeKey(matchSlot({game,origin:serverOrigin,code:id}),key);
        location.hash = serverMatchRoute(game,id);
      } catch (error) { status.textContent = error.message; }
      finally { button.disabled = false; }
    };
  }
  return details;
}
