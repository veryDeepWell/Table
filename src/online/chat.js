export function mountChat(play,send) {
  const parent = play.querySelector('[data-game-chat]');
  const section = document.createElement('section');
  section.className = 'match-chat';
  section.innerHTML = `<h2>Чат партии</h2><div role="log" aria-label="Сообщения" class="chat-messages"></div>
    <p data-chat-wait>Чат откроется после подключения к комнате.</p>
    <form hidden><label>Сообщение<input name="text" required maxlength="300" autocomplete="off"></label>
      <button class="button dark">Отправить</button></form><p role="status"></p>`;
  parent.replaceChildren(section);
  const log = section.querySelector('[role="log"]');
  const input = section.querySelector('input');
  const status = section.querySelector('[role="status"]');
  const button = section.querySelector('button');
  let newest = 0;
  section.querySelector('form').onsubmit = async event => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || button.disabled) return;
    button.disabled = true;
    try {
      await send(text);
      if (input.value.trim() === text) input.value = '';
      status.textContent = '';
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  };
  return messages => {
    section.querySelector('form').hidden = false;
    section.querySelector('[data-chat-wait]').hidden = true;
    const following = log.scrollHeight - log.scrollTop - log.clientHeight < 32;
    for (const {id,name,text} of messages) {
      if (id <= newest) continue;
      const line = document.createElement('p');
      const author = document.createElement('strong');
      author.textContent = name + ' · ';
      line.append(author,document.createTextNode(text));
      log.append(line);
      newest = id;
    }
    while (log.children.length > 60) log.firstElementChild.remove();
    if (following) log.scrollTop = log.scrollHeight;
  };
}
