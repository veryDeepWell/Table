export const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const goFiles = 'ABCDEFGHJKLMNOPQRST';
export const ranks = size => Array.from({length:size}, (_,i) => size - i);

export function coordinates(board, files, rows, layout) {
  const labels = (values, axis) => `<div class="board-axis ${axis}">
    ${Array.from(values, value => `<span>${value}</span>`).join('')}
  </div>`;
  return `<div class="coordinate-frame coordinate-${layout}" style="--files:${files.length};--ranks:${rows.length}">
    <div class="coordinate-labels" aria-hidden="true">
      ${labels(files,'axis-top')}${labels(files,'axis-bottom')}
      ${labels(rows,'axis-left')}${labels(rows,'axis-right')}
    </div>
    <div class="coordinate-field">${board}</div>
  </div>`;
}
