import {CONFIG as C,BOSS_IDS} from './config.js';
import {stats,cost,buy,maxBuy} from './upgrades.js';
import {getBoss,rewardFor,unlockProgress} from './bosses.js';
import {startCombat,stepCombat,unlockAFK} from './combat.js';
import {freshState,load,save,decode,SAVE_KEY,LEGACY_KEY} from './save.js';
import {itemDescription} from './items.js';
import {packFight,diagnose} from './advice.js';
import {applyStyle,chargePercent,armorPercentage} from './strategy.js';
const $=id=>document.getElementById(id);
const pct=n=>(100*n).toLocaleString('es-ES',{maximumFractionDigits:1})+'%';
let state,saveBlocked=false,readOnly=false,fight=null,timer=null,toastTimer,mode='progress';
// A tab owns the save for its lifetime. Secondary tabs cannot race victories/writes.
if(navigator.locks){
  readOnly=!(await new Promise(resolve=>navigator.locks.request('cavernaburx-session',{ifAvailable:true},async lock=>{
    resolve(Boolean(lock));if(lock)await new Promise(()=>{});
  })));
}
try {const raw=readOnly&&(localStorage.getItem(SAVE_KEY)||localStorage.getItem(LEGACY_KEY));state=readOnly?(raw?decode(raw):freshState()):load();}
catch(e){state=freshState();saveBlocked=true;$('save-status').textContent='Guardado protegido. '+e.message;}
const busy=()=>Boolean(fight&&!fight.done);
const blocked=()=>readOnly||saveBlocked;
let adviceWorker=null,adviceId=0;
function cancelAdvice(){adviceId++;adviceWorker?.terminate();adviceWorker=null;$('combat-advice').hidden=true;}
function requestAdvice(encounter){
  cancelAdvice();const id=adviceId,diagnosis=diagnose(encounter);
  $('combat-advice').hidden=false;$('advice-diagnosis').textContent=diagnosis.title;$('advice-evidence').textContent=diagnosis.evidence;
  $('advice-recommendation').textContent='Comparando mejoras y estilos…';
  try{
    adviceWorker=new Worker(new URL('./advice-worker.js',import.meta.url),{type:'module'});
    adviceWorker.onmessage=({data})=>{if(id!==adviceId||fight!==encounter)return;$('advice-recommendation').textContent=data.result?.recommendation||data.error;adviceWorker?.terminate();adviceWorker=null;};
    adviceWorker.onerror=()=>{if(id!==adviceId)return;$('advice-recommendation').textContent='La comparación no está disponible. Este diagnóstico utiliza solo el combate observado.';adviceWorker?.terminate();adviceWorker=null;};
    adviceWorker.postMessage({id,fight:packFight(encounter)});
  }catch{$('advice-recommendation').textContent='Tu navegador no permite la comparación en segundo plano. El diagnóstico usa el combate observado.';}
}
function renderUltimate(){
  const style=fight?.style||state.style,c=C.ultimates[style],active=Boolean(fight&&!fight.done&&fight.ultimate.remaining>0),charge=fight?chargePercent(fight):0;
  $('ultimate-percent').textContent=Math.round(charge)+'%';$('ultimate-bar').style.width=charge+'%';$('ultimate-track').setAttribute('aria-valuenow',String(Math.round(charge)));
  $('ultimate-track').classList.toggle('ultimate-active',active);
  const bonus=style==='aggressive'?`+${Math.round(c.critPoints*100)} puntos de probabilidad crítica`:style==='defensive'?`${pct(1-1/(1+c.mitigationStrength))} menos daño recibido`:`+${Math.round((c.attack-1)*100)}% ataque · ${pct(1-1/(1+c.mitigationStrength))} menos daño recibido`;
  $('ultimate-state').textContent=c.name+(active?` · activa · ${fight.ultimate.remaining} acciones restantes`:` · carga en ${c.chargeAttacks} ataques`)+` · ${bonus}`;
  $('ultimate-hint').textContent=active?'Definitiva activa':'Definitiva automática';
}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4000);}
function persist(){if(blocked())return;try{save(state);$('save-status').textContent='Partida guardada · '+new Date().toLocaleTimeString('es-ES');}catch{saveBlocked=true;state.afk.active=false;clearTimeout(timer);$('save-status').textContent='No se pudo guardar. Exporta tu progreso antes de recargar.';toast('Guardado no disponible: partida en pausa. Exporta una copia.');}}
function tab(name){document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id===name));document.querySelectorAll('.nav').forEach(el=>el.classList.toggle('active',el.dataset.tab===name));}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));
document.querySelectorAll('[data-subtab]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.cavern-pane').forEach(el=>el.hidden=el.id!==b.dataset.subtab);document.querySelectorAll('[data-subtab]').forEach(el=>el.classList.toggle('selected',el===b));}));
function requirements(id){const {any,all,requirement:r}=unlockProgress(state,id);return r?`Uno inicial: ${Math.min(any,r.any)} / ${r.any} · Los tres: ${Math.min(all,r.all)} / ${r.all}`:'';}
function renderBosses(){
  $('boss-roster').innerHTML=BOSS_IDS.map(id=>{
    const c=C.bosses[id],p=state.bosses[id];
    const {any,all,requirement:r}=unlockProgress(state,id);
    const progress=r?Math.min(1,any/r.any,all/r.all):1;
    return `<button class="boss-choice ${state.selectedBoss===id?'chosen':''} ${p.unlocked?'':'locked'}" data-boss="${id}" aria-pressed="${state.selectedBoss===id}" ${busy()||state.afk.active||blocked()?'disabled':''}>
      <span class="boss-choice-top"><span class="rune">${c.rune}</span><span>${p.unlocked?'DISPONIBLE':'BLOQUEADO'}</span></span>
      <strong>${C.caverns[id]}</strong>
      <span class="boss-choice-level">Nivel <b>${p.next}</b> · ${c.label}</span></button>`;
  }).join('');
}
function render(){
  const base=stats(state),p=applyStyle(base,state.style),id=state.selectedBoss,progress=state.bosses[id];
  const boss=fight?.boss||getBoss(state,id);
  $('gold').textContent=state.gold.format();
  $('highest').textContent=Math.max(...BOSS_IDS.map(key=>state.bosses[key].highest));
  $('power').textContent=p.attack.mul(10).add(p.health).add(p.defense.mul(10)).format();
  $('item-count').textContent=`${Object.keys(state.items).length}/6`;
  $('speed').value=state.speed;$('boss-rune').textContent=boss.rune;
  $('boss-level').textContent=`${C.caverns[id].toUpperCase()} · NIVEL ${boss.level}${boss.special?' · HITO ESPECIAL':''}`;
  $('boss-name').textContent=boss.name;$('boss-wins').textContent=boss.description;
  $('encounter-type').textContent=busy()?'COMBATE EN CURSO':fight?.done?'RESULTADO DEL ENCUENTRO':progress.unlocked?'SIGUIENTE DESAFÍO':'GUARDIÁN BLOQUEADO';
  const ps=fight?.player||p,ph=fight?.playerHP||p.health,bh=fight?.bossHP||boss.health;
  $('player-hp').textContent=`${ph.format()} / ${ps.health.format()}`;$('boss-hp').textContent=`${bh.format()} / ${boss.health.format()}`;
  $('player-bar').style.width=`${100*ph.ratio(ps.health)}%`;$('boss-bar').style.width=`${100*bh.ratio(boss.health)}%`;
  $('player-stats').innerHTML=`<span>ATQ <b>${ps.attack.format()}</b></span><span>DEF <b>${ps.defense.format()}</b></span><span>CRÍT <b>${pct(ps.criticalChance)}</b></span>`;
  $('boss-stats').innerHTML=`<span>ATQ <b>${boss.attack.format()}</b></span><span>DEF <b>${boss.defense.format()}</b></span>`;
  $('fight').disabled=blocked()||busy()||state.afk.active||!progress.unlocked;
  $('repeat').disabled=blocked()||busy()||state.afk.active||!progress.unlocked||!progress.highest;
  $('fight').textContent=`DESAFIAR · Nv. ${progress.next}`;$('repeat').textContent=`REPETIR · ${progress.highest?'Nv. '+progress.highest:'sin victorias'}`;
  const next=getBoss(state,id),last=progress.highest?getBoss(state,id,progress.highest):null;
  $('reward-preview').textContent=progress.unlocked?`Desafío: +${rewardFor(next,'progress').format()} oro y +1 nivel de reliquia · Repetición: ${last?'+'+rewardFor(last,'repeat').format()+' oro':'—'}, sin niveles ni XP`:'Requisitos: '+requirements(id);
  $('boss-item').textContent=`Superado ${progress.highest} · ${boss.item} · ${state.items[id]?'Nv. '+state.items[id].level+' · '+itemDescription(state,id):'Se obtiene al vencer el nivel 1'}`;
  for(const key of ['style','combat-style']){$(key).value=state.style;$(key).disabled=busy()||state.afk.active||blocked();}
  $('style-description').textContent=C.styles[state.style].description;
  $('character-stats').innerHTML=Object.entries(C.upgrades).map(([key,c])=>`<span>${c.name}<strong>${p[key].format()}</strong></span>`).join('');
  renderUltimate();
  if(!fight?.done||fight.won)$('combat-advice').hidden=true;
  $('special-detail').hidden=!boss.special;
  $('special-detail').textContent=boss.special?`Hito especial · ${C.milestones[id].description} · Oro ×${C.milestones[id].gold} solo en primera victoria.`:'';
  $('unlock-detail').hidden=progress.unlocked;$('unlock-detail').textContent=requirements(id);
  $('special-stats').innerHTML=`<span>Crítico <strong>${pct(p.criticalChance)}</strong></span><span>Daño crítico <strong>${pct(p.criticalDamage)}</strong></span><span>Penetración <strong>${pct(p.penetration)}</strong></span><span>Robo de vida <strong>${pct(p.vampirism)}</strong></span><p>Mejoras de oro: solo Ataque, Vida y Defensa. Las reliquias mejoran al superar nuevos niveles.</p>`;
  renderBosses();renderUpgrades(base);renderInventory();renderAFK();renderSummary();
  $('migration-notice').hidden=!state.migration&&!blocked();
  $('migration-notice').textContent=readOnly?'Esta partida ya está abierta en otra pestaña. Cierra aquella y recarga aquí para jugar.':saveBlocked?'Partida en pausa: revisa Partida y copias de seguridad. El guardado original no se sobrescribe.':state.migration?'Partida antigua migrada. Oro, mejoras y poder conservados; victorias agrupadas por especialización. Copia original disponible en Partida.':'';
  $('export-legacy').hidden=!state.migration&&!saveBlocked;
  $('import').disabled=readOnly;
}
function renderUpgrades(p){
  $('upgrade-list').innerHTML=Object.entries(C.upgrades).map(([key,c])=>`<article class="panel upgrade-card"><div class="upgrade-icon">${c.icon}</div><div><h2>${c.name} <small>NV. ${state.levels[key]}</small></h2><div class="upgrade-value">${p[key].format()}</div><small>+15% base por nivel</small></div><div class="upgrade-buttons">${[1,10,'max'].map(n=>{const count=n==='max'?maxBuy(state,key):n;return `<button data-buy="${key}" data-count="${n}" ${blocked()||!count||!state.gold.gte(cost(state,key,count))?'disabled':''}>${n==='max'?`Máx. (${count})`:`+${n}`}<br><small>${count?cost(state,key,count).format():'—'} oro</small></button>`;}).join('')}</div></article>`).join('');
}
function renderSummary(){
  const f=fight;$('combat-summary').hidden=!f?.done;if(!f?.done)return;
  const s=f.summary,percent=(b,r)=>{const n=armorPercentage(b,r);return n===null?'Sin ataques':n.toLocaleString('es-ES',{maximumFractionDigits:1})+'%';};
  $('combat-summary').innerHTML=`<span>Daño infligido <b>${s.dealt.format()}</b></span><span>Daño recibido <b>${s.received.format()}</b></span><span>Turnos (acciones) <b>${f.turn}</b></span><span>Bloqueado por armadura enemiga <b>${percent(s.enemyBlocked,s.enemyRaw)}</b></span><span>Bloqueado por tu armadura <b>${percent(s.playerBlocked,s.playerRaw)}</b></span><span>Definitivas <b>${f.ultimate.activations}</b></span>`;
}
function renderInventory(){
  $('inventory-list').innerHTML=BOSS_IDS.map(id=>{const c=C.bosses[id],i=state.items[id];return `<article class="panel item-card ${i?'':'unowned'}"><span class="rune">${c.rune}</span><div class="eyebrow">${c.label.toUpperCase()} · ${i?'NIVEL '+i.level:'SIN OBTENER'}</div><h3>${c.item}</h3><p class="bonus">${i?itemDescription(state,id):'Vence su primer nivel'}</p><p>${i?'Próxima mejora: vencer nivel '+state.bosses[id].next:'Una única reliquia permanente'}</p></article>`;}).join('');
  $('legacy-stats').hidden=!state.migration;
  $('legacy-stats').textContent=state.migration?'Legado de v1 conservado como multiplicador fijo adicional de Ataque, Vida y Defensa. No crea objetos nuevos ni crece al repetir.':'';
}
function renderAFK(){
  const id=state.afk.active?state.afk.bossId:state.selectedBoss,p=state.bosses[id];
  const autoMode=state.afk.active?state.afk.mode:$('afk-mode').value;
  const b=getBoss(state,id,autoMode==='repeat'&&p.highest?p.highest:p.next);
  $('afk-target').textContent=`${b.label} · nivel ${b.level} · +${rewardFor(b,autoMode,true).format()} oro / coste ${b.reward.mul(C.afk.feeRate).format()}`;
  $('afk-mode').disabled=state.afk.active||busy()||blocked();
  $('afk-toggle').textContent=!state.afk.unlocked?`Desbloquear · ${C.afk.unlock} oro`:state.afk.active?'Detener expedición':'Iniciar expedición';
  $('afk-toggle').disabled=blocked()||(!state.afk.active&&(busy()||!p.unlocked||(!state.afk.unlocked&&state.gold.log<Math.log10(C.afk.unlock))));
  $('afk-status').textContent=state.afk.active?`Activo · ${state.afk.mode==='repeat'?'repetición':'desafío'} · ${b.label} nivel ${b.level}`:state.afk.unlocked?'Preparado para descender.':'La expedición está bloqueada.';
}
function animate(id,cls){const el=$(id);el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);}
function begin(automatic=false,requestedMode='progress'){
  if(blocked()||busy())return;
  cancelAdvice();
  mode=automatic?state.afk.mode:requestedMode;
  if(automatic)state.selectedBoss=state.afk.bossId;
  fight=startCombat(state,state.selectedBoss,mode,automatic);
  if(!fight){if(automatic)state.afk.active=false;toast('No se puede iniciar: revisa desbloqueo, victorias u oro.');persist();render();return;}
  $('result').textContent=`${fight.boss.label} · nivel ${fight.boss.level} · ${mode==='repeat'?'repetición':'desafío'}`;
  $('battle-log').textContent='';$('player-hit').textContent='PREPARADO';$('boss-hit').textContent='EN GUARDIA';
  persist();render();if(!blocked())schedule();
}
function schedule(){clearTimeout(timer);timer=setTimeout(tick,650/state.speed);}
function tick(){
  if(!fight||fight.done||blocked())return;
  const e=stepCombat(state,fight);if(!e)return;
  const text=`${e.playerTurn?'Tú':'Boss'}: ${e.critical?'¡crítico! ':''}−${e.hit.format()}${e.healed.log>-Infinity?' · cura '+e.healed.format():''}`;
  $(e.playerTurn?'boss-hit':'player-hit').textContent=`−${e.hit.format()}${e.critical?' CRÍTICO':''}`;
  animate(e.playerTurn?'boss-fighter':'player-fighter','hit');fight.log.unshift(text);fight.log.length=Math.min(3,fight.log.length);$('battle-log').textContent=fight.log.join(' / ');
  if(fight.done){
    $('result').textContent=fight.won?`Victoria · +${fight.reward.format()} oro${fight.milestoneClaimed?' · Premio de hito cobrado':''}${fight.item?' · '+fight.boss.item+' sube a nivel '+fight.item.level:'. Repetición: sin mejora de reliquia.'}`:fight.timeout?'Combate agotado. Necesitas más poder para superar su resistencia.':'Derrota. Conservas tu progreso; mejora o repite un nivel superado.';
    if(fight.won)animate('combat','won');
    if(fight.unlocked?.length)toast('Guardián desbloqueado: '+fight.unlocked.map(id=>C.bosses[id].label).join(', '));
    if(fight.automatic&&!fight.won)toast(state.afk.active?'AFK pasa a repetir este mismo guardián.':'AFK detenido: no hay repetición disponible o has perdido en repetición.');
    persist();render();if(!fight.won)requestAdvice(fight);if(state.afk.active&&!blocked())timer=setTimeout(()=>begin(true),C.afk.delay);
  }else{renderCombatOnly();renderUltimate();schedule();}
}
function renderCombatOnly(){const f=fight;$('player-hp').textContent=`${f.playerHP.format()} / ${f.player.health.format()}`;$('boss-hp').textContent=`${f.bossHP.format()} / ${f.boss.health.format()}`;$('player-bar').style.width=`${100*f.playerHP.ratio(f.player.health)}%`;$('boss-bar').style.width=`${100*f.bossHP.ratio(f.boss.health)}%`;}
$('boss-roster').addEventListener('click',e=>{const b=e.target.closest('[data-boss]');if(!b||busy()||state.afk.active||blocked())return;state.selectedBoss=b.dataset.boss;fight=null;cancelAdvice();persist();render();});
$('fight').addEventListener('click',()=>begin(false,'progress'));
$('repeat').addEventListener('click',()=>begin(false,'repeat'));
$('speed').addEventListener('change',()=>{state.speed=Number($('speed').value);persist();});
for(const key of ['style','combat-style'])$(key).addEventListener('change',()=>{if(busy()||state.afk.active||blocked())return;state.style=$(key).value;fight=null;cancelAdvice();persist();render();});
$('upgrade-list').addEventListener('click',e=>{const b=e.target.closest('[data-buy]');if(!b||blocked())return;if(buy(state,b.dataset.buy,b.dataset.count==='max'?'max':Number(b.dataset.count))){persist();render();toast('Mejora permanente adquirida.');}});
$('afk-mode').addEventListener('change',renderAFK);
$('afk-toggle').addEventListener('click',()=>{
  if(blocked())return;
  if(!state.afk.unlocked){if(unlockAFK(state))toast('Expedición desbloqueada.');}
  else if(state.afk.active){state.afk.active=false;if(!busy())clearTimeout(timer);}
  else if(!busy()){state.afk.active=true;state.afk.bossId=state.selectedBoss;state.afk.mode=$('afk-mode').value;clearTimeout(timer);begin(true);}
  persist();render();
});
function download(raw,name){const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').addEventListener('click',()=>download(JSON.stringify(state,null,2),'cavernaburx-v2.json'));
$('export-legacy').addEventListener('click',()=>{const raw=state.migration?.source||localStorage.getItem(SAVE_KEY)||localStorage.getItem(LEGACY_KEY);if(raw)download(raw,'cavernaburx-original.json');});
$('import').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file||readOnly)return;
  try{
    if(file.size>20*1024*1024)throw Error('El archivo supera 20 MB.');
    const next=decode(await file.text());
    if(!confirm('¿Reemplazar la partida por esta copia validada?'+(next.migration?' Se conservará el original v1.':'')))return;
    // Retain the replaced local save before committing the import.
    const previous=localStorage.getItem(SAVE_KEY);if(previous)localStorage.setItem('cavernaburx.before-import',previous);
    clearTimeout(timer);next.pending=null;state=next;fight=null;saveBlocked=false;persist();render();toast('Partida importada.');
    if(state.afk.active&&!blocked())timer=setTimeout(()=>begin(true),C.afk.delay);
  }catch(error){toast('No se pudo importar: '+error.message);}finally{e.target.value='';}
});
// Fallback protection where Web Locks is unavailable: suspend stale tabs.
window.addEventListener('storage',e=>{if(e.key===SAVE_KEY&&!readOnly){readOnly=true;clearTimeout(timer);render();}});
window.addEventListener('pagehide',persist);
render();if(!blocked()){persist();if(state.afk.active)timer=setTimeout(()=>begin(true),C.afk.delay);}
const settingsLink=document.createElement('button');settingsLink.className='text-btn';settingsLink.textContent='Partida y copias ↗';settingsLink.addEventListener('click',()=>tab('settings'));document.querySelector('footer').append(settingsLink);
