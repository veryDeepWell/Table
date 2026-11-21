export const sabaccValue = card => card<30 ? card%10+1 : card<60 ? -(card%10+1) : 0;
export function sabaccRank(hand) {
  const values=hand.map(sabaccValue),sum=values.reduce((a,b)=>a+b,0);
  const special=hand.length===3 && values.includes(0) && values.includes(10) && values.includes(-10);
  return [special ? 2 : sum===0 ? 1 : 0,-Math.abs(sum),sum>=0 ? 1 : 0,hand.length,sum===0 ? values.reduce((a,b)=>a+Math.abs(b),0) : 0];
}
