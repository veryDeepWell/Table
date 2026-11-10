import {games} from './data/games.js';
const app=document.querySelector('#app');
const mark='<span class="brand-mark">●<i>○</i></span>';
function shell(content){app.innerHTML=`<header><a class="brand" href="#/">${mark}за столом<span class="brand-dot">.</span></a><nav aria-label="Главная навигация"><a href="#/" ${!location.hash||location.hash==='#/'?'aria-current="page"':''}>Все игры <span>${String(games.length).padStart(2,"0")}</span></a><a href="#/about">О проекте <span>↗</span></a></nav><span class="header-note">Хорошая компания начинается с игры</span></header><main>${content}</main><footer><a class="brand" href="#/">${mark}за столом.</a><span>Меньше суеты. Больше хороших партий.</span><span>Сделано для тех, кто любит играть ↗</span></footer>`}
function home() {
  const cards = games.map((game,index) => `<a class="game-card" href="#/games/${game.id}" data-search="${[game.name,game.aliases,game.variant,game.category].join(' ').toLowerCase()}">
    <div class="card-art cover-${game.id}" aria-hidden="true">
      <span class="card-index">${String(index + 1).padStart(3,'0')} / ${game.variant.toUpperCase()}</span>
      <span class="card-kanji">${game.art}</span>
      ${game.id === 'go' ? '<div class="stone stone-black"></div><div class="stone stone-white"></div>'
        : `<div class="cover-pieces"><b>${game.icons[0]}</b><b>${game.icons[1]}</b></div>`}
      <span class="card-arrow">↗</span>
    </div>
    <div class="card-description">
      <div><h3>${game.name}</h3><span class="game-category">${game.category}</span></div>
      <p>${game.description}</p><div class="card-meta"><span>♙ 2 игрока</span><span>◷ ${game.time}</span></div>
    </div>
  </a>`).join('');
  shell(`<section id="catalog" class="catalog">
    <div class="section-heading">
      <div><span class="eyebrow">КОЛЛЕКЦИЯ</span><h2>Найдите свою игру<span class="count">${String(games.length).padStart(2,'0')}</span></h2></div>
      <label class="search"><span>⌕</span><input id="search" type="search" placeholder="Название игры…" aria-label="Поиск игры"><kbd>/</kbd></label>
    </div>
    <div class="game-grid catalog-grid">${cards}</div>
    <p id="empty" role="status" hidden>Такой игры пока нет в коллекции.</p>
  </section>`);
  const entries = document.querySelectorAll('.game-card');
  document.querySelector('#search').addEventListener('input', event => {
    const query = event.target.value.toLowerCase().trim().replaceAll('ё','е');
    let visible = 0;
    entries.forEach(card => {
      card.hidden = !card.dataset.search.replaceAll('ё','е').includes(query);
      if (!card.hidden) visible++;
    });
    document.querySelector('#empty').hidden = visible > 0;
  });
}
async function route(){const hash=location.hash;if(hash.startsWith('#/games/')){const game=games.find(g=>hash.split('/')[2]===g.id);if(!game){shell('<section class="page-intro"><h1>Игра пока не найдена</h1><a href="#/">Вернуться к коллекции →</a></section>');return}shell('<p class="loading">Готовим доску…</p>');const {render}=await game.load();if(location.hash===hash)render(document.querySelector('main'));}else if(hash==='#/about'){shell('<section class="page-intro about"><div class="eyebrow">О ПРОЕКТЕ</div><h1>Для игр.<br>Для людей.<br><em>Для всех.</em></h1><p>«За столом» — открытая коллекция настольных игр с понятными правилами и возможностью сыграть прямо в браузере. Мечта — собрать все настолки мира. Первый шаг — го.</p><p>Сейчас можно играть вдвоём на одном устройстве. Партия сохраняется в этом браузере. Регистрация не нужна.</p><a class="button dark" href="#/games/go">Сделать первый ход ↗</a></section>')}else home();if(hash.startsWith('#/'))window.scrollTo(0,0)}
document.addEventListener('click',e=>{const link=e.target.closest('a');if(!link)return;const href=link.getAttribute('href');if(!href?.startsWith('#')||href.startsWith('#/'))return;const target=document.getElementById(href.slice(1));if(target){e.preventDefault();target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}});
window.addEventListener('hashchange',route);document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){const search=document.querySelector('#search');if(search){e.preventDefault();search.focus()}}});route();

