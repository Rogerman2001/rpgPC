import {ultimateEffects} from './strategy.js';
const percent=n=>(100*n).toLocaleString('es-ES',{maximumFractionDigits:1})+'%';
export function playerStatistics(player,fight=null){
  const e=fight&&!fight.done?ultimateEffects(fight):{attack:1,criticalChance:player.criticalChance,active:false};
  const rows=[['Ataque',player.attack.mul(e.attack).format()],['Defensa',player.defense.format()],['Prob. crítica',percent(e.criticalChance)],['Daño crítico',percent(player.criticalDamage)]];
  if(player.penetration)rows.push(['Penetración',percent(player.penetration)]);
  if(player.vampirism)rows.push(['Robo de vida',percent(player.vampirism)]);
  if(e.active)rows.push(['Valores efectivos','Definitiva activa']);
  return rows;
}
export function bossStatistics(boss){
  const a=boss.ability,rows=[['Ataque',boss.attack.format()],['Defensa',boss.defense.format()]];
  if(a.regeneration)rows.push(['Regeneración',percent(a.regeneration)+' por acción propia']);
  if(a.criticalChance)rows.push(['Prob. crítica',percent(a.criticalChance)],['Daño crítico',percent(a.criticalDamage)]);
  if(a.penetration)rows.push(['Penetración',percent(a.penetration)]);
  if(a.vampirism)rows.push(['Robo de vida',percent(a.vampirism)]);
  if(a.resistance)rows.push(['Resistencia',percent(a.resistance)]);
  if(a.enrageEvery)rows.push(['Furia',`×${a.enrageMultiplier} cada ${a.enrageEvery} ataques`]);
  return rows;
}
