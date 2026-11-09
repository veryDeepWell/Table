// Each game owns its renderer and rules engine; the catalogue only knows metadata.
export const games = [{id:'go',name:'Го',original:'圍棋',category:'Стратегия',players:'2 игрока',time:'20–90 минут',level:'Легко начать · сложно освоить',description:'Чёрное и белое. Простые правила. Бесконечность возможностей.',load:()=>import('../games/go/view.js')}];
