import {freshState,decode} from '../js/save.js';
import {startCombat,stepCombat} from '../js/combat.js';
import {checkUnlocks} from '../js/bosses.js';
export function seedRandom(seed=1234){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function encounter(state,id='attack',mode='progress',automatic=false,rng=()=>.5){
  const f=startCombat(state,id,mode,automatic);
  if(!f)return null;
  while(!f.done) {if(!stepCombat(state,f,rng))throw Error('Encounter interrupted');}
  return f;
}
export function milestone(state,id,highest){
  state.bosses[id]={highest,next:highest+1,unlocked:true,wins:highest,repeats:0};
  if(highest)state.items[id]={level:highest};else delete state.items[id];
  checkUnlocks(state);return state;
}
export function clone(state){return decode(JSON.stringify(state));}
export function veteran(level=100){const s=freshState();for(const id of ['attack','health','defense'])milestone(s,id,level);return s;}
