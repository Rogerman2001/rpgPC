import {CONFIG as C,INITIAL_IDS,BOSS_IDS} from './config.js';
import {scaled} from './numbers.js';
export function unlockProgress(state,id) {
  const requirement=C.bosses[id].unlock;
  const levels=INITIAL_IDS.map(key=>state.bosses[key].highest);
  return {any:Math.max(...levels),all:Math.min(...levels),requirement};
}
export function checkUnlocks(state) {
  const unlocked=[];
  for(const id of BOSS_IDS){
    const {any,all,requirement}=unlockProgress(state,id);
    if(!state.bosses[id].unlocked&&(!requirement||(any>=requirement.any&&all>=requirement.all))){
      state.bosses[id].unlocked=true;unlocked.push(id);
    }
  }
  return unlocked;
}
export function getBoss(state,id,level=state.bosses[id].next,{specials=true}={}) {
  const c=C.bosses[id];
  if(!c||!Number.isSafeInteger(level)||level<1)throw Error('Nivel de boss no válido.');
  const stat=key=>scaled(c.base[key],C.bossScaling.anchorGrowth,c.anchor-1).times(scaled(1,c.growth[key],level-1));
  const special=specials&&C.milestones.enabled&&level%C.milestones[id].interval===0;
  const m=C.milestones[id];
  return {...c,level,special,ability:{...c.ability,...(special?m.ability:{})},
    health:stat('health').mul(special?m.health:1),attack:stat('attack').mul(special?m.attack:1),defense:stat('defense').mul(special?m.defense:1),
    reward:scaled(c.rewardBase,C.economy.anchorRewardGrowth,c.anchor-1).times(scaled(1,c.rewardGrowth,level-1))};
}
export function rewardFor(boss,mode,automatic=false,specialEligible=true) {
  return boss.reward.mul((mode==='repeat'?C.economy.repeatRate:1)*(automatic?C.afk.rewardRate:1)*(boss.special&&mode==='progress'&&specialEligible?C.milestones[boss.id].gold:1));
}
