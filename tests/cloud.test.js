import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState} from '../js/save.js';
import {Huge} from '../js/numbers.js';
import {encodeCloud,decodeCloud,totalPower,validateName} from '../js/cloud-data.js';
import {CloudSync,readBackup,backupKey,startupChoice} from '../js/cloud-sync.js';
import {playerStatistics,bossStatistics} from '../js/combat-statistics.js';
import {getBoss} from '../js/bosses.js';
import {startCombat} from '../js/combat.js';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};
function setup(write){return new CloudSync({uid:'a',revision:'9007199254740993',state:freshState(),storage:storage(),write,delay:100000});}
test('cloud envelope preserves huge logarithms, legacy and future fields without coercion',()=>{
 const s=freshState();s.gold=new Huge(123456789.12345679);s.future={inventory:['new'],counter:'123456789012345678901234'};
 const round=decodeCloud(encodeCloud(s));assert.equal(JSON.stringify(round),JSON.stringify(s));
 assert.throws(()=>decodeCloud({format:2}));assert.throws(()=>decodeCloud({format:1,numeric_encoding:'log10-binary64-v1',payload:'{}'}));
});
test('v2 refuses unsafe counters; future BigInt counters must travel as strings',()=>{
 const s=freshState();s.levels.attack=Number.MAX_SAFE_INTEGER;
 assert.equal(decodeCloud(encodeCloud(s)).levels.attack,9007199254740991);
 s.levels.attack=9007199254740992;assert.throws(()=>encodeCloud(s));
 s.levels.attack='9007199254740993';assert.throws(()=>encodeCloud(s));
 // A larger SQL limit alone would silently lose this increment in JavaScript.
 assert.equal(9007199254740992+1,9007199254740992);
 const exact=BigInt('9'.repeat(256));
 assert.equal(BigInt(JSON.parse(JSON.stringify({level:exact.toString()})).level)+1n,10n**256n);
 // Log-space binary64 is approximate too, even when it avoids Infinity.
 assert.equal(new Huge(1e20).mul(1.15).log,1e20);
});
test('power uses existing style and permanent relics; names reject reserved/case/whitespace',()=>{
 const s=freshState();assert.ok(Math.abs(totalPower(s).log-Math.log10(260))<1e-12);
 for(const n of ['Admin','ADMIN','Support','ab','a b','<script>',' name','name '])assert.equal(validateName(n),false);
 assert.equal(validateName('BURX_Master12'),true);
});
test('serialized saves retain edits made while a write is pending and string revisions',async()=>{
 let release;const calls=[];const c=setup(async(data,revision,uid)=>{calls.push({data,revision,uid});if(calls.length===1)await new Promise(r=>release=r);return {revision:(BigInt(revision)+1n).toString()};});
 try{const s=freshState();c.queue(s);const pending=c.flush();await Promise.resolve();s.levels.attack++;c.queue(s);release();assert.equal(await pending,true);assert.equal(calls.length,2);assert.equal(calls[1].revision,'9007199254740994');assert.equal(c.revision,'9007199254740995');assert.equal(readBackup(c.storage,'a').pending,false);}finally{c.stop();}
});
test('network failure retains backup, retry confirms it; conflict never overwrites automatically',async()=>{
 let fail=true;const c=setup(async()=>{if(fail)throw Error('offline');return {revision:'22'};});
 try{c.queue(freshState());assert.equal(await c.flush(),false);assert.equal(readBackup(c.storage,'a').pending,true);fail=false;assert.equal(await c.flush(),true);
 c.write=async()=>{throw Object.assign(Error('conflict'),{code:'40001'});};c.queue(freshState());assert.equal(await c.flush(),false);assert.ok(c.conflict);assert.ok(c.latest);}finally{c.stop();}
});
test('late response after account change does not mark another account saved',async()=>{
 let release;const c=setup(()=>new Promise(r=>release=r));c.queue(freshState());const promise=c.flush();await Promise.resolve();c.stop();release({revision:'50'});assert.equal(await promise,false);assert.equal(c.revision,'9007199254740993');assert.equal(readBackup(c.storage,'a').pending,true);assert.equal(readBackup(c.storage,'b'),null);assert.throws(()=>c.queue(freshState()));
 c.storage.setItem(backupKey('b'),c.storage.getItem(backupKey('a')));assert.throws(()=>readBackup(c.storage,'b'));
});
test('combat statistics describe real abilities and update ultimate values without changing state',()=>{
 const s=freshState(),before=JSON.stringify(s);assert.equal(bossStatistics(getBoss(s,'attack')).length,2);
 assert.ok(bossStatistics(getBoss(s,'health')).some(r=>r[0]==='Regeneración'&&r[1].includes('por acción propia')));
 for(const [id,label] of [['critical','Prob. crítica'],['penetration','Penetración'],['vampirism','Robo de vida']])assert.ok(bossStatistics(getBoss(s,id,1)).some(r=>r[0]===label));
 assert.equal(JSON.stringify(s),before);s.style='aggressive';const f=startCombat(s,'attack');assert.equal(playerStatistics(f.player).length,4);f.ultimate.remaining=6;
 assert.equal(playerStatistics(f.player,f).find(r=>r[0]==='Prob. crítica')[1],'47%');assert.equal(f.player.criticalChance,.12);
 f.player.penetration=.2;f.player.vampirism=.1;assert.equal(playerStatistics(f.player).length,6);
});

