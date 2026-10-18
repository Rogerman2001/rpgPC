import {CONFIG as C} from './config.js';
import {Huge} from './numbers.js';
export function applyStyle(player,style='balanced') {
  const c=C.styles[style]||C.styles.balanced;
  return {...player,attack:player.attack.mul(c.attack),health:player.health.mul(c.health),defense:player.defense.mul(c.defense)};
}
export function newUltimate(){return {charge:0,remaining:0,activations:0,activeAttacks:0,activeResponses:0};}
export function ultimateEffects(f){
  const c=C.ultimates[f.style],active=C.ultimates.enabled&&f.ultimate.remaining>0;
  return {active,attack:active?c.attack:1,
    criticalChance:Math.min(1,Math.max(0,f.player.criticalChance*(active?1+c.critRelative:1)+(active?c.critPoints:0))),
    damageTaken:active?1/(1+c.mitigationStrength):1};
}
// Six subsequent actions = three enemy responses and three protagonist attacks.
// Charge pauses while active; the triggering attack itself is not empowered.
export function advanceUltimate(f,playerTurn,wasActive){
  const u=f.ultimate;if(!C.ultimates.enabled)return false;
  if(wasActive){u.remaining--;if(playerTurn)u.activeAttacks++;else u.activeResponses++;return false;}
  if(!playerTurn||f.bossHP.log===-Infinity||f.playerHP.log===-Infinity)return false;
  u.charge++;
  if(u.charge<C.ultimates[f.style].chargeAttacks)return false;
  u.charge=0;u.remaining=C.ultimates.durationActions;u.activations++;return true;
}
export function chargePercent(f){return f.done?0:Math.min(100,100*f.ultimate.charge/C.ultimates[f.style].chargeAttacks);}
export function newSummary(){return {dealt:new Huge(),received:new Huge(),enemyRaw:new Huge(),enemyBlocked:new Huge(),playerRaw:new Huge(),playerBlocked:new Huge(),enemyHealing:new Huge(),playerHealing:new Huge(),ultimatePrevented:new Huge(),enemyResisted:new Huge(),playerAttacks:0,enemyAttacks:0,playerCrits:0,enemyCrits:0,expectedCrits:0,ultimateDamage:new Huge()};}
export function armorPercentage(blocked,raw){return raw.log===-Infinity?null:100*blocked.ratio(raw);}
