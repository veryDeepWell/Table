const key = 'table:profile:name';
let name = '';
try { name = localStorage.getItem(key)?.trim().slice(0,24) || ''; } catch {}
export const playerName = () => name;

export function askName() {
  if (document.querySelector('[data-profile-dialog]')) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'profile-dialog';
  dialog.dataset.profileDialog = '';
  dialog.innerHTML = `<form><h2>Как тебя зовут?</h2>
    <label>Имя игрока<input name="name" required maxlength="24" autocomplete="nickname"></label>
    <button class="button dark">Сохранить имя</button></form>`;
  document.body.append(dialog);
  const input = dialog.querySelector('input');
  input.value = name;
  dialog.oncancel = event => { if (!name) event.preventDefault(); };
  dialog.onclose = () => dialog.remove();
  dialog.querySelector('form').onsubmit = event => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) {
      input.setCustomValidity('Введите имя.');
      input.reportValidity();
      return;
    }
    name = value;
    try { localStorage.setItem(key,name); } catch {}
    for (const button of document.querySelectorAll('[data-edit-name]')) button.textContent = name;
    document.dispatchEvent(new CustomEvent('table:profile', {detail:name}));
    dialog.close();
  };
  input.oninput = () => input.setCustomValidity('');
  dialog.showModal();
  input.select();
}
