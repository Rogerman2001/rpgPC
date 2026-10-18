import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG as C} from '../js/config.js';
import {Huge} from '../js/numbers.js';
import {freshState,decode} from '../js/save.js';
import {createEncounter,startCombat,stepCombat} from '../js/combat.js';
import {newUltimate,ultimateEffects,advanceUltimate,chargePercent} from '../js/strategy.js';
import {packFight,diagnose,analyzeDefeat} from '../js/advice.js';
import {encounter,milestone} from './helpers.js';
test('tres definitivas: carga, activación única, pausa, seis acciones y reinicio',()=>{
  for(const style of Object.keys(C.styles)){
    const f={style,ultimate:newUltimate(),bossHP:Huge.of(10),playerHP:Huge.of(10)};
    for(let i=1;i<=3;i++){assert.equal(advanceUltimate(f,true,false),i===3);assert.ok(Math.abs(chargePercent(f)-(i===3?0:i/3*100))<1e-10);}
    assert.equal(f.ultimate.activations,1);assert.equal(f.ultimate.remaining,6);
    for(let i=0;i<6;i++)advanceUltimate(f,i%2===1,true);
    assert.equal(f.ultimate.remaining,0);assert.equal(f.ultimate.charge,0);assert.equal(f.ultimate.activeAttacks,3);assert.equal(f.ultimate.activeResponses,3);
    assert.equal(newUltimate().activations,0);
  }
});
test('efectos exactos, ofensiva no aumenta daño crítico, defensa nunca invulnerable',()=>{
  const s=freshState();for(const style of Object.keys(C.styles)){
    s.pending=null;s.style=style;const f=startCombat(s,'attack');f.ultimate.remaining=6;
    const e=ultimateEffects(f);assert.equal(f.player.criticalDamage,1.75);
    if(style==='aggressive'){assert.equal(e.criticalChance,.47);assert.equal(e.attack,1);assert.equal(e.damageTaken,1);}
    if(style==='defensive'){assert.equal(e.criticalChance,.12);assert.equal(e.attack,1);assert.equal(e.damageTaken,1/1.5);}
    if(style==='balanced'){assert.equal(e.attack,1.12);assert.equal(e.damageTaken,1/1.2);}
    f.player.criticalChance=.99;assert.ok(ultimateEffects(f).criticalChance<=1);assert.ok(e.damageTaken>0);
    f.ultimate.remaining=0;assert.equal(ultimateEffects(f).damageTaken,1);
  }
});
test('fin de combate limpia carga y duración, guarda estilo sin guardar efectos',()=>{
  const s=freshState();s.style='defensive';const f=startCombat(s,'attack');f.ultimate.remaining=6;f.ultimate.charge=2;f.player.attack=Huge.of(1e10);stepCombat(s,f,()=>.5);
  assert.ok(f.won);assert.equal(f.ultimate.remaining,0);assert.equal(f.ultimate.charge,0);assert.equal(chargePercent(f),0);
  const restored=decode(JSON.stringify(s)),next=startCombat(restored,'attack');assert.equal(next.ultimate.remaining,0);assert.equal(next.ultimate.charge,0);assert.equal(restored.style,'defensive');
});
test('telemetría de daño/curación/critico y mitigación definitiva se separa de armadura',()=>{
  const s=freshState();s.style='defensive';const f=startCombat(s,'attack');f.turn=1;f.ultimate.remaining=6;f.player.defense=Huge.of(20);f.playerHP=Huge.of(1000);f.boss.attack=Huge.of(100);
  const e=stepCombat(s,f,()=>1);assert.ok(Math.abs(10**e.hit.log-80/1.5)<1e-8);assert.ok(Math.abs(10**f.summary.playerBlocked.log-20)<1e-8);assert.ok(Math.abs(10**f.summary.ultimatePrevented.log-(80-80/1.5))<1e-8);
});
test('diagnósticos diferenciados usan datos observados y priorizan regeneración',()=>{
  const s=freshState(),f=startCombat(s,'health');f.done=true;f.won=false;f.summary.playerAttacks=2;f.summary.dealt=Huge.of(100);f.summary.enemyHealing=Huge.of(80);
  assert.equal(diagnose(f).code,'healing');f.summary.enemyHealing=new Huge();assert.equal(diagnose(f).code,'survival');
  f.summary.playerAttacks=20;f.summary.enemyRaw=Huge.of(1000);f.summary.enemyBlocked=Huge.of(750);assert.equal(diagnose(f).code,'armor');
  f.summary.enemyBlocked=new Huge();assert.equal(diagnose(f).code,'damage');f.bossHP=f.boss.health.mul(.05);assert.equal(diagnose(f).code,'close');
});
test('contrafactual reutiliza motor sin tocar partida ni otorgar oro/reliquias',()=>{
  const s=freshState();milestone(s,'attack',12);const f=encounter(s);assert.equal(f.won,false);const before=JSON.stringify(s),packed=packFight(f),snapshot=JSON.stringify(packed);
  const advice=analyzeDefeat(packed,{maxMillis:10000});assert.equal(advice.runs,12);assert.equal(advice.scenarios.length,6);assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(packed),snapshot);
  for(const result of advice.scenarios){assert.ok(result.wins>=0&&result.wins<=12);assert.ok(result.meanBossRemaining>=0&&result.meanBossRemaining<=1);}
  assert.ok(advice.recommendation.includes('garantiza'));assert.ok(advice.elapsedMs<5000);
});
