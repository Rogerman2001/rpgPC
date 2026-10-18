import {createClient} from '@supabase/supabase-js';
import {freshState,decode,SAVE_KEY,LEGACY_KEY} from './save.js';
import {decodeCloud,validateName,describeSave} from './cloud-data.js';
import {CloudSync,readBackup,backupKey} from './cloud-sync.js';
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
    if(remote){$('cloud-export').hidden=false;$('cloud-export').onclick=()=>download(remote.data.payload,'cavernaburx-copia-nube.json');}
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
    if(!scopedRaw&&legacyRaw&&(!claim||claim===currentUid)){
      $('migration-export').hidden=false;$('migration-export').onclick=()=>download(legacyRaw,'cavernaburx-original.json');
      try{old=candidate(legacyRaw);}catch{
        const action=await choose('Copia local incompatible','El original se conserva. Descárgalo antes de continuar.',[['Cancelar','cancel'],[cloud?'Usar nube':'Crear nueva partida','continue']]);
        if(action==='cancel')throw Error('Importación cancelada. No se ha modificado ninguna partida.');
      }
    }
    let state=cloud,needsWrite=!cloud,selectedLocal=false;
    const offered=local?.state||old;
    if(offered&&(!cloud||!local||local.pending||local.revision!==String(remote.revision))){
      $('migration-export').hidden=false;$('migration-export').onclick=()=>download(JSON.stringify(offered,null,2),'cavernaburx-copia-local.json');
      const action=await choose('Elige qué partida conservar',`Copia local: ${describeSave(offered)}. ${cloud?'Nube: '+describeSave(cloud):'Esta cuenta no tiene partida en la nube.'} No se sumarán monedas ni reliquias.`,[['Cancelar','cancel'],['Usar copia local (confirmo que es mía)','local'],[cloud?'Usar nube':'Crear nueva partida','cloud']]);
      if(action==='cancel')throw Error('Elección cancelada. Tus copias siguen intactas.');
      if(action==='local'){if(remote)localStorage.setItem(backupKey(currentUid)+'.cloud-r'+remote.revision,JSON.stringify(remote));state=offered;needsWrite=true;selectedLocal=true;}
      else if(local){localStorage.setItem(backupKey(currentUid)+'.before-choice',JSON.stringify(local));}
    }
    if(!state)state=freshState();state.pending=null;state.afk.active=false;
    sync=new CloudSync({uid:currentUid,revision:remote?.revision||'0',state,storage:localStorage,
      write:(doc,revision,uid)=>{if(uid!==currentUid)throw Error('La cuenta ha cambiado.');return rpc('commit_player_save',{p_data:doc,p_revision:revision,p_owner:uid});},
      onStatus:text=>{$('cloud-status').textContent=text;if(sync?.conflict){document.dispatchEvent(new Event('cloud-conflict'));$('resolve-conflict').hidden=false;}}
    });
    if(needsWrite){sync.queue(state);if(!await sync.flush())throw Error('No se confirmó el guardado. La copia local se conserva; vuelve a entrar para resolverlo.');}
    else sync.backup();
    if(selectedLocal&&old)localStorage.setItem('cavernaburx.legacy-owner',currentUid);
    const account={uid:currentUid,username,state,sync,save:s=>sync.queue(s)};setAccount(account);
    document.querySelectorAll('[data-player-name]').forEach(el=>el.textContent=username);
    gate.hidden=true;game.hidden=false;
    await import('./app.js');
    $('account-name').textContent=username;
  }catch(error){hideGame();status(error.message||'No se pudo conectar. No se ha creado ni sobrescrito una partida.');$('retry-account').hidden=false;}
  finally{entering=false;}
}
$('username').addEventListener('input',()=>{const valid=validateName($('username').value);$('confirm-name').disabled=!valid;$('name-help').textContent=valid?'Formato válido; la disponibilidad se comprobará al guardar.':'3–20 letras A–Z, números o guion bajo. Sin espacios ni nombres reservados.';});
async function logout(){
  if(sync?.latest){await sync.flush();if(sync.latest&&!confirm('Hay cambios pendientes. Se conservarán en este dispositivo, pero no están confirmados en la nube. ¿Cerrar sesión igualmente?'))return;}
  hideGame();releaseLock?.();const {error}=await client.auth.signOut({scope:'local'});
  if(error){status('No se pudo cerrar la sesión. Reintenta cuando haya conexión.');return;}location.reload();
}
$('logout').onclick=logout;$('gate-logout').onclick=logout;
$('retry-account').onclick=()=>location.reload();
$('resolve-conflict').onclick=()=>{if(confirm('Tu copia local pendiente se conserva. Al volver podrás compararla con la nube. ¿Continuar?'))location.reload();};
$('export-pending').onclick=()=>{if(sync)download(JSON.stringify(sync.state,null,2),'cavernaburx-respaldo.json');};
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
window.addEventListener('online',()=>sync?.flush());
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
