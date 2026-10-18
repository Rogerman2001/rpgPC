import { CONFIG as C } from './config.js';
import { Huge,scaled } from './numbers.js';
import { bonusLog,specialStats } from './items.js';
export function stats(state) {
  return {...Object.fromEntries(Object.entries(C.upgrades).map(([key,c])=>[key,new Huge(scaled(c.base,c.growth,state.levels[key]).log+bonusLog(state,key))])),...specialStats(state)};
}
export function cost(state,key,count=1) {
  const c=C.upgrades[key], first=scaled(c.cost,c.costGrowth,state.levels[key]);
  if(count===1) return first;
  const x=count*Math.log(c.costGrowth);
  const logSum=(x>700 ? x : Math.log(Math.expm1(x)))-Math.log(c.costGrowth-1);
  return new Huge(first.log+logSum/Math.LN10);
}
export function maxBuy(state,key) {
  const c=C.upgrades[key], delta=state.gold.log-cost(state,key).log+Math.log10(c.costGrowth-1);
  let n=Math.floor((delta>15 ? delta*Math.LN10 : Math.log1p(10**delta))/Math.log(c.costGrowth));
  n=Math.max(0,Math.min(n,Number.MAX_SAFE_INTEGER-state.levels[key]));
  if(n>0&&!state.gold.gte(cost(state,key,n))) n--;
  return n;
}
export function buy(state,key,count) {
  if(!C.upgrades[key]) return false;
  const n=count==='max'?maxBuy(state,key):count;
  if(!Number.isSafeInteger(n)||n<1||!Number.isSafeInteger(state.levels[key]+n)) return false;
  const price=cost(state,key,n); if(!state.gold.gte(price)) return false;
  state.gold=state.gold.sub(price);state.levels[key]+=n;return true;
}
