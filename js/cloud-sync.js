import {encodeCloud,decodeCloud} from './cloud-data.js';
export const backupKey=uid=>'cavernaburx.account.'+uid;
export function protectCopy(storage,uid,kind,value){
 const key=backupKey(uid)+'.recovery.'+crypto.randomUUID();
 storage.setItem(key,JSON.stringify({uid,kind,savedAt:new Date().toISOString(),value}));return key;
}
export function startupChoice(remote,local){
 if(!remote)return local?'import':'new';
 if(!local?.pending)return 'cloud';
 return String(remote.revision)===local.revision?'resume':'conflict';
}
export class CloudSync {
 constructor({uid,revision='0',state,storage,write,read,onStatus=()=>{},delay=1200,confirmedAt=null}){
  Object.assign(this,{uid,revision:String(revision),state,storage,write,read,onStatus,delay,confirmedAt});
  this.latest=null;this.running=null;this.timer=null;this.active=true;this.conflict=false;this.serial=0;this.retryDelay=5000;this.operationId=crypto.randomUUID();this.statusText='Comprobando sincronización…';
 }
 status(text){this.statusText=text;if(this.active)this.onStatus(text);}
 backup(){this.storage.setItem(backupKey(this.uid),JSON.stringify({format:2,uid:this.uid,revision:this.revision,operationId:this.operationId,pending:!!this.latest,syncState:this.conflict?'conflict':this.latest?'pending':'confirmed',confirmedAt:this.confirmedAt,data:this.latest||encodeCloud(this.state)}));}
 queue(state){
  if(!this.active)throw Error('La sesión ha cambiado.');
  this.state=state;this.latest=encodeCloud(state);this.serial++;this.backup();
  if(this.conflict)return;
  this.status('Cambios pendientes de sincronizar');clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),this.delay);
 }
 async check(){
  if(!this.active||this.conflict)return false;
  if(this.running){await this.running;return !this.conflict;}
  try{return await this.verify();}catch{this.status(this.latest?'Sin conexión · Progreso pendiente de sincronizar':'No se pudo comprobar la conexión');return false;}
 }
 async verify(){
  if(!this.read)return true;
  const baseRevision=this.revision;
  const remote=await this.read();if(!this.active)return false;
  if(this.revision!==baseRevision)return true; // A concurrent local acknowledgement superseded this check.
  if(remote)decodeCloud(remote.data);
  if(String(remote?.revision||'0')!==this.revision){
   // Preserve both snapshots before any replacement. CAS still guards the later write.
   this.conflict=true;
   try{protectCopy(this.storage,this.uid,'local',JSON.parse(this.storage.getItem(backupKey(this.uid))||'null'));protectCopy(this.storage,this.uid,'cloud',remote);this.backup();}
   finally{this.status('Conflicto de sincronización');}
   return false;
  }
  if(!this.latest&&remote){this.confirmedAt=remote.updated_at||this.confirmedAt;this.status('Guardado en la nube');}
  return true;
 }
 flush(){
  clearTimeout(this.timer);if(this.running)return this.running;
  if(!this.active||this.conflict||!this.latest)return Promise.resolve(!this.latest);
  this.running=this.drain().finally(()=>{this.running=null;});return this.running;
 }
 async drain(){
  while(this.active&&this.latest&&!this.conflict){
   const data=this.latest,serial=this.serial,revision=this.revision;this.status('Guardando…');
   try{
    if(!await this.verify()||!this.active)return false;
    const result=await this.write(data,revision,this.uid);if(!this.active)return false;
    this.revision=String(result.revision);this.confirmedAt=new Date().toISOString();this.retryDelay=5000;
    if(serial===this.serial)this.latest=null;
    this.backup();this.status(this.latest?'Cambios pendientes de sincronizar':'Guardado en la nube');
   }catch(error){
    if(!this.active)return false;
    if(error.code==='40001'){
     this.conflict=true;this.backup();this.status('Conflicto de sincronización');
     try{protectCopy(this.storage,this.uid,'conflict-local',JSON.parse(this.storage.getItem(backupKey(this.uid))));if(this.read){const remote=await this.read();if(this.active)protectCopy(this.storage,this.uid,'conflict-cloud',remote);}}catch{/* The pending backup remains; recovery retries the official read. */}
    }
    else{this.status(error.code?'Error de sincronización · Copia local protegida':'Sin conexión · Progreso pendiente de sincronizar');this.timer=setTimeout(()=>this.flush(),this.retryDelay);this.retryDelay=Math.min(60000,this.retryDelay*2);}
    return false;
   }
  }return !this.latest;
 }
 stop(){this.active=false;clearTimeout(this.timer);}
}
export function readBackup(storage,uid){
 const raw=storage.getItem(backupKey(uid));if(!raw)return null;
 const b=JSON.parse(raw);if(b.uid!==uid||!/^\d+$/.test(b.revision)||typeof b.pending!=='boolean'||(b.format!==undefined&&b.format!==2))throw Error('Respaldo local incompatible.');
 return {...b,state:decodeCloud(b.data)};
}
