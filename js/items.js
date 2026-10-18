import {CONFIG as C} from './config.js';
export function awardItem(state,id) {
  state.items[id]={level:state.bosses[id].highest};
  return state.items[id];
}
export function bonusLog(state,stat) {
  return Math.log10(1+C.items.statPerLevel*(state.items[stat]?.level||0))+(state.legacyBonuses?.[stat]||0);
}
export function specialStats(state) {
  const penetration=C.items.penetrationPerLevel*(state.items.penetration?.level||0);
  const vampirism=C.items.vampirismPerLevel*(state.items.vampirism?.level||0);
  return {criticalChance:C.criticalChance,
    criticalDamage:C.criticalDamage+C.items.criticalPerLevel*(state.items.critical?.level||0),
    penetration:penetration/(1+penetration),vampirism:vampirism/(1+vampirism)};
}
export function itemDescription(state,id) {
  const level=state.items[id]?.level||0;
  const percent=n=>(n*100).toLocaleString('es-ES',{maximumFractionDigits:2})+'%';
  if(id in C.upgrades)return `+${percent(C.items.statPerLevel*level)} ${C.upgrades[id].name.toLowerCase()}`;
  if(id==='critical')return `+${(C.items.criticalPerLevel*level*100).toLocaleString('es-ES')} puntos de daño crítico`;
  return `${percent(specialStats(state)[id])} ${id==='penetration'?'defensa ignorada':'robo de vida'}`;
}
