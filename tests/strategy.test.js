import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG as C,BOSS_IDS} from '../js/config.js';
import {freshState,decode} from '../js/save.js';
import {getBoss,rewardFor} from '../js/bosses.js';
import {startCombat,stepCombat} from '../js/combat.js';
import {newUltimate,ultimateEffects,advanceUltimate,chargePercent,armorPercentage} from '../js/strategy.js';
import {Huge} from '../js/numbers.js';
import {encounter,milestone} from './helpers.js';
test('estilos persistentes, equilibrado neutro y snapshot de encuentro',()=>{
  const s=freshState(),f=startCombat(s,'attack');assert.equal(f.player.attack.format(),'12');s.style='aggressive';assert.equal(f.player.attack.format(),'12');s.pending=null;
  const a=startCombat(s,'attack');assert.ok(a.player.attack.log>f.player.attack.log);assert.ok(a.player.health.log<f.player.health.log);assert.equal(decode(JSON.stringify(s)).style,'aggressive');
});
test('hitos matemáticos infinitos, todos más fuertes y siguiente normal',()=>{
  const s=freshState();for(const id of BOSS_IDS){const n=C.milestones[id].interval,a=getBoss(s,id,n),normal=getBoss(s,id,n,{specials:false}),b=getBoss(s,id,n+1);
    assert.ok(a.special);assert.equal(b.special,false);assert.ok(a.health.log>normal.health.log&&a.attack.log>normal.attack.log&&a.defense.log>normal.defense.log);assert.deepEqual(b.ability,C.bosses[id].ability);
    assert.ok(getBoss(s,id,n*1000000).special);assert.ok(Number.isFinite(getBoss(s,id,n*1000000).health.log));
  }
});
test('primera victoria cobra hito una vez; repetición/recarga no duplica',()=>{
  const s=freshState();milestone(s,'attack',99);s.levels.attack=300;s.levels.health=300;
  const f=encounter(s);assert.ok(f.milestoneClaimed);assert.equal(s.items.attack.level,100);assert.deepEqual(s.milestones.attack.claimed,[100]);assert.equal(f.reward.log,rewardFor(f.boss,'progress').log);
  const saved=decode(JSON.stringify(s));const g=encounter(saved,'attack','repeat');assert.equal(g.milestoneClaimed,false);assert.equal(g.reward.log,g.boss.reward.mul(.8).log);assert.equal(saved.items.attack.level,100);
  const before=JSON.stringify(saved);stepCombat(saved,g);assert.equal(JSON.stringify(saved),before);
  const next=encounter(saved);assert.equal(next.boss.special,false);assert.deepEqual(saved.milestones.attack.claimed,[100]);
});
test('v2 anterior conserva oro/objetos, hitos pasados sin premios retroactivos',()=>{
  const s=freshState();milestone(s,'attack',100);delete s.rulesVersion;delete s.style;delete s.milestones;
  const migrated=decode(JSON.stringify(s));assert.equal(migrated.style,'balanced');assert.equal(migrated.milestones.attack.legacyThrough,100);assert.equal(migrated.gold.log,s.gold.log);assert.deepEqual(migrated.items,s.items);
});
test('AFK de hito: mismo coste base, 5% del premio, repetición 4%',()=>{
  const s=freshState();milestone(s,'attack',99);s.levels.attack=300;s.gold=Huge.of(1e20);s.afk.unlocked=true;
  const f=encounter(s,'attack','progress',true);assert.equal(f.reward.log,f.boss.reward.mul(2*.05).log);
  assert.equal(encounter(s,'attack','repeat',true).reward.log,f.boss.reward.mul(.8*.05).log);
});
test('resumen: armadura separada de resistencia, críticos y exceso de daño',()=>{
  const s=freshState(),f=startCombat(s,'defense');f.player.attack=Huge.of(100);f.boss.defense=Huge.of(20);f.bossHP=Huge.of(1000);f.boss.health=Huge.of(1000);f.boss.ability.resistance=.5;
  const e=stepCombat(s,f,()=>1);assert.ok(Math.abs(10**e.hit.log-40)<1e-8);assert.ok(Math.abs(armorPercentage(f.summary.enemyBlocked,f.summary.enemyRaw)-20)<1e-8);
  assert.equal(armorPercentage(f.summary.playerBlocked,f.summary.playerRaw),null);
  s.pending=null;const q=startCombat(s,'attack');q.bossHP=Huge.of(1);q.player.attack=Huge.of(100);stepCombat(s,q,()=>1);assert.ok(q.won);assert.ok(Math.abs(10**q.summary.dealt.log-1)<1e-8);
});
