export const games = [
  {id:'go', name:'Го', aliases:'go 圍棋', category:'Стратегия', variant:'Китай', art:'碁', icons:['●','○'],
    time:'20–90 мин', description:'Окружайте территорию и сохраняйте свои камни.', load:() => import('../games/go/view.js')},
  {id:'chess', name:'Шахматы', aliases:'chess', category:'Стратегия', variant:'Классика', art:'♜', icons:['♞','♟'],
    time:'15–60 мин', description:'Развивайте фигуры и ищите путь к мату.', load:() => import('../games/chess/view.js')},
  {id:'checkers', name:'Шашки', aliases:'checkers draughts', category:'Стратегия', variant:'Русские шашки', art:'✦', icons:['●','✦'],
    time:'10–30 мин', description:'Стройте цепочки взятий и проводите шашки в дамки.', load:() => import('../games/checkers/view.js')},
  {id:'backgammon', name:'Нарды', aliases:'backgammon', category:'Стратегия', variant:'Короткие нарды', art:'⚅', icons:['⚂','⚄'],
    time:'15–40 мин', description:'Ведите шашки домой и используйте каждый бросок.', load:() => import('../games/backgammon/view.js')},
  {id:'shogi', name:'Сёги', aliases:'сеги shogi 将棋', category:'Стратегия', variant:'Япония', art:'将', icons:['王','歩'],
    time:'30–90 мин', description:'Возвращайте взятые фигуры на доску под своим флагом.', load:() => import('../games/shogi/view.js')},
];
