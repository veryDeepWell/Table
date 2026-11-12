import {mountScoring} from './scoring.js';
import {goBoard} from './board.js';
import {mountReplay} from '../replay.js';
import {goReplay} from './replay.js';
import {downloadHistory} from '../history-export.js';
import {createGame,play,pass,undo,lastCapture,scoringAction} from './engine.js';
import {goPosition} from './board.js';
import {renderNetworkGo, renderRoom} from './room.js';
import {inMatch} from '../../online/client.js';
import {mountLobby} from '../../online/lobby.js';
import {loadSave, saveGame, saveMessage} from '../local-save.js';
import {decodeGo, encodeGo} from './save.js';
const storageKey='table:go:v1';
function diagram(stones, marks, caption, markType = 'point') {
  const coordinates = index => [22 + (index % 5) * 32, 22 + Math.floor(index / 5) * 32];
  const grid = [22, 54, 86, 118, 150]
    .map(point => `M22 ${point}H150 M${point} 22V150`).join(' ');
  const pieces = Object.entries(stones).map(([index, color]) => {
    const [x, y] = coordinates(Number(index));
    return `<circle class="diagram-stone ${color === 1 ? 'black' : 'white'}" cx="${x}" cy="${y}" r="13"/>`;
  }).join('');
  const markers = marks.map(index => {
    const [x, y] = coordinates(index);
    if (markType === 'blocked') {
      return `<path class="diagram-blocked" d="M${x-6} ${y-6}l12 12m0-12-12 12"/>`;
    }
    return `<circle class="diagram-mark ${markType}" cx="${x}" cy="${y}" r="${markType === 'move' ? 10 : 5}"/>`;
  }).join('');
  return `<svg class="diagram" viewBox="0 0 172 172" aria-hidden="true">
    <rect class="diagram-board" x="1" y="1" width="170" height="170" rx="7"/>
    <path class="diagram-grid" d="${grid}"/>${pieces}${markers}
  </svg><figcaption>${caption}</figcaption>`;
}
const rules=[
 ['Цель игры','Занять больше площади',`Го — игра для двоих, зародившаяся в Китае. Чёрные ходят первыми. Игроки по очереди ставят по одному камню на свободное пересечение линий. Камни не передвигаются. Цель — окружить территорию и сохранить свои камни. Для первой партии удобно поле 9 × 9; классическое — 19 × 19.`],
 ['Дыхания','Камням нужен воздух',`Свободные соседние пересечения по вертикали и горизонтали называют дыханиями, или дамэ. Диагонали не считаются. В центре у одиночного камня до четырёх дыханий, у края — трёх, в углу — двух. Камни одного цвета, соединённые по линиям, образуют группу с общими дыханиями.`,diagram({12:1},[7,11,13,17], 'Четыре точки вокруг чёрного камня — его дыхания.')],
 ['Захват','Последнее дыхание',`Когда у камня или целой группы не остаётся дыханий, её снимают с доски. Если осталось одно дыхание, это атари. Сначала проверяют захват чужих камней, затем дыхания своей группы: ход без дыханий разрешён, если он захватывает соперника и тем самым освобождает дыхания.`,diagram({12:2,7:1,11:1,13:1},[17], 'Ход чёрных на отмеченную точку снимает белый камень.', 'move')],
 ['Запреты','Самоубийство и ко',`Нельзя поставить камень так, чтобы своя группа осталась без дыханий после всех захватов. Нельзя сразу отыграть одиночный камень в ко и вернуть прежнюю позицию: сначала нужен ход в другом месте. Здесь действует позиционное суперко: ход камнем не может повторить любую прежнюю позицию доски; пас разрешён.`,diagram({7:2,11:2,13:2,17:2},[12], 'Чёрные не могут сыграть в центре: дыханий нет, захвата тоже.', 'blocked')],
 ['Жизнь группы','Два глаза — надёжный дом',`Глаз — внутреннее пустое пересечение, окружённое своей группой. Группа с двумя настоящими отдельными глазами живёт: соперник не может заполнить оба одним ходом. Не любая визуальная «дырка» — настоящий глаз: проверьте, нельзя ли захватить окружающие камни. Бывает сэки — взаимная жизнь, когда ни одной стороне невыгодно начинать захват.`,diagram({5:1,6:1,7:1,8:1,9:1,10:1,12:1,14:1,15:1,16:1,17:1,18:1,19:1},[11,13], 'Связная группа и два отдельных глаза внутри неё.')],
 ['Финал','Пасы, территория и очки',`Когда полезных ходов не осталось, можно пасовать. Два паса подряд заканчивают партию. По китайскому подсчёту каждый камень на доске и каждая пустая точка, окружённая только вашим цветом, дают по одному очку. Общие незанятые области нейтральны. Снятые камни отдельно не прибавляют. Белые получают 7,5 очка коми за второй ход. Например: у чёрных 30 камней и 12 точек территории — 42 очка; у белых 28 + 10 + 7,5 = 45,5. Победа белых на 3,5 очка.`],
 ['Спорные позиции','Сначала договоритесь',`Перед подсчётом соперники обычно согласуют мёртвые группы и снимают их. После двух пасов выберите режим подсчёта. Автоматический снимает только явно окружённые группы. В ручном режиме игроки отмечают пленных и подтверждают счёт. При разногласии нажмите «Продолжить игру» и доиграйте позицию. Суперко, китайский подсчёт и коми 7,5 — выбранные настройки этой доски; регламенты турниров могут отличаться.`]
];
export function render(root){
 const saved = loadSave(storageKey,decodeGo);
 let state = saved?.value || createGame();
 let saveLocation = saved?.location;
 root.innerHTML=`<section id="play" class="play-section"><div class="board-column"><div class="board-heading"><h1>Го</h1><label>Доска <select id="size" aria-label="Размер доски"><option value="9">9 × 9</option><option value="13">13 × 13</option><option value="19">19 × 19</option></select></label></div><div data-go-field></div><div class="board-caption"><span>Камни ставятся на пересечения линий</span><span class="go-last-position" data-last-position></span></div></div><aside class="game-panel"><span class="eyebrow">ЛОКАЛЬНАЯ ПАРТИЯ</span><h2 id="turn"></h2><p id="status" role="status" aria-live="polite"></p><div class="player"><span><b class="player-stone black"></b>Чёрные</span><strong id="black-captures">0</strong></div><div class="player"><span><b class="player-stone white"></b>Белые <small>+7,5 коми</small></span><strong id="white-captures">0</strong></div><small class="capture-note">Справа — число пленных у каждой стороны</small><div class="game-actions"><button id="pass" class="button dark">Пас <span>→</span></button><button id="undo" class="button secondary">↶ Отменить ход</button><button id="restart" class="text-button">Начать заново</button></div><p class="save-note" data-save-note role="status"></p><div class="go-backup"><button type="button" class="text-button" data-download>Скачать историю партии</button><button type="button" class="text-button" data-import>Открыть файл партии</button><input type="file" accept=".json,application/json" data-save-file hidden></div></aside></section><section id="rules" class="rules-section"><h2>Правила</h2><div class="rules-list">${rules.map((r,i)=>`<article class="rule"><span class="rule-number">0${i+1}</span><div><span class="eyebrow">${r[0]}</span><h3>${r[1]}</h3><p>${r[2]}</p></div>${r[3]?`<figure>${r[3]}</figure>`:''}</article>`).join('')}</div><p class="sources">Подробнее: <a href="https://www.britgo.org/intro/intro2.html" target="_blank" rel="noreferrer">введение Британской ассоциации го ↗</a> · <a href="https://www.britgo.org/rules/compare.html" target="_blank" rel="noreferrer">сравнение систем правил ↗</a></p></section>`;
 const playSection = root.querySelector('#play');
 if (location.hash.startsWith('#/games/go/room/')) {
   if (inMatch('go')) renderNetworkGo(root);
   else renderRoom(root);
   return;
 }
 mountLobby(playSection,'go');
 const board=root.querySelector('[data-go-field]'),status=root.querySelector('#status');let notice='';
 const showReplay = mountReplay(playSection,board,position => goBoard(position,false));
 function update(){
 paintScoring(state,!state.ended,{captured:lastCapture(state)});
 showReplay(goReplay(state));
 root.querySelector('[data-last-position]').textContent = state.last == null
   ? '' : 'Последний ход: ' + goPosition(state.last,state.size);
 const saveNote = root.querySelector('[data-save-note]'); saveNote.textContent = saveMessage(saveLocation); saveNote.classList.toggle('save-warning', saveLocation === 'memory' || saveLocation === 'sessionStorage'); root.querySelector('#size').value=state.size;root.querySelector('#turn').innerHTML=state.ended ? (state.confirmed ? 'Партия завершена' : 'Подсчёт очков') :`<b class="player-stone ${state.turn===1?'black':'white'}"></b> Ход ${state.turn===1?'чёрных':'белых'}`;status.textContent=state.ended ? '' : notice||`${state.history.length?`Ход ${state.history.length+1}. `:''}${state.passes?'Соперник пасует. Ещё один пас завершит игру.':'Выберите свободное пересечение.'}`;root.querySelector('#undo').disabled=!state.history.length;root.querySelector('#pass').hidden=state.ended; }
 function commit(next) {
   state = next;
   saveLocation = saveGame(storageKey,state,encodeGo);
   update();
 }
 const paintScoring = mountScoring(root.querySelector('#play'),(action,point) => {
   const next = action === 'play' ? play(state,point) : scoringAction(state,1,{action,point},1);
   if (!next) return;
   if (next.error) { status.textContent = next.error; return; }
   notice = '';
   commit(next);
 });
 root.querySelector('#pass').onclick = () => {
   notice = '';
   commit(pass(state));
 };
 root.querySelector('#undo').onclick = () => {
   if (!state.history.length) return;
   notice = '';
   commit(undo(state));
 };
 root.querySelector('#restart').onclick = () => {
   if (state.history.length && !confirm('Начать новую партию? Текущая позиция будет удалена.')) return;
   notice = 'Новая партия. Чёрные начинают.';
   commit(createGame(state.size));
 };
 root.querySelector('#size').onchange = event => {
   if (state.history.length && !confirm('Сменить доску и начать новую партию?')) {
     event.target.value = state.size;
     return;
   }
   notice = '';
   commit(createGame(Number(event.target.value)));
 };
 const file = root.querySelector('[data-save-file]');
 root.querySelector('[data-download]').onclick = () => downloadHistory('go',encodeGo(state));
 root.querySelector('[data-import]').onclick = () => file.click();
 file.onchange = async () => {
   const selected = file.files[0];
   file.value = '';
   if (!selected) return;
   let next;
   try { next = decodeGo(JSON.parse(await selected.text())); } catch {}
   if (!board.isConnected) return;
   if (!next) { status.textContent = 'Этот файл не удалось открыть как сохранённую партию го.'; return; }
   if (state.history.length && !confirm('Заменить текущую партию партией из файла?')) return;
   notice = 'Партия восстановлена из файла.';
   commit(next);
 };
 update();
}

