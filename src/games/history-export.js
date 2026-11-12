export function downloadHistory(game,data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = game + '-party.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}