test('A/B/I official cloud wins over old confirmed backups; old backup schema remains readable',()=>{
 const store=storage(),state=freshState(),data=encodeCloud(state);
 store.setItem(backupKey('a'),JSON.stringify({uid:'a',revision:'1',pending:false,data}));
 const local=readBackup(store,'a');assert.equal(JSON.stringify(local.state),JSON.stringify(state));
 assert.equal(startupChoice({revision:'30',data},local),'cloud');
 assert.equal(startupChoice({revision:'30',data},null),'cloud');
 assert.equal(startupChoice(null,local),'import');
});
test('C/D/E/F/H pending changes survive outage; reconnect reads revision before writing',async()=>{
 let revision='1',offline=true,writes=0,reads=0;
 const store=storage(),s=freshState();
 const c=new CloudSync({uid:'a',revision,state:s,storage:store,delay:100000,
 read:async()=>{reads++;if(offline)throw Error('offline');return {revision,data:encodeCloud(s)};},
 write:async()=>{writes++;return {revision:String(++revision)};}});
 try{
  s.levels.attack=5;c.queue(s);assert.equal(await c.flush(),false);assert.equal(writes,0);
  assert.equal(readBackup(store,'a').state.levels.attack,5);assert.ok(readBackup(store,'a').pending);
  offline=false;assert.equal(await c.flush(),true);assert.equal(writes,1);assert.equal(reads,2);
  revision='3';s.levels.attack=6;c.queue(s);assert.equal(await c.flush(),false);assert.ok(c.conflict);assert.equal(writes,1);
  assert.equal(readBackup(store,'a').state.levels.attack,6);assert.ok(readBackup(store,'a').pending);
  assert.equal(startupChoice({revision:'3'},readBackup(store,'a')),'conflict');
 }finally{c.stop();}
});
test('G foreign backup owner is rejected and never selected',()=>{
 const store=storage();store.setItem(backupKey('b'),JSON.stringify({uid:'a',revision:'1',pending:true,data:encodeCloud(freshState())}));
 assert.throws(()=>readBackup(store,'b'));
});
test('pending backup resumes only on its exact base revision',()=>{
 assert.equal(startupChoice({revision:'9007199254740993'},{revision:'9007199254740993',pending:true}),'resume');
 assert.equal(startupChoice({revision:'9007199254740994'},{revision:'9007199254740993',pending:true}),'conflict');
});

test('a late revision check does not mistake our own confirmed write for a foreign device',async()=>{
 let release;const c=new CloudSync({uid:'a',revision:'1',state:freshState(),storage:storage(),write:async()=>({revision:'2'}),read:()=>new Promise(r=>release=r)});
 try{const checking=c.check();c.revision='2';release({revision:'1',data:encodeCloud(freshState())});assert.equal(await checking,true);assert.equal(c.conflict,false);}finally{c.stop();}
});
