export const playerName = value => typeof value === 'string' && value.trim().length <= 24 ? value.trim() : '';

export function addMessage(messages, player, name, value, now) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > 300) return 'Введите сообщение длиной от 1 до 300 символов.';
  if (messages.some(message => message.player === player && now - message.time < 500)) return 'Подождите перед отправкой.';
  messages.push({id:(messages.at(-1)?.id || 0) + 1,player,name,text,time:now});
  if (messages.length > 60) messages.shift();
  return null;
}
