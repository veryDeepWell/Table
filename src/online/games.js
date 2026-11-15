export const networkGames = ['go','chess','checkers','backgammon','shogi','dots','connect-four','mahjong',
  'reversi','gomoku','kalah','battleship','domino','xiangqi','old-maid','eights','hearts','durak','thousand','holdem','janggi','hnefatafl'];

const sides = {
  go:['Чёрные','Белые'], chess:['Белые','Чёрные'], checkers:['Белые','Чёрные'],
  backgammon:['Белые','Чёрные'], shogi:['Чёрные','Белые'],
  dots:['Красные','Синие'], 'connect-four':['Красные','Жёлтые'],
  reversi:['Чёрные','Белые'], gomoku:['Чёрные','Белые'],
  xiangqi:['Красные','Чёрные'], janggi:['Синие','Красные'],
  hnefatafl:['Защитники','Нападающие'], mahjong:['Восток','Юг','Запад','Север'],
};
const largeTables = {domino:4,eights:4,hearts:4,holdem:4,thousand:3,'old-maid':4};
export const seatLabels = game => sides[game] || Array.from({length:largeTables[game] || 2},(_,index) => 'Место ' + (index + 1));
