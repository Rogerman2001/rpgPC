import {CONFIG as C} from './config.js';
import {Huge} from './numbers.js';
import {stats} from './upgrades.js';
import {getBoss,rewardFor,checkUnlocks} from './bosses.js';
import {awardItem} from './items.js';
import {applyStyle,newUltimate,ultimateEffects,advanceUltimate,newSummary} from './strategy.js';
export function damage(attack,defense,penetration=0,resistance=0) {
  const floor=attack.mul(C.combat.minimumDamage),d=attack.sub(defense.mul(1-penetration));
  return (d.gte(floor)?d:floor).mul(1-resistance);
}
function min(a,b){return a.log<b.log?a:b;}
export function createEncounter(basePlayer,boss,style='balanced',options={}){
  const player=applyStyle(basePlayer,style);
  return {boss,basePlayer:{...basePlayer},player,style,playerHP:player.health,bossHP:boss.health,
    turn:0,done:false,log:[],ultimate:newUltimate(),summary:newSummary(),...options};
}
export function startCombat(state,id,mode='progress',automatic=false) {
  const progress=state.bosses[id];
  if(state.pending||!progress?.unlocked||!['progress','repeat'].includes(mode))return null;
  if(mode==='repeat'&&!progress.highest)return null;
  const level=mode==='repeat'?progress.highest:progress.next;
  if(!Number.isSafeInteger(level+1)||!Number.isSafeInteger(state.combatSeq+1))return null;
  const boss=getBoss(state,id,level),fee=boss.reward.mul(C.afk.feeRate);
  if(automatic){if(!state.afk.unlocked||!state.gold.gte(fee))return null;state.gold=state.gold.sub(fee);}
  const token=++state.combatSeq;state.pending={token,id,level,mode,automatic};
  return createEncounter(stats(state),boss,state.style,{token,automatic,mode,upgradeLevels:{...state.levels},startingGold:state.gold,hasVictory:Object.values(state.bosses).some(b=>b.highest>0)});
}
function finish(state,fight,won){
  if(!state){fight.done=true;fight.won=won;fight.ultimate.remaining=0;fight.ultimate.charge=0;return;}
  if(state.pending?.token!==fight.token||state.pending.id!==fight.boss.id)return;
  fight.done=true;fight.won=won;state.pending=null;fight.ultimate.remaining=0;fight.ultimate.charge=0;
  if(won){
    const progress=state.bosses[fight.boss.id];
    if(fight.mode==='progress'&&progress.next!==fight.boss.level)return;
    const m=state.milestones[fight.boss.id];
    const eligible=fight.mode==='progress'&&fight.boss.special&&fight.boss.level>m.legacyThrough&&!m.claimed.includes(fight.boss.level);
    fight.reward=rewardFor(fight.boss,fight.mode,fight.automatic,eligible);
    fight.milestoneClaimed=eligible;
    if(eligible)m.claimed.push(fight.boss.level);
    state.gold=state.gold.add(fight.reward);progress.wins++;
    if(fight.mode==='progress'){
      progress.highest=fight.boss.level;progress.next=progress.highest+1;
      fight.item=awardItem(state,fight.boss.id);fight.unlocked=checkUnlocks(state);
    }else progress.repeats++;
  }
  if(fight.automatic&&!won){
    if(fight.mode==='progress'&&state.bosses[fight.boss.id].highest)state.afk.mode='repeat';
    else state.afk.active=false;
  }
}
export function stepCombat(state,fight,rng=Math.random) {
  if(fight.done||(state&&state.pending?.token!==fight.token))return null;
  const playerTurn=fight.turn%2===0,a={...fight.boss.ability};
  const effects=ultimateEffects(fight);
  const critical=rng()<(playerTurn?effects.criticalChance:(a.criticalChance||0));
  const crit=playerTurn?fight.player.criticalDamage:(a.criticalDamage||1);
  const enraged=!playerTurn&&a.enrageEvery&&(Math.floor(fight.turn/2)+1)%a.enrageEvery===0;
  const attack=playerTurn?fight.player.attack.mul(effects.attack):fight.boss.attack.mul(enraged?a.enrageMultiplier:1);
  const defense=playerTurn?fight.boss.defense:fight.player.defense;
  const penetration=playerTurn?fight.player.penetration:(a.penetration||0);
  const raw=attack.mul(critical?crit:1);
  const afterArmor=damage(attack,defense,penetration).mul(critical?crit:1);
  const hit=afterArmor.mul(playerTurn?(1-(a.resistance||0)):effects.damageTaken);
  const actual=min(hit,playerTurn?fight.bossHP:fight.playerHP);
  const armorBlocked=raw.sub(afterArmor),summary=fight.summary;
  if(playerTurn){summary.dealt=summary.dealt.add(actual);summary.enemyRaw=summary.enemyRaw.add(raw);summary.enemyBlocked=summary.enemyBlocked.add(armorBlocked);}
  else{summary.received=summary.received.add(actual);summary.playerRaw=summary.playerRaw.add(raw);summary.playerBlocked=summary.playerBlocked.add(armorBlocked);}
  if(playerTurn){summary.playerAttacks++;summary.playerCrits+=Number(critical);summary.expectedCrits+=effects.criticalChance;summary.enemyResisted=summary.enemyResisted.add(afterArmor.sub(hit));if(effects.active)summary.ultimateDamage=summary.ultimateDamage.add(actual);}
  else{summary.enemyAttacks++;summary.enemyCrits+=Number(critical);summary.ultimatePrevented=summary.ultimatePrevented.add(afterArmor.sub(hit));}
  let healed=new Huge(),potentialHeal=new Huge(),missingBeforeHeal=new Huge();
  if(playerTurn){
    fight.bossHP=fight.bossHP.sub(hit);
    healed=min(fight.player.health.sub(fight.playerHP),actual.mul(fight.player.vampirism));
    fight.playerHP=fight.playerHP.add(healed);
  }else{
    fight.playerHP=fight.playerHP.sub(hit);
    potentialHeal=actual.mul(a.vampirism||0).add(fight.boss.health.mul(a.regeneration||0));
    missingBeforeHeal=fight.boss.health.sub(fight.bossHP);
    healed=min(missingBeforeHeal,potentialHeal);
    fight.bossHP=fight.bossHP.add(healed);
  }
  if(playerTurn)summary.playerHealing=summary.playerHealing.add(healed);else summary.enemyHealing=summary.enemyHealing.add(healed);
  const event={playerTurn,critical,hit:actual,healed,raw,afterArmor};
  event.ultimateActivated=advanceUltimate(fight,playerTurn,effects.active);
  fight.turn++;
  if(fight.bossHP.log===-Infinity||fight.playerHP.log===-Infinity)finish(state,fight,fight.bossHP.log===-Infinity);
  if(fight.turn>=C.combat.maxTurns&&!fight.done){fight.timeout=true;finish(state,fight,false);}
  return event;
}
export function unlockAFK(state){const price=Huge.of(C.afk.unlock);if(state.afk.unlocked||!state.gold.gte(price))return false;state.gold=state.gold.sub(price);state.afk.unlocked=true;return true;}
