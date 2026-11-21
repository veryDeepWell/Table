const groups = [
  ['Teen',[6,6],[6,6]],['Day',[1,1],[1,1]],['Yun',[4,4],[4,4]],['Gor',[1,3],[1,3]],
  ['Mooy',[5,5],[5,5]],['Chong',[3,3],[3,3]],['Bon',[2,2],[2,2]],['Foo',[5,6],[5,6]],
  ['Ping',[4,6],[4,6]],['Tit',[1,6],[1,6]],['Look',[1,5],[1,5]],
  ['Chop Gow',[3,6],[4,5]],['Chop Bot',[2,6],[3,5]],['Chop Chit',[2,5],[3,4]],
  ['Chop Ng',[1,4],[2,3]],['Gee Jun',[1,2],[2,4]],
];
export const tiles = groups.flatMap(([name,...faces],group)=>faces.map(face=>({name,group,face,points:face[0]+face[1]})));
export const tileLabel = id => tiles[id].name+' '+tiles[id].face.join('·');
export function pairRank(ids) {
  const [a,b]=ids.map(id=>tiles[id]);
  if (a.group===b.group) return [4,a.group===15 ? 17 : 16-a.group,0];
  const royal=a.group<=1 ? a : b.group<=1 ? b : null;
  const other=royal===a ? b : a;
  if (royal && other.group!==15 && [9,8,7].includes(other.points)) {
    return [other.points===9 ? 3 : other.points===8 ? 2 : 1,2-royal.group,0];
  }
  const av=a.group===15 ? [3,6] : [a.points], bv=b.group===15 ? [3,6] : [b.points];
  const points=Math.max(...av.flatMap(x=>bv.map(y=>(x+y)%10)));
  return [0,points,Math.max(16-a.group,16-b.group)];
}
export function comparePair(a,b) {
  const first=pairRank(a),second=pairRank(b);
  for(let i=0;i<3;i++) if(first[i]!==second[i]) return Math.sign(first[i]-second[i]);
  return 0;
}
export function splitTiles(hand,index) {
  const choices=[[0,1],[0,2],[0,3]];
  const high=choices[index].map(i=>hand[i]),low=hand.filter((_,i)=>!choices[index].includes(i));
  return comparePair(high,low)>=0 ? {high,low} : {high:low,low:high};
}
export function pairName(ids) {
  const [category,value]=pairRank(ids);
  return category===4 ? 'Пара '+tiles[ids[0]].name : category===3 ? 'Wong' : category===2 ? 'Gong' : category===1 ? 'High Nine' : value+' очк.';
}
