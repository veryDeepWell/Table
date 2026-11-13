export function mountGameLayout(play,live,history) {
  const panel = play.querySelector(':scope > .game-panel');
  const field = live.closest('.board-column') || document.createElement('div');
  if (!field.parentElement) field.append(...play.children);
  field.classList.add('game-layout-field');
  if (panel) live.before(panel);

  const chat = document.createElement('aside');
  chat.className = 'game-layout-chat';
  chat.dataset.gameChat = '';
  chat.innerHTML = '<section class="match-chat"><h2>Чат партии</h2><p>Чат доступен в сетевой партии.</p></section>';
  play.classList.add('game-layout');
  play.append(field,history,chat);
}
