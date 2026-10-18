import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG as C,BOSS_IDS} from '../js/config.js';
import {Huge,scaled} from '../js/numbers.js';
import {freshState,save,load,decode,SAVE_KEY,LEGACY_KEY} from '../js/save.js';
import {buy,cost,maxBuy,stats} from '../js/upgrades.js';
import {startCombat,stepCombat,damage,unlockAFK} from '../js/combat.js';
import {getBoss,checkUnlocks,rewardFor} from '../js/bosses.js';
import {encounter,milestone,clone,veteran} from './helpers.js';
test('exactamente seis bosses y tres disponibles desde el inicio',()=>{const s=freshState();assert.equal(Object.keys(s.bosses).length,6);assert.equal(Object.values(s.bosses).filter(p=>p.unlocked).length,3);assert.equal(startCombat(s,'critical'),null);assert.equal(startCombat(s,'attack','repeat'),null);});
test('progreso independiente, una reliquia por boss y victoria idempotente',()=>{
  const s=freshState(),f=encounter(s);assert.ok(f.won);assert.equal(s.bosses.attack.highest,1);assert.equal(s.bosses.defense.highest,0);assert.equal(s.items.attack.level,1);
  const before=JSON.stringify(s);assert.equal(stepCombat(s,f),null);assert.equal(JSON.stringify(s),before);
  s.levels.attack=100;for(let i=0;i<20;i++)assert.ok(encounter(s).won);
  assert.equal(Object.keys(s.items).length,1);assert.equal(s.items.attack.level,21);assert.equal(s.selectedBoss,'attack');
});
test('repetir solo último nivel: dificultad constante, 80% oro, sin objetos ni desbloqueos',()=>{
  const s=freshState();encounter(s);const oldItems=JSON.stringify(s.items),boss=getBoss(s,'attack',1);
  for(let i=0;i<10;i++){const f=encounter(s,'attack','repeat');assert.ok(f.won);assert.equal(f.boss.level,1);assert.equal(f.boss.health.log,boss.health.log);assert.equal(f.reward.log,rewardFor(boss,'repeat').log);}
  assert.equal(s.bosses.attack.highest,1);assert.equal(s.bosses.attack.repeats,10);assert.equal(JSON.stringify(s.items),oldItems);
});
test('desbloqueos exigen ambos umbrales derrotados y son permanentes',()=>{
  for(const id of ['critical','penetration','vampirism']){const s=freshState(),r=C.bosses[id].unlock;
    milestone(s,'attack',r.any-1);milestone(s,'defense',r.all);milestone(s,'health',r.all);assert.equal(s.bosses[id].unlocked,false);
    milestone(s,'attack',r.any);assert.equal(s.bosses[id].unlocked,true);
    s.bosses.attack.highest=0;checkUnlocks(s);assert.equal(s.bosses[id].unlocked,true);
    const t=freshState();milestone(t,'attack',r.any);milestone(t,'defense',r.all);milestone(t,'health',r.all-1);assert.equal(t.bosses[id].unlocked,false);
  }
});
test('mejoras ×1, ×10 y máximo; grandes magnitudes',()=>{
  const s=freshState();assert.ok(buy(s,'attack',1));assert.equal(buy(s,'health',10),false);s.gold=Huge.of(100000);
  const n=maxBuy(s,'health');assert.ok(s.gold.gte(cost(s,'health',n)));assert.ok(!s.gold.gte(cost(s,'health',n+1)));assert.ok(buy(s,'health','max'));assert.equal(maxBuy(s,'health'),0);
  s.gold=scaled(12,1.26,1000000);assert.ok(buy(s,'attack','max'));assert.ok(Number.isFinite(stats(s).attack.log));
});
test('críticos de ambos lados, resistencia y penetración afectan daño real',()=>{
  const s=freshState();s.bosses.critical.unlocked=true;const f=startCombat(s,'critical');
  const normal=damage(Huge.of(100),Huge.of(80));const pierced=damage(Huge.of(100),Huge.of(80),.65);
  assert.ok(pierced.log>normal.log);assert.ok(damage(Huge.of(100),Huge.of(80),0,.15).log<normal.log);
  const hit=stepCombat(s,f,()=>0);assert.ok(hit.critical);assert.ok(stepCombat(s,f,()=>0).critical);
});
test('regeneración, robo de vida y límites de salud funcionan por turnos',()=>{
  const s=freshState(),f=startCombat(s,'health');stepCombat(s,f,()=>1);const hp=f.bossHP.log;
  const e=stepCombat(s,f,()=>1);assert.ok(e.healed.log>-Infinity);assert.ok(f.bossHP.log>hp);assert.ok(f.bossHP.log<=f.boss.health.log);
  const t=freshState();t.bosses.vampirism.unlocked=true;const v=startCombat(t,'vampirism');v.player.attack=v.boss.health.mul(.1);v.player.health=v.boss.attack.mul(100);v.playerHP=v.player.health;
  stepCombat(t,v,()=>1);const eh=stepCombat(t,v,()=>1);assert.ok(eh.healed.log>-Infinity);
  const u=freshState();u.items.vampirism={level:20};const q=startCombat(u,'health');q.playerHP=q.player.health.mul(.5);const heal=stepCombat(u,q,()=>1);assert.ok(heal.healed.log>-Infinity);assert.ok(q.playerHP.log<=q.player.health.log);
});
test('recompensas avanzadas moderadas, rendimientos decrecientes sin tope de nivel',()=>{
  const s=freshState();s.items.penetration={level:100};s.items.vampirism={level:100};s.items.critical={level:100};
  const a=stats(s);assert.ok(a.penetration<.5);assert.ok(a.vampirism<.4);assert.equal(a.criticalChance,.12);assert.equal(a.criticalDamage,4.25);
  s.items.vampirism.level=1000000000;assert.ok(stats(s).vampirism<1);assert.ok(stats(s).vampirism>a.vampirism);
  const boss=getBoss(s,'vampirism',1000000);assert.ok(Number.isFinite(boss.health.log));
});
test('AFK coste, victoria, caída al mismo boss y repetición sin niveles',()=>{
  const s=freshState();s.gold=Huge.of(1000);assert.ok(unlockAFK(s));s.afk.active=true;
  const f=encounter(s,'attack','progress',true);assert.ok(f.won);assert.ok(Math.abs(10**s.gold.log-(800-.14+1.4))<1e-8);
  milestone(s,'attack',15);const before=s.items.attack.level;s.afk.mode='progress';
  assert.equal(encounter(s,'attack','progress',true).won,false);assert.equal(s.afk.mode,'repeat');assert.equal(s.afk.active,true);
  assert.equal(encounter(s,'attack','repeat',true).won,false);assert.equal(s.afk.active,false);assert.equal(s.items.attack.level,before);
});
test('guardado v2, recarga parcial, rechazo de duplicados y datos corruptos',()=>{
  const s=freshState(),map=new Map(),storage={setItem:(k,v)=>map.set(k,v),getItem:k=>map.get(k)||null};
  const f=startCombat(s,'attack');assert.equal(startCombat(s,'attack'),null);save(s,storage);const loaded=load(storage);
  assert.equal(loaded.pending,null);assert.equal(loaded.gold.log,s.gold.log);assert.equal(stepCombat(loaded,f),null);
  assert.equal(JSON.stringify(clone(loaded)),JSON.stringify(loaded));
  const broken=clone(loaded);broken.items.attack={level:1};assert.throws(()=>decode(JSON.stringify(broken)));
});
test('migración v1 preserva oro, mejoras, poder y original sin crear objetos avanzados',()=>{
  const old={version:1,gold:4,levels:{attack:12,health:8,defense:4},highest:7,wins:{1:2,2:1,3:1,4:1,5:1,6:1,7:1},items:Array.from({length:7},(_,i)=>({boss:i+1,family:i%6,level:i===0?2:1,xp:i===0?10:0})),afk:{unlocked:true,active:true,mode:'progress'},speed:4};
  const raw=JSON.stringify(old),map=new Map([[LEGACY_KEY,raw]]),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
  const s=load(storage);assert.equal(s.bosses.attack.highest,3);assert.equal(s.bosses.health.highest,2);assert.equal(s.bosses.defense.highest,2);assert.equal(Object.keys(s.items).length,3);assert.equal(s.gold.log,4);assert.equal(s.afk.active,false);assert.equal(s.migration.source,raw);assert.equal(map.get(LEGACY_KEY),raw);
  const expected=scaled(12,1.15,12).mul(1.05).mul(1.025).mul(1.025);assert.ok(Math.abs(stats(s).attack.log-expected.log)<1e-10);
  assert.equal(JSON.stringify(load(storage)),JSON.stringify(s));assert.ok(map.has(SAVE_KEY));
  old.items.pop();assert.throws(()=>decode(JSON.stringify(old)));
});
