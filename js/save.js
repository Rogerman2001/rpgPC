import {CONFIG as C,BOSS_IDS,INITIAL_IDS} from './config.js';
import {Huge} from './numbers.js';
import {checkUnlocks} from './bosses.js';
export const SAVE_KEY='cavernaburx.save.v2';
export const LEGACY_KEY='cavernaburx.save.v1';
const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
const validGold=n=>n===null||(typeof n==='number'&&Number.isFinite(n));
export function freshState(){
  return {version:C.version,gold:Huge.of(C.initialGold),levels:{attack:0,health:0,defense:0},
    bosses:Object.fromEntries(BOSS_IDS.map(id=>[id,{highest:0,next:1,unlocked:INITIAL_IDS.includes(id),wins:0,repeats:0}])),
    items:{},selectedBoss:'attack',afk:{unlocked:false,active:false,mode:'progress',bossId:'attack'},
    speed:1,combatSeq:0,pending:null,legacyBonuses:{attack:0,health:0,defense:0},migration:null,
    rulesVersion:1,style:'balanced',milestones:Object.fromEntries(BOSS_IDS.map(id=>[id,{legacyThrough:0,claimed:[]}]))};
}
function validateCommon(s){
  if(!s||!validGold(s.gold)||!s.levels||!Object.keys(C.upgrades).every(k=>integer(s.levels[k])))throw Error('Recursos o mejoras no válidos.');
  if(!s.afk||typeof s.afk.unlocked!=='boolean'||typeof s.afk.active!=='boolean'||!['progress','repeat'].includes(s.afk.mode))throw Error('AFK no válido.');
}
function migrateV1(old,raw){
  validateCommon(old);
  if(!integer(old.highest)||old.highest>1000000||!Array.isArray(old.items)||old.items.length!==old.highest||!old.wins||Object.keys(old.wins).length!==old.highest)throw Error('No se puede migrar un historial incompleto. El original se conserva.');
  const s=freshState(),seen=new Set(),oldBonus={attack:0,health:0,defense:0};
  const correspondence=['attack','health','defense','attack','health','defense'];
  for(const i of old.items){
    if(!integer(i.boss,1)||i.boss>old.highest||seen.has(i.boss)||i.family!==(i.boss-1)%6||!integer(i.level,1)||!Number.isFinite(i.xp)||i.xp<0||!integer(old.wins[i.boss],1))throw Error('Reliquia antigua sin correspondencia fiable.');
    seen.add(i.boss);const id=correspondence[i.family];
    s.bosses[id].highest++;s.bosses[id].wins+=old.wins[i.boss];
    oldBonus[id]+=Math.log10(1+.025*i.level);
  }
  for(const id of INITIAL_IDS){
    const p=s.bosses[id];p.next=p.highest+1;p.repeats=p.wins-p.highest;
    if(p.highest)s.items[id]={level:p.highest};
    s.legacyBonuses[id]=Math.max(0,oldBonus[id]-Math.log10(1+C.items.statPerLevel*p.highest));
  }
  s.gold=old.gold;s.levels={...old.levels};s.speed=old.speed;s.afk.unlocked=old.afk.unlocked;
  s.migration={from:1,source:raw,note:'Partida v1 migrada: victorias agrupadas por Ataque/Vida/Defensa. Oro y mejoras conservados. El legado mantiene las bonificaciones anteriores. AFK en pausa.'};
  for(const id of BOSS_IDS)s.milestones[id].legacyThrough=s.bosses[id].highest;
  checkUnlocks(s);return s;
}
export function decode(raw){
  let s=JSON.parse(raw);
  if(s?.version===1)s=migrateV1(s,raw);
  if(s?.version!==C.version)throw Error('Versión de partida no compatible.');
  validateCommon(s);
  if(!s.bosses||Object.keys(s.bosses).length!==6||!s.items||Array.isArray(s.items)||Object.keys(s.items).some(id=>!BOSS_IDS.includes(id)))throw Error('Se requieren exactamente seis bosses.');
  for(const id of BOSS_IDS){
    const p=s.bosses[id],item=s.items[id];
    if(!p||!integer(p.highest)||!integer(p.next,1)||p.next!==p.highest+1||typeof p.unlocked!=='boolean'||!integer(p.wins)||!integer(p.repeats)||p.wins!==p.highest+p.repeats)throw Error('Progreso de boss no válido.');
    if(p.highest&&(!p.unlocked||!item||item.level!==p.highest))throw Error('Boss y reliquia no coinciden.');
    if(!p.highest&&item)throw Error('Reliquia sin primera victoria.');
    if(INITIAL_IDS.includes(id)&&!p.unlocked)throw Error('Boss inicial bloqueado.');
  }
  if(s.rulesVersion===undefined){
    if(s.style!==undefined||s.milestones!==undefined)throw Error('Extensión de guardado incompleta.');
    s.rulesVersion=1;s.style='balanced';s.milestones=Object.fromEntries(BOSS_IDS.map(id=>[id,{legacyThrough:s.bosses[id].highest,claimed:[]}])) ;
  }
  if(s.rulesVersion!==1||!Object.hasOwn(C.styles,s.style)||!s.milestones||Object.keys(s.milestones).length!==6)throw Error('Estrategia o hitos no válidos.');
  for(const id of BOSS_IDS){const m=s.milestones[id];
    if(!m||!integer(m.legacyThrough)||m.legacyThrough>s.bosses[id].highest||!Array.isArray(m.claimed)||m.claimed.some((n,i)=>!integer(n,1)||n<=m.legacyThrough||n>s.bosses[id].highest||(i>0&&n<=m.claimed[i-1])))throw Error('Historial de hitos no válido.');
  }
  if(!BOSS_IDS.includes(s.selectedBoss)||!BOSS_IDS.includes(s.afk.bossId)||!integer(s.combatSeq))throw Error('Selección o secuencia no válida.');
  if(s.afk.active&&(!s.afk.unlocked||!s.bosses[s.afk.bossId].unlocked))throw Error('Expedición no válida.');
  if(!s.legacyBonuses||!INITIAL_IDS.every(id=>typeof s.legacyBonuses[id]==='number'&&Number.isFinite(s.legacyBonuses[id])&&s.legacyBonuses[id]>=0))throw Error('Legado no válido.');
  if(s.migration!==null&&(!s.migration||s.migration.from!==1||typeof s.migration.source!=='string'))throw Error('Copia de migración no válida.');
  if(s.pending!==null){const p=s.pending;if(!p||p.token!==s.combatSeq||!BOSS_IDS.includes(p.id)||!['progress','repeat'].includes(p.mode)||typeof p.automatic!=='boolean'||p.level!==s.bosses[p.id][p.mode==='repeat'?'highest':'next'])throw Error('Combate pendiente no válido.');}
  s.gold=Huge.read(s.gold);s.speed=[1,2,4].includes(s.speed)?s.speed:1;checkUnlocks(s);return s;
}
export function save(state,storage=localStorage){storage.setItem(SAVE_KEY,JSON.stringify(state));}
export function load(storage=localStorage){
  const current=storage.getItem(SAVE_KEY),old=storage.getItem(LEGACY_KEY);
  const s=current?decode(current):old?decode(old):freshState();
  s.pending=null;
  if(!current&&old)save(s,storage);
  return s;
}
