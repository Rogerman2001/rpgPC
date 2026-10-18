import './account-settings.js';
import {createClient} from '@supabase/supabase-js';
import {freshState,decode,SAVE_KEY,LEGACY_KEY} from './save.js';
import {decodeCloud,validateName,describeSave} from './cloud-data.js';
import {CloudSync,readBackup,backupKey,protectCopy,startupChoice} from './cloud-sync.js';
import {setAccount} from './account-context.js';
import {Huge} from './numbers.js';
const $=id=>document.getElementById(id),gate=$('account-gate'),game=document.querySelector('.shell');
let client,currentUid=null,sync=null,entering=false,offset=0,releaseLock=null,rankingRequest=0;
const status=text=>{$('account-message').textContent=text;};
function download(raw,name){const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function hideGame(){game.hidden=true;gate.hidden=false;sync?.stop();document.dispatchEvent(new Event('account-ended'));setAccount(null);}
async function rpc(name,args){const {data,error}=await client.rpc(name,args).abortSignal(AbortSignal.timeout(15000));if(error)throw error;return data;}
async function choose(title,description,choices){
  $('decision-title').textContent=title;$('decision-description').textContent=description;
  $('decision-buttons').replaceChildren();$('account-decision').hidden=false;
  return new Promise(resolve=>{for(const [label,value] of choices){const b=document.createElement('button');b.textContent=label;b.className='secondary';b.onclick=()=>{$('account-decision').hidden=true;resolve(value);};$('decision-buttons').append(b);}});
}
async function profile(){
  const {data,error}=await client.from('player_profiles').select('username').eq('user_id',currentUid).maybeSingle();if(error)throw error;if(data)return data.username;
  $('profile-form').hidden=false;status('Elige tu identidad pública para continuar.');
  return new Promise(resolve=>{$('profile-form').onsubmit=async e=>{
    e.preventDefault();const name=$('username').value;if(!validateName(name))return;
    $('confirm-name').disabled=true;
    try{const result=await rpc('register_player',{p_username:name,p_owner:currentUid});$('profile-form').hidden=true;resolve(result);}
    catch(error){status(error.code==='23505'?'Ese nombre ya está ocupado. Elige otro.':'No se pudo registrar el nombre. Revisa la conexión y vuelve a intentarlo.');}
    finally{$('confirm-name').disabled=false;}
  };});
}
function candidate(raw){return raw?decode(raw):null;}
async function enter(){
  if(entering)return;entering=true;status('Comprobando sesión…');
  try{
    const {data:session,error:sessionError}=await client.auth.getSession();if(sessionError)throw sessionError;
    if(!session.session){status(new URLSearchParams(location.search).has('error')?'El acceso fue cancelado o rechazado. Puedes volver a intentarlo.':'Inicia sesión para recuperar tu progreso.');return;}
    const {data,error}=await client.auth.getUser();if(error)throw error;
    if(!data.user?.app_metadata?.providers?.includes('google'))throw Error('Esta cuenta debe acceder mediante Google.');
    currentUid=data.user.id;$('google-login').hidden=true;$('gate-logout').hidden=false;
    if(!navigator.locks)throw Error('Este navegador no permite bloquear sesiones simultáneas. Usa una versión reciente de Chrome, Edge, Firefox o Safari.');
    const locked=await new Promise(resolve=>navigator.locks.request('cavernaburx-account-'+currentUid,{ifAvailable:true},async lock=>{resolve(!!lock);if(lock)await new Promise(done=>{releaseLock=done;});}));
    if(!locked)throw Error('Esta cuenta está abierta en otra pestaña. Ciérrala y vuelve a entrar.');
    const username=await profile();status('Recuperando tu partida…');
    const remote=await rpc('read_player_save'); // A failed read NEVER means no saved game.
    const cloud=remote?decodeCloud(remote.data):null;
    if(remote){$('cloud-export').hidden=false;$('cloud-export').onclick=()=>download(JSON.stringify({uid:currentUid,...remote}),'cavernaburx-copia-nube.json');}
    const scopedRaw=localStorage.getItem(backupKey(currentUid));
    if(scopedRaw){$('migration-export').hidden=false;$('migration-export').onclick=()=>download(scopedRaw,'cavernaburx-respaldo-completo.json');}
    let local=null;
    try{local=readBackup(localStorage,currentUid);}catch{
      const action=await choose('Respaldo local incompatible','Puedes descargar el original. No se mezclará con la partida de la nube.',[['Cancelar','cancel'],[cloud?'Usar nube':'Crear nueva partida','continue']]);
      if(action==='cancel')throw Error('Recuperación cancelada; el respaldo original permanece intacto.');
      localStorage.setItem(backupKey(currentUid)+'.corrupt-'+Date.now(),scopedRaw);
    }
    const legacyRaw=localStorage.getItem(SAVE_KEY)||localStorage.getItem(LEGACY_KEY);
    // Unclaimed v1/v2 data is never associated with another account silently.
    const claim=localStorage.getItem('cavernaburx.legacy-owner');
    let old=null;
    if(!cloud&&!scopedRaw&&legacyRaw&&(!claim||claim===currentUid)){
      $('migration-export').hidden=false;$('migration-export').onclick=()=>download(legacyRaw,'cavernaburx-original.json');
      try{old=candidate(legacyRaw);}catch{
        const action=await choose('Copia local incompatible','El original se conserva. Descárgalo antes de continuar.',[['Cancelar','cancel'],[cloud?'Usar nube':'Crear nueva partida','continue']]);
        if(action==='cancel')throw Error('Importación cancelada. No se ha modificado ninguna partida.');
      }
    }
    let state=cloud,needsWrite=!cloud,selectedLocal=false;
    const offered=local?.state||old;
    const decision=startupChoice(remote,local);
    // Always protect the old account backup before replacing it with official progress.
    if(scopedRaw)protectCopy(localStorage,currentUid,'startup-local',local?JSON.parse(scopedRaw):{raw:scopedRaw});
    if(decision==='resume'){state=local.state;needsWrite=true;}
    if((!cloud&&offered)||decision==='conflict'){
      if(remote)protectCopy(localStorage,currentUid,'startup-cloud',remote);
      const action=await choose(cloud?'Recuperación de cambios pendientes':'Importación de primera partida',
       `Copia local: revisión ${local?.revision||'sin vincular'}, última confirmación ${local?.confirmedAt||'desconocida'}. ${describeSave(offered)}. ${cloud?'Nube: revisión '+remote.revision+', '+describeSave(cloud):'Esta cuenta no tiene partida oficial.'} Las copias se conservan. No se fusionan recursos. Restaurar la local sustituye el progreso oficial.`,
       [['Cancelar','cancel'],[cloud?'Cargar progreso oficial':'Crear nueva partida','cloud'],['Restaurar copia local (recuperación avanzada)','local']]);
      if(action==='cancel')throw Error('Recuperación cancelada. Las copias se conservan.');
      if(!confirm(action==='local'?'Confirmo que esta copia es mía y deseo restaurarla. Sustituirá la partida oficial mostrada.':'¿Continuar con el progreso oficial? Los cambios locales quedan archivados para recuperación.'))throw Error('Recuperación cancelada.');
      const checked=await rpc('read_player_save');
      if(String(checked?.revision||'0')!==String(remote?.revision||'0'))throw Error('La nube ha cambiado durante la recuperación. Vuelve a comprobarla.');
      if(action==='local'){state=offered;needsWrite=true;selectedLocal=true;}
    }
    if(!state)state=freshState();state.pending=null;state.afk.active=false;
    sync=new CloudSync({uid:currentUid,revision:remote?.revision||'0',state,storage:localStorage,
      read:()=>rpc('read_player_save'),confirmedAt:remote?.updated_at||null,
      write:(doc,revision,uid)=>{if(uid!==currentUid)throw Error('La cuenta ha cambiado.');return rpc('commit_player_save',{p_data:doc,p_revision:revision,p_owner:uid});},
      onStatus:text=>{$('cloud-status').textContent=text;updateSecurity();if(sync?.conflict){document.dispatchEvent(new Event('cloud-conflict'));$('resolve-conflict').hidden=false;}}
    });
    if(needsWrite){sync.queue(state);if(!await sync.flush())throw Error('No se confirmó el guardado. La copia local se conserva; vuelve a entrar para resolverlo.');}
    else {sync.backup();sync.status('Guardado en la nube');}
    if(selectedLocal&&old)localStorage.setItem('cavernaburx.legacy-owner',currentUid);
    const account={uid:currentUid,username,state,sync,recover:async raw=>{try{await recoverFile(raw);}catch(error){status(error.message+' Las copias se conservan. Recarga para continuar.');$('retry-account').hidden=false;throw error;}},save:s=>sync.queue(s)};setAccount(account);
    document.querySelectorAll('[data-player-name]').forEach(el=>el.textContent=username);
    gate.hidden=true;game.hidden=false;
    await import('./app.js');
    $('account-name').textContent=username;updateSecurity();
  }catch(error){hideGame();status(error.message||'No se pudo conectar. No se ha creado ni sobrescrito una partida.');$('retry-account').hidden=false;}
  finally{entering=false;}
}
function updateSecurity(){
 if(!$('security-info')||!sync)return;
 $('security-info').textContent=`Cuenta: ${currentUid} · Revisión: ${sync.revision} · ${sync.statusText} · Pendientes: ${sync.latest?'sí':'no'} · Última confirmación: ${sync.confirmedAt||'desconocida'}`;
}
async function recoverFile(raw){
 const parsed=JSON.parse(raw);
 if(parsed.uid&&parsed.uid!==currentUid)throw Error('La copia pertenece a otra cuenta.');
 const state=parsed.data?decodeCloud(parsed.data):decode(raw);
 // Freeze the running game before reading and presenting snapshots.
 document.dispatchEvent(new Event('cloud-conflict'));sync.stop();if(sync.running)await sync.running;
 const local=localStorage.getItem(backupKey(currentUid));
 if(local)protectCopy(localStorage,currentUid,'before-restore-local',JSON.parse(local));
 protectCopy(localStorage,currentUid,'restore-candidate',{uid:currentUid,data:parsed});
 const remote=await rpc('read_player_save');if(remote){decodeCloud(remote.data);protectCopy(localStorage,currentUid,'before-restore-cloud',remote);}
 $('cloud-export').hidden=!remote;$('cloud-export').onclick=()=>download(JSON.stringify({uid:currentUid,...remote}),'cavernaburx-oficial.json');
 $('migration-export').hidden=false;$('migration-export').onclick=()=>download(raw,'cavernaburx-restaurar.json');
 game.hidden=true;gate.hidden=false;
 const action=await choose('Recuperación avanzada',`Restaurar: ${describeSave(state)}. Nube: revisión ${remote?.revision||'0'}, ${remote?describeSave(decodeCloud(remote.data)):'sin partida'}. Ambas copias están archivadas y puedes descargarlas. Restaurar sustituye la oficial; no suma recursos.`,[['Cancelar y volver','cancel'],['Restaurar esta copia','restore']]);
 if(action!=='restore'||!confirm('Confirmo que la copia es mía y quiero sustituir la partida oficial.')){location.reload();return;}
 const checked=await rpc('read_player_save');
 if(String(checked?.revision||'0')!==String(remote?.revision||'0'))throw Error('La nube ha avanzado. Recarga y revisa las copias; no se ha restaurado.');
 state.afk.active=false;state.pending=null;
 const {encodeCloud}=await import('./cloud-data.js');
 await rpc('commit_player_save',{p_data:encodeCloud(state),p_revision:String(remote?.revision||'0'),p_owner:currentUid});
 // Mark archived local as resolved only after the server confirms the replacement.
 localStorage.setItem(backupKey(currentUid),JSON.stringify({uid:currentUid,revision:String(remote?.revision||'0'),pending:false,data:encodeCloud(state)}));
 location.reload();
}
$('check-sync').onclick=async()=>{if(await sync?.check()&&sync.latest)await sync.flush();updateSecurity();};
$('advanced-recovery').onclick=()=>{
 $('recovery-tools').hidden=!$('recovery-tools').hidden;$('archive-list').replaceChildren();
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i);if(!key.startsWith(backupKey(currentUid)+'.'))continue;
  try{const archive=JSON.parse(localStorage.getItem(key)),value=archive.value||archive;
   if(value?.uid&&value.uid!==currentUid)continue;
   if(!value?.data)continue;decodeCloud(value.data);
   const option=document.createElement('option');option.value=key;option.textContent=`${archive.kind||'Respaldo'} · revisión ${value.revision||'?'} · ${archive.savedAt||'fecha desconocida'}`;$('archive-list').append(option);
  }catch{}
 }
};
$('restore-archive').onclick=async()=>{
 const key=$('archive-list').value;if(!key)return;
 try{const archive=JSON.parse(localStorage.getItem(key));await recoverFile(JSON.stringify({uid:currentUid,...(archive.value||archive)}));}
 catch(error){status(error.message+' Copias protegidas. Recarga para continuar.');$('retry-account').hidden=false;}
};
$('download-account').onclick=()=>{if(sync)download(localStorage.getItem(backupKey(currentUid)),'cavernaburx-cuenta.json');};
$('download-archives').onclick=()=>{const copies=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith(backupKey(currentUid)+'.'))copies.push({key,value:localStorage.getItem(key)});}download(JSON.stringify({uid:currentUid,copies}),'cavernaburx-recuperaciones.json');};
$('username').addEventListener('input',()=>{const valid=validateName($('username').value);$('confirm-name').disabled=!valid;$('name-help').textContent=valid?'Formato válido; la disponibilidad se comprobará al guardar.':'3–20 letras A–Z, números o guion bajo. Sin espacios ni nombres reservados.';});
async function logout(){
  if(sync?.latest){await sync.flush();if(sync.latest&&!confirm('Hay cambios pendientes. Se conservarán en este dispositivo, pero no están confirmados en la nube. ¿Cerrar sesión igualmente?'))return;}
  hideGame();releaseLock?.();const {error}=await client.auth.signOut({scope:'local'});
  if(error){status('No se pudo cerrar la sesión. Reintenta cuando haya conexión.');return;}location.reload();
}
$('logout').onclick=logout;$('gate-logout').onclick=logout;
$('retry-account').onclick=()=>location.reload();
$('resolve-conflict').onclick=()=>{if(confirm('Tu copia local pendiente se conserva. Al volver podrás compararla con la nube. ¿Continuar?'))location.reload();};
$('export-pending').onclick=()=>{if(sync)download(JSON.stringify({uid:currentUid,revision:sync.revision,data:sync.latest||JSON.parse(localStorage.getItem(backupKey(currentUid))).data}),'cavernaburx-respaldo.json');};
async function ranking(){
  const request=++rankingRequest,pageOffset=offset;
  $('ranking-message').textContent='Consultando clasificación…';
  try{
    const [rows,mine]=await Promise.all([rpc('leaderboard_page',{p_offset:pageOffset}),rpc('my_rank')]);
    if(request!==rankingRequest)return;
    $('ranking-body').replaceChildren();
    for(const row of rows){const tr=document.createElement('tr');if(row.is_self)tr.className='self';
      for(const text of [(['1','2','3'].includes(row.position)?['🥇','🥈','🥉'][Number(row.position)-1]+' ':'')+row.position,row.username,new Huge(Number(row.power_log)).format()]){const td=document.createElement('td');td.textContent=text;tr.append(td);}$('ranking-body').append(tr);}
    $('my-rank').textContent=mine?`${mine.position} · ${mine.username} · ${new Huge(Number(mine.power_log)).format()} poder · guardado ${new Date(mine.updated_at).toLocaleString('es-ES')}`:'Tu posición estará disponible tras confirmar el primer guardado.';
    $('ranking-message').textContent=`Puestos ${pageOffset+1}–${pageOffset+rows.length}. Consulta: ${new Date().toLocaleTimeString('es-ES')}. Puntuaciones provisionales, no verificadas.`;
    $('ranking-prev').disabled=offset===0;$('ranking-next').disabled=rows.length<100||offset>=10000;
  }catch{if(request===rankingRequest)$('ranking-message').textContent='No se pudo consultar la clasificación. Reintenta cuando haya conexión.';}
}
$('ranking-refresh').onclick=ranking;$('ranking-prev').onclick=()=>{offset=Math.max(0,offset-100);ranking();};$('ranking-next').onclick=()=>{offset+=100;ranking();};
document.querySelector('[data-tab="ranking"]').addEventListener('click',ranking);
window.addEventListener('online',()=>sync?.latest?sync.flush():sync?.check());
window.addEventListener('focus',()=>sync?.check());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync?.check();});
setInterval(()=>{if(!document.hidden)sync?.check();},30000);
window.addEventListener('beforeunload',e=>{if(sync?.latest){e.preventDefault();e.returnValue='';}});
if(!__SUPABASE_URL__||!__SUPABASE_KEY__){status('Acceso pendiente de configuración de Supabase. Tu partida local permanece intacta. Consulta SUPABASE_SETUP.md.');$('google-login').disabled=true;}
else{
  client=createClient(__SUPABASE_URL__,__SUPABASE_KEY__,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch:(input,init={})=>fetch(input,{...init,signal:init.signal||AbortSignal.timeout(15000)})}});
  client.auth.onAuthStateChange((event,session)=>{if(currentUid&&(!session||session.user.id!==currentUid)){hideGame();currentUid=null;setTimeout(()=>location.reload(),0);}});
  $('google-login').onclick=async()=>{
    $('google-login').disabled=true;status('Abriendo Google…');
    const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/'}});
    if(error){status('No se pudo iniciar sesión: '+error.message);$('google-login').disabled=false;}
  };
  enter();
}
