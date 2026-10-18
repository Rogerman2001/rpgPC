import {CONFIG as C} from './config.js';
import {Huge} from './numbers.js';
import {cost} from './upgrades.js';
import {createEncounter,stepCombat} from './combat.js';
import {newSummary,armorPercentage} from './strategy.js';

const statKeys=['attack','health','defense'];
const percent=n=>(n*100).toLocaleString('es-ES',{maximumFractionDigits:1})+'%';
export function packFight(f){return JSON.parse(JSON.stringify(f));}
export function unpackFight(raw){
  const f=structuredClone(raw);
  for(const group of ['basePlayer','player','boss'])for(const key of statKeys)f[group][key]=Huge.read(f[group][key]);
  f.boss.reward=Huge.read(f.boss.reward);f.playerHP=Huge.read(f.playerHP);f.bossHP=Huge.read(f.bossHP);
  for(const [key,value] of Object.entries(newSummary()))if(value instanceof Huge)f.summary[key]=Huge.read(f.summary[key]);
  f.startingGold=Huge.read(f.startingGold??null);return f;
}
export function diagnose(f){
  const s=f.summary,remaining=f.bossHP.ratio(f.boss.health),armor=armorPercentage(s.enemyBlocked,s.enemyRaw)||0;
  const healRatio=s.enemyHealing.ratio(s.dealt);
  if(remaining<=.1)return {code:'close',title:'Derrota ajustada',evidence:`Al boss le quedaba ${percent(remaining)} de vida. Un ajuste pequeño podría bastar.`};
  if(s.enemyHealing.log>-Infinity&&healRatio>=.55)return {code:'healing',title:'La curación compensa tu daño',evidence:`El boss recuperó ${percent(healRatio)} del daño que le infligiste. Necesitas más daño sostenido.`};
  if(s.playerAttacks<=3)return {code:'survival',title:'Supervivencia insuficiente',evidence:`Solo pudiste atacar ${s.playerAttacks} ${s.playerAttacks===1?'vez':'veces'}. ${f.ultimate.activations?'Tu definitiva llegó a activarse.':'No llegaste a aprovechar tu definitiva.'}`};
  if(armor>=60)return {code:'armor',title:'Su armadura frena tu daño',evidence:`Su armadura evitó el ${armor.toLocaleString('es-ES',{maximumFractionDigits:1})}% del daño bruto. No incluye su resistencia.`};
  if(f.timeout||s.playerAttacks>=10)return {code:'damage',title:'Daño efectivo insuficiente',evidence:`Tras ${s.playerAttacks} ataques le quedaba ${percent(remaining)} de vida.`};
  return {code:'pressure',title:'El intercambio favoreció al boss',evidence:`Infligiste ${s.dealt.format()} y recibiste ${s.received.format()} de daño; el boss conserva ${percent(remaining)} de vida.`};
}
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function analyzeDefeat(raw,{maxMillis=1500,seeds=C.analysis.seeds}={}){
  const f=unpackFight(raw),diagnosis=diagnose(f),start=performance.now();
  if(!f.done||f.won)return {diagnosis:null,recommendation:'',scenarios:[]};
  const count=C.analysis.upgradeCount;
  const variants=[{id:'baseline',label:'Sin cambios',style:f.style,price:new Huge()},
    ...statKeys.map(key=>({id:key,key,label:`+${count} mejoras de ${C.upgrades[key].name.toLowerCase()}`,style:f.style,price:cost({levels:f.upgradeLevels},key,count)})),
    ...Object.keys(C.styles).filter(style=>style!==f.style).map(style=>({id:style,label:`estilo ${C.styles[style].name}`,style,price:new Huge()}))];
  for(const v of variants){v.wins=0;v.remaining=0;v.turns=0;v.runs=0;}
  // Paired seeds, complete batches: every scenario receives the same sample count.
  for(let seed=0;seed<seeds;seed++){
    if(seed>0&&performance.now()-start>maxMillis)break;
    for(const v of variants){
      const base={...f.basePlayer};if(v.key)base[v.key]=base[v.key].mul(C.upgrades[v.key].growth**count);
      const trial=createEncounter(base,f.boss,v.style);
      const random=rng(8927+seed*997);
      while(!trial.done&&trial.turn<C.analysis.maxActions)stepCombat(null,trial,random);
      v.runs++;v.wins+=Number(trial.won);v.remaining+=trial.bossHP.ratio(trial.boss.health);v.turns+=trial.turn;
    }
  }
  const baseline=variants[0];
  const candidates=variants.slice(1).filter(v=>v.runs>=6&&(v.wins>baseline.wins||v.remaining/v.runs<baseline.remaining/baseline.runs-.08));
  candidates.sort((a,b)=>(b.wins-a.wins)||(a.remaining/a.runs-b.remaining/b.runs)||(a.price.log-b.price.log));
  // If effectiveness is comparable (one victory), prefer a free/affordable change.
  const best=candidates[0];
  const affordable=best&&candidates.filter(v=>v.wins>=best.wins-1&&v.remaining/v.runs<=best.remaining/best.runs+.05&&f.startingGold.gte(v.price)).sort((a,b)=>a.price.log-b.price.log)[0];
  const chosen=affordable||best;
  const recommendation=chosen?`Prueba ${chosen.label}${chosen.price.log===-Infinity?' (sin coste)':` (coste: ${chosen.price.format()} oro${f.startingGold.gte(chosen.price)?'':'; requiere ahorrar'})`}. En escenarios hipotéticos ganó ${chosen.wins}/${chosen.runs}, frente a ${baseline.wins}/${baseline.runs} sin cambios. ${chosen.wins===0?'No bastó para ganar, pero dejó menos vida al boss. ':''}No garantiza la victoria.`:
    `No se ha encontrado una mejora pequeña con evidencia suficiente. ${f.hasVictory?'Repite un nivel superado para reunir oro':'Prueba otro guardián inicial para conseguir oro'} y vuelve a evaluar; ninguna opción probada garantiza vencer.`;
  return {diagnosis,recommendation,chosen:chosen?.id||null,runs:baseline.runs,elapsedMs:performance.now()-start,
    scenarios:variants.map(v=>({id:v.id,label:v.label,runs:v.runs,wins:v.wins,meanBossRemaining:v.remaining/v.runs,meanTurns:v.turns/v.runs,cost:v.price.format()}))};
}
